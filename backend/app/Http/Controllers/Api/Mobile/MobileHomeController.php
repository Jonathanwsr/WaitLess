<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use App\Models\Estabelecimento; 
use App\Models\User;
// Assumindo que você tenha esses models, caso contrário, comente-os e use DB::table
use App\Models\Servico; 
use App\Models\Agendamento; 

class MobileHomeController extends Controller
{
    /**
     * Busca os estabelecimentos próximos (raio em km, fórmula de Haversine
     * calculada em PHP — volume de estabelecimentos ainda é pequeno o
     * suficiente para não justificar a expressão SQL, que variaria entre
     * MySQL/Postgres/SQLite usados em dev, teste e produção).
     */
    /**
     * 👉 ESTABELECIMENTOS PARA A HOME
     *
     * Cascata de 3 níveis, igual ao pedido:
     * 1) Perto de você — por localização, quando disponível.
     * 2) Estabelecimentos de sócios/donos premium — quando não há nada perto.
     * 3) Recomendados — aleatórios entre os ativos, como último recurso.
     *
     * A resposta sempre inclui "origem" para a Home saber qual título mostrar.
     */
    public function getEstabelecimentosProximos(Request $request)
    {
        $radius = (float) $request->input('radius', 15);
        $lat = $request->input('lat');
        $lng = $request->input('lng');
        $user = $request->user();

        if (!$lat || !$lng) {
            $lat = $user?->latitude;
            $lng = $user?->longitude;
        }

        // 1) PERTO DE VOCÊ
        if ($lat && $lng) {
            $proximos = $this->formatarEstabelecimentos(
                Estabelecimento::where('ativo', true)->whereNotNull('latitude')->whereNotNull('longitude')->get(),
                (float) $lat,
                (float) $lng
            )
                ->filter(fn ($est) => $est['distance'] !== null && $est['distance'] <= $radius)
                // Donos premium aparecem primeiro; dentro de cada grupo, do mais perto ao mais longe.
                ->sortBy(fn ($est) => [$est['destaque_premium'] ? 0 : 1, $est['distance']])
                ->values();

            if ($proximos->isNotEmpty()) {
                return response()->json(['origem' => 'proximidade', 'data' => $proximos->take(20)->values()], 200);
            }
        }

        // 2) SÓCIOS/DONOS PREMIUM (sem ninguém perto — dá mais visibilidade a quem paga)
        $idsUsuariosPremium = app(\App\Services\DestaquePremiumService::class)->idsUsuariosPremium();

        if ($idsUsuariosPremium->isNotEmpty()) {
            $estabelecimentosPremium = Estabelecimento::where('ativo', true)
                ->whereHas('proprietarios', fn ($q) => $q->whereIn('users.id', $idsUsuariosPremium))
                ->inRandomOrder()
                ->limit(20)
                ->get();

            if ($estabelecimentosPremium->isNotEmpty()) {
                $formatados = $this->formatarEstabelecimentos($estabelecimentosPremium, $lat, $lng);
                return response()->json(['origem' => 'premium', 'data' => $formatados], 200);
            }
        }

        // 3) RECOMENDADOS (aleatórios, último recurso)
        $recomendados = Estabelecimento::where('ativo', true)->inRandomOrder()->limit(20)->get();
        $formatados = $this->formatarEstabelecimentos($recomendados, $lat, $lng);

        return response()->json(['origem' => 'recomendado', 'data' => $formatados], 200);
    }

    private function formatarEstabelecimentos($estabelecimentos, $lat = null, $lng = null)
    {
        $premiumIds = app(\App\Services\DestaquePremiumService::class)->idsEstabelecimentosPremium();

        $servicos = DB::table('servicos')
            ->where('ativo', true)->whereNull('deleted_at')
            ->selectRaw('estabelecimento_id, MIN(valor) as min_valor, COUNT(*) as total, BOOL_OR(tem_promocao) as promo')
            ->groupBy('estabelecimento_id')->get()->keyBy('estabelecimento_id');

        return $estabelecimentos->map(function (Estabelecimento $est) use ($lat, $lng, $premiumIds, $servicos) {
            $distancia = ($lat && $lng && $est->latitude && $est->longitude)
                ? $this->calcularDistanciaKm((float) $lat, (float) $lng, (float) $est->latitude, (float) $est->longitude)
                : null;

            $filaAtual = $est->agendamentos()
                ->whereDate('data_agendamento', now()->toDateString())
                ->whereIn('status', ['pendente', 'confirmado'])
                ->count();

            $resumo = $servicos->get($est->id);

            return [
                'id' => $est->id,
                'nome' => $est->nome,
                'tipo' => $est->ramo_atuacao,
                'foto_perfil' => $est->foto_perfil ?: $est->foto_banner,
                'avaliacao_media' => (float) $est->avaliacao_media,
                'total_avaliacoes' => $est->total_avaliacoes,
                'cidade' => $est->cidade,
                'estado' => $est->estado,
                'distance' => $distancia !== null ? round($distancia, 1) : null,
                'fila_atual' => $filaAtual,
                'valor_desde' => $resumo ? (float) $resumo->min_valor : null,
                'total_servicos' => $resumo ? (int) $resumo->total : 0,
                'tem_promocao' => $resumo ? (bool) $resumo->promo : false,
                'destaque_premium' => $premiumIds->contains($est->id),
            ];
        });
    }

    private function calcularDistanciaKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $raioTerraKm = 6371;

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $raioTerraKm * (2 * atan2(sqrt($a), sqrt(1 - $a)));
    }

    /**
     * Avaliações que o próprio cliente já publicou (tela "Meus comentários").
     */
    public function minhasAvaliacoes(Request $request)
    {
        $avaliacoes = DB::table('avaliacoes')
            ->leftJoin('estabelecimentos', 'avaliacoes.estabelecimento_id', '=', 'estabelecimentos.id')
            ->leftJoin('agendamentos', 'avaliacoes.agendamento_id', '=', 'agendamentos.id')
            ->leftJoin('servicos', 'agendamentos.servico_id', '=', 'servicos.id')
            ->where('avaliacoes.usuario_id', $request->user()->id)
            ->orderByDesc('avaliacoes.created_at')
            ->select(
                'avaliacoes.id',
                'avaliacoes.nota',
                'avaliacoes.comentario',
                'avaliacoes.fotos',
                'avaliacoes.publica',
                'avaliacoes.resposta_anfitriao',
                'avaliacoes.data_resposta',
                'avaliacoes.created_at',
                'estabelecimentos.nome as local_nome',
                'estabelecimentos.ramo_atuacao',
                'estabelecimentos.foto_perfil as local_foto',
                'servicos.nome as servico_nome'
            )
            ->get()
            ->map(function ($a) {
                $fotos = is_string($a->fotos) ? json_decode($a->fotos, true) : [];
                return [
                    'id' => $a->id,
                    'nota' => (float) $a->nota,
                    'comentario' => $a->comentario,
                    'local_nome' => $a->local_nome,
                    'ramo_atuacao' => $a->ramo_atuacao,
                    'local_foto' => $a->local_foto,
                    'servico_nome' => $a->servico_nome,
                    'total_fotos' => is_array($fotos) ? count($fotos) : 0,
                    'publica' => (bool) $a->publica,
                    'resposta' => $a->resposta_anfitriao,
                    'data_resposta' => $a->data_resposta,
                    'created_at' => $a->created_at,
                ];
            });

        return response()->json(['data' => $avaliacoes]);
    }

    /**
     * Atualiza o endereço do usuário autenticado e salva no banco.
     */
    public function updateAddress(Request $request)
    {
        $request->validate([
            'logradouro' => 'required|string|min:5|max:255',
            'numero' => 'required|string|max:20',
            'bairro' => 'nullable|string|max:100',
            'cidadeUf' => 'required|string|max:100',
        ]);

        $user = $request->user();

        if ($user) {
            $user->update([
                'endereco_logradouro' => $request->logradouro,
                'endereco_numero' => $request->numero,
                'endereco_bairro' => $request->bairro,
                'endereco_cidade_uf' => $request->cidadeUf,
            ]);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Endereço salvo com sucesso.'
        ], 200);
    }

    /**
     * Busca o saldo e o histórico de pontos do usuário logado.
     */
    public function getHistoricoPontos(Request $request)
    {
        $user = $request->user();

        // 1. Busca o saldo total e nível do usuário por estabelecimento
        $saldos = DB::table('pontos_usuario_estabelecimento')
            ->join('estabelecimentos', 'pontos_usuario_estabelecimento.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('pontos_usuario_estabelecimento.usuario_id', $user->id)
            ->select(
                'pontos_usuario_estabelecimento.id',
                'pontos_usuario_estabelecimento.total_pontos',
                'pontos_usuario_estabelecimento.nivel',
                'estabelecimentos.nome as estabelecimento_nome',
                'estabelecimentos.id as estabelecimento_id'
            )
            ->get();

        // 2. Busca o histórico detalhado de ganhos e usos de pontos.
        // LEFT JOIN (não INNER JOIN): entradas globais — bônus de cadastro,
        // pontos de promoção de admin, renovação de plano — têm
        // estabelecimento_id nulo e desapareciam do extrato com INNER JOIN.
        $historico = DB::table('historico_pontos')
            ->leftJoin('estabelecimentos', 'historico_pontos.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('historico_pontos.usuario_id', $user->id)
            ->select(
                'historico_pontos.id',
                'historico_pontos.tipo',
                'historico_pontos.descricao',
                'historico_pontos.quantidade',
                'historico_pontos.created_at',
                'estabelecimentos.nome as estabelecimento_nome'
            )
            ->orderBy('historico_pontos.created_at', 'desc')
            ->get();

        // Nível pelo total já ganho (usar pontos em descontos não rebaixa o cliente).
        $pontosGanhos = (int) DB::table('historico_pontos')->where('usuario_id', $user->id)->where('tipo', 'ganho')->sum('quantidade');

        return response()->json([
            'status' => 'success',
            'pontos_saldo' => $user->pontos_saldo,
            'nivel' => \App\Support\NiveisFidelidade::para($pontosGanhos),
            'saldos' => $saldos,
            'historico' => $historico
        ], 200);
    }

    /**
     * Busca os serviços/imóveis disponíveis
     * (Com base nos casts enviados: valor_diaria, possui_wifi, etc)
     */
    public function getServicos(Request $request)
    {
        // Se você tiver um Model "Servico", "Imovel" ou "Espaco"
        // Certifique-se de que o array de casts que você enviou está no Model correspondente.
        
        $servicos = Servico::where('ativo', true)
            ->where('disponivel', true)
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $servicos
        ], 200);
    }

    /**
     * Busca as reservas/agendamentos do usuário logado
     */
    public function getReservas(Request $request)
    {
        $user = $request->user();

        // Busca os agendamentos do usuário. 
        // Adapte as relações (com 'servico' ou 'estabelecimento') conforme o seu banco.
        $reservas = Agendamento::where('usuario_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $reservas
        ], 200);
    }
}
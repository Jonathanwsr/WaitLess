<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Carrinho;
use App\Models\Favorito;
use App\Models\Funcionario;
use App\Models\Servico;
use App\Services\Servico\DetalheServicoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

/**
 * Página de detalhes de um serviço (web): galeria, descrição, profissionais, dias e horários (com os
 * lotados), avaliações, desconto com pontos, favoritos e carrinho. O pagamento acontece no checkout
 * (cliente.agendar), que já abre com o serviço, o dia, o horário e os pontos escolhidos aqui.
 * As regras ficam no DetalheServicoService, compartilhado com o app.
 */
class ServicoDetalheController extends Controller
{
    public function show(Request $request, Servico $servico, DetalheServicoService $detalhe)
    {
        abort_unless($servico->ativo, 404, 'Este serviço não está disponível.');
        $local = $servico->estabelecimento()->first(['id', 'nome', 'foto_perfil', 'ramo_atuacao', 'bairro', 'cidade', 'estado', 'avaliacao_media', 'total_avaliacoes', 'telefone']);
        abort_unless($local, 404);
        $user = $request->user();

        $valor = (float) $servico->valor;
        $comPromocao = $detalhe->comPromocao($valor, $servico);
        $config = $detalhe->json($servico->configuracoes);
        // Sócio sem carteira Asaas: o cliente só pode pagar no local.
        $aceitaOnline = app(\App\Services\PagamentoService::class)->estabelecimentoTemCarteiraAsaas($local->id);

        return Inertia::render('Cliente/ServicoDetalhe', [
            'servico' => [
                'id' => $servico->id,
                'nome' => $servico->nome,
                'descricao' => $servico->descricao,
                'tipo_servico' => $servico->tipo_servico,
                'valor' => round($valor, 2),
                'valor_com_promocao' => round($comPromocao, 2),
                'tem_promocao' => $comPromocao < $valor,
                'duracao_minutos' => (int) $servico->duracao_minutos,
                'fotos' => array_values(array_filter($detalhe->json($servico->fotos), 'is_string')),
                'avaliacao_media' => (float) $servico->avaliacao_media,
                'total_avaliacoes' => (int) $servico->total_avaliacoes,
                'aceita_pontos' => (bool) $servico->aceita_pontos,
                'maximo_pontos_permitidos' => $servico->maximo_pontos_permitidos ? (int) $servico->maximo_pontos_permitidos : null,
                'somente_premium' => (bool) $servico->somente_premium,
                'vagas_por_horario' => $detalhe->capacidade($servico),
                'tipo_pagamento' => app(\App\Services\PagamentoService::class)->tipoPagamentoEfetivo($config['tipo_pagamento'] ?? null, $aceitaOnline),
                'aceita_pagamento_online' => $aceitaOnline,
                'dias_disponiveis' => array_values($config['dias_disponiveis'] ?? []),
                'horarios' => $detalhe->listaDeHorarios($servico->horarios_disponiveis),
                // Sem horários fixos: o cliente combina com o dono (chat ou telefone).
                'horario_a_combinar' => $servico->horarioACombinar(),
                // Onde atende, 24h, taxa de deslocamento, tipo de preço, o que inclui...
                'atendimento' => $servico->atendimento,
            ],
            'estabelecimento' => $local,
            'profissionais' => Funcionario::where('estabelecimento_id', $local->id)->where('ativo', true)->orderBy('nome')->limit(8)->get(['id', 'nome', 'cargo']),
            'outrosServicos' => $detalhe->outros($servico, (int) $local->id),
            'ocupados' => $detalhe->horariosOcupados($servico),
            'avaliacoes' => $detalhe->avaliacoes($servico, (int) $local->id),
            'favorito' => $user ? Favorito::where('usuario_id', $user->id)->where('servico_id', $servico->id)->exists() : false,
            'noCarrinho' => $user ? Carrinho::where('user_id', $user->id)->where('servico_id', $servico->id)->exists() : false,
            'pontosPorReal' => \App\Services\PontosService::PONTOS_POR_REAL,
            // Dono do local: destino do botão "conversar".
            'donoId' => DB::table('estabelecimento_usuario')->where('estabelecimento_id', $local->id)
                ->whereIn('tipo', ['socio', 'proprietario'])->value('usuario_id'),
        ]);
    }

    /** Confere na hora se o horário escolhido ainda tem vaga; sem vaga, sugere os próximos livres. */
    public function disponibilidade(Request $request, Servico $servico, DetalheServicoService $detalhe): JsonResponse
    {
        $dados = $request->validate([
            'data' => 'required|date_format:Y-m-d',
            'hora' => 'required|date_format:H:i',
        ]);

        return response()->json($detalhe->disponibilidade($servico, $dados['data'], $dados['hora']));
    }
}

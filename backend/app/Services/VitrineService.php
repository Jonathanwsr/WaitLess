<?php

namespace App\Services;

use App\Models\Cupom;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Produto;
use App\Models\Servico;
use App\Models\User;
use App\Services\Agendamento\VagasServicoService;
use App\Services\Locacao\DisponibilidadeService;
use Illuminate\Support\Facades\DB;

/**
 * A vitrine de um local do jeito que o CLIENTE vê: serviços, reservas (locações do dono),
 * produtos, cupons e reputação — só o que está ativo e visível. Usada pelo painel do sócio
 * no site e no app, para ele conferir como sua vitrine aparece.
 */
class VitrineService
{
    public function locaisDoDono(User $dono)
    {
        return Estabelecimento::whereIn('id', DB::table('estabelecimento_usuario')->where('usuario_id', $dono->id)->pluck('estabelecimento_id'))
            ->orderBy('nome')
            ->get(['id', 'nome']);
    }

    public function montar(User $dono, ?int $estabelecimentoId = null): ?array
    {
        $locais = $this->locaisDoDono($dono);
        $local = $estabelecimentoId ? $locais->firstWhere('id', $estabelecimentoId) : $locais->first();
        if (!$local) {
            return null;
        }

        $estab = Estabelecimento::findOrFail($local->id);
        $vagas = app(VagasServicoService::class);
        $disponibilidade = app(DisponibilidadeService::class);

        $primeiraFoto = function ($fotos) {
            $lista = is_string($fotos) ? (json_decode($fotos, true) ?? []) : ($fotos ?? []);
            return is_array($lista) ? ($lista[0] ?? null) : null;
        };
        $precoFinal = function ($valor, $promo, $tipo, $desconto) {
            $valor = (float) $valor;
            if (!$promo || (float) $desconto <= 0) return round($valor, 2);
            return round($tipo === 'percentual' ? $valor - ($valor * (float) $desconto / 100) : max(0, $valor - (float) $desconto), 2);
        };

        $servicos = Servico::where('estabelecimento_id', $estab->id)->where('ativo', true)->orderBy('nome')->get()
            ->map(function ($s) use ($vagas, $primeiraFoto, $precoFinal) {
                $resumo = $vagas->resumoHoje($s);
                return [
                    'id' => $s->id,
                    'nome' => $s->nome,
                    'valor' => (float) $s->valor,
                    'preco_final' => $precoFinal($s->valor, $s->tem_promocao, $s->tipo_desconto, $s->valor_desconto),
                    'em_promocao' => (bool) $s->tem_promocao && (float) $s->valor_desconto > 0,
                    'duracao_minutos' => $s->duracao_minutos,
                    'foto' => $primeiraFoto($s->fotos),
                    'avaliacao_media' => $s->avaliacao_media ? (float) $s->avaliacao_media : null,
                    'total_avaliacoes' => (int) $s->total_avaliacoes,
                    'somente_premium' => (bool) $s->somente_premium,
                    'vagas_status' => $resumo['status'],
                    'vagas_restantes' => $resumo['restantes'],
                ];
            })->values();

        $reservas = ItemAluguel::catalogo()->where('estabelecimento_id', $dono->id)->where('ativo', true)->orderBy('nome')->get()
            ->map(function ($i) use ($disponibilidade, $primeiraFoto, $precoFinal) {
                $resumo = $disponibilidade->resumoHoje($i);
                return [
                    'id' => $i->id,
                    'nome' => $i->nome,
                    'categoria' => $i->categoria,
                    'valor_diaria' => (float) $i->valor_diaria,
                    'preco_final' => $precoFinal($i->valor_diaria, $i->tem_promocao, $i->tipo_desconto, $i->valor_desconto),
                    'em_promocao' => (bool) $i->tem_promocao && (float) $i->valor_desconto > 0,
                    'foto' => $primeiraFoto($i->fotos),
                    'cidade' => $i->cidade,
                    'estado' => $i->estado,
                    'capacidade_pessoas' => $i->capacidade_pessoas,
                    'somente_premium' => (bool) $i->somente_premium,
                    'vagas_status' => $resumo['status'],
                    'vagas_restantes' => $resumo['restantes'],
                ];
            })->values();

        $produtos = Produto::where('estabelecimento_id', $estab->id)->where('estoque_disponivel', '>', 0)->where('atrelado_reservas', true)
            ->orderBy('nome')->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'nome' => $p->nome,
                'valor_final' => (float) $p->valor_final,
                'em_promocao' => (bool) $p->is_promocao,
                'somente_premium' => (bool) $p->somente_premium,
                'foto' => is_array($p->fotos) ? ($p->fotos[0] ?? null) : null,
            ])->values();

        $cupons = Cupom::with(['servico:id,nome', 'itemAluguel:id,nome'])
            ->where('estabelecimento_id', $estab->id)->where('ativo', true)
            ->where(fn ($q) => $q->whereNull('data_validade')->orWhere('data_validade', '>', now()))
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'titulo' => $c->titulo,
                'codigo' => $c->codigo,
                'tipo_desconto' => $c->tipo_desconto,
                'valor_desconto' => (float) $c->valor_desconto,
                'pontos_custo' => (int) $c->pontos_custo,
                'apenas_plus' => (bool) $c->apenas_plus,
                'escopo' => $c->escopo,
                'alvo' => $c->servico?->nome ?? $c->itemAluguel?->nome,
            ])->values();

        return [
            'locais' => $locais,
            'estabelecimento' => [
                'id' => $estab->id,
                'nome' => $estab->nome,
                'foto_perfil' => $estab->foto_perfil,
                'foto_banner' => $estab->foto_banner,
                'ramo_atuacao' => $estab->ramo_atuacao,
                'bairro' => $estab->bairro,
                'cidade' => $estab->cidade,
                'estado' => $estab->estado,
                'avaliacao_media' => $estab->avaliacao_media ? (float) $estab->avaliacao_media : null,
                'total_avaliacoes' => (int) $estab->total_avaliacoes,
            ],
            'servicos' => $servicos,
            'reservas' => $reservas,
            'produtos' => $produtos,
            'cupons' => $cupons,
            'avaliacoes' => app(ReputacaoAnfitriaoService::class)->resumo($estab->id)['avaliacoes'],
        ];
    }
}

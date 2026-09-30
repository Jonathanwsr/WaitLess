<?php

namespace App\Services\Locacao;

use App\Models\ItemAluguel;
use App\Models\User;
use App\Services\CupomService;
use App\Services\PontosService;
use Carbon\Carbon;

/**
 * Fonte única do preço de uma reserva de item/locação (diárias, pessoas, acessórios,
 * promoção, pontos e cupom). Usada tanto na criação da reserva quanto na cotação
 * mostrada ao cliente antes de pagar (parcelamento no cartão), para que os dois
 * nunca divirjam. Não grava nada — só calcula e recusa (422) pedidos inválidos.
 */
class CotacaoAluguelService
{
    public function cotar(ItemAluguel $item, User $user, array $validated, CupomService $cupomService): array
    {
        $dataInicio = Carbon::parse($validated['data_inicio']);
        $dataFim = Carbon::parse($validated['data_fim']);
        $totalDias = $dataInicio->diffInDays($dataFim);
        if ($totalDias === 0) $totalDias = 1;

        // Quantas unidades idênticas deste item (ex.: 2 bicicletas iguais) e quantas pessoas vão.
        $unidades = max(1, (int) ($validated['quantidade'] ?? 1));
        $validated['quantidade'] = $unidades;
        $pessoas = max(1, (int) ($validated['pessoas'] ?? 1));
        $capacidadePessoas = max(1, (int) ($item->capacidade_pessoas ?: $item->lugares ?: $pessoas));
        if ($pessoas > $capacidadePessoas) {
            abort(422, "Este local comporta no máximo {$capacidadePessoas} pessoa(s).");
        }

        // Bloqueia data já reservada (soma das unidades ocupadas) e as regras de disponibilidade do dono.
        try {
            app(DisponibilidadeService::class)->verificar($item, $dataInicio, $dataFim, $unidades);
        } catch (\Illuminate\Validation\ValidationException $e) {
            abort(422, collect($e->errors())->collapse()->first() ?? 'Este item não está disponível para o período escolhido.');
        }

        $valorBasePorCiclo = match($item->periodo_faturamento_padrao) {
            'diaria'  => $item->valor_diaria ?? 0,
            'semanal' => $item->valor_semanal ?? 0,
            'mensal'  => $item->valor_mensal ?? 0,
            default   => $item->valor_diaria ?? 0
        };

        $multiplicador = 1;
        if ($item->periodo_faturamento_padrao === 'diaria') {
            $multiplicador = $totalDias;
        } elseif ($item->periodo_faturamento_padrao === 'semanal') {
            $multiplicador = max(1, ceil($totalDias / 7));
        } elseif ($item->periodo_faturamento_padrao === 'mensal') {
            $multiplicador = max(1, ceil($totalDias / 30));
        }

        // Preço por pessoa (ver App\Services\PrecificacaoService::item para a mesma regra usada na prévia do app):
        // "pacote" só cobra quem passa da franquia incluída; "por_pessoa" multiplica o valor cheio pelas pessoas.
        if (($item->modelo_precificacao ?? 'pacote') === 'por_pessoa') {
            $valorBasePorCiclo = $valorBasePorCiclo * $pessoas;
        } else {
            $incluidas = max(1, (int) ($item->pessoas_incluidas ?: $capacidadePessoas));
            $pessoasExtras = max(0, $pessoas - $incluidas);
            $valorBasePorCiclo += $pessoasExtras * (float) ($item->valor_pessoa_extra ?? 0);
        }

        $valorBrutoItens = ($valorBasePorCiclo * $multiplicador) * $unidades;

        $valorExtras = 0;
        $acessoriosDisponiveis = is_array($item->acessorios) ? $item->acessorios : (json_decode((string) $item->acessorios, true) ?? []);
        $acessoriosFinaisParaSalvar = [];

        if (!empty($validated['acessorios_selecionados'])) {
            foreach ($validated['acessorios_selecionados'] as $nomeExtra) {
                foreach ($acessoriosDisponiveis as $disponivel) {
                    if ($disponivel['nome'] === $nomeExtra) {
                        $precoExtra = floatval($disponivel['valor']);
                        $valorExtras += ($precoExtra * $multiplicador) * $validated['quantidade'];
                        $acessoriosFinaisParaSalvar[] = $disponivel;
                    }
                }
            }
        }

        $precoSubtotal = $valorBrutoItens + $valorExtras;

        $descontoPromocao = 0;
        if ($item->tem_promocao && $item->valor_desconto > 0) {
            if ($item->tipo_desconto === 'percentual') {
                $descontoPromocao = $precoSubtotal * ($item->valor_desconto / 100);
            } else {
                $descontoPromocao = $item->valor_desconto * $validated['quantidade'];
            }
        }

        $descontoPontos = 0;
        $pontosParaAbater = 0;
        if ($item->aceita_pontos && !empty($validated['pontos_utilizados'])) {
            $maximoPermitidoItem = $item->maximo_pontos_permitidos ?? 0;
            $pontosParaAbater = min(intval($validated['pontos_utilizados']), $maximoPermitidoItem);

            if ($user->pontos_saldo < $pontosParaAbater) {
                abort(422, 'Saldo de pontos insuficiente.');
            }
            $descontoPontos = PontosService::pontosParaValor($pontosParaAbater);
        }

        $cupomAplicado = null;
        $descontoCupom = 0;
        if (!empty($validated['cupom_codigo'])) {
            $subtotalAntesDoCupom = max(0, $precoSubtotal - $descontoPromocao - $descontoPontos);
            try {
                $cupomAplicado = $cupomService->buscarValidoParaUsuario($validated['cupom_codigo'], $user, $item->estabelecimento_id, null, $item->id);
            } catch (\Illuminate\Validation\ValidationException $e) {
                abort(422, collect($e->errors())->collapse()->first() ?? 'Cupom inválido.');
            }
            $descontoCupom = $cupomService->calcularDesconto($cupomAplicado, $subtotalAntesDoCupom);
        }

        $precoFinalCliente = max(0, $precoSubtotal - $descontoPromocao - $descontoPontos - $descontoCupom);
        $totalComCaucao = $precoFinalCliente + ($item->valor_caucao ?? 0);

        return [
            'validated' => $validated,
            'unidades' => $unidades,
            'pessoas' => $pessoas,
            'multiplicador' => $multiplicador,
            'valorBasePorCiclo' => $valorBasePorCiclo,
            'valorExtras' => $valorExtras,
            'precoSubtotal' => $precoSubtotal,
            'descontoPromocao' => $descontoPromocao,
            'descontoPontos' => $descontoPontos,
            'pontosParaAbater' => $pontosParaAbater,
            'cupomAplicado' => $cupomAplicado,
            'descontoCupom' => $descontoCupom,
            'precoFinalCliente' => $precoFinalCliente,
            'totalComCaucao' => $totalComCaucao,
            'acessoriosFinaisParaSalvar' => $acessoriosFinaisParaSalvar,
        ];
    }
}

<?php

namespace App\Services\Viagem;

use App\Models\User;
use App\Models\Viagem;
use App\Models\ViagemDespesa;
use App\Models\ViagemDespesaParte;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Divisão de gastos do grupo. Todo cálculo é feito em centavos (inteiros)
 * para nunca sobrar nem faltar um centavo entre os participantes.
 */
class DivisaoGastosService
{
    /** IDs de quem participa das contas da viagem (criador + membros que não recusaram). */
    public function participantes(Viagem $viagem): array
    {
        return $viagem->membros()->wherePivot('presenca', '!=', 'recusado')->pluck('users.id')
            ->push($viagem->criador_id)->unique()->sort()->values()->map(fn ($i) => (int) $i)->all();
    }

    /**
     * @param array{descricao:string, valor:float|int|string, pagador_id:int, data_despesa?:string, categoria?:?string,
     *              viagem_item_id?:?int, participantes?:array<int>, partes?:array<int|string,float|int|string>} $dados
     */
    public function registrar(Viagem $viagem, User $autor, array $dados): ViagemDespesa
    {
        $elegiveis = $this->participantes($viagem);
        $total = $this->centavos($dados['valor']);
        if ($total <= 0) {
            throw new InvalidArgumentException('Informe um valor maior que zero.');
        }

        $pagador = (int) $dados['pagador_id'];
        if (!in_array($pagador, $elegiveis, true)) {
            throw new InvalidArgumentException('Quem pagou precisa ser participante da viagem.');
        }

        // Divisão personalizada (valor por pessoa) ou igual entre os participantes escolhidos.
        if (!empty($dados['partes'])) {
            $partes = [];
            foreach ($dados['partes'] as $uid => $valor) {
                $partes[(int) $uid] = $this->centavos($valor);
            }
            $partes = array_filter($partes, fn ($c) => $c > 0);
            if (array_diff(array_keys($partes), $elegiveis)) {
                throw new InvalidArgumentException('Só participantes da viagem podem dividir a conta.');
            }
            if (array_sum($partes) !== $total) {
                $falta = ($total - array_sum($partes)) / 100;
                throw new InvalidArgumentException('A soma das partes não fecha com o valor total (diferença de R$ ' . number_format(abs($falta), 2, ',', '.') . ').');
            }
        } else {
            $ids = collect($dados['participantes'] ?? $elegiveis)->map(fn ($i) => (int) $i)->unique()->sort()->values()->all();
            if (!$ids || array_diff($ids, $elegiveis)) {
                throw new InvalidArgumentException('Escolha ao menos um participante da viagem para dividir a conta.');
            }
            $partes = $this->dividirIgual($total, $ids);
        }

        return DB::transaction(function () use ($viagem, $autor, $dados, $total, $pagador, $partes) {
            $despesa = ViagemDespesa::create([
                'viagem_id' => $viagem->id,
                'viagem_item_id' => $dados['viagem_item_id'] ?? null,
                'pagador_id' => $pagador,
                'descricao' => $dados['descricao'],
                'valor' => $total / 100,
                'data_despesa' => $dados['data_despesa'] ?? now()->toDateString(),
                'categoria' => $dados['categoria'] ?? null,
                'criado_por_id' => $autor->id,
            ]);

            foreach ($partes as $uid => $centavos) {
                ViagemDespesaParte::create(['viagem_despesa_id' => $despesa->id, 'usuario_id' => $uid, 'valor' => $centavos / 100]);
            }

            return $despesa->load('partes');
        });
    }

    /** @return array<int,int> usuario_id => centavos; o resto da divisão vai, 1 centavo por vez, para os primeiros. */
    public function dividirIgual(int $totalCentavos, array $ids): array
    {
        $n = count($ids);
        $base = intdiv($totalCentavos, $n);
        $resto = $totalCentavos % $n;

        $partes = [];
        foreach ($ids as $i => $uid) {
            $partes[$uid] = $base + ($i < $resto ? 1 : 0);
        }

        return $partes;
    }

    /**
     * Saldo de cada pessoa: positivo = tem a receber, negativo = deve.
     * Pagamentos de acerto entram: quem pagou "de" tem o saldo aumentado, quem recebeu "para" diminuído.
     *
     * @return array{saldos: array<int,int>, pago: array<int,int>, devido: array<int,int>}
     */
    public function saldos(Viagem $viagem): array
    {
        $pago = [];
        $devido = [];
        $saldos = [];

        foreach ($this->participantes($viagem) as $uid) {
            $pago[$uid] = $devido[$uid] = $saldos[$uid] = 0;
        }

        foreach ($viagem->despesas()->with('partes')->get() as $d) {
            $c = $this->centavos($d->valor);
            $pago[$d->pagador_id] = ($pago[$d->pagador_id] ?? 0) + $c;
            $saldos[$d->pagador_id] = ($saldos[$d->pagador_id] ?? 0) + $c;
            foreach ($d->partes as $p) {
                $pc = $this->centavos($p->valor);
                $devido[$p->usuario_id] = ($devido[$p->usuario_id] ?? 0) + $pc;
                $saldos[$p->usuario_id] = ($saldos[$p->usuario_id] ?? 0) - $pc;
            }
        }

        foreach ($viagem->pagamentos as $pg) {
            $c = $this->centavos($pg->valor);
            $saldos[$pg->de_id] = ($saldos[$pg->de_id] ?? 0) + $c;
            $saldos[$pg->para_id] = ($saldos[$pg->para_id] ?? 0) - $c;
        }

        return compact('saldos', 'pago', 'devido');
    }

    /**
     * Menor número de transferências para zerar todo mundo: sempre o maior devedor paga ao maior credor.
     *
     * @return array<int,array{de:int,para:int,valor:float}>
     */
    public function acertos(array $saldos): array
    {
        $devedores = collect($saldos)->filter(fn ($v) => $v < 0)->map(fn ($v) => -$v)->sortDesc()->all();
        $credores = collect($saldos)->filter(fn ($v) => $v > 0)->sortDesc()->all();

        $acertos = [];
        while ($devedores && $credores) {
            $d = array_key_first($devedores);
            $c = array_key_first($credores);
            $valor = min($devedores[$d], $credores[$c]);

            $acertos[] = ['de' => $d, 'para' => $c, 'valor' => $valor / 100];

            $devedores[$d] -= $valor;
            $credores[$c] -= $valor;
            if ($devedores[$d] === 0) {
                unset($devedores[$d]);
            }
            if ($credores[$c] === 0) {
                unset($credores[$c]);
            }
            arsort($devedores);
            arsort($credores);
        }

        return $acertos;
    }

    private function centavos(mixed $valor): int
    {
        return (int) round(((float) $valor) * 100);
    }
}

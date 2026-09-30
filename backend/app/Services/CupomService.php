<?php

namespace App\Services;

use App\Models\Cupom;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Aplicação de cupons (App\Models\Cupom) no checkout de uma reserva/aluguel.
 * Até aqui existia apenas o resgate (ClienteCupomController::resgatar, que
 * debita pontos e guarda o cupom no "inventário" do usuário via cupom_user)
 * — nenhum lugar do sistema realmente CONSUMIA um cupom resgatado contra
 * uma compra real, nem verificava se quem está usando o código de fato o
 * possui. Este serviço é a única fonte de verdade pra validar e consumir um
 * cupom, reaproveitado tanto pelas reservas via Explorar quanto pelo
 * checkout de sacola de produtos que já aceitava (de forma insegura) um
 * cupom_id cru.
 */
class CupomService
{
    /**
     * Busca um cupom pelo código já validando: existe, está ativo, dentro
     * da validade, é do estabelecimento certo, o usuário realmente o
     * resgatou (está no "cupom_user" dele) e ainda não usou.
     */
    public function buscarValidoParaUsuario(string $codigo, User $user, ?int $estabelecimentoId = null, ?int $servicoId = null, ?int $itemAluguelId = null): Cupom
    {
        $cupom = Cupom::where('codigo', $codigo)->first();

        if (!$cupom) {
            throw ValidationException::withMessages(['cupom_codigo' => 'Cupom não encontrado.']);
        }
        if (!$cupom->ativo) {
            throw ValidationException::withMessages(['cupom_codigo' => 'Este cupom não está mais ativo.']);
        }
        if ($cupom->data_validade && $cupom->data_validade->isPast()) {
            throw ValidationException::withMessages(['cupom_codigo' => 'Este cupom expirou.']);
        }
        if ($estabelecimentoId && $cupom->estabelecimento_id && (int) $cupom->estabelecimento_id !== (int) $estabelecimentoId) {
            throw ValidationException::withMessages(['cupom_codigo' => 'Este cupom não é válido para este estabelecimento.']);
        }
        if ($cupom->servico_id && (int) $cupom->servico_id !== (int) $servicoId) {
            $nome = $cupom->servico?->nome;
            throw ValidationException::withMessages(['cupom_codigo' => 'Este cupom vale apenas para ' . ($nome ? "o serviço \"{$nome}\"." : 'um serviço específico.')]);
        }
        if ($cupom->item_aluguel_id && (int) $cupom->item_aluguel_id !== (int) $itemAluguelId) {
            $nome = $cupom->itemAluguel?->nome;
            throw ValidationException::withMessages(['cupom_codigo' => 'Este cupom vale apenas para ' . ($nome ? "a reserva \"{$nome}\"." : 'uma reserva específica.')]);
        }
        if ($cupom->apenas_plus && !$user->isPremium()) {
            throw ValidationException::withMessages(['cupom_codigo' => 'Este cupom é exclusivo para assinantes premium.']);
        }
        if ($mensagem = $this->motivoDeInelegibilidade($cupom, $user)) {
            throw ValidationException::withMessages(['cupom_codigo' => $mensagem]);
        }

        $pivot = DB::table('cupom_user')
            ->where('user_id', $user->id)
            ->where('cupom_id', $cupom->id)
            ->first();

        if (!$pivot) {
            throw ValidationException::withMessages(['cupom_codigo' => 'Você ainda não resgatou este cupom com seus pontos.']);
        }
        if ($pivot->usado) {
            throw ValidationException::withMessages(['cupom_codigo' => 'Você já utilizou este cupom.']);
        }

        return $cupom;
    }

    /** O cliente ainda não reservou (nem tem reserva em andamento) neste estabelecimento? */
    public function ehClienteNovoNoLocal(User $user, ?int $estabelecimentoId): bool
    {
        if (!$estabelecimentoId) {
            return false;
        }

        return !\App\Models\Agendamento::where('usuario_id', $user->id)
            ->where('estabelecimento_id', $estabelecimentoId)
            ->whereNotIn('status', ['cancelado', 'recusado'])
            ->exists();
    }

    /** Mensagem quando o cupom não vale para este usuário (ex.: "primeira reserva" para quem já reservou); null se vale. */
    public function motivoDeInelegibilidade(Cupom $cupom, User $user): ?string
    {
        if ($cupom->somente_novos_clientes && !$this->ehClienteNovoNoLocal($user, $cupom->estabelecimento_id)) {
            return 'Este cupom vale apenas para a primeira reserva neste local.';
        }

        return null;
    }

    /**
     * Cupons ativos que servem para este serviço/reserva/local, para recomendar ao cliente na
     * hora de reservar. Os específicos (de um serviço ou reserva) vêm primeiro.
     */
    public function recomendados(?User $user, ?int $estabelecimentoId, int|array|null $servicoId = null, ?int $itemAluguelId = null): array
    {
        $servicoIds = array_values(array_filter((array) $servicoId));
        $query = Cupom::query()
            ->where('ativo', true)
            ->where(fn ($q) => $q->whereNull('data_validade')->orWhere('data_validade', '>', now()))
            ->where(function ($q) use ($estabelecimentoId, $servicoIds, $itemAluguelId) {
                $q->where(function ($local) use ($estabelecimentoId) {
                    $local->whereNull('servico_id')->whereNull('item_aluguel_id');
                    if ($estabelecimentoId) {
                        $local->where('estabelecimento_id', $estabelecimentoId);
                    } else {
                        $local->whereRaw('1 = 0');
                    }
                });
                if ($servicoIds) $q->orWhereIn('servico_id', $servicoIds);
                if ($itemAluguelId) $q->orWhere('item_aluguel_id', $itemAluguelId);
            });

        $meus = $user
            ? DB::table('cupom_user')->where('user_id', $user->id)->where('usado', false)->pluck('cupom_id')->all()
            : [];
        $ehPremium = $user && $user->isPremium();

        return $query->get()
            // "Primeira reserva": só aparece para quem ainda é cliente novo do local (visitante vê como convite).
            ->filter(fn (Cupom $c) => !($user && $c->somente_novos_clientes && $this->motivoDeInelegibilidade($c, $user)))
            ->map(fn (Cupom $c) => [
                'id' => $c->id,
                'codigo' => $c->codigo,
                'titulo' => $c->titulo,
                'tipo_desconto' => $c->tipo_desconto,
                'valor_desconto' => (float) $c->valor_desconto,
                'pontos_custo' => (int) $c->pontos_custo,
                'apenas_plus' => (bool) $c->apenas_plus,
                'somente_novos_clientes' => (bool) $c->somente_novos_clientes,
                'bloqueado' => $c->apenas_plus && !$ehPremium,
                'escopo' => $c->escopo,
                'servico_id' => $c->servico_id,
                'item_aluguel_id' => $c->item_aluguel_id,
                'resgatado' => in_array($c->id, $meus, true),
            ])
            ->sortBy(fn ($c) => [$c['escopo'] === 'local' ? 1 : 0, -$c['valor_desconto']])
            ->values()
            ->all();
    }

    public function calcularDesconto(Cupom $cupom, float $subtotal): float
    {
        if ($subtotal <= 0) {
            return 0;
        }

        $desconto = $cupom->tipo_desconto === 'percentual'
            ? $subtotal * ((float) $cupom->valor_desconto / 100)
            : (float) $cupom->valor_desconto;

        return round(min($desconto, $subtotal), 2);
    }

    /** Consome o cupom do inventário do usuário — nunca pode ser reaproveitado depois disso. */
    public function marcarUsado(User $user, Cupom $cupom): void
    {
        DB::table('cupom_user')
            ->where('user_id', $user->id)
            ->where('cupom_id', $cupom->id)
            ->update(['usado' => true, 'updated_at' => now()]);
    }
}

<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Descobre quem é "dono premium" para dar mais visibilidade aos serviços e
 * locais dessas pessoas no app (Home e Descubra). Premium = qualquer plano
 * cujo nome começa com "premium" e que ainda não venceu — mesma regra de
 * User::isPremium().
 */
class DestaquePremiumService
{
    private ?Collection $usuarios = null;
    private ?Collection $estabelecimentos = null;

    /** IDs de usuários (donos) com plano premium ativo. */
    public function idsUsuariosPremium(): Collection
    {
        return $this->usuarios ??= User::query()
            ->where('plano_assinatura', 'like', 'premium%')
            ->where('plano_expira_em', '>', now())
            ->pluck('id');
    }

    /** IDs de estabelecimentos que têm ao menos um sócio/dono premium. */
    public function idsEstabelecimentosPremium(): Collection
    {
        return $this->estabelecimentos ??= DB::table('estabelecimento_usuario')
            ->whereIn('usuario_id', $this->idsUsuariosPremium())
            ->pluck('estabelecimento_id')
            ->unique()
            ->values();
    }
}

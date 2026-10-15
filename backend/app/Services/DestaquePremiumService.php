<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Descobre quem ganha mais visibilidade no Explorar e nas buscas: primeiro os donos premium,
 * depois os donos que aceitam pontos em serviços e reservas (quanto mais itens com pontos, antes),
 * depois quem aceita pagamento online (tem carteira Lokyva, ou seja, CNPJ). Dentro de cada grupo,
 * quem aceita pagamento online vem antes: é mais seguro para o cliente (valor protegido até o atendimento).
 * Premium = qualquer plano cujo nome começa com "premium" e que ainda não venceu (User::isPremium()).
 */
class DestaquePremiumService
{
    private ?Collection $usuarios = null;
    private ?Collection $estabelecimentos = null;
    private ?Collection $pontosEstabelecimento = null;
    private ?Collection $pontosUsuario = null;
    private ?Collection $onlineUsuarios = null;
    private ?Collection $onlineEstabelecimentos = null;

    /** Donos (users.id) com carteira Lokyva ativa: aceitam pagamento online. */
    public function idsUsuariosComPagamentoOnline(): Collection
    {
        return $this->onlineUsuarios ??= DB::table('providers')
            ->whereNotNull('asaas_wallet_id')
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    /** Estabelecimentos com ao menos um sócio/dono com carteira: aceitam pagamento online. */
    public function idsEstabelecimentosComPagamentoOnline(): Collection
    {
        return $this->onlineEstabelecimentos ??= DB::table('estabelecimento_usuario')
            ->whereIn('usuario_id', $this->idsUsuariosComPagamentoOnline())
            ->whereIn('tipo', ['socio', 'proprietario'])
            ->pluck('estabelecimento_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
    }

    public function aceitaPagamentoOnline(int $id, string $tipo = 'estabelecimento'): bool
    {
        return ($tipo === 'usuario' ? $this->idsUsuariosComPagamentoOnline() : $this->idsEstabelecimentosComPagamentoOnline())->contains($id);
    }

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

    /**
     * Quantos serviços e reservas ativos de cada estabelecimento aceitam pontos
     * (serviços do local + reservas avulsas dos donos do local). [estabelecimento_id => total]
     */
    public function pontosPorEstabelecimento(): Collection
    {
        if ($this->pontosEstabelecimento !== null) {
            return $this->pontosEstabelecimento;
        }

        $servicos = DB::table('servicos')
            ->where('aceita_pontos', true)->where('ativo', true)->whereNull('deleted_at')
            ->selectRaw('estabelecimento_id, COUNT(*) as total')
            ->groupBy('estabelecimento_id')
            ->pluck('total', 'estabelecimento_id');

        $reservasPorDono = $this->reservasComPontosPorDono();
        $donos = DB::table('estabelecimento_usuario')
            ->whereIn('usuario_id', $reservasPorDono->keys())
            ->whereIn('tipo', ['socio', 'proprietario'])
            ->get(['estabelecimento_id', 'usuario_id']);

        $total = $servicos->map(fn ($n) => (int) $n);
        foreach ($donos as $d) {
            $total[$d->estabelecimento_id] = ($total[$d->estabelecimento_id] ?? 0) + (int) $reservasPorDono[$d->usuario_id];
        }

        return $this->pontosEstabelecimento = $total;
    }

    /** Mesma contagem por dono (users.id): reservas avulsas dele + serviços dos locais em que é sócio. [usuario_id => total] */
    public function pontosPorUsuario(): Collection
    {
        if ($this->pontosUsuario !== null) {
            return $this->pontosUsuario;
        }

        $total = $this->reservasComPontosPorDono()->map(fn ($n) => (int) $n);
        $porLocal = DB::table('servicos')
            ->where('aceita_pontos', true)->where('ativo', true)->whereNull('deleted_at')
            ->selectRaw('estabelecimento_id, COUNT(*) as total')
            ->groupBy('estabelecimento_id')
            ->pluck('total', 'estabelecimento_id');

        $vinculos = DB::table('estabelecimento_usuario')
            ->whereIn('estabelecimento_id', $porLocal->keys())
            ->whereIn('tipo', ['socio', 'proprietario'])
            ->get(['estabelecimento_id', 'usuario_id']);

        foreach ($vinculos as $v) {
            $total[$v->usuario_id] = ($total[$v->usuario_id] ?? 0) + (int) $porLocal[$v->estabelecimento_id];
        }

        return $this->pontosUsuario = $total;
    }

    /**
     * Ordena uma consulta por destaque: 1º donos premium, 2º quem aceita pontos (mais itens com pontos
     * primeiro), 3º quem aceita pagamento online, 4º os demais; em cada grupo, pagamento online antes.
     * $tipo diz se $coluna guarda estabelecimento_id ou o id do dono (users.id).
     */
    public function ordenarPorDestaque($query, string $coluna, string $tipo = 'estabelecimento')
    {
        $premium = $tipo === 'usuario' ? $this->idsUsuariosPremium() : $this->idsEstabelecimentosPremium();
        $pontos = $tipo === 'usuario' ? $this->pontosPorUsuario() : $this->pontosPorEstabelecimento();
        $pontos = $pontos->filter(fn ($n) => $n > 0);
        $online = $tipo === 'usuario' ? $this->idsUsuariosComPagamentoOnline() : $this->idsEstabelecimentosComPagamentoOnline();

        $casos = [];
        if ($premium->isNotEmpty()) {
            $casos[] = "WHEN {$coluna} IN (" . $premium->map(fn ($id) => (int) $id)->implode(',') . ') THEN 0';
        }
        if ($pontos->isNotEmpty()) {
            $casos[] = "WHEN {$coluna} IN (" . $pontos->keys()->map(fn ($id) => (int) $id)->implode(',') . ') THEN 1';
        }
        $listaOnline = $online->isNotEmpty() ? $online->map(fn ($id) => (int) $id)->implode(',') : null;
        if ($listaOnline) {
            $casos[] = "WHEN {$coluna} IN ({$listaOnline}) THEN 2";
        }
        if (!$casos) {
            return $query;
        }

        $query->orderByRaw('CASE ' . implode(' ', $casos) . ' ELSE 3 END');

        if ($listaOnline) {
            $query->orderByRaw("CASE WHEN {$coluna} IN ({$listaOnline}) THEN 0 ELSE 1 END");
        }

        if ($pontos->isNotEmpty()) {
            $quantos = $pontos->map(fn ($n, $id) => 'WHEN ' . (int) $id . ' THEN ' . (int) $n)->implode(' ');
            $query->orderByRaw("CASE {$coluna} {$quantos} ELSE 0 END DESC");
        }

        return $query;
    }

    /** Nível de destaque para ordenar coleções em PHP: 0 premium, 1 aceita pontos, 2 pagamento online, 3 demais (menor vem antes). */
    public function nivelDeDestaque(int $id, string $tipo = 'estabelecimento'): int
    {
        $premium = $tipo === 'usuario' ? $this->idsUsuariosPremium() : $this->idsEstabelecimentosPremium();
        if ($premium->contains($id)) {
            return 0;
        }

        $pontos = $tipo === 'usuario' ? $this->pontosPorUsuario() : $this->pontosPorEstabelecimento();

        if (($pontos[$id] ?? 0) > 0) {
            return 1;
        }

        return $this->aceitaPagamentoOnline($id, $tipo) ? 2 : 3;
    }

    public function itensComPontos(int $id, string $tipo = 'estabelecimento'): int
    {
        $pontos = $tipo === 'usuario' ? $this->pontosPorUsuario() : $this->pontosPorEstabelecimento();

        return (int) ($pontos[$id] ?? 0);
    }

    /** Reservas avulsas ativas que aceitam pontos, por dono (itens_aluguel.estabelecimento_id = users.id). */
    private function reservasComPontosPorDono(): Collection
    {
        return DB::table('itens_aluguel')
            ->where('aceita_pontos', true)->where('ativo', true)->whereNull('deleted_at')
            ->selectRaw('estabelecimento_id, COUNT(*) as total')
            ->groupBy('estabelecimento_id')
            ->pluck('total', 'estabelecimento_id');
    }
}

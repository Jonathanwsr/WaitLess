<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Funcionario;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Valida quem pode abrir uma conversa e sobre o quê (rota mensagens/iniciar, web e app).
 * - O cliente da conversa é quem está logado, ou a equipe do local abre conversa com um cliente.
 * - Agendamento precisa ser daquele cliente e daquele local; funcionário precisa ser do local.
 * - Locação: só o locatário ou o dono do item.
 */
class ContextoConversaService
{
    private const PAPEIS_EQUIPE = ['admin', 'socio', 'proprietario', 'gerente', 'atendente', 'funcionario'];

    public function ehEquipeDoLocal(User $user, ?int $estabelecimentoId): bool
    {
        if (!$estabelecimentoId) {
            return false;
        }

        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->where('estabelecimento_id', $estabelecimentoId)
            ->whereIn('tipo', self::PAPEIS_EQUIPE)
            ->exists();
    }

    /**
     * Confere o pedido de conversa e devolve os dados finais, já com o cliente correto.
     *
     * @param array{usuario_id?: int|string|null, estabelecimento_id?: int|string|null, funcionario_id?: int|string|null,
     *              agendamento_id?: int|string|null, aluguel_id?: int|string|null} $dados
     */
    public function validar(User $logado, array $dados): array
    {
        $clienteId = (int) ($dados['usuario_id'] ?? 0) ?: $logado->id;

        if (!empty($dados['aluguel_id'])) {
            $aluguel = Aluguel::findOrFail($dados['aluguel_id']);
            $ehLocatario = (int) $logado->id === (int) $aluguel->locatario_id;
            $ehDono = (int) $logado->id === (int) $aluguel->estabelecimento_id || (int) $logado->id === (int) $aluguel->proprietario_id;
            abort_unless($ehLocatario || $ehDono, 403, 'Você não tem acesso a esta locação.');

            $dados['usuario_id'] = $aluguel->locatario_id;
            $dados['estabelecimento_id'] = $aluguel->estabelecimento_id;

            return $dados;
        }

        $estabelecimentoId = (int) ($dados['estabelecimento_id'] ?? 0);
        abort_unless($estabelecimentoId > 0, 422, 'Informe o local da conversa.');

        // Abrir conversa em nome de outra pessoa só é permitido para a equipe do local.
        if ($clienteId !== (int) $logado->id) {
            abort_unless($this->ehEquipeDoLocal($logado, $estabelecimentoId), 403, 'Você não pode abrir conversa em nome de outra pessoa.');
        }

        if (!empty($dados['agendamento_id'])) {
            $agendamento = Agendamento::findOrFail($dados['agendamento_id']);
            abort_unless(
                (int) $agendamento->usuario_id === $clienteId && (int) $agendamento->estabelecimento_id === $estabelecimentoId,
                403,
                'Este agendamento não pertence a esta conversa.'
            );
        }

        if (!empty($dados['funcionario_id'])) {
            abort_unless(
                Funcionario::whereKey($dados['funcionario_id'])->where('estabelecimento_id', $estabelecimentoId)->exists(),
                403,
                'Este profissional não é deste local.'
            );
        }

        $dados['usuario_id'] = $clienteId;
        $dados['estabelecimento_id'] = $estabelecimentoId;

        return $dados;
    }
}

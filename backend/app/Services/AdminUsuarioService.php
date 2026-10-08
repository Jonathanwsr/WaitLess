<?php

namespace App\Services;

use App\Models\Assinatura;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Lógica compartilhada da área de admin "gestão de usuários" (listar, liberar
 * plano de cortesia, revogar) — usada tanto pelo painel web (Inertia) quanto
 * pelo app mobile (JSON), pra não duplicar a mesma regra de negócio nos dois.
 */
class AdminUsuarioService
{
    /** Pontos concedidos ao ativar cada plano — mesmo mapa usado em AssinaturaController::adminAcao. */
    private const PONTOS_POR_PLANO = [
        'premium'             => 50,
        'premium-plus'        => 150,
        'premium-socio'       => 300,
        'premium-anual'       => 600,
        'premium-socio-anual' => 3600,
    ];

    /**
     * "premium" e outros ids de plano existem duplicados nos dois catálogos
     * (sócio vs. cliente), com preço e tipo_publico diferentes — a validade
     * de um plano para um usuário depende do papel dele, não só do nome.
     */
    public function chavePlanoDoPapel(string $papel): string
    {
        return in_array($papel, ['socio', 'proprietario', 'gerente']) ? 'socio' : 'user';
    }

    public function listar(string $busca, int $porPagina = 25): LengthAwarePaginator
    {
        return User::query()
            ->select(['id', 'name', 'email', 'foto_perfil', 'papel', 'plano_assinatura', 'plano_expira_em', 'asaas_subscription_status', 'pontos_saldo', 'created_at'])
            ->when($busca !== '', function ($q) use ($busca) {
                $q->where(function ($qq) use ($busca) {
                    $qq->where('name', 'ilike', "%{$busca}%")
                       ->orWhere('email', 'ilike', "%{$busca}%");
                });
            })
            ->orderByDesc('created_at')
            ->paginate($porPagina)
            ->withQueryString();
    }

    /**
     * Ficha completa de um usuário para o card "ver detalhes" do admin: todo
     * o perfil (contato, endereço, documentos) mais um resumo de atividade
     * (estabelecimentos geridos, agendamentos, avaliações, indicações).
     * Nunca inclui password/remember_token nem os campos de auditoria de IP/
     * user-agent do termo de compromisso — não é isso que o admin precisa ver aqui.
     */
    public function detalhar(User $usuario): array
    {
        $endereco = trim(implode(', ', array_filter([
            $usuario->endereco ?: $usuario->address,
            $usuario->bairro ?: $usuario->province,
            $usuario->cidade ?: $usuario->city,
            $usuario->estado ?: $usuario->state,
        ])));

        $estabelecimentos = $usuario->estabelecimentos()
            ->select('estabelecimentos.id', 'estabelecimentos.nome', 'estabelecimentos.cidade')
            ->withPivot('tipo')
            ->get()
            ->map(fn ($e) => ['id' => $e->id, 'nome' => $e->nome, 'cidade' => $e->cidade, 'tipo' => $e->pivot->tipo])
            ->values();

        return [
            'id' => $usuario->id,
            'name' => $usuario->name,
            'email' => $usuario->email,
            'email_verificado' => (bool) $usuario->email_verified_at,
            'foto_perfil' => $usuario->foto_perfil,
            'papel' => $usuario->papel,
            'telefone' => $usuario->telefone ?: $usuario->mobile_phone ?: $usuario->phone,
            'cpf_cnpj' => $usuario->cpf_cnpj,
            'tipo_pessoa' => $usuario->person_type,
            'data_nascimento' => $usuario->birth_date,
            'endereco_completo' => $endereco ?: null,
            'cep' => $usuario->cep ?: $usuario->postal_code,
            'profissao' => $usuario->profissao,
            'sobre_mim' => $usuario->sobre_mim,
            'idiomas' => $usuario->idiomas,
            'onde_estudei' => $usuario->onde_estudei,
            'plano_assinatura' => $usuario->plano_assinatura,
            'plano_expira_em' => $usuario->plano_expira_em,
            'asaas_subscription_status' => $usuario->asaas_subscription_status,
            'asaas_customer_id' => $usuario->asaas_customer_id,
            'pontos_saldo' => $usuario->pontos_saldo,
            'numero_servicos' => $usuario->numero_servicos,
            'numero_reservas' => $usuario->numero_reservas,
            'codigo_indicacao' => $usuario->codigo_indicacao,
            'indicado_por' => $usuario->indicado_por_id ? User::find($usuario->indicado_por_id)?->only(['id', 'name']) : null,
            'notificacoes_desativadas' => (bool) $usuario->notification_disabled,
            'criado_em' => $usuario->created_at,
            'estabelecimentos' => $estabelecimentos,
            'resumo_atividade' => [
                'agendamentos' => $usuario->agendamentos()->count(),
                'avaliacoes_feitas' => DB::table('avaliacoes')->where('usuario_id', $usuario->id)->count(),
                'indicados' => User::where('indicado_por_id', $usuario->id)->count(),
            ],
        ];
    }

    /** Ids de plano válidos para o papel do usuário-alvo (catálogo sócio ou cliente). */
    public function planosValidosParaUsuario(User $usuario): array
    {
        $chave = $this->chavePlanoDoPapel($usuario->papel ?? 'user');
        return array_keys(PlanoService::PLANOS_PREMIUM[$chave]);
    }

    /**
     * Libera um plano premium pra um usuário específico por um número de
     * dias (ex: 1 mês grátis) — reaproveita a mesma tabela `assinaturas` e a
     * mesma lógica de ativação usada quando um pagamento real é confirmado,
     * criando a assinatura do zero em vez de exigir uma pendente. Fica
     * marcada como cortesia (metodo_pagamento='cortesia_admin', valor_mensal=0)
     * — nunca é cobrada de verdade nem gera cobrança na Asaas.
     */
    public function liberarPlano(User $usuario, int $adminId, string $plano, int $dias): Carbon
    {
        $chaveCatalogo = $this->chavePlanoDoPapel($usuario->papel ?? 'user');
        $planosDoUsuario = $this->planosValidosParaUsuario($usuario);

        if (!in_array($plano, $planosDoUsuario, true)) {
            throw ValidationException::withMessages(['plano' => 'O plano selecionado não é válido para este usuário.']);
        }

        $tipoPublico = PlanoService::PLANOS_PREMIUM[$chaveCatalogo][$plano]['tipo_publico'];
        $vencimento = now()->addDays($dias);

        DB::transaction(function () use ($usuario, $plano, $tipoPublico, $vencimento) {
            Assinatura::create([
                'user_id' => $usuario->id,
                'nome_plano' => $plano,
                'tipo_publico' => $tipoPublico,
                'valor_mensal' => 0,
                'gateway_assinatura_id' => null,
                'status' => 'ativa',
                'data_inicio' => now(),
                'data_vencimento' => $vencimento,
                'metodo_pagamento' => 'cortesia_admin',
            ]);

            $usuario->update([
                'plano_assinatura' => $plano,
                'plano_expira_em' => $vencimento,
                'asaas_subscription_status' => 'ACTIVE',
            ]);

            $pontos = self::PONTOS_POR_PLANO[$plano] ?? 0;
            if ($pontos > 0) {
                $usuario->increment('pontos_saldo', $pontos);
            }
        });

        Log::info("Admin {$adminId} liberou o plano {$plano} por {$dias} dia(s) para o usuário {$usuario->id} ({$usuario->email}).");

        return $vencimento;
    }

    /** Revoga um plano de cortesia concedido pelo admin, voltando o usuário pro modo gratuito imediatamente. */
    public function revogarPlano(User $usuario, int $adminId): void
    {
        $usuario->update([
            'plano_assinatura' => 'gratuito',
            'plano_expira_em' => now(),
            'asaas_subscription_status' => 'CANCELLED',
        ]);

        Assinatura::where('user_id', $usuario->id)
            ->where('status', 'ativa')
            ->update(['status' => 'cancelada', 'cancelada_em' => now()]);

        Log::info("Admin {$adminId} revogou o plano do usuário {$usuario->id} ({$usuario->email}).");
    }

    /** Edita os dados cadastrais básicos de um usuário direto pelo painel admin. */
    public function atualizar(User $usuario, array $dados, int $adminId): void
    {
        $usuario->update([
            'name' => $dados['name'],
            'email' => $dados['email'],
            'telefone' => $dados['telefone'] ?? $usuario->telefone,
            'papel' => $dados['papel'],
        ]);

        Log::info("Admin {$adminId} editou os dados do usuário {$usuario->id} ({$usuario->email}).");
    }

    /**
     * Apaga definitivamente um usuário. Não permite que o admin apague a
     * própria conta, e converte qualquer erro de integridade referencial
     * (registros vinculados sem cascade) numa mensagem legível em vez de
     * estourar um erro 500 cru pro front.
     */
    public function apagar(User $usuario, int $adminId): void
    {
        if ((int) $usuario->id === $adminId) {
            throw ValidationException::withMessages(['usuario' => 'Você não pode apagar sua própria conta de administrador.']);
        }

        try {
            $usuario->delete();
        } catch (\Illuminate\Database\QueryException $e) {
            throw ValidationException::withMessages([
                'usuario' => 'Não foi possível apagar: este usuário ainda possui registros vinculados (agendamentos, locações, pagamentos, mensagens...). Considere revogar o plano em vez de apagar.',
            ]);
        }

        Log::info("Admin {$adminId} apagou definitivamente o usuário {$usuario->id} ({$usuario->email}).");
    }
}

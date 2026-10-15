<?php

namespace App\Services\NotaFiscal;

use App\Models\NotaFiscal;
use App\Models\Provider;
use App\Models\User;
use App\Services\NotaFiscalService;
use App\Support\Taxas;

/**
 * Central de notas fiscais do usuário (web e app): as notas de venda que o sócio emitiu, as notas
 * da comissão que a Lokyva emitiu para ele, as da assinatura, o resumo do mês e a configuração fiscal.
 */
class CentralNotasService
{
    public const TIPOS = ['venda', 'comissao', 'assinatura'];

    public const REGRAS_CONFIGURACAO = [
        'nfse_servico_id' => 'nullable|string|max:60',
        'nfse_servico_codigo' => 'nullable|required_without:nfse_servico_id|string|max:20',
        'nfse_servico_nome' => 'nullable|required_without:nfse_servico_id|string|max:255',
        'nfse_iss' => 'required|numeric|min:0|max:10',
        'nfse_retem_iss' => 'boolean',
        'nfse_pis' => 'nullable|numeric|min:0|max:100',
        'nfse_cofins' => 'nullable|numeric|min:0|max:100',
        'nfse_csll' => 'nullable|numeric|min:0|max:100',
        'nfse_ir' => 'nullable|numeric|min:0|max:100',
        'nfse_inss' => 'nullable|numeric|min:0|max:100',
        'nfse_observacoes' => 'nullable|string|max:500',
    ];

    public const MENSAGENS_CONFIGURACAO = [
        'nfse_servico_codigo.required_without' => 'Informe o código do serviço municipal (ou o ID do serviço no Asaas).',
        'nfse_servico_nome.required_without' => 'Informe a descrição do serviço municipal.',
    ];

    public function __construct(private NotaFiscalService $notas)
    {
    }

    public function consultaDoUsuario(User $user, ?Provider $provider)
    {
        return NotaFiscal::where(fn ($q) => $q->where('usuario_id', $user->id)
            ->when($provider, fn ($w) => $w->orWhere('provider_id', $provider->id)));
    }

    /** Tudo menos a lista paginada (resumo, configuração, regras de exibição). */
    public function painel(User $user, ?Provider $provider): array
    {
        $doMes = $this->consultaDoUsuario($user, $provider)
            ->where('created_at', '>=', now()->startOfMonth())
            ->where('status', '!=', 'CANCELADA');

        return [
            'elegivel' => $provider ? $this->notas->elegivel($provider) : false,
            'ehSocio' => (bool) $provider,
            'taxas' => [
                'reservas' => Taxas::percentual(),
                'produtos' => Taxas::percentualEntregas(),
                'cobrancas' => Taxas::percentualCobrancas(),
            ],
            'resumo' => [
                'vendas_mes' => (float) (clone $doMes)->where('tipo', 'venda')->sum('valor'),
                'comissoes_mes' => (float) (clone $doMes)->where('tipo', 'comissao')->sum('valor'),
                'vendas_intermediadas_mes' => (float) (clone $doMes)->where('tipo', 'comissao')->sum('valor_operacao'),
                'pendencias' => $this->consultaDoUsuario($user, $provider)->whereIn('status', ['ERRO', 'NAO_CONFIGURADO'])->count(),
            ],
            'configuracao' => $provider ? $this->configuracao($provider) : null,
        ];
    }

    public function configuracao(Provider $provider): array
    {
        return [
            'configurada' => $this->notas->temConfiguracaoFiscal($provider),
            'nfse_servico_id' => $provider->nfse_servico_id,
            'nfse_servico_codigo' => $provider->nfse_servico_codigo,
            'nfse_servico_nome' => $provider->nfse_servico_nome,
            'nfse_iss' => (float) $provider->nfse_iss,
            'nfse_retem_iss' => (bool) $provider->nfse_retem_iss,
            'nfse_pis' => (float) $provider->nfse_pis,
            'nfse_cofins' => (float) $provider->nfse_cofins,
            'nfse_csll' => (float) $provider->nfse_csll,
            'nfse_ir' => (float) $provider->nfse_ir,
            'nfse_inss' => (float) $provider->nfse_inss,
            'nfse_observacoes' => $provider->nfse_observacoes,
        ];
    }

    public function salvarConfiguracao(Provider $provider, array $dados): void
    {
        foreach (['nfse_pis', 'nfse_cofins', 'nfse_csll', 'nfse_ir', 'nfse_inss'] as $campo) {
            $dados[$campo] = (float) ($dados[$campo] ?? 0);
        }
        $dados['nfse_retem_iss'] = (bool) ($dados['nfse_retem_iss'] ?? false);

        $provider->update($dados);
    }

    public function podeMexer(NotaFiscal $nota, User $user, ?Provider $provider): bool
    {
        return $nota->usuario_id === $user->id || ($provider && $nota->provider_id === $provider->id);
    }
}

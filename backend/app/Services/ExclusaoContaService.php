<?php

namespace App\Services;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\Cobranca;
use App\Models\Estorno;
use App\Models\Pagamento;
use App\Models\PedidoEntrega;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Antes de apagar a conta, tudo que envolve dinheiro ou compromisso com outra pessoa precisa estar
 * resolvido: pagamentos pendentes, estornos em andamento, agendamentos e reservas futuras, pedidos e
 * cobranças em aberto, assinatura ativa e dívida com a plataforma. Cada pendência diz o que fazer.
 */
class ExclusaoContaService
{
    private const ESTORNOS_ABERTOS = ['PENDENTE', 'EM_ANALISE', 'APROVADO', 'ERRO_ASAAS'];
    private const ALUGUEIS_ENCERRADOS = ['cancelado', 'finalizado', 'concluido', 'recusado', 'estornado'];

    /** @return array<int, array{chave: string, titulo: string, quantidade: int, como_resolver: string, rota: ?string}> */
    public function pendencias(User $user): array
    {
        $hoje = now('America/Sao_Paulo')->toDateString();
        $lista = [];

        $agendamentos = Agendamento::where('usuario_id', $user->id)
            ->where(function ($q) use ($hoje) {
                $q->where(fn ($q2) => $q2->whereIn('status', ['pendente', 'confirmado'])->where('data_agendamento', '>=', $hoje))
                    ->orWhere('status_pagamento', 'aguardando_pagamento');
            })
            ->where('status', '!=', 'cancelado')
            ->count();
        $this->adicionar($lista, 'agendamentos', 'Agendamentos marcados', $agendamentos,
            'Cancele ou conclua seus agendamentos futuros no seu painel.', 'dashboard');

        $reservas = Aluguel::where('locatario_id', $user->id)
            ->whereNotIn('status', self::ALUGUEIS_ENCERRADOS)
            ->where(fn ($q) => $q->where('data_fim', '>=', $hoje)->orWhere('status', 'aguardando_pagamento'))
            ->count();
        $this->adicionar($lista, 'reservas', 'Reservas em andamento', $reservas,
            'Cancele as reservas futuras ou espere o fim do período reservado.', 'dashboard');

        $pagamentos = Pagamento::where('usuario_id', $user->id)->where('status', 'pendente')->count();
        $this->adicionar($lista, 'pagamentos', 'Pagamentos pendentes', $pagamentos,
            'Pague ou cancele os pedidos que ainda estão aguardando pagamento.', null);

        $estornos = Estorno::where(fn ($q) => $q->where('usuario_id', $user->id)->orWhere('prestador_id', $user->id))
            ->whereIn('status', self::ESTORNOS_ABERTOS)
            ->count();
        $this->adicionar($lista, 'estornos', 'Estornos em andamento', $estornos,
            'Aguarde a conclusão dos estornos abertos (por você ou contra você).', null);

        $pedidos = PedidoEntrega::where(fn ($q) => $q->where('cliente_id', $user->id)->orWhere('vendedor_id', $user->id))
            ->whereIn('status', ['pendente_pagamento', 'pago', 'aguardando_confirmacao'])
            ->count();
        $this->adicionar($lista, 'pedidos', 'Pedidos de produtos em aberto', $pedidos,
            'Finalize ou cancele os pedidos de produtos que ainda não foram entregues.', 'entregas.pedidos.meus');

        $cobrancas = Cobranca::where(fn ($q) => $q->where('cliente_id', $user->id)->orWhere('criado_por_usuario_id', $user->id))
            ->whereIn('status', [Cobranca::STATUS_AGUARDANDO, Cobranca::STATUS_ACEITA])
            ->count();
        $this->adicionar($lista, 'cobrancas', 'Pagamentos parcelados em aberto', $cobrancas,
            'Quite as parcelas restantes ou peça ao estabelecimento para cancelar a cobrança.', 'cobrancas.minhas');

        $assinaturaAtiva = $user->isPremium()
            && strtoupper((string) $user->asaas_subscription_status) !== 'CANCELLED';
        $this->adicionar($lista, 'assinatura', 'Assinatura premium ativa', $assinaturaAtiva ? 1 : 0,
            'Cancele sua assinatura em "Minha assinatura" para não ser cobrado depois.', 'assinatura.status');

        $divida = (float) DB::table('estabelecimento_usuario')
            ->join('estabelecimentos', 'estabelecimento_usuario.estabelecimento_id', '=', 'estabelecimentos.id')
            ->where('estabelecimento_usuario.usuario_id', $user->id)
            ->whereIn('estabelecimento_usuario.tipo', ['socio', 'proprietario'])
            ->sum('estabelecimentos.saldo_devedor');
        $this->adicionar($lista, 'divida', 'Taxas a pagar à plataforma', $divida > 0.009 ? 1 : 0,
            'Há R$ ' . number_format($divida, 2, ',', '.') . ' de taxas de pagamentos presenciais a acertar. Elas são descontadas do seu próximo repasse.', null);

        return $lista;
    }

    public function podeExcluir(User $user): bool
    {
        return empty($this->pendencias($user));
    }

    private function adicionar(array &$lista, string $chave, string $titulo, int $quantidade, string $comoResolver, ?string $rota): void
    {
        if ($quantidade <= 0) {
            return;
        }

        $lista[] = [
            'chave' => $chave,
            'titulo' => $titulo,
            'quantidade' => $quantidade,
            'como_resolver' => $comoResolver,
            'rota' => $rota && \Illuminate\Support\Facades\Route::has($rota) ? route($rota) : null,
        ];
    }
}

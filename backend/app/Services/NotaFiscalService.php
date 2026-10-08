<?php

namespace App\Services;

use App\Mail\NotaFiscalEmitidaMail;
use App\Models\Assinatura;
use App\Models\NotaFiscal;
use App\Models\Pagamento;
use App\Models\Provider;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Emissão automática de Nota Fiscal de Serviço (NFS-e) via Asaas. Dois fluxos:
 *
 * - "venda" (emitirParaPagamento): nota do PRESTADOR pro cliente dele, a cada
 *   pagamento online dentro do app (cartão, PIX ou boleto) — exclusiva do
 *   plano Sócio Premium. Usa a CHAVE DE API DO PRÓPRIO PRESTADOR
 *   (providers.asaas_api_key), já que a nota é dele.
 *
 * - "assinatura" (emitirParaAssinatura): nota da PRÓPRIA PLATAFORMA (Lokyva)
 *   pro assinante (sócio ou cliente) a cada cobrança do plano premium. Usa a
 *   chave master (config('services.asaas.key')) — quem vende a assinatura é
 *   a plataforma, não o prestador.
 *
 * IMPORTANTE: pra isso funcionar de verdade, a conta Asaas emissora (a
 * subconta do prestador, ou a conta master da plataforma) precisa ter os
 * dados fiscais (município, regime tributário, código de serviço)
 * configurados antes — este serviço não cria essa configuração, só agenda a
 * emissão em cima dela. Sem essa configuração, a chamada falha e fica
 * registrada com status NAO_CONFIGURADO, pra quem emite saber o que falta.
 */
class NotaFiscalService
{
    /**
     * Emite (agenda) a nota fiscal do prestador para um pagamento online já
     * confirmado (cartão aprovado na hora, ou PIX/boleto confirmado pelo
     * webhook). Retorna null quando não há prestador elegível — nunca lança
     * exceção, pra nunca derrubar o fluxo de pagamento que chama este método.
     */
    public function emitirParaPagamento(Pagamento $pagamento): ?NotaFiscal
    {
        if (!$pagamento->id_transacao_gateway || !$pagamento->estabelecimento_id) {
            return null;
        }

        if (NotaFiscal::where('pagamento_id', $pagamento->id)->exists()) {
            return null; // já tentamos emitir pra este pagamento antes
        }

        $provider = $this->resolverProvider($pagamento->estabelecimento_id);
        if (!$provider || !$provider->asaas_api_key || !$this->elegivel($provider)) {
            return null;
        }

        $descricao = $this->descreverServico($pagamento);
        $valor = (float) ($pagamento->valor_total ?? $pagamento->valor);

        return $this->emitir(
            apiKey: $provider->asaas_api_key,
            origem: ['payment' => $pagamento->id_transacao_gateway],
            valor: $valor,
            descricao: $descricao,
            dadosBase: [
                'pagamento_id' => $pagamento->id,
                'provider_id' => $provider->id,
                'usuario_id' => $pagamento->usuario_id,
                'tipo' => 'venda',
            ],
        );
    }

    /**
     * Emite a nota fiscal da PLATAFORMA referente à cobrança de uma
     * assinatura premium (sócio ou cliente) — chamada depois que o webhook
     * de assinatura já confirmou e ativou o plano. Não tem a restrição de
     * tier do emitirParaPagamento: qualquer assinante pagante tem direito à
     * nota fiscal da própria assinatura que pagou.
     */
    public function emitirParaAssinatura(Assinatura $assinatura, User $user): ?NotaFiscal
    {
        if (!$assinatura->fatura_id) {
            return null;
        }

        // Idempotência: uma nota por cobrança de assinatura (fatura_id muda a cada renovação).
        if (NotaFiscal::where('assinatura_id', $assinatura->id)->where('referencia_cobranca', $assinatura->fatura_id)->exists()) {
            return null;
        }

        $masterKey = config('services.asaas.key');
        if (!$masterKey) {
            return null;
        }

        $descricao = 'Assinatura Lokyva ' . strtoupper(str_replace('-', ' ', $assinatura->nome_plano));
        $valor = (float) $assinatura->valor_mensal;

        return $this->emitir(
            apiKey: $masterKey,
            origem: ['payment' => $assinatura->fatura_id],
            valor: $valor,
            descricao: $descricao,
            dadosBase: [
                'assinatura_id' => $assinatura->id,
                'usuario_id' => $user->id,
                'tipo' => 'assinatura',
                'referencia_cobranca' => $assinatura->fatura_id,
            ],
        );
    }

    /** Nova tentativa manual — usada pelo botão "Tentar novamente" na tela do sócio/cliente. */
    public function tentarNovamente(NotaFiscal $notaFiscal): NotaFiscal
    {
        $notaFiscal->delete();

        if ($notaFiscal->tipo === 'assinatura') {
            $assinatura = Assinatura::find($notaFiscal->assinatura_id);
            $user = User::find($notaFiscal->usuario_id);

            return ($assinatura && $user ? $this->emitirParaAssinatura($assinatura, $user) : null) ?? $notaFiscal;
        }

        return $this->emitirParaPagamento($notaFiscal->pagamento) ?? $notaFiscal;
    }

    /** Chamada HTTP ao Asaas + gravação do resultado (sucesso ou falha graciosa) + e-mail. */
    private function emitir(string $apiKey, array $origem, float $valor, string $descricao, array $dadosBase): NotaFiscal
    {
        try {
            $response = Http::withHeaders([
                'access_token' => $apiKey,
            ])->post(config('services.asaas.url') . '/invoices', array_merge($origem, [
                'effectiveDate' => now()->toDateString(),
                'value' => $valor,
                'deductions' => 0,
                'serviceDescription' => $descricao,
            ]));

            if ($response->successful()) {
                $dados = $response->json();

                $nota = NotaFiscal::create(array_merge($dadosBase, [
                    'asaas_invoice_id' => $dados['id'] ?? null,
                    'status' => $this->mapearStatus($dados['status'] ?? null),
                    'valor' => $valor,
                    'descricao_servico' => $descricao,
                    'pdf_url' => $dados['pdfUrl'] ?? null,
                ]));

                $this->notificarPorEmail($nota);

                return $nota;
            }

            $erro = $response->json('errors.0.description') ?? $response->body();
            $naoConfigurado = $this->pareceFaltaDeConfiguracao($erro);

            Log::warning('Falha ao emitir nota fiscal via Asaas', ['dados' => $dadosBase, 'erro' => $erro]);

            return NotaFiscal::create(array_merge($dadosBase, [
                'status' => $naoConfigurado ? 'NAO_CONFIGURADO' : 'ERRO',
                'valor' => $valor,
                'descricao_servico' => $descricao,
                'mensagem_erro' => $erro,
            ]));
        } catch (\Throwable $e) {
            Log::error('Erro inesperado ao emitir nota fiscal: ' . $e->getMessage());

            return NotaFiscal::create(array_merge($dadosBase, [
                'status' => 'ERRO',
                'valor' => $valor,
                'descricao_servico' => $descricao,
                'mensagem_erro' => 'Falha de comunicação com o gateway de notas fiscais.',
            ]));
        }
    }

    private function notificarPorEmail(NotaFiscal $nota): void
    {
        $email = $nota->usuario?->email ?? $nota->pagamento?->usuario?->email;
        if (!$email) {
            return;
        }

        try {
            Mail::to($email)->queue(new NotaFiscalEmitidaMail($nota));
        } catch (\Throwable $e) {
            Log::warning('Falha ao enviar e-mail de nota fiscal: ' . $e->getMessage());
        }
    }

    /** Resolve o prestador (dono/sócio) de um estabelecimento — mesma lógica usada no split de pagamento. */
    private function resolverProvider(int $estabelecimentoId): ?Provider
    {
        $providerId = DB::table('providers')
            ->join('users', 'providers.user_id', '=', 'users.id')
            ->join('estabelecimento_usuario', 'users.id', '=', 'estabelecimento_usuario.usuario_id')
            ->where('estabelecimento_usuario.estabelecimento_id', $estabelecimentoId)
            ->value('providers.id');

        return $providerId ? Provider::with('user')->find($providerId) : null;
    }

    /** Só emitimos automaticamente pra quem está no plano Sócio Premium (mensal ou anual). */
    public function elegivel(Provider $provider): bool
    {
        $user = $provider->user;

        return $user
            && $user->isPremium()
            && in_array($user->plano_assinatura, ['premium-socio', 'premium-socio-anual'], true);
    }

    private function descreverServico(Pagamento $pagamento): string
    {
        $pagamento->loadMissing(['agendamento.servico', 'agendamento.itemAluguel', 'aluguel.item', 'pedidoEntrega.produto']);

        $nome = $pagamento->agendamento?->servico?->nome
            ?? $pagamento->agendamento?->itemAluguel?->nome
            ?? $pagamento->aluguel?->item?->nome
            ?? $pagamento->pedidoEntrega?->produto?->nome
            ?? 'Reserva via Lokyva';

        return "Serviço: {$nome}";
    }

    private function mapearStatus(?string $statusAsaas): string
    {
        return match ($statusAsaas) {
            'AUTHORIZED' => 'AUTORIZADA',
            'SYNCHRONIZED' => 'SINCRONIZADA',
            'CANCELLED' => 'CANCELADA',
            'ERROR' => 'ERRO',
            default => 'AGENDADA',
        };
    }

    private function pareceFaltaDeConfiguracao(?string $mensagem): bool
    {
        if (!$mensagem) return false;
        $texto = mb_strtolower($mensagem);

        return str_contains($texto, 'configuração') || str_contains($texto, 'configuracao')
            || str_contains($texto, 'município') || str_contains($texto, 'municipio')
            || str_contains($texto, 'serviço municipal') || str_contains($texto, 'servico municipal');
    }
}

<?php

namespace App\Services\Carteira;

use Illuminate\Http\Client\Response;

/**
 * Tradução de erro do Asaas para uma mensagem que o proprietário entende.
 * O texto técnico original nunca some: vai em $detalhe para o admin investigar.
 */
class AsaasErro
{
    /** Códigos em que vale tentar de novo mais tarde (o problema não é dos dados do usuário). */
    public const RETENTAVEIS = ['indisponivel', 'saldo_plataforma'];

    public function __construct(
        public string $codigo,
        public string $mensagem,
        public string $detalhe = '',
    ) {}

    public function retentavel(): bool
    {
        return in_array($this->codigo, self::RETENTAVEIS, true);
    }

    public static function deResposta(Response $resposta): self
    {
        $json = $resposta->json();
        $descricoes = [];
        foreach (($json['errors'] ?? []) as $erro) {
            $descricoes[] = trim(($erro['code'] ?? '') . ' ' . ($erro['description'] ?? ''));
        }
        $detalhe = $descricoes ? implode(' | ', $descricoes) : mb_substr((string) $resposta->body(), 0, 500);

        return self::traduzir($resposta->status(), $detalhe);
    }

    public static function deExcecao(\Throwable $e): self
    {
        return new self(
            'indisponivel',
            'Não conseguimos falar com o serviço de pagamentos agora. Nenhum valor foi movimentado — tente novamente em alguns minutos.',
            get_class($e) . ': ' . $e->getMessage(),
        );
    }

    /** Motivo de falha informado pelo Asaas depois que a transferência já foi aceita (status FAILED). */
    public static function deFalhaAsincrona(?string $motivo): self
    {
        return self::traduzir(200, (string) $motivo ?: 'Transferência recusada pelo banco de destino.');
    }

    public static function traduzir(int $status, string $detalhe): self
    {
        $t = mb_strtolower($detalhe);
        $tem = fn (string ...$termos) => collect($termos)->contains(fn ($x) => str_contains($t, $x));

        if ($status === 401 || $tem('invalid_access_token', 'chave de api')) {
            return new self('conta_nao_liberada', 'Sua conta de recebimento ainda não está liberada para movimentar dinheiro. Confira se o cadastro foi aprovado pela plataforma e tente novamente.', $detalhe);
        }
        if ($tem('saldo insuficiente', 'insufficient', 'saldo disponível')) {
            return new self('saldo_insuficiente', 'O saldo disponível não cobre o valor mais as taxas da transferência. Tente um valor um pouco menor.', $detalhe);
        }
        if ($tem('chave pix') && $tem('inválid', 'invalid', 'não encontrad', 'nao encontrad', 'inexistente', 'não existe')) {
            return new self('chave_invalida', 'Não encontramos essa chave Pix. Confira se ela está correta e ativa no seu banco.', $detalhe);
        }
        if ($tem('conta bancária', 'agência', 'agencia', 'dígito', 'digito', 'bankaccount')) {
            return new self('dados_bancarios_invalidos', 'Os dados bancários parecem incorretos. Confira banco, agência, conta e dígito.', $detalhe);
        }
        if ($tem('cpf', 'cnpj', 'titularidade', 'titular')) {
            return new self('titular_divergente', 'O documento informado não confere com o titular da conta de destino. Use uma conta no seu próprio nome.', $detalhe);
        }
        if ($tem('limite')) {
            return new self('limite_excedido', 'O limite de transferência foi atingido. Tente um valor menor ou aguarde o próximo período.', $detalhe);
        }
        if ($tem('horário', 'horario', 'noturno', 'período de')) {
            return new self('fora_do_horario', 'Esta transferência não pôde ser feita neste horário. Tente novamente mais tarde.', $detalhe);
        }
        if ($tem('não aprovad', 'nao aprovad', 'aprovação', 'aprovacao', 'bloquead', 'documentação', 'documentacao')) {
            return new self('conta_nao_liberada', 'Sua conta de recebimento ainda está em análise. Assim que for aprovada você poderá movimentar o saldo.', $detalhe);
        }
        if ($status >= 500 || $status === 0) {
            return new self('indisponivel', 'O serviço de pagamentos está instável no momento. Nenhum valor foi movimentado — tente novamente em alguns minutos.', $detalhe);
        }

        return new self('recusada', 'Não conseguimos concluir a transferência. Nenhum valor foi movimentado. Se o problema continuar, fale com o suporte informando o número da operação.', $detalhe);
    }
}

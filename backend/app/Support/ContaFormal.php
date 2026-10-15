<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Sócio formal x informal.
 *
 * Quem não tem CNPJ (informal) pode se cadastrar e usar a Lokyva normalmente com pagamento no local,
 * mas não pode abrir a carteira Lokyva e, portanto, não recebe pagamentos online (o pagamento online
 * depende da carteira para o repasse). Para liberar, basta cadastrar um CNPJ válido (MEI serve).
 */
class ContaFormal
{
    public const CODIGO = 'conta_informal';

    public const MENSAGEM = 'A carteira Lokyva e os pagamentos online são exclusivos para quem tem CNPJ (MEI serve). '
        . 'Sem CNPJ você continua usando a Lokyva normalmente, com pagamento no local.';

    public static function cnpjValido(?string $cnpj): bool
    {
        $n = preg_replace('/\D/', '', (string) $cnpj);
        if (strlen($n) !== 14 || preg_match('/^(\d)\1{13}$/', $n)) {
            return false;
        }

        foreach ([12, 13] as $tamanho) {
            $pesos = $tamanho === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
            $soma = 0;
            for ($i = 0; $i < $tamanho; $i++) {
                $soma += (int) $n[$i] * $pesos[$i];
            }
            $resto = $soma % 11;
            $digito = $resto < 2 ? 0 : 11 - $resto;
            if ((int) $n[$tamanho] !== $digito) {
                return false;
            }
        }

        return true;
    }

    /** Dados de carteira válidos para abrir a conta de recebimento: pessoa jurídica com CNPJ válido. */
    public static function podeAbrirCarteira(?string $tipoPessoa, ?string $documento): bool
    {
        return strtoupper((string) $tipoPessoa) === 'JURIDICA' && self::cnpjValido($documento);
    }

    /** Sócio sem carteira e sem CNPJ no cadastro: usa só pagamento no local. */
    public static function ehInformal(User $user): bool
    {
        $temCarteira = DB::table('providers')->where('user_id', $user->id)->whereNotNull('asaas_wallet_id')->exists();

        return !$temCarteira && !self::cnpjValido($user->cpf_cnpj);
    }

    public static function resposta(): array
    {
        return ['error' => self::MENSAGEM, 'codigo' => self::CODIGO];
    }
}

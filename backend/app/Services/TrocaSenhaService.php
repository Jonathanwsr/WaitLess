<?php

namespace App\Services;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Regras de troca de senha: no máximo 3 trocas a cada 30 dias por conta
 * (vale para recuperação pelo app, recuperação pelo site e troca no perfil),
 * e o código de recuperação de 6 dígitos enviado por e-mail (Brevo).
 */
class TrocaSenhaService
{
    public const LIMITE = 3;
    public const JANELA_DIAS = 30;
    public const VALIDADE_CODIGO_MIN = 15;
    public const MAX_TENTATIVAS_CODIGO = 5;

    // ---------------------------------------------------------------- limite mensal

    public function usadas(User $user): int
    {
        return DB::table('trocas_senha')->where('user_id', $user->id)->where('created_at', '>=', now()->subDays(self::JANELA_DIAS))->count();
    }

    public function restantes(User $user): int
    {
        return max(self::LIMITE - $this->usadas($user), 0);
    }

    /** Quando a troca mais antiga da janela "vence" e libera uma nova (null se ainda há saldo). */
    public function liberaEm(User $user): ?Carbon
    {
        if ($this->restantes($user) > 0) {
            return null;
        }

        $maisAntiga = DB::table('trocas_senha')->where('user_id', $user->id)->where('created_at', '>=', now()->subDays(self::JANELA_DIAS))
            ->orderBy('created_at')->value('created_at');

        return Carbon::parse($maisAntiga)->addDays(self::JANELA_DIAS);
    }

    public function mensagemLimite(User $user): string
    {
        $libera = $this->liberaEm($user);

        return 'Você já trocou a senha ' . self::LIMITE . ' vezes nos últimos ' . self::JANELA_DIAS . ' dias, que é o limite por segurança. '
            . ($libera ? 'Uma nova troca será liberada em ' . $libera->format('d/m/Y') . '.' : '');
    }

    /** @throws ValidationException */
    public function garantirPodeTrocar(User $user, string $campo = 'password'): void
    {
        if ($this->restantes($user) <= 0) {
            throw ValidationException::withMessages([$campo => [$this->mensagemLimite($user)]]);
        }
    }

    public function registrar(User $user, string $canal, ?string $ip = null): void
    {
        DB::table('trocas_senha')->insert(['user_id' => $user->id, 'canal' => $canal, 'ip' => $ip, 'created_at' => now(), 'updated_at' => now()]);
    }

    // ---------------------------------------------------------------- código por e-mail

    /**
     * Gera e envia o código. Sempre retorna sem revelar se o e-mail existe.
     * Se a conta já esgotou as trocas do mês, o e-mail explica o limite em vez de mandar código.
     */
    public function enviarCodigo(string $email, ?string $ip): void
    {
        $user = User::where('email', mb_strtolower(trim($email)))->first();
        if (!$user) {
            return;
        }

        if ($this->restantes($user) <= 0) {
            $this->enviarEmail($user, 'Limite de trocas de senha atingido', $this->corpoLimite($user));
            return;
        }

        $codigo = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::transaction(function () use ($user, $codigo, $ip) {
            DB::table('codigos_recuperacao_senha')->where('user_id', $user->id)->whereNull('usado_em')->update(['usado_em' => now()]);
            DB::table('codigos_recuperacao_senha')->insert([
                'user_id' => $user->id, 'codigo_hash' => Hash::make($codigo), 'expira_em' => now()->addMinutes(self::VALIDADE_CODIGO_MIN),
                'ip' => $ip, 'created_at' => now(), 'updated_at' => now(),
            ]);
        });

        $this->enviarEmail($user, 'Seu código para redefinir a senha', $this->corpoCodigo($user, $codigo));
    }

    /**
     * Confere o código e troca a senha. Erros vêm como ValidationException com mensagem pronta para o app.
     *
     * @throws ValidationException
     */
    public function redefinir(string $email, string $codigo, string $novaSenha, ?string $ip): User
    {
        $erroGenerico = ValidationException::withMessages(['codigo' => ['Código inválido ou expirado. Peça um novo código.']]);

        $user = User::where('email', mb_strtolower(trim($email)))->first();
        if (!$user) {
            throw $erroGenerico;
        }

        $registro = DB::table('codigos_recuperacao_senha')->where('user_id', $user->id)->whereNull('usado_em')->latest('id')->first();
        if (!$registro || now()->greaterThan($registro->expira_em)) {
            throw $erroGenerico;
        }

        if ($registro->tentativas >= self::MAX_TENTATIVAS_CODIGO) {
            DB::table('codigos_recuperacao_senha')->where('id', $registro->id)->update(['usado_em' => now()]);
            throw ValidationException::withMessages(['codigo' => ['Muitas tentativas com esse código. Peça um novo código.']]);
        }

        if (!Hash::check($codigo, $registro->codigo_hash)) {
            DB::table('codigos_recuperacao_senha')->where('id', $registro->id)->increment('tentativas');
            $restam = self::MAX_TENTATIVAS_CODIGO - $registro->tentativas - 1;
            throw ValidationException::withMessages(['codigo' => ["Código incorreto. Você ainda tem {$restam} " . ($restam === 1 ? 'tentativa.' : 'tentativas.')]]);
        }

        $this->garantirPodeTrocar($user);

        DB::transaction(function () use ($user, $registro, $novaSenha, $ip) {
            $user->forceFill(['password' => Hash::make($novaSenha)])->save();
            DB::table('codigos_recuperacao_senha')->where('id', $registro->id)->update(['usado_em' => now()]);
            $this->registrar($user, 'app_recuperacao', $ip);
            // Quem trocou a senha por recuperação sai de todos os aparelhos.
            $user->tokens()->delete();
        });

        $this->enviarEmail($user, 'Sua senha foi alterada', $this->corpoAlterada($user));

        return $user;
    }

    // ---------------------------------------------------------------- e-mail (Brevo SMTP configurado em MAIL_*)

    private function enviarEmail(User $user, string $assunto, string $html): void
    {
        try {
            Mail::html($html, fn ($m) => $m->to($user->email, $user->name)->subject($assunto));
        } catch (\Throwable $e) {
            Log::error('Recuperação de senha: falha ao enviar e-mail (Brevo/SMTP). ' . $e->getMessage(), ['user_id' => $user->id]);
        }
    }

    private function moldura(string $titulo, string $corpo): string
    {
        return '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:12px;padding:24px;color:#333;line-height:1.6">'
            . '<h2 style="color:#F0561D;margin-top:0">' . e($titulo) . '</h2>' . $corpo
            . '<p style="color:#999;font-size:12px;margin-top:24px">Se não foi você, ignore este e-mail: sua senha continua a mesma.<br>Equipe ' . e(config('app.name', 'Lokyva')) . '</p></div>';
    }

    private function corpoCodigo(User $user, string $codigo): string
    {
        return $this->moldura('Redefinir senha', '<p>Olá, <b>' . e($user->name) . '</b>!</p><p>Use o código abaixo no aplicativo. Ele vale por ' . self::VALIDADE_CODIGO_MIN . ' minutos.</p>'
            . '<p style="font-size:34px;letter-spacing:8px;font-weight:bold;text-align:center;background:#FDF8F5;border-radius:12px;padding:14px">' . $codigo . '</p>'
            . '<p style="font-size:13px">Por segurança, cada conta pode trocar a senha até ' . self::LIMITE . ' vezes a cada ' . self::JANELA_DIAS . ' dias.</p>');
    }

    private function corpoLimite(User $user): string
    {
        return $this->moldura('Limite de trocas atingido', '<p>Olá, <b>' . e($user->name) . '</b>!</p><p>Recebemos um pedido para redefinir sua senha, mas ' . e($this->mensagemLimite($user)) . '</p>'
            . '<p>Se precisa de ajuda antes disso, fale com o suporte.</p>');
    }

    private function corpoAlterada(User $user): string
    {
        return $this->moldura('Senha alterada', '<p>Olá, <b>' . e($user->name) . '</b>!</p><p>Sua senha foi alterada agora e você foi desconectado dos outros aparelhos.</p>'
            . '<p>Trocas restantes neste período: <b>' . $this->restantes($user) . '</b> de ' . self::LIMITE . '.</p><p>Se não foi você, entre em contato com o suporte imediatamente.</p>');
    }
}

<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

/**
 * Monitoramento simples de erros: e-mail para o responsável quando acontece um erro de verdade (500),
 * com trava para não repetir o mesmo erro e limite por hora. Não substitui o log — só avisa.
 */
class AlertaDeErros
{
    /** Erros "esperados" (validação, login, 404, 403...) não geram alerta. */
    private const IGNORADOS = [
        \Illuminate\Validation\ValidationException::class,
        \Illuminate\Auth\AuthenticationException::class,
        \Illuminate\Auth\Access\AuthorizationException::class,
        \Illuminate\Database\Eloquent\ModelNotFoundException::class,
        \Illuminate\Session\TokenMismatchException::class,
        \App\Exceptions\PremiumRequiredException::class,
    ];

    public static function deveAvisar(Throwable $e): bool
    {
        if (!config('monitoramento.alerta_erros_email') || app()->runningUnitTests()) {
            return false;
        }
        foreach (self::IGNORADOS as $classe) {
            if ($e instanceof $classe) {
                return false;
            }
        }

        return !($e instanceof HttpExceptionInterface && $e->getStatusCode() < 500);
    }

    public static function avisar(Throwable $e): void
    {
        if (!self::deveAvisar($e)) {
            return;
        }

        try {
            $assinatura = sha1(get_class($e) . '|' . $e->getFile() . '|' . $e->getLine());
            $intervalo = max(1, config('monitoramento.alerta_erros_intervalo_minutos', 30));
            // Mesmo erro: um aviso por intervalo. Total: limite por hora.
            if (!Cache::add('alerta-erro:' . $assinatura, 1, now()->addMinutes($intervalo))) {
                Cache::increment('alerta-erro:repeticoes:' . $assinatura);
                return;
            }
            $chaveHora = 'alerta-erro:hora:' . now()->format('YmdH');
            Cache::add($chaveHora, 0, now()->addHour());
            if (Cache::increment($chaveHora) > config('monitoramento.alerta_erros_maximo_por_hora', 20)) {
                return;
            }

            Mail::raw(self::texto($e), function ($m) use ($e) {
                $m->to(config('monitoramento.alerta_erros_email'))
                    ->subject('[' . config('app.name') . '] Erro: ' . mb_strimwidth(class_basename($e) . ' — ' . $e->getMessage(), 0, 120, '…'));
            });
        } catch (Throwable $falha) {
            // Nunca derruba a requisição por causa do alerta.
            logger()->warning('Alerta de erro não enviado: ' . $falha->getMessage());
        }
    }

    public static function texto(Throwable $e): string
    {
        $req = app()->runningInConsole() ? null : request();
        $linhas = [
            'Aconteceu um erro no ' . config('app.name') . ' (' . config('app.env') . ') em ' . now()->format('d/m/Y H:i:s') . '.',
            '',
            'Erro: ' . get_class($e),
            'Mensagem: ' . $e->getMessage(),
            'Onde: ' . str_replace(base_path() . DIRECTORY_SEPARATOR, '', $e->getFile()) . ':' . $e->getLine(),
        ];
        if ($req) {
            $linhas[] = 'Requisição: ' . $req->method() . ' ' . $req->path();
            $linhas[] = 'Usuário: ' . ($req->user()?->id ? '#' . $req->user()->id : 'visitante');
        } else {
            $linhas[] = 'Origem: comando/fila (' . implode(' ', array_slice($_SERVER['argv'] ?? [], 1, 3)) . ')';
        }
        $linhas[] = '';
        $linhas[] = 'Primeiras linhas do rastro:';
        foreach (array_slice(explode("\n", $e->getTraceAsString()), 0, 12) as $l) {
            $linhas[] = '  ' . str_replace(base_path() . DIRECTORY_SEPARATOR, '', $l);
        }
        $linhas[] = '';
        $linhas[] = 'O log completo está em storage/logs. Repetições deste mesmo erro ficam sem aviso por '
            . config('monitoramento.alerta_erros_intervalo_minutos', 30) . ' minutos.';

        return implode("\n", $linhas);
    }
}

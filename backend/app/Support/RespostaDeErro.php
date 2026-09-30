<?php

namespace App\Support;

use App\Exceptions\PremiumRequiredException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Transforma QUALQUER exceção da API numa resposta JSON padronizada, sempre em
 * português e sem vazar detalhes internos (SQL, caminhos de arquivo, stack):
 *
 *   { "error": "frase para o usuário", "message": "(igual)", "codigo": "validacao",
 *     "errors": { campo: [..] }?, "premium_necessario": true?, "protocolo": "AB12CD34"? }
 *
 * O app lê `error`/`message`; `codigo` permite tratar o caso sem depender do texto.
 * Erros inesperados (500) recebem um `protocolo` que também vai para o log, para
 * o suporte achar a causa quando o usuário informar o código.
 */
class RespostaDeErro
{
    public static function deveResponderJson(Request $request): bool
    {
        // Requisições Inertia (navegação normal do site) seguem o fluxo de páginas.
        if ($request->header('X-Inertia')) {
            return false;
        }

        return $request->is('api/*') || $request->expectsJson();
    }

    public static function montar(Throwable $e, Request $request): JsonResponse
    {
        $cabecalhos = [];

        if ($e instanceof ValidationException) {
            $erros = $e->errors();
            $primeira = collect($erros)->flatten()->first();

            return self::json(422, 'validacao', $primeira ?: 'Confira os dados informados e tente novamente.', ['errors' => $erros]);
        }

        if ($e instanceof AuthenticationException) {
            return self::json(401, 'nao_autenticado', 'Sua sessão expirou. Entre novamente para continuar.');
        }

        if ($e instanceof PremiumRequiredException) {
            return self::json(403, 'premium', $e->getMessage(), ['premium_necessario' => true]);
        }

        if ($e instanceof AuthorizationException) {
            return self::json(403, 'proibido', 'Você não tem permissão para fazer isso.');
        }

        if ($e instanceof TokenMismatchException) {
            return self::json(419, 'sessao_expirada', 'A página expirou. Recarregue e tente novamente.');
        }

        if ($e instanceof ModelNotFoundException || $e instanceof NotFoundHttpException) {
            return self::json(404, 'nao_encontrado', 'Não encontramos o que você procurava. Ele pode ter sido removido.');
        }

        if ($e instanceof MethodNotAllowedHttpException) {
            return self::json(405, 'metodo_invalido', 'Esta ação não está disponível.');
        }

        if ($e instanceof ThrottleRequestsException) {
            $espera = (int) ($e->getHeaders()['Retry-After'] ?? 0);
            $cabecalhos = $e->getHeaders();

            return self::json(
                429,
                'muitas_requisicoes',
                'Muitas tentativas em pouco tempo. Aguarde ' . ($espera > 0 ? "{$espera}s" : 'um instante') . ' e tente de novo.',
                $espera > 0 ? ['espere_segundos' => $espera] : [],
                $cabecalhos,
            );
        }

        if ($e instanceof HttpExceptionInterface) {
            $status = $e->getStatusCode();
            $texto = trim((string) $e->getMessage());

            // Mensagens escritas por nós (ex.: abort(403, 'Acesso não autorizado.')) são seguras de mostrar.
            $mostrarTexto = in_array($status, [400, 403, 409, 422], true)
                && $texto !== ''
                && !in_array($texto, ['Forbidden', 'This action is unauthorized.', 'Bad Request'], true);

            if ($status < 500) {
                return self::json($status, 'requisicao_invalida', $mostrarTexto ? $texto : 'Não foi possível concluir esta ação.', [], $e->getHeaders());
            }

            return self::erroInterno($e, $request, $status);
        }

        return self::erroInterno($e, $request, 500);
    }

    private static function erroInterno(Throwable $e, Request $request, int $status): JsonResponse
    {
        $protocolo = strtoupper(Str::random(8));

        Log::error("Erro interno na API [{$protocolo}]", [
            'protocolo' => $protocolo,
            'excecao' => get_class($e),
            'mensagem' => $e->getMessage(),
            'arquivo' => $e->getFile() . ':' . $e->getLine(),
            'rota' => $request->method() . ' ' . $request->path(),
            'usuario_id' => optional($request->user())->id,
        ]);

        $extra = ['protocolo' => $protocolo];

        // Em desenvolvimento ajuda a achar o problema; em produção nunca vaza detalhes.
        if (config('app.debug')) {
            $extra['detalhe'] = get_class($e) . ': ' . $e->getMessage();
        }

        return self::json(
            $status,
            'erro_interno',
            "Algo deu errado do nosso lado. Tente novamente em instantes. Se persistir, informe o código {$protocolo} ao suporte.",
            $extra,
        );
    }

    private static function json(int $status, string $codigo, string $mensagem, array $extra = [], array $cabecalhos = []): JsonResponse
    {
        return response()->json(array_merge([
            'error' => $mensagem,
            'message' => $mensagem,
            'codigo' => $codigo,
        ], $extra), $status, $cabecalhos);
    }
}

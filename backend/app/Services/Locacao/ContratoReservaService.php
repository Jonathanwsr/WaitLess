<?php

namespace App\Services\Locacao;

use App\Models\Aluguel;
use App\Models\Contrato;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * Quem pode ver/gerenciar o contrato de uma reserva (avulsa ou de um local) e como ele é mostrado
 * ao cliente: texto para ler na tela e links temporários (assinados) para o PDF e o Word.
 */
class ContratoReservaService
{
    /** Validade dos links de download entregues ao app/site. */
    public const MINUTOS_LINK = 60;

    /** Lado do dono: o dono da reserva, sócios/gerentes do mesmo local e o admin. */
    public function podeGerenciar(Aluguel $aluguel, ?User $user): bool
    {
        if (!$user) {
            return false;
        }
        if ($user->papel === 'admin' || (int) $aluguel->estabelecimento_id === (int) $user->id || (int) $aluguel->proprietario_id === (int) $user->id) {
            return true;
        }

        // Locais de onde a reserva vem: o local do item (reservas do local) e os locais do dono (reservas avulsas).
        $locais = DB::table('estabelecimento_usuario')->where('usuario_id', $aluguel->estabelecimento_id)->pluck('estabelecimento_id');
        $localDoItem = DB::table('itens_aluguel')->where('id', $aluguel->item_aluguel_id)->value('local_id');
        if ($localDoItem) {
            $locais->push($localDoItem);
        }

        return DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->whereIn('estabelecimento_id', $locais->unique()->all())
            ->exists();
    }

    /** Ler o contrato: o cliente da reserva ou quem gerencia a reserva. */
    public function podeVer(Contrato $contrato, ?User $user): bool
    {
        $aluguel = $contrato->aluguel;
        if (!$aluguel || !$user) {
            return false;
        }

        return (int) $aluguel->locatario_id === (int) $user->id || $this->podeGerenciar($aluguel, $user);
    }

    /** Dados do contrato para a tela de detalhes da reserva (null quando ainda não há contrato). */
    public function paraTela(?Contrato $contrato, ?User $user = null): ?array
    {
        if (!$contrato) {
            return null;
        }
        $user ??= request()->user();
        $ehCliente = $user && (int) $contrato->aluguel?->locatario_id === (int) $user->id;

        return [
            'id' => $contrato->id,
            'numero' => $contrato->numero_contrato,
            'titulo' => $contrato->titulo,
            'gerado_em' => $contrato->created_at?->toIso8601String(),
            'enviado_em' => $contrato->enviado_em?->toIso8601String(),
            'assinado' => (bool) $contrato->assinado,
            // "Li e aceito": só o cliente da reserva, uma vez.
            'pode_aceitar' => !$contrato->assinado && $ehCliente,
            'aceite' => $contrato->assinado ? [
                'em' => $contrato->data_assinatura?->toIso8601String(),
                'como' => $contrato->plataforma_assinatura,
                'aparelho' => self::aparelhoLegivel($contrato->dispositivo_assinatura),
                'codigo' => $contrato->hash_assinatura ? strtoupper(substr($contrato->hash_assinatura, 0, 12)) : null,
            ] : null,
            'texto' => self::textoPuro($contrato->descricao),
            'pdf_url' => $contrato->arquivo_pdf ? $this->link($contrato, 'pdf') : null,
            'docx_url' => $contrato->arquivo_docx ? $this->link($contrato, 'docx') : null,
        ];
    }

    /** Contratos ficam no disco privado; arquivos antigos (gerados antes) ainda podem estar no público. */
    public const DISCO = 'local';

    public function link(Contrato $contrato, string $formato, ?int $minutos = null): string
    {
        return URL::temporarySignedRoute('contratos.arquivo', now()->addMinutes($minutos ?? self::MINUTOS_LINK), ['contrato' => $contrato->id, 'formato' => $formato]);
    }

    /** Link mais longo (7 dias) para o dono mandar pelo WhatsApp. */
    public function linkParaCompartilhar(Contrato $contrato): string
    {
        return $this->link($contrato, 'pdf', 60 * 24 * 7);
    }

    /** Disco em que o arquivo está (privado; ou público, para contratos antigos ainda não movidos). */
    public static function discoDo(?string $arquivo): ?string
    {
        if (!$arquivo) {
            return null;
        }
        foreach ([self::DISCO, 'public'] as $disco) {
            if (Storage::disk($disco)->exists($arquivo)) {
                return $disco;
            }
        }

        return null;
    }

    public function caminho(Contrato $contrato, string $formato): ?string
    {
        $arquivo = $formato === 'docx' ? $contrato->arquivo_docx : $contrato->arquivo_pdf;
        $disco = self::discoDo($arquivo);

        return $disco ? Storage::disk($disco)->path($arquivo) : null;
    }

    public static function apagarArquivos(Contrato $contrato): void
    {
        foreach ([$contrato->arquivo_pdf, $contrato->arquivo_docx] as $arquivo) {
            if ($arquivo) {
                Storage::disk(self::DISCO)->delete($arquivo);
                Storage::disk('public')->delete($arquivo);
            }
        }
    }

    /**
     * Aceite eletrônico do cliente ("Li e aceito"): registra data, IP, aparelho e uma impressão digital
     * (SHA-256) do documento aceito, marca a reserva como contrato assinado e avisa o proprietário.
     */
    public function aceitar(Contrato $contrato, User $cliente, ?string $ip, ?string $aparelho): Contrato
    {
        $aluguel = $contrato->aluguel;
        abort_unless($aluguel && (int) $aluguel->locatario_id === (int) $cliente->id, 403, 'Só o cliente da reserva pode aceitar este contrato.');
        abort_if($contrato->assinado, 422, 'Este contrato já foi aceito.');

        $agora = now();
        $caminho = $this->caminho($contrato, 'pdf');
        $documento = $caminho ? hash_file('sha256', $caminho) : hash('sha256', (string) $contrato->descricao);

        $contrato->update([
            'assinado' => true,
            'plataforma_assinatura' => 'Lokyva (aceite eletrônico)',
            'data_assinatura' => $agora,
            'ip_assinatura' => $ip ? substr($ip, 0, 45) : null,
            'dispositivo_assinatura' => $aparelho ? mb_substr($aparelho, 0, 255) : null,
            'hash_assinatura' => hash('sha256', implode('|', [$documento, $contrato->id, $cliente->id, $agora->toIso8601String(), $ip])),
        ]);
        $aluguel->update(['contrato_assinado' => true]);

        $this->avisarDono($contrato, $cliente);

        return $contrato->fresh();
    }

    private function avisarDono(Contrato $contrato, User $cliente): void
    {
        $dono = User::find($contrato->aluguel->estabelecimento_id);
        if (!$dono) {
            return;
        }
        $titulo = 'Contrato aceito';
        $texto = "{$cliente->name} leu e aceitou o contrato {$contrato->numero_contrato}.";
        try {
            $notificacoes = app(\App\Services\NotificacaoService::class);
            if ($dono->expo_push_token) {
                $notificacoes->enviarPush($dono, $titulo, $texto, ['tipo' => 'contrato_aceito', 'rota' => '/Proprietario/contratos']);
            }
            if ($dono->email && !app()->runningUnitTests()) {
                $notificacoes->enviarEmailBrevo($dono, $titulo . ' · ' . $contrato->numero_contrato, '<p>' . e($texto) . '</p><p>O aceite ficou registrado com data, hora e aparelho na sua área de Contratos.</p>');
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::info('Aviso de contrato aceito não enviado: ' . $e->getMessage());
        }
    }

    /** "Chrome no Android", "App LOKYVA (iPhone)"... a partir do User-Agent. */
    public static function aparelhoLegivel(?string $ua): ?string
    {
        if (!$ua) {
            return null;
        }
        $sistema = match (true) {
            str_contains($ua, 'iPhone') || str_contains($ua, 'iOS') => 'iPhone',
            str_contains($ua, 'iPad') => 'iPad',
            str_contains($ua, 'Android') => 'Android',
            str_contains($ua, 'Windows') => 'Windows',
            str_contains($ua, 'Mac OS') || str_contains($ua, 'Macintosh') => 'Mac',
            str_contains($ua, 'Linux') => 'Linux',
            default => null,
        };
        $onde = match (true) {
            str_contains($ua, 'LOKYVA-App') || str_contains($ua, 'okhttp') || str_contains($ua, 'Expo') || str_contains($ua, 'CFNetwork') => 'App LOKYVA',
            str_contains($ua, 'Edg/') => 'Edge',
            str_contains($ua, 'Chrome') => 'Chrome',
            str_contains($ua, 'Firefox') => 'Firefox',
            str_contains($ua, 'Safari') => 'Safari',
            default => 'Navegador',
        };

        return $sistema ? "{$onde} · {$sistema}" : $onde;
    }

    /** HTML do contrato (escrito pelo dono) em texto simples, seguro para mostrar na tela. */
    public static function textoPuro(?string $html): ?string
    {
        if (!$html || !trim($html)) {
            return null;
        }

        $texto = preg_replace(['~<\s*br\s*/?>~i', '~</\s*(p|div|h[1-6]|li|tr)\s*>~i'], "\n", $html);
        $texto = html_entity_decode(strip_tags($texto), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $texto = preg_replace("/[ \t]+/", ' ', $texto);
        $texto = preg_replace("/\n\s*\n\s*\n+/", "\n\n", $texto);

        return trim($texto) ?: null;
    }
}

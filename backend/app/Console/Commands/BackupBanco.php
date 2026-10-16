<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

/**
 * Backup do PostgreSQL com pg_dump (formato custom, comprimido). Guarda no disco privado,
 * apaga os antigos (mantém os N mais recentes) e, se configurado, envia uma cópia para outro disco (ex.: S3).
 * Restaurar: pg_restore --clean --if-exists -d NOME_DO_BANCO arquivo.dump
 */
class BackupBanco extends Command
{
    protected $signature = 'backup:banco {--manter= : Quantos backups manter (padrão: config monitoramento.backup.manter)}';

    protected $description = 'Faz o backup diário do banco PostgreSQL e apaga os mais antigos';

    public function handle(): int
    {
        $conexao = config('database.connections.' . config('database.default'));
        if (($conexao['driver'] ?? null) !== 'pgsql') {
            $this->warn('O backup automático é só para PostgreSQL (banco atual: ' . ($conexao['driver'] ?? '?') . ').');

            return self::SUCCESS;
        }

        $cfg = config('monitoramento.backup');
        $disco = Storage::disk($cfg['disco']);
        $disco->makeDirectory($cfg['pasta']);
        $nome = $cfg['pasta'] . '/' . $conexao['database'] . '_' . now()->format('Y-m-d_His') . '.dump';
        $destino = $disco->path($nome);

        $resultado = Process::timeout(1800)
            ->env(['PGPASSWORD' => (string) ($conexao['password'] ?? '')])
            ->run([
                $cfg['pg_dump'],
                '--host=' . $conexao['host'],
                '--port=' . $conexao['port'],
                '--username=' . $conexao['username'],
                '--format=custom',
                '--no-owner',
                '--file=' . $destino,
                $conexao['database'],
            ]);

        if (!$resultado->successful() || !$disco->exists($nome) || $disco->size($nome) === 0) {
            $disco->delete($nome);
            $erro = trim($resultado->errorOutput()) ?: 'pg_dump não gerou o arquivo.';
            $this->error('Backup falhou: ' . $erro);
            $this->avisarFalha($erro);

            return self::FAILURE;
        }

        $tamanho = round($disco->size($nome) / 1048576, 2);
        $this->info("Backup criado: {$nome} ({$tamanho} MB)");

        if (!empty($cfg['copia_externa'])) {
            try {
                Storage::disk($cfg['copia_externa'])->writeStream($nome, $disco->readStream($nome));
                $this->info('Cópia enviada para o disco ' . $cfg['copia_externa'] . '.');
            } catch (\Throwable $e) {
                $this->warn('Não deu para copiar para o disco externo: ' . $e->getMessage());
                $this->avisarFalha('Backup local OK, mas a cópia externa falhou: ' . $e->getMessage());
            }
        }

        $this->limpar($cfg, (int) ($this->option('manter') ?: $cfg['manter']));

        return self::SUCCESS;
    }

    private function limpar(array $cfg, int $manter): void
    {
        $manter = max(1, $manter);
        $disco = Storage::disk($cfg['disco']);
        $arquivos = collect($disco->files($cfg['pasta']))
            ->filter(fn ($f) => str_ends_with($f, '.dump'))
            ->sortDesc()
            ->values();

        foreach ($arquivos->slice($manter) as $antigo) {
            $disco->delete($antigo);
            $this->line('Apagado backup antigo: ' . $antigo);
        }
    }

    private function avisarFalha(string $erro): void
    {
        $para = config('monitoramento.alerta_erros_email');
        if (!$para) {
            return;
        }
        try {
            Mail::raw("O backup diário do banco falhou em " . now()->format('d/m/Y H:i') . ".\n\n{$erro}\n\nConfira PG_DUMP_BIN e as credenciais do banco no .env.", function ($m) use ($para) {
                $m->to($para)->subject('[' . config('app.name') . '] Backup do banco falhou');
            });
        } catch (\Throwable $e) {
            logger()->warning('Aviso de backup não enviado: ' . $e->getMessage());
        }
    }
}

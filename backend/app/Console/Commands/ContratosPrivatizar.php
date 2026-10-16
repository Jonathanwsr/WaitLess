<?php

namespace App\Console\Commands;

use App\Models\Contrato;
use App\Services\Locacao\ContratoReservaService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Move os contratos antigos (gerados quando ficavam em storage/app/public) para o disco privado.
 * Depois disso, o PDF/Word só abre por link assinado — não dá mais para adivinhar a URL.
 */
class ContratosPrivatizar extends Command
{
    protected $signature = 'contratos:privatizar {--simular : Só mostra o que seria movido}';

    protected $description = 'Move os arquivos de contratos da pasta pública para o disco privado';

    public function handle(): int
    {
        $publico = Storage::disk('public');
        $privado = Storage::disk(ContratoReservaService::DISCO);
        $movidos = 0;

        Contrato::query()->select(['id', 'arquivo_pdf', 'arquivo_docx'])->orderBy('id')->chunkById(200, function ($contratos) use ($publico, $privado, &$movidos) {
            foreach ($contratos as $contrato) {
                foreach ([$contrato->arquivo_pdf, $contrato->arquivo_docx] as $arquivo) {
                    if (!$arquivo || !$publico->exists($arquivo)) {
                        continue;
                    }
                    if ($this->option('simular')) {
                        $this->line("Moveria: {$arquivo}");
                        $movidos++;
                        continue;
                    }
                    if (!$privado->exists($arquivo)) {
                        $privado->writeStream($arquivo, $publico->readStream($arquivo));
                    }
                    if ($privado->exists($arquivo) && $privado->size($arquivo) === $publico->size($arquivo)) {
                        $publico->delete($arquivo);
                        $movidos++;
                    } else {
                        $this->warn("Não confirmado, mantido no público: {$arquivo}");
                    }
                }
            }
        });

        // Sobras na pasta pública que não pertencem a nenhum contrato (ex.: fluxo antigo de assinatura).
        foreach (['contratos', 'contratos/assinados'] as $pasta) {
            foreach ($publico->files($pasta) as $arquivo) {
                if ($this->option('simular')) {
                    $this->line("Moveria (sem contrato): {$arquivo}");
                    $movidos++;
                    continue;
                }
                if (!$privado->exists($arquivo)) {
                    $privado->writeStream($arquivo, $publico->readStream($arquivo));
                }
                $publico->delete($arquivo);
                $movidos++;
            }
        }

        $this->info(($this->option('simular') ? 'Seriam movidos: ' : 'Arquivos movidos para o disco privado: ') . $movidos);

        return self::SUCCESS;
    }
}

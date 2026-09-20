<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoboExecucao extends Model
{
    protected $table = 'robo_execucoes';

    protected $fillable = [
        'comando',
        'disparado_por',
        'iniciado_em',
        'finalizado_em',
        'sucesso',
        'itens_processados',
        'mensagem',
    ];

    protected $casts = [
        'iniciado_em' => 'datetime',
        'finalizado_em' => 'datetime',
        'sucesso' => 'boolean',
    ];

    /**
     * Cria o registro de início da execução (usado por Console\Commands e pelo
     * disparo manual do admin) e devolve a instância para ser fechada no final.
     */
    public static function iniciar(string $comando, string $disparadoPor = 'agendado'): self
    {
        return self::create([
            'comando' => $comando,
            'disparado_por' => $disparadoPor,
            'iniciado_em' => now(),
        ]);
    }

    public function finalizar(bool $sucesso, int $itensProcessados = 0, ?string $mensagem = null): void
    {
        $this->update([
            'finalizado_em' => now(),
            'sucesso' => $sucesso,
            'itens_processados' => $itensProcessados,
            'mensagem' => $mensagem,
        ]);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Aluguel extends Model
{
    use SoftDeletes;

    protected $table = 'alugueis';

    // Protege apenas o ID, permitindo o preenchimento em massa de todos os novos campos de endereço automaticamente
    protected $guarded = ['id'];

    protected $casts = [
        // Controle de Datas e Horários
        'data_inicio' => 'datetime',
        'data_fim' => 'datetime',
        'data_checkin' => 'datetime',
        'data_checkout' => 'datetime',
        'data_devolucao_prevista' => 'datetime',
        'data_devolucao_real' => 'datetime',

        // Flags e Controles Booleanos
        'pagamento_confirmado' => 'boolean',
        'contrato_assinado' => 'boolean',
        'renovacao_automatica' => 'boolean',
        'permitir_cancelamento' => 'boolean',
        'seguro_contratado' => 'boolean',

        // Tipagem de Valores Monetários
        'valor_unitario' => 'decimal:2',
        'desconto' => 'decimal:2',
        'taxa_servico' => 'decimal:2',
        'valor_caucao' => 'decimal:2',
        'valor_multa_atraso' => 'decimal:2',
        'valor_danos' => 'decimal:2',
        'multa_cancelamento' => 'decimal:2',
        'valor_total' => 'decimal:2',

        // Coordenadas de Retirada e Entrega (Precisão de 7 casas decimais)
        'latitude_retirada' => 'decimal:7',
        'longitude_retirada' => 'decimal:7',
        'latitude_entrega' => 'decimal:7',
        'longitude_entrega' => 'decimal:7',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(ItemAluguel::class, 'item_aluguel_id');
    }

    public function locatario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'locatario_id');
    }

    public function proprietario(): BelongsTo
    {
        return $this->belongsTo(User::class, 'proprietario_id');
    }

    public function contratoDocumento(): BelongsTo
    {
        return $this->belongsTo(Contrato::class, 'contrato_id');
    }
}
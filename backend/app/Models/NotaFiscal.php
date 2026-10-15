<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotaFiscal extends Model
{
    protected $table = 'notas_fiscais';

    protected $fillable = [
        'pagamento_id',
        'provider_id',
        'assinatura_id',
        'cobranca_parcela_id',
        'usuario_id',
        'tipo',
        'asaas_invoice_id',
        'referencia_cobranca',
        'status',
        'valor',
        'valor_operacao',
        'percentual',
        'numero',
        'descricao_servico',
        'pdf_url',
        'xml_url',
        'mensagem_erro',
        'emitida_em',
    ];

    protected $casts = [
        'valor' => 'decimal:2',
        'valor_operacao' => 'decimal:2',
        'percentual' => 'decimal:2',
        'emitida_em' => 'datetime',
    ];

    public function pagamento()
    {
        return $this->belongsTo(Pagamento::class);
    }

    public function provider()
    {
        return $this->belongsTo(Provider::class);
    }

    public function assinatura()
    {
        return $this->belongsTo(Assinatura::class);
    }

    public function cobrancaParcela()
    {
        return $this->belongsTo(CobrancaParcela::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}

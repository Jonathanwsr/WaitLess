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
        'usuario_id',
        'tipo',
        'asaas_invoice_id',
        'referencia_cobranca',
        'status',
        'valor',
        'descricao_servico',
        'pdf_url',
        'mensagem_erro',
    ];

    protected $casts = [
        'valor' => 'decimal:2',
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

    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}

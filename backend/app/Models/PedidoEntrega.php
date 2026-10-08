<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PedidoEntrega extends Model
{
    use HasFactory;

    protected $table = 'pedidos_entrega';

    protected $guarded = ['id'];

    // Só o cliente vê o código (ver PedidoEntregaController::dadosDoPedidoParaCliente);
    // o vendedor precisa digitá-lo na entrega, nunca recebê-lo na resposta.
    protected $hidden = ['codigo_confirmacao'];

    protected $casts = [
        'valor_unitario' => 'decimal:2',
        'valor_total' => 'decimal:2',
        'taxa_plataforma' => 'decimal:2',
        'taxa_entrega' => 'decimal:2',
        'data_conclusao' => 'datetime',
        'data_cancelamento' => 'datetime',
    ];

    public function cliente()
    {
        return $this->belongsTo(User::class, 'cliente_id');
    }

    public function vendedor()
    {
        return $this->belongsTo(User::class, 'vendedor_id');
    }

    public function funcionario()
    {
        return $this->belongsTo(Funcionario::class, 'funcionario_id');
    }

    public function entregador()
    {
        return $this->belongsTo(User::class, 'entregador_usuario_id');
    }

    public function atribuidoPor()
    {
        return $this->belongsTo(User::class, 'atribuido_por');
    }

    public function produto()
    {
        return $this->belongsTo(ProdutoEntrega::class, 'produto_entrega_id');
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function pagamento()
    {
        return $this->belongsTo(Pagamento::class);
    }

    public function estorno()
    {
        return $this->hasOne(Estorno::class, 'pedido_entrega_id');
    }
}

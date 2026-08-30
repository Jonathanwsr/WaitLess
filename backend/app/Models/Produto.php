<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Produto extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nome', 'descricao', 'cor', 'tamanho', 'usuario_id', 'estabelecimento_id', 
        'usuario_estabelecimento_id', 'pagamento_id', 'servico_id', 'agendamento_id', 
        'aluguel_id', 'is_promocao', 'valor_normal', 'valor_promocional', 'valor_final',
        'fotos', 'somente_premium', 'estoque_disponivel', 'quantidade_vendida',
        'categoria', 'subcategoria', 'atrelado_reservas'
    ];

    protected $casts = [
        'fotos' => 'array',
        'is_promocao' => 'boolean',
        'somente_premium' => 'boolean',
        'atrelado_reservas' => 'boolean',
    ];

    // Relações básicas
    public function estabelecimento() {
        return $this->belongsTo(Estabelecimento::class);
    }

    // Produto pertence a um Usuário (quem cadastrou)
    public function usuario()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }

    

    // Produto pode estar atrelado a um funcionário/usuário específico do estabelecimento
    public function usuarioEstabelecimento()
    {
        return $this->belongsTo(UsuarioEstabelecimento::class, 'usuario_estabelecimento_id');
    }

    // Produto pode ter um pagamento vinculado diretamente
    public function pagamento()
    {
        return $this->belongsTo(Pagamento::class, 'pagamento_id');
    }

    // Produto pode estar atrelado a um Serviço
    public function servico()
    {
        return $this->belongsTo(Servico::class, 'servico_id');
    }

    // Produto pode estar atrelado a um Agendamento
    public function agendamento()
    {
        return $this->belongsTo(Agendamento::class, 'agendamento_id');
    }

    // Produto pode estar atrelado a um Aluguel (ou Alugueis, dependendo do nome do seu Model)
    public function aluguel()
    {
        return $this->belongsTo(Aluguel::class, 'aluguel_id'); 
    }
}
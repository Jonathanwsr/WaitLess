<?php

namespace App\Models;

use Laravel\Sanctum\HasApiTokens;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use App\Models\Cupom;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'papel', 
        'plano_assinatura',
        'plano_expira_em',
        'pontos_saldo',
        'telefone',
        'numero_servicos',
        'numero_reservas',
        'asaas_customer_id',
        'asaas_subscription_id',
        'asaas_subscription_status',


       
    'cpf_cnpj',
    'mobile_phone',
    'phone',
    'postal_code',
    'address',
    'address_number',
    'complement',
    'province',
    'city',
    'state',
    'person_type',
    'birth_date',
    'notification_disabled',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    public function cupons()
    {
        return $this->belongsToMany(Cupom::class, 'cupom_user')
                    ->withPivot('usado')
                    ->withTimestamps();
    }

public function estabelecimentosGerenciados()
{
    return $this->belongsToMany(
        Estabelecimento::class, 
        'estabelecimento_usuario',
        'usuario_id',             
        'estabelecimento_id'      
    )
    ->withPivot('tipo')
    ->withTimestamps();
}

public function estabelecimentosComoCliente()
{
    
    return $this->belongsToMany(Estabelecimento::class, 'cliente_estabelecimento')
                ->withTimestamps();
}

public function agendamentos()
{
    return $this->hasMany(Agendamento::class);
}

public function pontos()
{
    return $this->hasMany(PontoUsuarioEstabelecimento::class);
}

public function estabelecimentos()
    {
        return $this->belongsToMany(
            Estabelecimento::class, 
            'estabelecimento_usuario', 
            'usuario_id', 
            'estabelecimento_id'
        )->withPivot('tipo')->withTimestamps();
    }

    /**
     * Relação com a tabela de Assinaturas (Histórico)
     */
    public function assinaturas()
    {
        return $this->hasMany(Assinatura::class);
    }

    /**
     * Pega a assinatura ativa no momento
     */
    public function assinaturaAtiva()
    {
        return $this->hasOne(Assinatura::class)->where('status', 'ativa')->latestOfMany();
    }

    /**
     * Helper prático para verificar qual é o plano atual do usuário
     */
    public function getPlanoAtualAttribute()
    {
        $assinatura = $this->assinaturaAtiva;
        return $assinatura ? $assinatura->nome_plano : 'gratuito';
    }


    public function cuponsResgatados()
    {
        return $this->belongsToMany(Cupom::class, 'cupom_user')
                    ->withPivot('usado')
                    ->withTimestamps();
    }

}

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
        'expo_push_token',


       
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

    // Perfil (já enviados pelo cadastro web e mobile, mas nunca listados aqui
    // — o Eloquent descartava esses campos em silêncio no User::create()).
    'onde_estudei',
    'onde_moro',
    'idiomas',
    'profissao',
    'sobre_mim',
    'foto_perfil',

    // Aceite do Termo de Compromisso (colunas já existiam desde a migration
    // de anfitrião, mas nunca tinham sido liberadas para mass-assignment —
    // o cadastro sempre enviou esses campos e eles sempre foram descartados).
    'termo_compromisso_aceito',
    'termo_compromisso_aceito_em',
    'termo_compromisso_ip',
    'termo_compromisso_versao',
    'termo_compromisso_user_agent',
    'termo_compromisso_rejeitado_em',
    'termo_compromisso_observacao',
    ];

    protected $casts = [
        'termo_compromisso_aceito' => 'boolean',
        'termo_compromisso_aceito_em' => 'datetime',
        'termo_compromisso_rejeitado_em' => 'datetime',
        'plano_expira_em' => 'datetime',
    ];

    /**
     * Verifica se o usuário tem QUALQUER plano premium ativo (premium,
     * premium-plus, premium-socio, premium-anual, premium-socio-anual —
     * ver App\Services\PlanoService::PLANOS_PREMIUM). Vários pontos do
     * sistema comparavam plano_assinatura com o valor fixo 'plus', que não
     * corresponde a nenhum plano realmente vendido — essa checagem nunca
     * era verdadeira para um assinante de verdade.
     */
    public function isPremium(): bool
    {
        return $this->plano_assinatura
            && str_starts_with($this->plano_assinatura, 'premium')
            && $this->plano_expira_em
            && $this->plano_expira_em->isFuture();
    }

    /**
     * Só o sócio no plano premium mais alto (premium-socio ou
     * premium-socio-anual — ver App\Services\PlanoService::PLANOS_PREMIUM)
     * pode convidar outros sócios e criar gerentes sem limite. Planos mais
     * básicos (premium, premium-anual) continuam só com atendente/funcionário.
     */
    public function podeGerenciarEquipeAvancada(): bool
    {
        return $this->papel === 'socio'
            && $this->isPremium()
            && in_array($this->plano_assinatura, ['premium-socio', 'premium-socio-anual'], true);
    }

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
    // Adicione o 'usuario_id' como segundo parâmetro!
    return $this->hasMany(Agendamento::class, 'usuario_id');
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

    public function favoritos() {
    return $this->hasMany(Favorito::class, 'usuario_id');
}


 
}

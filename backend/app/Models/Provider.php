<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Provider extends Model
{
    use HasFactory;

   protected $fillable = [
        'user_id',
        'name',
        'email',
        'person_type',
        'document',
        'birth_date',
        'income_value',
        'mobile_phone',
        'postal_code',
        'address',
        'address_number',
        'complement',
        'province',
        'company_type',
        'responsible_name',
        'responsible_cpf',
        'pix_key_type',
        'pix_key',
        'asaas_wallet_id',
        'asaas_api_key',
        'asaas_status',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

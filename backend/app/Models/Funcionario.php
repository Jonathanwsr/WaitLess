<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Funcionario extends Model
{
    protected $guarded = ['id'];

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class);
    }

    public function usuario()
    {
        return $this->belongsTo(User::class); // Se o funcionário tiver login no sistema
    }

    public function agendamentos()
    {
        return $this->hasMany(Agendamento::class);
    }
}
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentoEstorno extends Model
{
    protected $table = 'documentos_estorno';

    protected $guarded = ['id'];

    public function estorno()
    {
        return $this->belongsTo(Estorno::class);
    }

    public function enviou()
    {
        return $this->belongsTo(User::class, 'usuario_id');
    }
}
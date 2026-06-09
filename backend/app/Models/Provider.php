<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Provider extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'name', 'email', 'document', 'pix_key_type', 'pix_key'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}

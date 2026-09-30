<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ContaBancariaRepasse extends Model
{
    protected $table = 'contas_bancarias_repasse';

    protected $fillable = [
        'provider_id', 'user_id', 'apelido', 'tipo',
        'pix_key_type', 'pix_key',
        'banco_codigo', 'banco_nome', 'agencia', 'conta', 'conta_digito', 'tipo_conta',
        'titular_nome', 'titular_documento',
        'status_validacao', 'validada_em', 'validacao_transferencia_id', 'tentativas_validacao',
        'ultimo_erro_codigo', 'ultimo_erro_mensagem',
        'padrao', 'ativa',
    ];

    protected $casts = [
        'validada_em' => 'datetime',
        'padrao' => 'boolean',
        'ativa' => 'boolean',
    ];

    public function provider()
    {
        return $this->belongsTo(Provider::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function transferencias()
    {
        return $this->hasMany(TransferenciaCarteira::class, 'conta_bancaria_id');
    }

    public function estaValidada(): bool
    {
        return $this->status_validacao === 'validada';
    }

    /** Texto que identifica o destino sem expor a chave/conta inteira. */
    public function destinoMascarado(): string
    {
        if ($this->tipo === 'PIX') {
            $chave = (string) $this->pix_key;
            $visivel = mb_strlen($chave) > 8 ? mb_substr($chave, 0, 3) . '•••' . mb_substr($chave, -3) : '•••';
            return "Pix ({$this->pix_key_type}) {$visivel}";
        }

        $conta = (string) $this->conta;
        return trim(($this->banco_nome ?: "Banco {$this->banco_codigo}") . " · Ag {$this->agencia} · Cc ••" . mb_substr($conta, -3));
    }

    /** Formato usado pelas telas (web e mobile). */
    public function paraTela(): array
    {
        return [
            'id' => $this->id,
            'apelido' => $this->apelido,
            'tipo' => $this->tipo,
            'destino' => $this->destinoMascarado(),
            'titular_nome' => $this->titular_nome,
            'status_validacao' => $this->status_validacao,
            'validada_em' => optional($this->validada_em)->toIso8601String(),
            'erro' => $this->status_validacao === 'falhou' ? $this->ultimo_erro_mensagem : null,
            'padrao' => $this->padrao,
        ];
    }
}

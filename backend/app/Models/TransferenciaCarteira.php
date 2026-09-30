<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TransferenciaCarteira extends Model
{
    protected $table = 'transferencias_carteira';

    public const TIPO_REPASSE = 'repasse';
    public const TIPO_ANTECIPACAO = 'antecipacao';
    public const TIPO_VALIDACAO = 'validacao';

    public const NOMES = [
        self::TIPO_REPASSE => 'Repasse semanal',
        self::TIPO_ANTECIPACAO => 'Repasse antecipado',
        self::TIPO_VALIDACAO => 'Validação de conta',
    ];

    protected $fillable = [
        'provider_id', 'user_id', 'conta_bancaria_id',
        'tipo', 'nome', 'origem',
        'valor_bruto', 'taxa_plataforma', 'taxa_asaas', 'valor_liquido',
        'status', 'external_reference', 'asaas_transfer_id', 'asaas_taxa_transfer_id', 'asaas_status',
        'taxa_status', 'saldo_local_debitado',
        'erro_codigo', 'erro_mensagem', 'erro_detalhe',
        'payload_enviado', 'resposta_asaas', 'tentativas', 'processado_em',
    ];

    protected $casts = [
        'valor_bruto' => 'decimal:2',
        'taxa_plataforma' => 'decimal:2',
        'taxa_asaas' => 'decimal:2',
        'valor_liquido' => 'decimal:2',
        'saldo_local_debitado' => 'decimal:2',
        'payload_enviado' => 'array',
        'resposta_asaas' => 'array',
        'processado_em' => 'datetime',
    ];

    public function provider()
    {
        return $this->belongsTo(Provider::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function conta()
    {
        return $this->belongsTo(ContaBancariaRepasse::class, 'conta_bancaria_id');
    }

    public function emAndamento(): bool
    {
        return in_array($this->status, ['pendente', 'processando'], true);
    }

    /** Formato usado pelo proprietário (sem detalhes técnicos). */
    public function paraProprietario(): array
    {
        return [
            'id' => $this->id,
            'nome' => $this->nome,
            'tipo' => $this->tipo,
            'status' => $this->status,
            'valor_bruto' => (float) $this->valor_bruto,
            'taxa_plataforma' => (float) $this->taxa_plataforma,
            'valor_liquido' => (float) $this->valor_liquido,
            'destino' => optional($this->conta)->destinoMascarado(),
            'erro' => $this->status === 'falhou' ? $this->erro_mensagem : null,
            'criado_em' => optional($this->created_at)->toIso8601String(),
            'processado_em' => optional($this->processado_em)->toIso8601String(),
        ];
    }
}

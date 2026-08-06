<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Estorno extends Model
{
    use HasFactory;

    protected $table = 'estornos';

    protected $guarded = ['id'];
    
    protected $casts = [
        'prestador_visualizou' => 'boolean',
        'prestador_respondeu' => 'boolean',
        'data_visualizacao_prestador' => 'datetime',
        'data_resposta_prestador' => 'datetime',
        'prazo_resposta' => 'datetime',
        'data_pagamento' => 'datetime',
        'data_solicitacao' => 'datetime',
        'data_aprovacao' => 'datetime',
        'data_estorno' => 'datetime',
        'data_cancelamento' => 'datetime',
        'valor_pago' => 'decimal:2',
        'valor_estornado' => 'decimal:2',
        'taxa_plataforma' => 'decimal:2',
        'taxa_asaas' => 'decimal:2',
        'valor_liquido' => 'decimal:2',
    ];

    // ==========================================
    // RELACIONAMENTOS
    // ==========================================
    public function cliente() 
    { 
        return $this->belongsTo(User::class, 'usuario_id'); 
    }

    public function prestador() 
    { 
        return $this->belongsTo(User::class, 'prestador_id'); 
    }

    public function estabelecimento() 
    { 
        return $this->belongsTo(Estabelecimento::class); 
    }

    public function pagamento() 
    { 
        return $this->belongsTo(Pagamento::class); 
    }

    public function servico() 
    { 
        return $this->belongsTo(Servico::class); 
    }

    public function itemAluguel() 
    { 
        return $this->belongsTo(ItemAluguel::class); 
    }
    
    // Relacionamentos com as tabelas de apoio
    public function historicos() 
    { 
        return $this->hasMany(HistoricoEstorno::class); 
    }

    public function mensagens() 
    { 
        return $this->hasMany(MensagemEstorno::class); 
    }

    public function documentos() 
    { 
        return $this->hasMany(DocumentoEstorno::class); 
    }

    public function notificacoes() 
    { 
        return $this->hasMany(NotificacaoEstorno::class); 
    }

    // ==========================================
    // REGRAS DE NEGÓCIO E MÉTODOS AUXILIARES
    // ==========================================
    
    /**
     * Processa a devolução do dinheiro após o Asaas confirmar
     */
    public function processarEstornoConcluido()
    {
        DB::transaction(function () {
            // Atualiza Status do Estorno
            $this->update([
                'status' => 'ESTORNADO',
                'data_estorno' => now()
            ]);

            // Regra de Gamificação: Desconta os pontos ganhos
            $pontosGanhos = $this->pagamento->pontos_gerados ?? 0;
            if ($pontosGanhos > 0) {
                $this->cliente->decrement('pontos_saldo', $pontosGanhos);
            }

            // Subtrai o valor da Wallet do prestador
            $providerWallet = $this->prestador->provider;
            if ($providerWallet) {
                $providerWallet->decrement('valor_retido', $this->valor_estornado);
                $providerWallet->increment('valor_estornado', $this->valor_estornado);
            }

            // Marca o pagamento como estornado
            $this->pagamento->update([
                'permite_estorno' => false,
                'status_estorno' => 'CONCLUIDO',
                'valor_estornado' => $this->valor_estornado,
                'data_estorno' => now()
            ]);

            // Salva Auditoria Financeira
            LogFinanceiro::create([
                'usuario_id' => $this->usuario_id,
                'prestador_id' => $this->prestador_id,
                'estorno_id' => $this->id,
                'pagamento_id' => $this->pagamento_id,
                'tipo' => 'ESTORNO',
                'descricao' => 'Estorno aprovado e concluído via plataforma.',
                'valor' => $this->valor_estornado,
                'saldo_anterior' => ($providerWallet->valor_retido ?? 0) + $this->valor_estornado,
                'saldo_atual' => ($providerWallet->valor_retido ?? 0),
            ]);
        });
    }
}
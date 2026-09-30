<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ItemAluguel extends Model
{
    use SoftDeletes;

    protected $table = 'itens_aluguel';

    protected $guarded = ['id'];

    protected $appends = ['permite_entrega'];

    protected $casts = [
        'disponivel' => 'boolean',
        'ativo' => 'boolean',
        'somente_premium' => 'boolean',
        'valor_diaria' => 'decimal:2',
        'valor_semanal' => 'decimal:2',
        'valor_mensal' => 'decimal:2',
        'valor_caucao' => 'decimal:2',
        'mobiliado' => 'boolean',
        'aceita_pet' => 'boolean',
        'possui_wifi' => 'boolean',
        'possui_ar_condicionado' => 'boolean',
        'piscina' => 'boolean',
        'churrasqueira' => 'boolean',
        'possui_seguro' => 'boolean',
        'recursos_oferecidos' => 'array', 
        'acessorios' => 'array',
        'dias_semana_disponiveis' => 'array',
         'dias_mes_disponiveis' => 'array',
         'datas_permitidas' => 'array',
         'datas_bloqueadas' => 'array',
         'horarios_bloqueados' => 'array',
         'sempre_disponivel' => 'boolean',
         'disponibilidade_por_data' => 'boolean',
        'quantidade_padrao'        => 'integer',
        'dias_disponiveis'         => 'array', // Converte o JSON do banco para Array no PHP
        'horarios_disponiveis'     => 'array', // Converte o JSON do banco para Array no PHP
        'valor'                    => 'decimal:2',
        'valor_original'           => 'decimal:2',
        'percentual_desconto'      => 'decimal:2',
    
        'valor_final'              => 'decimal:2',
        'fotos'                    => 'array',
        'horario_retirada'         => 'datetime:H:i',
        'horario_entrega'          => 'datetime:H:i',

    ];

    /**
     * Categorias oferecidas nas telas de "Locações Avulsas" (dono aluga
     * direto, sem estabelecimento) — subconjunto curado do enum completo
     * de `categoria` (ver migration 2026_09_19_203535_...), agrupado por
     * imóvel/veículo/equipamento pra montar o filtro no front-end.
     */
    const CATEGORIAS_LOCACAO_AVULSA = [
        'Imóveis' => ['casa', 'apartamento', 'casa_praia', 'flat', 'chalé', 'cabana', 'kitnet', 'cobertura', 'sitio', 'chacara'],
        'Veículos' => ['carro', 'moto', 'bicicleta', 'bicicleta_eletrica', 'patinete', 'patinete_eletrico', 'van', 'motorhome', 'trailer', 'barco', 'lancha'],
        'Espaços' => ['sala', 'auditorio', 'espaco_eventos', 'salão_festas', 'quadra', 'quadra_futebol', 'quadra_volei', 'academia'],
        'Equipamentos' => ['equipamento', 'ferramenta', 'gerador', 'compressor', 'camera', 'drone', 'notebook', 'projetor', 'audio_video', 'tenda'],
        'Outros' => ['outro'],
    ];

    /**
     * Categorias de bens "móveis" — só neles faz sentido combinar local de
     * entrega/retirada (e devolução). Imóveis, espaços, quadras e serviços
     * são usados no próprio local, então não têm esse conceito.
     */
    const CATEGORIAS_COM_ENTREGA = [
        // Veículos
        'carro', 'moto', 'bicicleta', 'bicicleta_eletrica', 'patinete', 'patinete_eletrico', 'van', 'onibus',
        'micro_onibus', 'caminhao', 'carreta', 'motorhome', 'trailer', 'jet_ski', 'barco', 'lancha', 'iate', 'caiaque',
        // Equipamentos
        'equipamento', 'ferramenta', 'equipamento_construcao', 'equipamento_agricola', 'equipamento_industrial',
        'andaime', 'betoneira', 'gerador', 'compressor', 'escada',
        // Tecnologia
        'camera', 'camera_fotografica', 'camera_filmagem', 'drone', 'notebook', 'computador', 'tablet', 'projetor',
        'impressora', 'monitor', 'videogame',
        // Áudio e vídeo
        'audio_video', 'caixa_som', 'mesa_som', 'microfone', 'telão', 'painel_led', 'iluminacao', 'karaoke',
        // Eventos
        'palco', 'tenda', 'cadeira', 'mesa', 'decoracao', 'brinquedo_inflavel',
        // Vestuário
        'roupa', 'terno', 'vestido', 'fantasia',
        // Sem categoria específica: assume-se um objeto
        'outro',
    ];

    public static function categoriaPermiteEntrega(?string $categoria): bool
    {
        return $categoria !== null && in_array($categoria, self::CATEGORIAS_COM_ENTREGA, true);
    }

    public function getPermiteEntregaAttribute(): bool
    {
        return self::categoriaPermiteEntrega($this->categoria);
    }

    public function estabelecimento(): BelongsTo
    {
        return $this->belongsTo(User::class, 'estabelecimento_id');
    }

    public function alugueis(): HasMany
    {
        return $this->hasMany(Aluguel::class, 'item_aluguel_id');
    }

    public function produtosVinculados(): HasMany
    {
        return $this->hasMany(Produto::class, 'aluguel_id');
    }

    /**
     * `itens_aluguel` também guarda linhas de carrinho (produto extra vinculado
     * a um agendamento — ver AgendamentoController::storeCarrinho). Esse escopo
     * filtra só os itens de catálogo de verdade (locações), excluindo essas linhas.
     */
    public function scopeCatalogo($query)
    {
        return $query->whereNull('agendamento_id')
            ->whereNotIn('categoria', ['produto_extra', 'produto_avulso']);
    }

    public function getEnderecoCompletoAttribute(): ?string
    {
        $linhaRua = collect([$this->endereco, $this->numero])->filter()->implode(', ');
        $cidadeEstado = collect([$this->cidade, $this->estado])->filter()->implode('/');

        return collect([$linhaRua, $this->bairro, $cidadeEstado])->filter()->implode(' - ') ?: null;
    }
}
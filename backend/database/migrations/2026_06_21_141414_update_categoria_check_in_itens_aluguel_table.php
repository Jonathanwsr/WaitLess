<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $constraintName = 'itens_aluguel_categoria_check';

        // Remove a restrição antiga
        DB::statement("ALTER TABLE itens_aluguel DROP CONSTRAINT IF EXISTS {$constraintName}");

        // Lista completa de categorias
        $categorias = [

            // Imóveis
            'casa',
            'apartamento',
            'casa_praia',
            'flat',
            'hotel',
            'pousada',
            'hostel',
            'chalé',
            'cabana',
            'loft',
            'kitnet',
            'cobertura',
            'condominio',
            'sitio',
            'chacara',
            'fazenda',
            'galpao',
            'armazem',
            'terreno',
            'escritorio',
            'consultorio',
            'sala',
            'auditorio',
            'espaco_eventos',
            'salão_festas',
            'coworking',

            // Esportes
            'quadra',
            'quadra_futebol',
            'quadra_futsal',
            'quadra_volei',
            'quadra_basquete',
            'quadra_tenis',
            'quadra_beach_tennis',
            'quadra_padel',
            'campo_futebol',
            'arena',
            'ginasio',
            'piscina',
            'academia',
            'estudio_danca',

            // Veículos
            'carro',
            'moto',
            'bicicleta',
            'bicicleta_eletrica',
            'patinete',
            'patinete_eletrico',
            'van',
            'onibus',
            'micro_onibus',
            'caminhao',
            'carreta',
            'motorhome',
            'trailer',
            'jet_ski',
            'barco',
            'lancha',
            'iate',
            'caiaque',

            // Equipamentos
            'equipamento',
            'ferramenta',
            'equipamento_construcao',
            'equipamento_agricola',
            'equipamento_industrial',
            'andaime',
            'betoneira',
            'gerador',
            'compressor',
            'escada',

            // Tecnologia
            'camera',
            'camera_fotografica',
            'camera_filmagem',
            'drone',
            'notebook',
            'computador',
            'tablet',
            'projetor',
            'impressora',
            'monitor',
            'videogame',

            // Áudio e vídeo
            'audio_video',
            'caixa_som',
            'mesa_som',
            'microfone',
            'telão',
            'painel_led',
            'iluminacao',
            'karaoke',

            // Eventos
            'palco',
            'tenda',
            'cadeira',
            'mesa',
            'decoracao',
            'brinquedo_inflavel',

            // Vestuário
            'roupa',
            'terno',
            'vestido',
            'fantasia',

            // Saúde e Beleza
            'consultorio_estetica',
            'cadeira_barbeiro',
            'salao_beleza',
            'espaco_spa',

            // Serviços
            'barbeiro',
            'cabeleireiro',
            'manicure',
            'pedicure',
            'massagem',
            'esteticista',
            'tatuador',
            'personal_trainer',
            'professor',
            'instrutor',
            'fotografo',
            'cinegrafista',
            'dj',
            'musico',
            'animador',
            'buffet',
            'garcom',
            'seguranca',
            'limpeza',
            'consultoria',

            // Outros
            'animal',
            'pet',
            'espaco_pet',
            'armazenamento',
            'deposito',
            'outro'
        ];

        $checkQuery = "categoria IN ('" . implode("', '", $categorias) . "')";

        DB::statement("
            ALTER TABLE itens_aluguel
            ADD CONSTRAINT {$constraintName}
            CHECK ({$checkQuery})
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $constraintName = 'itens_aluguel_categoria_check';

        DB::statement("ALTER TABLE itens_aluguel DROP CONSTRAINT IF EXISTS {$constraintName}");

        $categoriasOriginais = [
            'casa',
            'apartamento',
            'carro',
            'moto',
            'bicicleta',
            'patinete',
            'quadra',
            'sala',
            'equipamento',
            'ferramenta',
            'outro'
        ];

        $checkQuery = "categoria IN ('" . implode("', '", $categoriasOriginais) . "')";

        DB::statement("
            ALTER TABLE itens_aluguel
            ADD CONSTRAINT {$constraintName}
            CHECK ({$checkQuery})
        ");
    }
};
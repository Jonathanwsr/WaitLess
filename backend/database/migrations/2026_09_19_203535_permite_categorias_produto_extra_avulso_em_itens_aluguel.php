<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * AgendamentoController::storeCarrinho/storeProdutoCarrinho já usam
     * `itens_aluguel` com categoria "produto_extra"/"produto_avulso" para
     * marcar linhas que são um produto vinculado a um agendamento (não um
     * item de locação de verdade), mas a constraint de categoria nunca
     * incluía esses dois valores.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE itens_aluguel DROP CONSTRAINT itens_aluguel_categoria_check');
        DB::statement("
            ALTER TABLE itens_aluguel ADD CONSTRAINT itens_aluguel_categoria_check
            CHECK (categoria IN (
                'casa','apartamento','casa_praia','flat','hotel','pousada','hostel','chalé','cabana','loft',
                'kitnet','cobertura','condominio','sitio','chacara','fazenda','galpao','armazem','terreno',
                'escritorio','consultorio','sala','auditorio','espaco_eventos','salão_festas','coworking',
                'quadra','quadra_futebol','quadra_futsal','quadra_volei','quadra_basquete','quadra_tenis',
                'quadra_beach_tennis','quadra_padel','campo_futebol','arena','ginasio','piscina','academia',
                'estudio_danca','carro','moto','bicicleta','bicicleta_eletrica','patinete','patinete_eletrico',
                'van','onibus','micro_onibus','caminhao','carreta','motorhome','trailer','jet_ski','barco',
                'lancha','iate','caiaque','equipamento','ferramenta','equipamento_construcao',
                'equipamento_agricola','equipamento_industrial','andaime','betoneira','gerador','compressor',
                'escada','camera','camera_fotografica','camera_filmagem','drone','notebook','computador',
                'tablet','projetor','impressora','monitor','videogame','audio_video','caixa_som','mesa_som',
                'microfone','telão','painel_led','iluminacao','karaoke','palco','tenda','cadeira','mesa',
                'decoracao','brinquedo_inflavel','roupa','terno','vestido','fantasia','consultorio_estetica',
                'cadeira_barbeiro','salao_beleza','espaco_spa','barbeiro','cabeleireiro','manicure','pedicure',
                'massagem','esteticista','tatuador','personal_trainer','professor','instrutor','fotografo',
                'cinegrafista','dj','musico','animador','buffet','garcom','seguranca','limpeza','consultoria',
                'animal','pet','espaco_pet','armazenamento','deposito','outro',
                'produto_extra','produto_avulso'
            ))
        ");
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE itens_aluguel DROP CONSTRAINT itens_aluguel_categoria_check');
        DB::statement("
            ALTER TABLE itens_aluguel ADD CONSTRAINT itens_aluguel_categoria_check
            CHECK (categoria IN (
                'casa','apartamento','casa_praia','flat','hotel','pousada','hostel','chalé','cabana','loft',
                'kitnet','cobertura','condominio','sitio','chacara','fazenda','galpao','armazem','terreno',
                'escritorio','consultorio','sala','auditorio','espaco_eventos','salão_festas','coworking',
                'quadra','quadra_futebol','quadra_futsal','quadra_volei','quadra_basquete','quadra_tenis',
                'quadra_beach_tennis','quadra_padel','campo_futebol','arena','ginasio','piscina','academia',
                'estudio_danca','carro','moto','bicicleta','bicicleta_eletrica','patinete','patinete_eletrico',
                'van','onibus','micro_onibus','caminhao','carreta','motorhome','trailer','jet_ski','barco',
                'lancha','iate','caiaque','equipamento','ferramenta','equipamento_construcao',
                'equipamento_agricola','equipamento_industrial','andaime','betoneira','gerador','compressor',
                'escada','camera','camera_fotografica','camera_filmagem','drone','notebook','computador',
                'tablet','projetor','impressora','monitor','videogame','audio_video','caixa_som','mesa_som',
                'microfone','telão','painel_led','iluminacao','karaoke','palco','tenda','cadeira','mesa',
                'decoracao','brinquedo_inflavel','roupa','terno','vestido','fantasia','consultorio_estetica',
                'cadeira_barbeiro','salao_beleza','espaco_spa','barbeiro','cabeleireiro','manicure','pedicure',
                'massagem','esteticista','tatuador','personal_trainer','professor','instrutor','fotografo',
                'cinegrafista','dj','musico','animador','buffet','garcom','seguranca','limpeza','consultoria',
                'animal','pet','espaco_pet','armazenamento','deposito','outro'
            ))
        ");
    }
};

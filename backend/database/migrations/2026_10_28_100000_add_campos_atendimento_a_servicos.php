<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mais informações no cadastro de serviço (pensado também para guincho, socorro 24h, borracharia móvel,
 * profissionais que vão até o cliente): onde é atendido, 24h, raio, taxa de deslocamento, tempo de chegada,
 * como o preço é cobrado, o que está incluído, como se preparar e garantia.
 * No agendamento, o cliente informa onde quer ser atendido quando o serviço vai até ele.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('servicos', function (Blueprint $t) {
            $t->string('modalidade_atendimento', 20)->default('no_local'); // no_local | a_domicilio | ambos | online
            $t->boolean('atende_24h')->default(false);
            $t->unsignedSmallInteger('raio_atendimento_km')->nullable();
            $t->decimal('taxa_deslocamento', 10, 2)->nullable();
            $t->unsignedSmallInteger('tempo_chegada_minutos')->nullable();
            $t->string('tipo_preco', 20)->default('fixo'); // fixo | a_partir_de | por_hora | por_km | sob_orcamento
            $t->text('o_que_inclui')->nullable();
            $t->text('como_se_preparar')->nullable();
            $t->unsignedSmallInteger('garantia_dias')->nullable();
        });

        Schema::table('agendamentos', function (Blueprint $t) {
            $t->string('endereco_atendimento', 255)->nullable();
            $t->decimal('taxa_deslocamento', 10, 2)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('servicos', function (Blueprint $t) {
            $t->dropColumn(['modalidade_atendimento', 'atende_24h', 'raio_atendimento_km', 'taxa_deslocamento', 'tempo_chegada_minutos', 'tipo_preco', 'o_que_inclui', 'como_se_preparar', 'garantia_dias']);
        });
        Schema::table('agendamentos', function (Blueprint $t) {
            $t->dropColumn(['endereco_atendimento', 'taxa_deslocamento']);
        });
    }
};

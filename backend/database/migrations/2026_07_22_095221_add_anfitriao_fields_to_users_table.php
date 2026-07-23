<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {

            // Perfil do anfitrião
            $table->string('onde_estudei')->nullable()->after('papel');
            $table->string('onde_moro')->nullable()->after('onde_estudei');
            $table->string('idiomas')->nullable()->after('onde_moro');
            $table->string('profissao')->nullable()->after('idiomas');
            $table->text('sobre_mim')->nullable()->after('profissao');

            // Termo de compromisso
            $table->boolean('termo_compromisso_aceito')
                ->default(false)
                ->after('sobre_mim');

            $table->timestamp('termo_compromisso_aceito_em')
                ->nullable()
                ->after('termo_compromisso_aceito');

            $table->string('termo_compromisso_ip', 45)
                ->nullable()
                ->after('termo_compromisso_aceito_em');

            $table->string('termo_compromisso_versao')
                ->nullable()
                ->after('termo_compromisso_ip');

            $table->text('termo_compromisso_user_agent')
                ->nullable()
                ->after('termo_compromisso_versao');

            $table->timestamp('termo_compromisso_rejeitado_em')
                ->nullable()
                ->after('termo_compromisso_user_agent');

            $table->text('termo_compromisso_observacao')
                ->nullable()
                ->after('termo_compromisso_rejeitado_em');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'onde_estudei',
                'onde_moro',
                'idiomas',
                'profissao',
                'sobre_mim',

                'termo_compromisso_aceito',
                'termo_compromisso_aceito_em',
                'termo_compromisso_ip',
                'termo_compromisso_versao',
                'termo_compromisso_user_agent',
                'termo_compromisso_rejeitado_em',
                'termo_compromisso_observacao',
            ]);
        });
    }
};
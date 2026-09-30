<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * A migration 2026_08_03_143848_add_expo_push_token_to_users_table tinha
     * um erro de digitação: em vez de criar a coluna "expo_push_token", criou
     * uma coluna chamada literalmente "a" (nunca usada em lugar nenhum do
     * código — confirmado vazia para todos os usuários). Como código em
     * vários pontos (login, notificações push) já espera "expo_push_token",
     * essa coluna nunca existiu de verdade. Corrige sem reescrever a
     * migration antiga já executada em produção.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'a')) {
                $table->dropColumn('a');
            }
            if (!Schema::hasColumn('users', 'expo_push_token')) {
                $table->string('expo_push_token')->nullable()->after('remember_token');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'expo_push_token')) {
                $table->dropColumn('expo_push_token');
            }
            $table->string('a')->nullable()->after('remember_token');
        });
    }
};

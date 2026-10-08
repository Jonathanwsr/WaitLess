<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Datas usadas pelo ProfileController para limitar edições (dados gerais a cada 15 dias, e-mail e
     * endereço a cada 30). As colunas nunca tinham sido criadas, e salvar o perfil dava erro 500.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'last_profile_update')) {
                $table->timestamp('last_profile_update')->nullable();
            }
            if (!Schema::hasColumn('users', 'last_address_email_update')) {
                $table->timestamp('last_address_email_update')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['last_profile_update', 'last_address_email_update']);
        });
    }
};

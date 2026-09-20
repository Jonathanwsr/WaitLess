<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('historico_agendamentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agendamento_id')->constrained('agendamentos')->cascadeOnDelete();
            $table->string('status_anterior')->nullable();
            $table->string('status_novo');
            $table->foreignId('alterado_por_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('alterado_por_nome')->nullable();
            $table->string('descricao')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('historico_agendamentos');
    }
};

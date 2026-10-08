<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Horário de funcionamento por dia da semana — opcional, um local sem
     * nenhuma linha aqui simplesmente não exibe horário definido. Uma linha
     * por dia (0=domingo...6=sábado); "fechado" marca um dia sem atendimento
     * sem precisar apagar a linha.
     */
    public function up(): void
    {
        Schema::create('horarios_funcionamento', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estabelecimento_id')->constrained('estabelecimentos')->cascadeOnDelete();
            $table->unsignedTinyInteger('dia_semana'); // 0=domingo ... 6=sábado
            $table->time('hora_abertura')->nullable();
            $table->time('hora_fechamento')->nullable();
            $table->boolean('fechado')->default(false);
            $table->timestamps();

            $table->unique(['estabelecimento_id', 'dia_semana']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('horarios_funcionamento');
    }
};

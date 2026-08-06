<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Linha do Tempo e Auditoria de Status
        Schema::create('historico_estornos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estorno_id')->constrained('estornos')->cascadeOnDelete();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete(); // Quem fez a ação
            $table->string('status_anterior')->nullable();
            $table->string('novo_status');
            $table->text('descricao')->nullable();
            $table->string('ip')->nullable();
            $table->string('dispositivo')->nullable();
            $table->string('navegador')->nullable();
            $table->timestamps();
        });

        // 2. Chat de Disputa (Cliente vs Prestador vs Admin)
        Schema::create('mensagens_estorno', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estorno_id')->constrained('estornos')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('funcionario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('tipo_usuario', ['CLIENTE', 'PRESTADOR', 'FUNCIONARIO', 'ADMIN']);
            $table->text('mensagem')->nullable();
            $table->string('arquivo')->nullable();
            $table->string('tipo_arquivo')->nullable();
            $table->boolean('visualizada')->default(false);
            $table->timestamps();
        });

        // 3. Evidências Anexadas ao Estorno Principal
        Schema::create('documentos_estorno', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estorno_id')->constrained('estornos')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->string('tipo'); // foto, video, pdf
            $table->string('arquivo');
            $table->text('descricao')->nullable();
            $table->timestamps();
        });

        // 4. Log Financeiro (Auditoria Intocável)
        Schema::create('log_financeiro', function (Blueprint $table) {
            $table->id();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('prestador_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('estorno_id')->nullable()->constrained('estornos')->nullOnDelete();
            $table->foreignId('pagamento_id')->nullable()->constrained('pagamentos')->nullOnDelete();
            $table->string('tipo'); // DEBITO, CREDITO, ESTORNO, RETENCAO
            $table->text('descricao');
            $table->decimal('valor', 10, 2);
            $table->decimal('saldo_anterior', 10, 2);
            $table->decimal('saldo_atual', 10, 2);
            $table->string('ip')->nullable();
            $table->string('dispositivo')->nullable();
            $table->json('json_asaas')->nullable(); // Resposta bruta do gateway
            $table->timestamps();
        });

        // 5. Visualizações de Estorno (Para controle interno)
        Schema::create('visualizacoes_estorno', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estorno_id')->constrained('estornos')->cascadeOnDelete();
            $table->foreignId('usuario_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('funcionario_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('tipo_usuario'); // ADMIN, PRESTADOR
            $table->string('ip')->nullable();
            $table->string('dispositivo')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        // 6. Notificações Internas Específicas
        Schema::create('notificacoes_estorno', function (Blueprint $table) {
            $table->id();
            $table->foreignId('estorno_id')->constrained('estornos')->cascadeOnDelete();
            $table->foreignId('usuario_id')->constrained('users')->cascadeOnDelete();
            $table->string('titulo');
            $table->text('mensagem');
            $table->boolean('lida')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notificacoes_estorno');
        Schema::dropIfExists('visualizacoes_estorno');
        Schema::dropIfExists('log_financeiro');
        Schema::dropIfExists('documentos_estorno');
        Schema::dropIfExists('mensagens_estorno');
        Schema::dropIfExists('historico_estornos');
    }
};
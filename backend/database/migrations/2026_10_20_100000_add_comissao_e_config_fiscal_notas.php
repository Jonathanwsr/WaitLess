<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Notas fiscais em três frentes:
     * - venda: o sócio emite para o cliente pelo valor total (subconta Asaas do sócio);
     * - comissao: a Lokyva emite para o sócio só pela taxa de intermediação (conta principal);
     * - assinatura: a Lokyva emite para o assinante do plano.
     *
     * Aqui entram a ligação com parcelas de cobrança, os dados da operação de origem
     * (valor da venda e percentual da comissão) e a configuração fiscal de cada sócio.
     */
    public function up(): void
    {
        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->foreignId('cobranca_parcela_id')->nullable()->after('assinatura_id')->constrained('cobranca_parcelas')->nullOnDelete();
            $table->decimal('valor_operacao', 10, 2)->nullable()->after('valor'); // valor da venda que originou a comissão
            $table->decimal('percentual', 5, 2)->nullable()->after('valor_operacao'); // percentual da comissão
            $table->string('numero', 40)->nullable()->after('asaas_invoice_id');
            $table->string('xml_url')->nullable()->after('pdf_url');
            $table->timestamp('emitida_em')->nullable()->after('mensagem_erro');

            $table->index(['pagamento_id', 'tipo']);
            $table->index(['provider_id', 'tipo', 'created_at']);
        });

        Schema::table('providers', function (Blueprint $table) {
            // Cadastro do sócio como cliente (tomador) na conta principal da Lokyva, para a nota da comissão.
            $table->string('asaas_cliente_plataforma_id')->nullable();

            // Configuração fiscal das notas de venda do sócio (códigos e alíquotas definidos pelo contador dele).
            $table->string('nfse_servico_id')->nullable();
            $table->string('nfse_servico_codigo', 20)->nullable();
            $table->string('nfse_servico_nome')->nullable();
            $table->decimal('nfse_iss', 5, 2)->default(0);
            $table->boolean('nfse_retem_iss')->default(false);
            $table->decimal('nfse_pis', 5, 2)->default(0);
            $table->decimal('nfse_cofins', 5, 2)->default(0);
            $table->decimal('nfse_csll', 5, 2)->default(0);
            $table->decimal('nfse_ir', 5, 2)->default(0);
            $table->decimal('nfse_inss', 5, 2)->default(0);
            $table->string('nfse_observacoes', 500)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('providers', function (Blueprint $table) {
            $table->dropColumn([
                'asaas_cliente_plataforma_id', 'nfse_servico_id', 'nfse_servico_codigo', 'nfse_servico_nome', 'nfse_iss',
                'nfse_retem_iss', 'nfse_pis', 'nfse_cofins', 'nfse_csll', 'nfse_ir', 'nfse_inss', 'nfse_observacoes',
            ]);
        });

        Schema::table('notas_fiscais', function (Blueprint $table) {
            $table->dropIndex(['pagamento_id', 'tipo']);
            $table->dropIndex(['provider_id', 'tipo', 'created_at']);
            $table->dropConstrainedForeignId('cobranca_parcela_id');
            $table->dropColumn(['valor_operacao', 'percentual', 'numero', 'xml_url', 'emitida_em']);
        });
    }
};

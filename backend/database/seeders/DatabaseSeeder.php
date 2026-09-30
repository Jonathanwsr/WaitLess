<?php

namespace Database\Seeders;

use App\Models\Agendamento;
use App\Models\Estabelecimento;
use App\Models\Funcionario;
use App\Models\Servico;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Dados mínimos pra desenvolver localmente com o app "de pé" (login, um
 * estabelecimento com equipe e serviços, um cliente com pontos). Senha de
 * todo mundo: "password". Existe porque o banco de desenvolvimento local
 * ficou vazio depois que um teste antigo rodou migrate:fresh nele sem
 * querer — veja a nota em tests/TestCase.php sobre por que isso não pode
 * acontecer de novo.
 */
class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        $senha = Hash::make('password');

        $admin = User::create([
            'name' => 'Admin Lokyva',
            'email' => 'admin@lokyva.com',
            'password' => $senha,
            'papel' => 'admin',
            'email_verified_at' => now(),
        ]);

        $socio = User::create([
            'name' => 'Sócio Teste',
            'email' => 'socio@lokyva.com',
            'password' => $senha,
            'papel' => 'socio',
            'plano_assinatura' => 'premium-socio',
            'plano_expira_em' => now()->addYear(),
            'email_verified_at' => now(),
        ]);

        $gerente = User::create([
            'name' => 'Gerente Teste',
            'email' => 'gerente@lokyva.com',
            'password' => $senha,
            'papel' => 'gerente',
            'email_verified_at' => now(),
        ]);

        $atendenteUsuario = User::create([
            'name' => 'Atendente Teste',
            'email' => 'atendente@lokyva.com',
            'password' => $senha,
            'papel' => 'atendente',
            'email_verified_at' => now(),
        ]);

        $cliente = User::create([
            'name' => 'Cliente Teste',
            'email' => 'cliente@lokyva.com',
            'password' => $senha,
            'papel' => 'user',
            'pontos_saldo' => 5000,
            'email_verified_at' => now(),
        ]);

        $estabelecimento = Estabelecimento::create([
            'nome' => 'Salão Exemplo',
            'ramo_atuacao' => 'Salão de Beleza',
            'cidade' => 'São Paulo',
            'estado' => 'SP',
            'ativo' => true,
        ]);

        DB::table('estabelecimento_usuario')->insert([
            ['usuario_id' => $socio->id, 'estabelecimento_id' => $estabelecimento->id, 'tipo' => 'socio'],
            ['usuario_id' => $gerente->id, 'estabelecimento_id' => $estabelecimento->id, 'tipo' => 'gerente'],
        ]);

        $funcionario = Funcionario::create([
            'estabelecimento_id' => $estabelecimento->id,
            'usuario_id' => $atendenteUsuario->id,
            'nome' => 'Atendente Teste',
            'cargo' => 'Atendente',
            'ativo' => true,
        ]);

        $servicoPago = Servico::create([
            'estabelecimento_id' => $estabelecimento->id,
            'nome' => 'Corte de Cabelo',
            'tipo_servico' => 'Salão de Beleza',
            'descricao' => 'Corte tradicional masculino ou feminino.',
            'valor' => 50,
            'duracao_minutos' => 40,
            'vagas_por_horario' => 1,
            'ativo' => true,
            'horarios_disponiveis' => json_encode(['09:00', '10:00', '11:00', '14:00', '15:00']),
            'configuracoes' => json_encode(['dias_disponiveis' => ['segunda', 'terca', 'quarta', 'quinta', 'sexta'], 'tipo_pagamento' => 'hibrido']),
            'fotos' => json_encode([]),
        ]);

        Servico::create([
            'estabelecimento_id' => $estabelecimento->id,
            'nome' => 'Avaliação Gratuita',
            'tipo_servico' => 'Salão de Beleza',
            'descricao' => 'Primeira consulta sem custo.',
            'valor' => 0,
            'duracao_minutos' => 20,
            'vagas_por_horario' => 4,
            'ativo' => true,
            'horarios_disponiveis' => json_encode(['09:00', '13:00']),
            'configuracoes' => json_encode(['dias_disponiveis' => ['segunda', 'quarta', 'sexta'], 'tipo_pagamento' => 'hibrido']),
            'fotos' => json_encode([]),
        ]);

        Agendamento::create([
            'usuario_id' => $cliente->id,
            'estabelecimento_id' => $estabelecimento->id,
            'servico_id' => $servicoPago->id,
            'funcionario_id' => $funcionario->id,
            'data_agendamento' => now()->addDay()->toDateString(),
            'hora_agendamento' => '10:00',
            'status' => 'confirmado',
            'status_pagamento' => 'presencial',
            'valor_final' => 50,
            'codigo_verificacao' => '1234',
        ]);

        $this->command?->info('Seed concluído. Login (senha "password" pra todos):');
        $this->command?->info('  admin@lokyva.com · socio@lokyva.com · gerente@lokyva.com · atendente@lokyva.com · cliente@lokyva.com');
    }
}

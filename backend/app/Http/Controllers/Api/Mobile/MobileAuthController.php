<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Funcionario;
use Illuminate\Validation\Rules;

class MobileAuthController extends Controller
{
    /**
     * Trata o login vindo do aplicativo móvel.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'As credenciais fornecidas estão incorretas.'
            ], 421);
        }

        $papel = strtolower(trim($user->papel ?? ''));
        $isFuncionario = Funcionario::where('usuario_id', $user->id)->exists();

        $destino = 'cliente';
        if (in_array($papel, ['admin', 'socio', 'proprietario', 'funcionario', 'atendente']) || $isFuncionario) {
            $destino = 'funcionario';
        }

        $token = $user->createToken('mobile_auth_token')->plainTextToken;

        return response()->json([
            'status' => 'success',
            'token' => $token,
            'usuario' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'papel' => $papel,
            ],
            'destino' => $destino
        ], 200);
    }

    /**
     * Cadastro completo com Integração Asaas (Customer e Wallet) e Aceite dos Termos
     */
    public function register(Request $request)
    {
        // 1. Validação estendida com os campos do Asaas e do Termo
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'papel' => 'required|string|in:admin,socio,proprietario,user,gerente,atendente',
            
            // Campos Asaas
            'cpf_cnpj' => 'required|string|max:18',
            'mobile_phone' => 'required|string|max:20',
            'phone' => 'nullable|string|max:20',
            'postal_code' => 'required|string|max:10',
            'address' => 'required|string|max:255',
            'address_number' => 'required|string|max:20',
            'complement' => 'nullable|string|max:100',
            'province' => 'required|string|max:100',
            'city' => 'required|string|max:100',
            'state' => 'required|string|size:2',
            'person_type' => 'required|in:FISICA,JURIDICA',
            'birth_date' => 'nullable|date',

            // CAMPOS DO TERMO DE COMPROMISSO
            'termo_compromisso_aceito' => 'required|boolean|accepted',
            'termo_compromisso_versao' => 'required|string|max:20',
        ]);

        // Limpa a formatação para a API do Asaas
        $cpfCnpjLimpo = preg_replace('/[^0-9]/', '', $request->cpf_cnpj);
        $telefoneLimpo = preg_replace('/[^0-9]/', '', $request->mobile_phone);
        $cepLimpo = preg_replace('/[^0-9]/', '', $request->postal_code);

        DB::beginTransaction();

        try {
            $asaasUrl = config('services.asaas.url');
            $asaasKey = config('services.asaas.key');

            // =========================================================
            // PASSO 1: Criar o ID de Pagador (Customer) no Asaas
            // =========================================================
            $responseCustomer = Http::withHeaders([
                'access_token' => $asaasKey,
                'Content-Type' => 'application/json',
            ])->post($asaasUrl . '/customers', [
                'name' => $request->name,
                'cpfCnpj' => $cpfCnpjLimpo,
                'email' => $request->email,
                'mobilePhone' => $telefoneLimpo,
                'postalCode' => $cepLimpo,
                'address' => $request->address,
                'addressNumber' => $request->address_number,
                'complement' => $request->complement,
                'province' => $request->province,
                'city' => $request->city,
                'state' => strtoupper($request->state),
            ]);

            if ($responseCustomer->failed()) {
                $erro = $responseCustomer->json();
                return response()->json(['error' => 'Erro no Asaas: ' . ($erro['errors'][0]['description'] ?? 'Dados inválidos.')], 422);
            }

            $asaasCustomerId = $responseCustomer->json()['id'];

            // =========================================================
            // PASSO 2: Salvar o Usuário no Banco de Dados
            // =========================================================
            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'papel' => $request->papel,
                'cpf_cnpj' => $cpfCnpjLimpo,
                'mobile_phone' => $telefoneLimpo,
                'phone' => $request->phone,
                'postal_code' => $cepLimpo,
                'address' => $request->address,
                'address_number' => $request->address_number,
                'complement' => $request->complement,
                'province' => $request->province,
                'city' => $request->city,
                'state' => strtoupper($request->state),
                'person_type' => $request->person_type,
                'birth_date' => $request->birth_date,
                'asaas_customer_id' => $asaasCustomerId,

                // DADOS DO TERMO DE COMPROMISSO (Capturados de forma segura pelo próprio servidor)
                'termo_compromisso_aceito' => $request->termo_compromisso_aceito,
                'termo_compromisso_data'   => now(),
                'termo_compromisso_versao' => $request->termo_compromisso_versao,
                'termo_compromisso_ip'     => $request->ip(),
                'termo_compromisso_user_agent' => $request->userAgent(),
            ]);

            // =========================================================
            // PASSO 3: Criar Subconta/Wallet (Apenas Proprietários/Sócios)
            // =========================================================
            if (in_array($request->papel, ['admin', 'socio', 'proprietario'])) {
                $responseAccount = Http::withHeaders([
                    'access_token' => $asaasKey,
                    'Content-Type' => 'application/json',
                ])->post($asaasUrl . '/accounts', [
                    'name' => $request->name,
                    'email' => $request->email,
                    'loginEmail' => $request->email,
                    'cpfCnpj' => $cpfCnpjLimpo,
                    'birthDate' => $request->birth_date,
                    'companyType' => $request->person_type === 'JURIDICA' ? 'LIMITED' : null,
                    'phone' => $telefoneLimpo,
                    'mobilePhone' => $telefoneLimpo,
                    'address' => $request->address,
                    'addressNumber' => $request->address_number,
                    'complement' => $request->complement,
                    'province' => $request->province,
                    'postalCode' => $cepLimpo,
                ]);

                if ($responseAccount->successful()) {
                    $accountData = $responseAccount->json();
                    
                    // Salva a carteira oficial do dono na tabela providers
                    DB::table('providers')->insert([
                        'user_id' => $user->id,
                        'asaas_wallet_id' => $accountData['walletId'],
                        'asaas_api_key' => $accountData['apiKey'],
                        'saldo' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                } else {
                    DB::rollBack();
                    $erro = $responseAccount->json();
                    return response()->json(['error' => 'Falha ao gerar carteira de recebedor: ' . ($erro['errors'][0]['description'] ?? 'Erro desconhecido.')], 422);
                }
            }

            DB::commit();

            // Redirecionamento
            $papel = strtolower(trim($user->papel ?? ''));
            $destino = in_array($papel, ['admin', 'socio', 'proprietario', 'funcionario', 'atendente']) ? 'funcionario' : 'cliente';

            // Gera o Token de Autenticação Automática
            $token = $user->createToken('mobile_auth_token')->plainTextToken;

            return response()->json([
                'status' => 'success',
                'token' => $token,
                'usuario' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'papel' => $papel,
                ],
                'destino' => $destino
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Erro interno ao processar o cadastro.',
                'details' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Retorna os dados do perfil do usuário autenticado
     */
    public function me(Request $request)
    {
        try {
            /** @var User $user */
            $user = $request->user();

            // Carrega a assinatura ativa e estabelecimentos com seus pontos
            $user->load(['assinaturaAtiva', 'pontos']);

            // Calcula o saldo total de pontos acumulados
            $totalPontos = $user->pontos_saldo ?? $user->pontos()->sum('total_pontos');

            return response()->json([
                'success' => true,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'papel' => $user->papel ?? 'Cliente',
                    'telefone' => $user->telefone ?? $user->mobile_phone,
                    'cpf_cnpj' => $user->cpf_cnpj,
                    'cidade' => $user->city,
                    'estado' => $user->state,
                    'pontos_saldo' => (int) $totalPontos,
                    'plano_atual' => $user->plano_atual, // Usando o Mutator getPlanoAtualAttribute() da Model
                    'assinatura' => $user->assinaturaAtiva ? [
                        'nome_plano' => $user->assinaturaAtiva->nome_plano,
                        'tipo_publico' => $user->assinaturaAtiva->tipo_publico,
                        'valor_mensal' => $user->assinaturaAtiva->valor_mensal,
                        'status' => $user->assinaturaAtiva->status,
                    ] : null,
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Erro ao carregar perfil: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sair da conta no mobile (revoga o token Sanctum atual)
     */
    public function logout(Request $request)
    {
        try {
            if ($request->user() && $request->user()->currentAccessToken()) {
                $request->user()->currentAccessToken()->delete();
            }

            return response()->json([
                'status' => 'success',
                'success' => true,
                'message' => 'Sessão encerrada com sucesso no dispositivo móvel.'
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'success' => false,
                'message' => 'Erro ao realizar logout: ' . $e->getMessage()
            ], 500);
        }
    }
}
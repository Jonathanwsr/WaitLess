<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
            'expo_push_token' => 'nullable|string'
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'As credenciais fornecidas estão incorretas.'
            ], 421);
        }

        $papel = strtolower(trim($user->papel ?? ''));
        $isFuncionario = Funcionario::where('usuario_id', $user->id)->exists();

        // LÓGICA DE REDIRECIONAMENTO AJUSTADA
        $destino = 'cliente';
        if (in_array($papel, ['socio', 'proprietario', 'gerente'])) {
            $destino = 'dashboard'; // Redireciona para /Proprietario/dashboard no app
        } elseif (in_array($papel, ['admin', 'funcionario', 'atendente']) || $isFuncionario) {
            $destino = 'funcionario'; // Redireciona para /src/funcionario/Painel-funcioanario
        }

        // Apaga os tokens antigos para otimização
        $user->tokens()->where('name', 'mobile_auth_token')->delete();

        // Cria novo token Sanctum
        $token = $user->createToken('mobile_auth_token')->plainTextToken;

        // Salva o Expo Push Token se enviado
        if ($request->filled('expo_push_token')) {
            $user->update(['expo_push_token' => $request->expo_push_token]);
        }

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
     * Cadastro completo com Asaas, sanitização de segurança e E-mail via Brevo
     */
    public function register(Request $request)
    {
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

            // NOVOS CAMPOS DO PERFIL
            'onde_estudei' => 'nullable|string|max:255',
            'onde_moro' => 'nullable|string|max:255',
            'idiomas' => 'nullable|string|max:255',
            'profissao' => 'nullable|string|max:255',
            'sobre_mim' => 'nullable|string|max:1000',

            // CAMPOS DO TERMO DE COMPROMISSO
            'termo_compromisso_aceito' => 'required|boolean|accepted',
            'termo_compromisso_versao' => 'required|string|max:20',
            
            'expo_push_token' => 'nullable|string'
        ]);

        // Função de Sanitização (Bloqueia scripts, tags HTML e códigos maliciosos)
        $cleanText = function ($input) {
            return $input ? trim(strip_tags($input)) : null;
        };

        $cpfCnpjLimpo = preg_replace('/[^0-9]/', '', $request->cpf_cnpj);
        $telefoneLimpo = preg_replace('/[^0-9]/', '', $request->mobile_phone);
        $cepLimpo = preg_replace('/[^0-9]/', '', $request->postal_code);

        DB::beginTransaction();

        try {
            $asaasUrl = config('services.asaas.url');
            $asaasKey = config('services.asaas.key');

            // PASSO 1: Criar o ID de Pagador (Customer) no Asaas
            $responseCustomer = Http::withHeaders([
                'access_token' => $asaasKey,
                'Content-Type' => 'application/json',
            ])->post($asaasUrl . '/customers', [
                'name' => $cleanText($request->name),
                'cpfCnpj' => $cpfCnpjLimpo,
                'email' => $request->email,
                'mobilePhone' => $telefoneLimpo,
                'postalCode' => $cepLimpo,
                'address' => $cleanText($request->address),
                'addressNumber' => $cleanText($request->address_number),
                'complement' => $cleanText($request->complement),
                'province' => $cleanText($request->province),
                'city' => $cleanText($request->city),
                'state' => strtoupper($request->state),
            ]);

            if ($responseCustomer->failed()) {
                $erro = $responseCustomer->json();
                return response()->json(['error' => 'Erro no Asaas: ' . ($erro['errors'][0]['description'] ?? 'Dados inválidos.')], 422);
            }

            $asaasCustomerId = $responseCustomer->json()['id'];

            // PASSO 2: Salvar o Usuário no Banco de Dados (com sanitização)
            $user = User::create([
                'name' => $cleanText($request->name),
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'papel' => $request->papel,
                'cpf_cnpj' => $cpfCnpjLimpo,
                'mobile_phone' => $telefoneLimpo,
                'phone' => $request->phone ? preg_replace('/[^0-9]/', '', $request->phone) : null,
                'postal_code' => $cepLimpo,
                'address' => $cleanText($request->address),
                'address_number' => $cleanText($request->address_number),
                'complement' => $cleanText($request->complement),
                'province' => $cleanText($request->province),
                'city' => $cleanText($request->city),
                'state' => strtoupper($request->state),
                'person_type' => $request->person_type,
                'birth_date' => $request->birth_date,
                
                // Novos campos sanitizados
                'onde_estudei' => $cleanText($request->onde_estudei),
                'onde_moro' => $cleanText($request->onde_moro),
                'idiomas' => $cleanText($request->idiomas),
                'profissao' => $cleanText($request->profissao),
                'sobre_mim' => $cleanText($request->sobre_mim),

                'asaas_customer_id' => $asaasCustomerId,
                'expo_push_token' => $request->expo_push_token ?? null,

                // DADOS DO TERMO DE COMPROMISSO
                'termo_compromisso_aceito' => $request->termo_compromisso_aceito,
                'termo_compromisso_data'   => now(),
                'termo_compromisso_versao' => $request->termo_compromisso_versao,
                'termo_compromisso_ip'     => $request->ip(),
                'termo_compromisso_user_agent' => $request->userAgent(),
            ]);

            // PASSO 3: Criar Subconta/Wallet (Apenas Proprietários/Sócios)
            if (in_array($request->papel, ['admin', 'socio', 'proprietario'])) {
                $responseAccount = Http::withHeaders([
                    'access_token' => $asaasKey,
                    'Content-Type' => 'application/json',
                ])->post($asaasUrl . '/accounts', [
                    'name' => $user->name,
                    'email' => $user->email,
                    'loginEmail' => $user->email,
                    'cpfCnpj' => $cpfCnpjLimpo,
                    'birthDate' => $request->birth_date,
                    'companyType' => $request->person_type === 'JURIDICA' ? 'LIMITED' : null,
                    'phone' => $telefoneLimpo,
                    'mobilePhone' => $telefoneLimpo,
                    'address' => $user->address,
                    'addressNumber' => $user->address_number,
                    'complement' => $user->complement,
                    'province' => $user->province,
                    'postalCode' => $cepLimpo,
                ]);

                if ($responseAccount->successful()) {
                    $accountData = $responseAccount->json();
                    
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

            // PASSO 4: Envio de E-mail de Boas-Vindas via Brevo API
            $this->enviarEmailBrevo($user);

            // LÓGICA DE REDIRECIONAMENTO AJUSTADA NO REGISTRO
            $papel = strtolower(trim($user->papel ?? ''));
            $destino = 'cliente';
            if (in_array($papel, ['socio', 'proprietario', 'gerente'])) {
                $destino = 'dashboard';
            } elseif (in_array($papel, ['admin', 'funcionario', 'atendente'])) {
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

            $user->load(['assinaturaAtiva', 'pontos']);

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
                    
                    // Retorno dos novos campos no perfil
                    'onde_estudei' => $user->onde_estudei,
                    'onde_moro' => $user->onde_moro,
                    'idiomas' => $user->idiomas,
                    'profissao' => $user->profissao,
                    'sobre_mim' => $user->sobre_mim,

                    'pontos_saldo' => (int) $totalPontos,
                    'plano_atual' => $user->plano_atual, 
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
     * Sair da conta no mobile
     */
    public function logout(Request $request)
    {
        try {
            if ($request->user()) {
                $request->user()->update(['expo_push_token' => null]);

                if ($request->user()->currentAccessToken()) {
                    $request->user()->currentAccessToken()->delete();
                }
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

    /**
     * Envia o e-mail de boas-vindas diretamente via Brevo API
     */
    private function enviarEmailBrevo(User $user)
    {
        try {
            $brevoApiKey = config('services.brevo.key');

            if (!$brevoApiKey) {
                Log::warning('Chave da Brevo não configurada em config/services.php');
                return;
            }

            Http::withHeaders([
                'api-key' => $brevoApiKey,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->post('https://api.brevo.com/v3/smtp/email', [
                'sender' => [
                    'name' => config('app.name', 'Lokyva'),
                    'email' => config('mail.from.address', 'no-reply@lokyva.com')
                ],
                'to' => [
                    [
                        'email' => $user->email,
                        'name'  => $user->name,
                    ]
                ],
                'subject' => 'Parabéns, seja bem-vindo ao Lokyva!',
                'htmlContent' => '
                    <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
                        <h2 style="color: #4A90E2; text-align: center;">Seja muito bem-vindo ao Lokyva!</h2>
                        <p>Olá, <strong>' . htmlspecialchars($user->name) . '</strong>!</p>
                        <p>Ficamos muito felizes em ter você conosco. Sua conta foi criada com sucesso e você já pode aproveitar todos os nossos recursos.</p>
                        <br>
                        <div style="text-align: center; margin: 20px 0;">
                            <span style="background-color: #4A90E2; color: #fff; padding: 10px 20px; border-radius: 5px; text-decoration: none; font-weight: bold;">Sua conta está ativa</span>
                        </div>
                        <br>
                        <p>Atenciosamente,<br><strong>Equipe Lokyva</strong></p>
                    </div>
                '
            ]);
        } catch (\Exception $e) {
            // Loga a falha sem interromper o fluxo de resposta ao aplicativo
            Log::error('Erro ao enviar e-mail via Brevo: ' . $e->getMessage());
        }
    }
}
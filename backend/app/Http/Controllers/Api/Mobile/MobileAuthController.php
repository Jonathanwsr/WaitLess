<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Services\TrocaSenhaService;
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
        $funcionario = Funcionario::where('usuario_id', $user->id)->orderBy('id')->first();
        $isFuncionario = $funcionario !== null;

        // LÓGICA DE REDIRECIONAMENTO AJUSTADA
        $destino = 'cliente';
        if (in_array($papel, ['socio', 'proprietario', 'gerente'])) {
            $destino = 'dashboard'; // Redireciona para /Proprietario/dashboard no app
        } elseif (in_array($papel, ['admin', 'funcionario', 'atendente']) || $isFuncionario) {
            $destino = 'funcionario'; // Redireciona para /src/funcionario/Painel-funcioanario
        }

        // 🔒 TRAVA DE PLANO: no plano básico do sócio/proprietário, só o
        // primeiro funcionário cadastrado no estabelecimento pode acessar o
        // app mobile. No plano superior (premium-socio / premium-socio-anual),
        // todos os funcionários vinculados podem usar o app normalmente.
        if ($papel !== 'admin' && $funcionario) {
            $bloqueado = $this->funcionarioBloqueadoPeloPlano($funcionario);

            if ($bloqueado) {
                return response()->json([
                    'message' => 'O plano atual do estabelecimento libera o app mobile apenas para o primeiro funcionário cadastrado. Peça ao responsável para fazer upgrade do plano e liberar o acesso para toda a equipe.'
                ], 403);
            }
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
            // Só os dois papéis que a tela de cadastro realmente oferece (Cliente/
            // Proprietário) podem ser auto-atribuídos aqui — "admin", "gerente" e
            // "atendente" eram aceitos por essa validação, permitindo que qualquer
            // pessoa se cadastrasse como administrador da plataforma só mandando
            // esse valor no corpo da requisição. Papéis internos (funcionário,
            // gerente) só devem ser criados por um proprietário autenticado, via
            // ConfiguracoesMobileController::storeFuncionario.
            'papel' => 'required|string|in:user,proprietario',
            
            // Campos Asaas — só dígitos (e pontuação usual de máscara), pra
            // barrar HTML/script ou texto solto nesses campos antes de ir pro
            // gateway de pagamento (o app já filtra no teclado, mas isso é só
            // cosmético; a validação real precisa estar aqui).
            'cpf_cnpj' => 'required|string|max:18|regex:/^[0-9.\-\/\s]+$/',
            'mobile_phone' => 'required|string|max:20|regex:/^[0-9()\-\s]+$/',
            'phone' => 'nullable|string|max:20|regex:/^[0-9()\-\s]+$/',
            'postal_code' => 'required|string|max:10|regex:/^[0-9\-\s]+$/',
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
            
            'expo_push_token' => 'nullable|string',
            'codigo_indicacao' => 'nullable|string|max:12',
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
                // A versão gravada é sempre a atual do servidor (config/termos.php),
                // não a que o app mandou — o app é só a UI, o backend é quem manda
                // na verdade sobre qual texto o usuário realmente aceitou.
                'termo_compromisso_aceito' => $request->termo_compromisso_aceito,
                'termo_compromisso_aceito_em' => now(),
                'termo_compromisso_versao' => config('termos.versao_atual'),
                'termo_compromisso_ip'     => $request->ip(),
                'termo_compromisso_user_agent' => $request->userAgent(),
            ]);
            // Programa de indicação: liga o novo usuário a quem o convidou (código inválido é ignorado).
            app(\App\Services\IndicacaoService::class)->registrar($user, $request->input('codigo_indicacao'));

            // Bônus de boas-vindas: todo cliente novo (papel 'user') já
            // entra com 100 pontos de fidelidade, visíveis no histórico.
            if ($user->papel === 'user') {
                $user->increment('pontos_saldo', 100);
                DB::table('historico_pontos')->insert([
                    'usuario_id' => $user->id,
                    'estabelecimento_id' => null,
                    'tipo' => 'ganho',
                    'descricao' => 'Bônus de boas-vindas - cadastro na Lokyva',
                    'quantidade' => 100,
                    'created_at' => now(),
                ]);
            }

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
     * Edição do próprio perfil (qualquer papel). E-mail, CPF/CNPJ e papel
     * ficam de fora de propósito: identificam a conta e estão ligados à
     * cobrança (Asaas) e às permissões.
     */
    public function atualizarPerfil(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'            => 'required|string|max:255',
            'telefone'        => 'nullable|string|max:30',
            'data_nascimento' => 'nullable|date|before:today',
            'cep'             => 'nullable|string|max:12',
            'endereco'        => 'nullable|string|max:255',
            'numero'          => 'nullable|string|max:20',
            'bairro'          => 'nullable|string|max:255',
            'cidade'          => 'nullable|string|max:120',
            'estado'          => 'nullable|string|max:2',
            'profissao'       => 'nullable|string|max:255',
            'idiomas'         => 'nullable|string|max:255',
            'onde_estudei'    => 'nullable|string|max:255',
            'onde_moro'       => 'nullable|string|max:255',
            'sobre_mim'       => 'nullable|string|max:1000',
        ]);

        $user->update([
            'name'          => $validated['name'],
            'telefone'      => $validated['telefone'] ?? null,
            'birth_date'    => $validated['data_nascimento'] ?? null,
            'postal_code'   => $validated['cep'] ?? null,
            'address'       => $validated['endereco'] ?? null,
            'address_number' => $validated['numero'] ?? null,
            'province'      => $validated['bairro'] ?? null,
            'city'          => $validated['cidade'] ?? null,
            'state'         => isset($validated['estado']) ? strtoupper($validated['estado']) : null,
            'profissao'     => $validated['profissao'] ?? null,
            'idiomas'       => $validated['idiomas'] ?? null,
            'onde_estudei'  => $validated['onde_estudei'] ?? null,
            'onde_moro'     => $validated['onde_moro'] ?? null,
            'sobre_mim'     => $validated['sobre_mim'] ?? null,
        ]);

        return $this->me($request);
    }

    /**
     * Retorna os dados do perfil do usuário autenticado
     */
    public function me(Request $request)
    {
        try {
            /** @var User $user */
            $user = $request->user();

            $user->load('assinaturaAtiva');

            $totalPontos = $user->pontos_saldo ?? 0;

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
                    'foto_perfil' => $user->foto_perfil,
                    'data_nascimento' => $user->birth_date,
                    'cep' => $user->postal_code,
                    'endereco' => $user->address,
                    'numero' => $user->address_number,
                    'bairro' => $user->province,
                    'membro_desde' => optional($user->created_at)->toDateString(),

                    // Retorno dos novos campos no perfil
                    'onde_estudei' => $user->onde_estudei,
                    'onde_moro' => $user->onde_moro,
                    'idiomas' => $user->idiomas,
                    'profissao' => $user->profissao,
                    'sobre_mim' => $user->sobre_mim,

                    'pontos_saldo' => (int) $totalPontos,
                    // A coluna real é "plano_assinatura" — "plano_atual" não existe
                    // na tabela e sempre voltava null, fazendo o app mostrar
                    // "GRATUITO" pra qualquer usuário, mesmo assinantes Premium.
                    'plano_atual' => $user->plano_assinatura ?? 'gratuito',
                    'assinatura' => $user->assinaturaAtiva ? [
                        'nome_plano' => $user->assinaturaAtiva->nome_plano,
                        'tipo_publico' => $user->assinaturaAtiva->tipo_publico,
                        'valor_mensal' => $user->assinaturaAtiva->valor_mensal,
                        'status' => $user->assinaturaAtiva->status,
                    ] : null,

                    'termo_compromisso' => [
                        'aceito' => (bool) $user->termo_compromisso_aceito,
                        'aceito_em' => $user->termo_compromisso_aceito_em,
                        'versao' => $user->termo_compromisso_versao,
                        'versao_atual' => config('termos.versao_atual'),
                    ],
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
     * Planos do sócio/proprietário que liberam o app mobile para TODOS os
     * funcionários do estabelecimento (ver App\Services\PlanoService).
     */
    private const PLANOS_EQUIPE_COMPLETA = ['premium-socio', 'premium-socio-anual'];

    /**
     * Decide se este funcionário deve ser barrado do login mobile por causa
     * do plano do estabelecimento: no plano básico, só o funcionário mais
     * antigo (primeiro cadastrado) do local pode acessar o app.
     */
    private function funcionarioBloqueadoPeloPlano(Funcionario $funcionario): bool
    {
        $donoId = DB::table('estabelecimento_usuario')
            ->where('estabelecimento_id', $funcionario->estabelecimento_id)
            ->whereIn('tipo', ['proprietario', 'socio', 'admin'])
            ->value('usuario_id');

        $planoDono = $donoId
            ? strtolower(User::where('id', $donoId)->value('plano_assinatura') ?? '')
            : '';

        if (in_array($planoDono, self::PLANOS_EQUIPE_COMPLETA)) {
            return false; // Plano superior: todos os funcionários têm acesso
        }

        $primeiroFuncionarioId = Funcionario::where('estabelecimento_id', $funcionario->estabelecimento_id)
            ->orderBy('id')
            ->value('id');

        return $primeiroFuncionarioId !== $funcionario->id;
    }

    /**
     * Passo 1 da recuperação de senha pelo app: envia um código de 6 dígitos por e-mail.
     * A resposta é sempre a mesma, exista ou não a conta (não revela cadastros).
     */
    public function solicitarCodigoSenha(Request $request, TrocaSenhaService $senhas)
    {
        $dados = $request->validate(['email' => 'required|email|max:255'], [
            'email.required' => 'Informe o e-mail da sua conta.',
            'email.email' => 'Digite um e-mail válido.',
        ]);

        $senhas->enviarCodigo($dados['email'], $request->ip());

        return response()->json([
            'message' => 'Se esse e-mail estiver cadastrado, enviamos um código de 6 dígitos. Ele vale por ' . TrocaSenhaService::VALIDADE_CODIGO_MIN . ' minutos.',
        ]);
    }

    /** Passo 2: confere o código e define a nova senha (máximo de 3 trocas a cada 30 dias). */
    public function redefinirSenha(Request $request, TrocaSenhaService $senhas)
    {
        $dados = $request->validate([
            'email' => 'required|email|max:255',
            'codigo' => 'required|digits:6',
            'password' => ['required', 'confirmed', \Illuminate\Validation\Rules\Password::min(8)],
        ], [
            'codigo.digits' => 'O código tem 6 números.',
            'password.confirmed' => 'As senhas não conferem.',
            'password.min' => 'A senha precisa ter pelo menos 8 caracteres.',
        ]);

        $senhas->redefinir($dados['email'], $dados['codigo'], $dados['password'], $request->ip());

        return response()->json(['message' => 'Senha alterada! Entre com a nova senha.']);
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
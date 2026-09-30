<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        // 1. Validação de todos os campos obrigatórios e opcionais
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            // Só os três papéis que a tela de cadastro realmente oferece (Cliente/
            // Funcionário/Proprietário) podem ser auto-atribuídos aqui — "admin" e
            // "gerente" eram aceitos por essa validação, permitindo que qualquer
            // pessoa se cadastrasse como administrador da plataforma só mandando
            // esse valor no corpo da requisição.
            'papel' => 'required|string|in:user,atendente,socio',
            
            // Novos campos do cliente — só dígitos (e pontuação usual de
            // máscara), pra barrar HTML/script ou texto solto nesses campos
            // antes de ir pro gateway de pagamento.
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
            'notification_disabled' => 'nullable|boolean',
            'codigo_indicacao' => 'nullable|string|max:12',

            // Novos campos de Perfil adicionados
            'onde_estudei' => 'nullable|string|max:255',
            'onde_moro' => 'nullable|string|max:255',
            'idiomas' => 'nullable|string|max:255',
            'profissao' => 'nullable|string|max:255',
            'sobre_mim' => 'nullable|string|max:1000',

            // Aceite do Termo de Compromisso — obrigatório, marcado manualmente
            // pelo usuário (nunca aceito automaticamente). A validação real de
            // "aceitou de verdade" fica no backend, não só no checkbox do front.
            'termo_compromisso_aceito' => 'required|boolean|accepted',
        ]);

        // Limpa os dados para enviar apenas números para a API do Asaas
        $cpfCnpjLimpo = preg_replace('/[^0-9]/', '', $request->cpf_cnpj);
        $telefoneLimpo = preg_replace('/[^0-9]/', '', $request->mobile_phone);
        $cepLimpo = preg_replace('/[^0-9]/', '', $request->postal_code);

        try {
            // 2. PRIMEIRO: Integração com a Asaas para gerar o Customer ID (cus_...)
            $asaasUrl = config('services.asaas.url');
            $asaasKey = config('services.asaas.key');

            $response = Http::withHeaders([
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
                'notificationDisabled' => $request->has('notification_disabled') ? $request->notification_disabled : false,
            ]);

            // Se o Asaas recusar os dados (Ex: CPF Inválido), bloqueamos o cadastro e avisamos o usuário
            if ($response->failed()) {
                $erroAsaas = $response->json();
                $mensagemErro = $erroAsaas['errors'][0]['description'] ?? 'Não foi possível validar seus dados de pagamento.';
                return back()->withErrors(['cpf_cnpj' => 'Asaas recusou o cadastro: ' . $mensagemErro])->withInput();
            }

            // Pega os dados de retorno com sucesso
            $asaasData = $response->json();
            $asaasCustomerId = $asaasData['id'];

            // 3. SEGUNDO: Como o Asaas aprovou, agora salvamos o usuário no Banco de Dados local
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
                
                // Novos campos salvos no banco de dados
                'onde_estudei' => $request->onde_estudei,
                'onde_moro' => $request->onde_moro,
                'idiomas' => $request->idiomas,
                'profissao' => $request->profissao,
                'sobre_mim' => $request->sobre_mim,

                // Aceite do Termo de Compromisso — a versão gravada é sempre a
                // atual do servidor, não a que o front mandou.
                'termo_compromisso_aceito' => (bool) $request->termo_compromisso_aceito,
                'termo_compromisso_aceito_em' => now(),
                'termo_compromisso_versao' => config('termos.versao_atual'),
                'termo_compromisso_ip' => $request->ip(),
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

            // 4. TERCEIRO: Envio de e-mail de boas-vindas via Brevo API
            $brevoKey = config('services.brevo.key');
            if ($brevoKey) {
                Http::withHeaders([
                    'api-key' => $brevoKey,
                    'Content-Type' => 'application/json',
                    'Accept' => 'application/json',
                ])->post('https://api.brevo.com/v3/smtp/email', [
                    'sender' => [
                        'name' => 'Lokyva',
                        'email' => config('mail.from.address', 'nao-responda@lokyva.com'),
                    ],
                    'to' => [
                        [
                            'email' => $user->email,
                            'name' => $user->name,
                        ]
                    ],
                    'subject' => 'Seja bem-vindo(a) à Lokyva!',
                    'htmlContent' => '<html><body><h2>Olá, ' . htmlspecialchars($user->name) . '!</h2><p>Seja muito bem-vindo(a) à Lokyva. Seu cadastro foi realizado com sucesso!</p></body></html>',
                ]);
            }

            event(new Registered($user));

            Auth::login($user);

            return redirect(route('dashboard', absolute: false));

        } catch (\Exception $e) {
            // Em caso de API fora do ar ou sem internet
            return back()->withErrors(['error' => 'Falha de comunicação: ' . $e->getMessage()])->withInput();
        }
    }
}
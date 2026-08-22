<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
            'papel' => 'required|string|in:admin,socio,user,gerente,atendente',
            
            // Novos campos do cliente
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
            'notification_disabled' => 'nullable|boolean',

            // Novos campos de Perfil adicionados
            'onde_estudei' => 'nullable|string|max:255',
            'onde_moro' => 'nullable|string|max:255',
            'idiomas' => 'nullable|string|max:255',
            'profissao' => 'nullable|string|max:255',
            'sobre_mim' => 'nullable|string|max:1000',
        ]);

        // Limpa os dados para enviar apenas números para a API do Asaas
        $cpfCnpjLimpo = preg_replace('/[^0-9]/', '', $request->cpf_cnpj);
        $telefoneLimpo = preg_replace('/[^0-9]/', '', $request->mobile_phone);
        $cepLimpo = preg_replace('/[^0-9]/', '', $request->postal_code);

        try {
            // 2. PRIMEIRO: Integração com a Asaas para gerar o Customer ID (cus_...)
            $asaasUrl = config('services.asaas.url');
            $asaasKey = config('services.asaas.key'); // 👉 CORRIGIDO AQUI!

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
            $asaasCustomerId = $asaasData['id']; // Esse é o "cus_..."

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
                'asaas_customer_id' => $asaasCustomerId, // 👉 SALVA O CUS AQUI!
                
                // Novos campos salvos no banco de dados
                'onde_estudei' => $request->onde_estudei,
                'onde_moro' => $request->onde_moro,
                'idiomas' => $request->idiomas,
                'profissao' => $request->profissao,
                'sobre_mim' => $request->sobre_mim,
            ]);

            event(new Registered($user));

            Auth::login($user);

            return redirect(route('dashboard', absolute: false));

        } catch (\Exception $e) {
            // Em caso de API fora do ar ou sem internet
            return back()->withErrors(['error' => 'Falha de comunicação: ' . $e->getMessage()])->withInput();
        }
    }
}
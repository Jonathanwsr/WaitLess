<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\QueryException;
use Exception;

class ProviderController extends Controller
{
    /**
     * Cadastrar um novo provedor (Integração Asaas + Banco Local)
     */
    public function store(Request $request)
    {
        // 1. Validação
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'regex:/^[a-zA-ZÀ-ÿ\s]+$/'],
            'email' => 'required|email|unique:providers,email',
            'person_type' => 'required|in:FISICA,JURIDICA',
            'document' => ['required', 'string'], 
            'birth_date' => 'required|date',
            'income_value' => 'required|string', // 🚀 Validando a renda que vem do form
            
            'mobile_phone' => 'required|string',
            'postal_code' => 'required|string',
            'address' => 'required|string|max:255',
            'address_number' => 'required|string|max:20',
            'complement' => 'nullable|string|max:100',
            'province' => 'required|string|max:100', 

            'company_type' => 'required_if:person_type,JURIDICA|in:MEI,EI,EIRELI,LTDA,SA,ANY_OTHER',
            'responsible_name' => ['required_if:person_type,JURIDICA', 'nullable', 'string', 'regex:/^[a-zA-ZÀ-ÿ\s]+$/'],
            'responsible_cpf' => 'required_if:person_type,JURIDICA|nullable|string',

            'pix_key_type' => 'required|in:CPF,CNPJ,EMAIL,PHONE,RANDOM',
            'pix_key' => ['required', 'string', 'max:255', 'regex:/^[^<>]+$/'], 
        ]);

        // 2. Limpeza de Strings
        $cleanDocument = preg_replace('/[^0-9]/', '', $validated['document']);
        $cleanPostalCode = preg_replace('/[^0-9]/', '', $validated['postal_code']);
        $cleanMobilePhone = preg_replace('/[^0-9]/', '', $validated['mobile_phone']);
        $cleanRespCpf = $validated['responsible_cpf'] ? preg_replace('/[^0-9]/', '', $validated['responsible_cpf']) : null;
        
        $formattedBirthDate = date('Y-m-d', strtotime($validated['birth_date']));

        // 🚀 Limpeza da Renda (Transforma "R$ 1.500,00" em "1500.00")
        $cleanIncome = str_replace(['R$', ' ', '.'], '', $validated['income_value']);
        $cleanIncome = (float) str_replace(',', '.', $cleanIncome);

        // 3. Preparar o Payload do Asaas
        $asaasPayload = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'cpfCnpj' => $cleanDocument,
            'birthDate' => $formattedBirthDate,
            'incomeValue' => $cleanIncome, // 🚀 Enviando a renda numérica para o Asaas
            'mobilePhone' => $cleanMobilePhone,
            'postalCode' => $cleanPostalCode,
            'address' => $validated['address'],
            'addressNumber' => $validated['address_number'],
            'complement' => $validated['complement'],
            'province' => $validated['province'],
        ];

        if ($validated['person_type'] === 'JURIDICA') {
            $asaasPayload['companyType'] = $validated['company_type'];
        }

        try {
            // 4. Integração com o Asaas
            $response = Http::withoutRedirecting()
                ->withHeaders([
                    'access_token' => config('services.asaas.key'),
                    'Accept'       => 'application/json',
                ])->post(config('services.asaas.url') . '/accounts', $asaasPayload);

            $asaasData = $response->json(); 

            // Se o Asaas retornar erro (Status 400, 401, 500, etc)
            if ($response->failed() || $response->status() === 302) {
                // Registra o log detalhado internamente para sua consulta técnica
                Log::error('Erro ao criar conta no Asaas', [
                    'status' => $response->status(),
                    'response' => $asaasData ?? $response->body(),
                    'payload' => $asaasPayload,
                ]);
                
                // Captura a descrição original vinda do Asaas (ex: "O email ... já está em uso.")
                $errorDescription = $asaasData['errors'][0]['description'] ?? 'Erro desconhecido na API externa.';

                // Traduzindo mensagens comuns para torná-las amigáveis ao usuário
                if (stripos($errorDescription, 'email') !== false && stripos($errorDescription, 'já está em uso') !== false) {
                    return response()->json([
                        'error' => 'Este endereço de e-mail já está cadastrado em nosso sistema de recebimentos. Por favor, tente utilizar outro e-mail.'
                    ], 400);
                }

                if ((stripos($errorDescription, 'CPF') !== false || stripos($errorDescription, 'CNPJ') !== false) && stripos($errorDescription, 'já está em uso') !== false) {
                    return response()->json([
                        'error' => 'Este CPF/CNPJ já possui um perfil financeiro criado. Verifique os dados ou tente outro documento.'
                    ], 400);
                }

                if (stripos($errorDescription, 'mobilePhone') !== false || stripos($errorDescription, 'telefone') !== false) {
                    return response()->json([
                        'error' => 'O número de celular informado é inválido ou já está associado a outra conta.'
                    ], 400);
                }

                // Fallback caso seja outro erro do Asaas (ex: CEP inexistente, nome curto demais)
                return response()->json([
                    'error' => 'Não foi possível validar seus dados junto ao gateway: ' . $errorDescription,
                    'details' => $asaasData['errors'] ?? null
                ], $response->status() === 0 ? 400 : $response->status());
            }

            // Verifica se a carteira realmente foi retornada no sucesso
            if (!is_array($asaasData) || !isset($asaasData['walletId'])) {
                return response()->json(['error' => 'Erro ao vincular conta. A integração não retornou o ID da carteira.'], 500);
            }

            // 5. Salvar no banco de dados local
            $provider = Provider::create([
                'user_id' => $request->user()->id, 
                'name' => $validated['name'],
                'email' => $validated['email'],
                'person_type' => $validated['person_type'],
                'document' => $cleanDocument,
                'birth_date' => $formattedBirthDate, 
                'income_value' => $cleanIncome, // 🚀 Salvando a renda localmente
                'mobile_phone' => $cleanMobilePhone,
                'postal_code' => $cleanPostalCode,
                'address' => $validated['address'],
                'address_number' => $validated['address_number'],
                'complement' => $validated['complement'],
                'province' => $validated['province'],
                
                'company_type' => $validated['company_type'] ?? null,
                'responsible_name' => $validated['responsible_name'] ?? null,
                'responsible_cpf' => $cleanRespCpf,

                'pix_key_type' => $validated['pix_key_type'],
                'pix_key' => trim($validated['pix_key']),

                'asaas_wallet_id' => $asaasData['walletId'], 
                'asaas_api_key' => $asaasData['apiKey'] ?? null,     
                'asaas_status' => $asaasData['status'] ?? 'PENDING',
            ]);

            return response()->json([
                'message' => 'Sua conta de recebimento foi criada e configurada com sucesso.',
                'provider' => $provider
            ], 201);

        } catch (QueryException $ex) {
            // Captura erros críticos de Banco de Dados (Ex: Not null violation)
            Log::critical("Falha crítica na integração Asaas no banco local: " . $ex->getMessage(), [
                'payload' => $asaasPayload
            ]);

            return response()->json([
                'error' => 'Seus dados foram validados no gateway, mas ocorreu um erro interno ao salvar o perfil no sistema. Nossa equipe técnica já foi notificada.'
            ], 500);

        } catch (Exception $e) {
            // Captura qualquer outro erro inesperado (Ex: Falha de conexão de internet com o Asaas)
            Log::error("Erro geral no ProviderController: " . $e->getMessage());

            return response()->json([
                'error' => 'Ocorreu um erro inesperado ao processar sua solicitação. Por favor, tente novamente mais tarde.'
            ], 500);
        }
    }

    /**
     * Obter as informações do provedor para o usuário logado.
     */
    public function show(Request $request)
    {
        try {
            // Busca o provider associado ao usuário autenticado
            $provider = Provider::where('user_id', $request->user()->id)->first();

            // Se não encontrar nada, não quebra! Retorna um estado vazio estruturado
            if (!$provider) {
                return response()->json([
                    'has_profile' => false,
                    'provider' => null
                ], 200);
            }

            // Se encontrar, retorna todos os campos da tabela
            return response()->json([
                'has_profile' => true,
                'provider' => $provider
            ], 200);

        } catch (Exception $e) {
            Log::error("Erro ao buscar perfil de provedor: " . $e->getMessage());

            return response()->json([
                'error' => 'Ocorreu um erro interno ao carregar as suas informações financeiras.'
            ], 500);
        }
    }

    /**
     * Atualizar apenas as informações da Chave PIX do provedor logado.
     */
    public function update(Request $request)
    {
        // 1. Validação restrita apenas aos campos de PIX
        $validated = $request->validate([
            'pix_key_type' => 'required|in:CPF,CNPJ,EMAIL,PHONE,RANDOM',
            'pix_key' => ['required', 'string', 'max:255', 'regex:/^[^<>]+$/'], 
        ]);

        try {
            // 2. Localiza o provedor do usuário autenticado
            $provider = Provider::where('user_id', $request->user()->id)->first();

            if (!$provider) {
                return response()->json([
                    'error' => 'Perfil de recebimento não encontrado para este usuário.'
                ], 404);
            }

            // 3. Atualiza exclusivamente os dados do PIX
            $provider->update([
                'pix_key_type' => $validated['pix_key_type'],
                'pix_key' => trim($validated['pix_key']),
            ]);

            return response()->json([
                'message' => 'Chave PIX atualizada com sucesso!',
                'provider' => $provider
            ], 200);

        } catch (Exception $e) {
            Log::error("Erro ao atualizar chave PIX do provedor: " . $e->getMessage());

            return response()->json([
                'error' => 'Ocorreu um erro interno ao tentar atualizar sua chave PIX.'
            ], 500);
        }
    }
}
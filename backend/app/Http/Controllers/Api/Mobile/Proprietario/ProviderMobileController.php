<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use App\Models\ContaPagamentoEstabelecimento;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Database\QueryException;
use Exception;

class ProviderMobileController extends Controller
{
    /**
     * Listar estabelecimentos associados ao usuário logado (para o dropdown do App)
     */
    public function getEstabelecimentos(Request $request)
    {
        try {
            $user = $request->user();

            $estabelecimentos = $user->estabelecimentos()
                ->select('estabelecimentos.id', 'estabelecimentos.nome') // Ajuste as colunas conforme seu BD
                ->get();

            return response()->json([
                'success' => true,
                'estabelecimentos' => $estabelecimentos
            ], 200);

        } catch (Exception $e) {
            Log::error("Erro ao buscar estabelecimentos do usuário: " . $e->getMessage());

            return response()->json([
                'error' => 'Não foi possível carregar seus estabelecimentos.'
            ], 500);
        }
    }

    /**
     * Cadastrar um novo provedor (Asaas + Banco Local + Conta de Pagamento do Estabelecimento)
     */
    public function store(Request $request)
    {
        $user = $request->user();

        // 1. Validação
        $validated = $request->validate([
            // Dados do Provedor
            'name'             => ['required', 'string', 'max:255', 'regex:/^[a-zA-ZÀ-ÿ\s]+$/'],
            'email'            => 'required|email|unique:providers,email',
            'person_type'      => 'required|in:FISICA,JURIDICA',
            'document'         => ['required', 'string'], 
            'birth_date'       => 'required|date',
            'income_value'     => 'required|string',
            'mobile_phone'     => 'required|string',
            'postal_code'      => 'required|string',
            'address'          => 'required|string|max:255',
            'address_number'   => 'required|string|max:20',
            'complement'       => 'nullable|string|max:100',
            'province'         => 'required|string|max:100', 

            'company_type'     => 'required_if:person_type,JURIDICA|in:MEI,EI,EIRELI,LTDA,SA,ANY_OTHER',
            'responsible_name' => ['required_if:person_type,JURIDICA', 'nullable', 'string', 'regex:/^[a-zA-ZÀ-ÿ\s]+$/'],
            'responsible_cpf'  => 'required_if:person_type,JURIDICA|nullable|string',

            // Chave PIX Principal
            'pix_key_type'     => 'required|in:CPF,CNPJ,EMAIL,PHONE,RANDOM',
            'pix_key'          => ['required', 'string', 'max:255', 'regex:/^[^<>]+$/'], 

            // Dados do Estabelecimento & Chave PIX Reserva (OPCIONAL)
            'estabelecimento_id' => [
                'nullable',
                'exists:estabelecimentos,id',
                function ($attribute, $value, $fail) use ($user) {
                    if ($value && !$user->estabelecimentos()->where('estabelecimentos.id', $value)->exists()) {
                        $fail('O estabelecimento selecionado não pertence à sua conta.');
                    }
                }
            ],
            'gateway'          => 'nullable|string|max:100', // ex: asaas, stripe, mercadopago, pix_direto
            'chave_pix_reserva'=> ['nullable', 'string', 'max:255', 'different:pix_key', 'regex:/^[^<>]+$/'],
            'ativo'            => 'nullable|boolean'
        ]);

        // 2. Limpeza de Strings
        $cleanDocument     = preg_replace('/[^0-9]/', '', $validated['document']);
        $cleanPostalCode   = preg_replace('/[^0-9]/', '', $validated['postal_code']);
        $cleanMobilePhone  = preg_replace('/[^0-9]/', '', $validated['mobile_phone']);
        $cleanRespCpf      = !empty($validated['responsible_cpf']) ? preg_replace('/[^0-9]/', '', $validated['responsible_cpf']) : null;
        
        $formattedBirthDate = date('Y-m-d', strtotime($validated['birth_date']));

        // Limpeza da Renda (Transforma "R$ 1.500,00" em 1500.00)
        $cleanIncome = str_replace(['R$', ' ', '.'], '', $validated['income_value']);
        $cleanIncome = (float) str_replace(',', '.', $cleanIncome);

        // 3. Preparar Payload do Asaas
        $asaasPayload = [
            'name'          => $validated['name'],
            'email'         => $validated['email'],
            'cpfCnpj'       => $cleanDocument,
            'birthDate'     => $formattedBirthDate,
            'incomeValue'   => $cleanIncome,
            'mobilePhone'   => $cleanMobilePhone,
            'postalCode'    => $cleanPostalCode,
            'address'       => $validated['address'],
            'addressNumber' => $validated['address_number'],
            'complement'    => $validated['complement'] ?? null,
            'province'      => $validated['province'],
        ];

        if ($validated['person_type'] === 'JURIDICA') {
            $asaasPayload['companyType'] = $validated['company_type'];
        }

        try {
            // 4. Integrar com Asaas
            $response = Http::withoutRedirecting()
                ->withHeaders([
                    'access_token' => config('services.asaas.key'),
                    'Accept'       => 'application/json',
                ])->post(config('services.asaas.url') . '/accounts', $asaasPayload);

            $asaasData = $response->json(); 

            // Se o Asaas retornar erro
            if ($response->failed() || $response->status() === 302) {
                Log::error('Erro ao criar conta no Asaas (Mobile)', [
                    'status'   => $response->status(),
                    'response' => $asaasData ?? $response->body(),
                    'payload'  => $asaasPayload,
                ]);

                $errorDescription = $asaasData['errors'][0]['description'] ?? 'Erro desconhecido na API externa.';

                if (stripos($errorDescription, 'email') !== false && stripos($errorDescription, 'já está em uso') !== false) {
                    return response()->json([
                        'error' => 'Este e-mail já está cadastrado em nosso sistema financeiro.'
                    ], 400);
                }

                if ((stripos($errorDescription, 'CPF') !== false || stripos($errorDescription, 'CNPJ') !== false) && stripos($errorDescription, 'já está em uso') !== false) {
                    return response()->json([
                        'error' => 'Este CPF/CNPJ já possui um perfil financeiro criado.'
                    ], 400);
                }

                if (stripos($errorDescription, 'mobilePhone') !== false || stripos($errorDescription, 'telefone') !== false) {
                    return response()->json([
                        'error' => 'O celular informado é inválido ou já está associado a outra conta.'
                    ], 400);
                }

                return response()->json([
                    'error'   => 'Não foi possível validar seus dados no gateway: ' . $errorDescription,
                    'details' => $asaasData['errors'] ?? null
                ], $response->status() === 0 ? 400 : $response->status());
            }

            if (!is_array($asaasData) || !isset($asaasData['walletId'])) {
                return response()->json(['error' => 'Erro ao vincular conta. O Asaas não retornou o ID da carteira.'], 500);
            }

            // 5. Salvar em Transação no Banco de Dados
            $result = DB::transaction(function () use ($user, $validated, $cleanDocument, $formattedBirthDate, $cleanIncome, $cleanMobilePhone, $cleanPostalCode, $cleanRespCpf, $asaasData) {
                
                // A) Salvar Provedor
                $provider = Provider::create([
                    'user_id'          => $user->id, 
                    'name'             => $validated['name'],
                    'email'            => $validated['email'],
                    'person_type'      => $validated['person_type'],
                    'document'         => $cleanDocument,
                    'birth_date'       => $formattedBirthDate, 
                    'income_value'     => $cleanIncome,
                    'mobile_phone'     => $cleanMobilePhone,
                    'postal_code'      => $cleanPostalCode,
                    'address'          => $validated['address'],
                    'address_number'   => $validated['address_number'],
                    'complement'       => $validated['complement'] ?? null,
                    'province'         => $validated['province'],
                    
                    'company_type'     => $validated['company_type'] ?? null,
                    'responsible_name' => $validated['responsible_name'] ?? null,
                    'responsible_cpf'  => $cleanRespCpf,

                    'pix_key_type'     => $validated['pix_key_type'],
                    'pix_key'          => trim($validated['pix_key']),

                    'asaas_wallet_id'  => $asaasData['walletId'], 
                    'asaas_api_key'    => $asaasData['apiKey'] ?? null,     
                    'asaas_status'     => $asaasData['status'] ?? 'PENDING',
                ]);

                // B) Salvar na tabela contas_pagamento_estabelecimento (Se estabelecimento informado ou se enviou PIX reserva)
                $contaPagamento = null;
                if (!empty($validated['estabelecimento_id'])) {
                    $chavePixReserva = !empty($validated['chave_pix_reserva']) ? trim($validated['chave_pix_reserva']) : null;

                    $contaPagamento = ContaPagamentoEstabelecimento::create([
                        'estabelecimento_id' => $validated['estabelecimento_id'],
                        'gateway'            => $validated['gateway'] ?? 'asaas',
                        'id_conta_gateway'   => $asaasData['walletId'],
                        'chave_pix'          => $chavePixReserva, // Chave reserva salva aqui
                        'ativo'              => $validated['ativo'] ?? true,
                    ]);
                }

                return [
                    'provider' => $provider,
                    'conta_pagamento' => $contaPagamento
                ];
            });

            return response()->json([
                'message'         => 'Sua conta de recebimento foi criada e configurada com sucesso.',
                'provider'        => $result['provider'],
                'conta_pagamento' => $result['conta_pagamento']
            ], 201);

        } catch (QueryException $ex) {
            Log::critical("Falha em banco de dados no ProviderMobileController: " . $ex->getMessage(), [
                'payload' => $asaasPayload
            ]);

            return response()->json([
                'error' => 'Seus dados foram validados no gateway, mas ocorreu um erro interno ao salvar o perfil no sistema.'
            ], 500);

        } catch (Exception $e) {
            Log::error("Erro geral no ProviderMobileController: " . $e->getMessage());

            return response()->json([
                'error' => 'Ocorreu um erro inesperado ao processar sua solicitação.'
            ], 500);
        }
    }

    /**
     * Detalhes do perfil e contas de pagamento do usuário
     */
    public function show(Request $request)
    {
        try {
            $user = $request->user();
            $provider = Provider::where('user_id', $user->id)->first();

            if (!$provider) {
                return response()->json([
                    'has_profile' => false,
                    'provider' => null,
                    'contas_pagamento' => []
                ], 200);
            }

            // Busca as contas de pagamento associadas aos estabelecimentos do usuário
            $estabelecimentosIds = $user->estabelecimentos()->pluck('estabelecimentos.id');
            $contasPagamento = ContaPagamentoEstabelecimento::whereIn('estabelecimento_id', $estabelecimentosIds)->get();

            return response()->json([
                'has_profile' => true,
                'provider' => $provider,
                'contas_pagamento' => $contasPagamento
            ], 200);

        } catch (Exception $e) {
            Log::error("Erro ao buscar perfil mobile: " . $e->getMessage());

            return response()->json([
                'error' => 'Ocorreu um erro interno ao carregar suas informações financeiras.'
            ], 500);
        }
    }

    /**
     * Atualizar chaves PIX (Principal e/ou Reserva do Estabelecimento)
     */
    public function update(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'pix_key_type'       => 'required|in:CPF,CNPJ,EMAIL,PHONE,RANDOM',
            'pix_key'            => ['required', 'string', 'max:255', 'regex:/^[^<>]+$/'], 
            'estabelecimento_id' => [
                'nullable',
                'exists:estabelecimentos,id',
                function ($attribute, $value, $fail) use ($user) {
                    if ($value && !$user->estabelecimentos()->where('estabelecimentos.id', $value)->exists()) {
                        $fail('O estabelecimento informado não pertence a este usuário.');
                    }
                }
            ],
            'chave_pix_reserva'  => ['nullable', 'string', 'max:255', 'different:pix_key', 'regex:/^[^<>]+$/'],
        ]);

        try {
            $provider = Provider::where('user_id', $user->id)->first();

            if (!$provider) {
                return response()->json([
                    'error' => 'Perfil de recebimento não encontrado.'
                ], 404);
            }

            DB::transaction(function () use ($provider, $validated) {
                // Atualiza chave PIX principal
                $provider->update([
                    'pix_key_type' => $validated['pix_key_type'],
                    'pix_key'      => trim($validated['pix_key']),
                ]);

                // Atualiza chave PIX reserva se informado estabelecimento
                if (!empty($validated['estabelecimento_id'])) {
                    ContaPagamentoEstabelecimento::updateOrCreate(
                        ['estabelecimento_id' => $validated['estabelecimento_id']],
                        [
                            'gateway'   => 'asaas',
                            'chave_pix' => !empty($validated['chave_pix_reserva']) ? trim($validated['chave_pix_reserva']) : null,
                            'ativo'     => true,
                        ]
                    );
                }
            });

            return response()->json([
                'message'  => 'Chaves PIX atualizadas com sucesso!',
                'provider' => $provider->fresh()
            ], 200);

        } catch (Exception $e) {
            Log::error("Erro ao atualizar chaves PIX no mobile: " . $e->getMessage());

            return response()->json([
                'error' => 'Ocorreu um erro interno ao atualizar suas chaves PIX.'
            ], 500);
        }
    }
}
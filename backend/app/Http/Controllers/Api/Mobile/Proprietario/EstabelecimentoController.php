<?php

namespace App\Http\Controllers\Api\Mobile\Proprietario;

use App\Http\Controllers\Controller;
use App\Models\Estabelecimento;
use App\Models\Agendamento;
use App\Models\Aluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use App\Services\HiveAiService; // Novo serviço para verificação de imagem

class EstabelecimentoController extends Controller
{
    /**
     * SALVAR NOVO ESTABELECIMENTO VIA APP
     */
    public function store(Request $request)
    {
        // Limpando as máscaras para o banco
        $this->limparMascaras($request);

        $validated = $request->validate([
            'nome'         => 'required|string|max:255',
            'razao_social' => 'nullable|string|max:255',
            'cnpj'         => 'required|string|max:14', // Obrigatório conforme o app
            'site'         => 'nullable|string|max:255', // Deixado como string para não dar erro se faltar http://
            'ramo_atuacao' => 'nullable|string|max:255',
            'telefone'     => 'nullable|string|max:15',
            'cep'          => 'nullable|string|max:8',
            'rua'          => 'nullable|string|max:255',
            'numero'       => 'required|string|max:50', // Obrigatório conforme o app
            'complemento'  => 'nullable|string|max:255',
            'bairro'       => 'nullable|string|max:255',
            'cidade'       => 'nullable|string|max:255',
            'estado'       => 'nullable|string|size:2',
            
            // Alterado de 'logo' para 'foto_perfil' para bater com o FormData do app React Native
            'foto_perfil'  => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            
            // 3 a 4 Imagens do Estabelecimento (Máx 2MB por foto)
            'fotos'        => 'nullable|array|min:3|max:4',
            'fotos.*'      => 'image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        try {
            // ==========================================
            // 1. VERIFICAÇÃO HIVE AI E UPLOAD (Cloudflare R2)
            // ==========================================
            if ($request->hasFile('foto_perfil')) {
                $fileLogo = $request->file('foto_perfil');
                
                // Verifica no Hive AI se a imagem é segura (SFW)
                if (!HiveAiService::isSafe($fileLogo)) {
                    return response()->json(['error' => 'A foto de perfil foi bloqueada pelo sistema de segurança (conteúdo impróprio).'], 422);
                }

                // Upload para o Cloudflare R2
                $path = $fileLogo->store('waitless/estabelecimentos/perfil', 'r2');
                $validated['foto_perfil'] = Storage::disk('r2')->url($path);
            }

            if ($request->hasFile('fotos')) {
                $fotosUrls = [];
                
                foreach ($request->file('fotos') as $foto) {
                    // Verifica cada foto no Hive AI
                    if (!HiveAiService::isSafe($foto)) {
                        return response()->json(['error' => 'Uma ou mais fotos do estabelecimento foram bloqueadas pelo sistema de segurança (conteúdo impróprio).'], 422);
                    }
                    
                    // Upload para o R2
                    $path = $foto->store('waitless/estabelecimentos/fotos', 'r2');
                    $fotosUrls[] = Storage::disk('r2')->url($path);
                }
                
                // Salvando o array de URLs como JSON no banco
                $validated['fotos'] = json_encode($fotosUrls);
            }

            // ==========================================
            // 2. CRIAÇÃO NO BANCO
            // ==========================================
            $estabelecimento = Estabelecimento::create($validated);
            $estabelecimento->proprietarios()->attach(Auth::id(), ['tipo' => 'proprietario']);

            return response()->json([
                'message' => 'Estabelecimento criado com sucesso!',
                'estabelecimento' => $estabelecimento
            ], 201);

        } catch (\Exception $e) {
            \Log::error('Erro APP Salvar Estabelecimento: ' . $e->getMessage());
            return response()->json(['error' => 'Erro interno ao salvar. Tente novamente.'], 500);
        }
    }

    /**
     * ATUALIZAR ESTABELECIMENTO (EDITAR)
     */
    public function update(Request $request, $id)
    {
        $estabelecimento = Estabelecimento::findOrFail($id);

        $this->limparMascaras($request);

        $validated = $request->validate([
            'nome'              => 'required|string|max:255',
            'cnpj'              => 'required|string|max:14',
            'razao_social'      => 'nullable|string|max:255',
            'site'              => 'nullable|string|max:255',
            'ramo_atuacao'      => 'nullable|string|max:255',
            'telefone'          => 'nullable|string|max:20',
            'cep'               => 'nullable|string|max:8',
            'rua'               => 'nullable|string|max:255',
            'numero'            => 'required|string|max:20',
            'complemento'       => 'nullable|string|max:255',
            'bairro'            => 'nullable|string|max:255',
            'cidade'            => 'nullable|string|max:255',
            'estado'            => 'nullable|string|size:2',
            'token_mercadopago' => 'nullable|string', 
            
            // Alterado de 'logo' para 'foto_perfil' também no update
            'foto_perfil'       => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            'fotos'             => 'nullable|array|min:3|max:4',
            'fotos.*'           => 'image|mimes:jpeg,png,jpg,webp|max:2048',
        ]);

        try {
            // UPLOAD E VERIFICAÇÃO DA FOTO DE PERFIL
            if ($request->hasFile('foto_perfil')) {
                if (!HiveAiService::isSafe($request->file('foto_perfil'))) {
                    return response()->json(['error' => 'A foto de perfil foi bloqueada pelo sistema (conteúdo impróprio).'], 422);
                }
                $path = $request->file('foto_perfil')->store('waitless/estabelecimentos/perfil', 'r2');
                $validated['foto_perfil'] = Storage::disk('r2')->url($path);
            } else {
                unset($validated['foto_perfil']); // Mantém a antiga se não enviar
            }

            // UPLOAD E VERIFICAÇÃO DAS FOTOS DA GALERIA
            if ($request->hasFile('fotos')) {
                $fotosUrls = [];
                foreach ($request->file('fotos') as $foto) {
                    if (!HiveAiService::isSafe($foto)) {
                        return response()->json(['error' => 'Uma foto foi bloqueada (conteúdo impróprio).'], 422);
                    }
                    $path = $foto->store('waitless/estabelecimentos/fotos', 'r2');
                    $fotosUrls[] = Storage::disk('r2')->url($path);
                }
                $validated['fotos'] = json_encode($fotosUrls);
            } else {
                unset($validated['fotos']); // Mantém as antigas se não enviar
            }

            $estabelecimento->update($validated);
            
            return response()->json([
                'message' => 'Configurações atualizadas com sucesso!',
                'estabelecimento' => $estabelecimento
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Erro ao editar estabelecimento via App: ' . $e->getMessage());
            return response()->json(['error' => 'Erro ao atualizar. Verifique os dados e tente novamente.'], 500);
        }
    }

    /**
     * APAGAR ESTABELECIMENTO (Com regra de bloqueio)
     */
    public function destroy($id)
    {
        $estabelecimento = Estabelecimento::findOrFail($id);

        $temAgendamentos = Agendamento::where('estabelecimento_id', $estabelecimento->id)
            ->whereIn('status', ['pendente', 'confirmado', 'aguardando_pagamento'])
            ->exists();

        $temReservas = Aluguel::where('estabelecimento_id', $estabelecimento->id)
            ->whereIn('status', ['aguardando_pagamento', 'pendente', 'confirmado', 'em_andamento'])
            ->exists();

        if ($temAgendamentos || $temReservas) {
            return response()->json([
                'error' => 'Ação bloqueada! Você possui agendamentos ou reservas em andamento para este estabelecimento.'
            ], 403);
        }

        $estabelecimento->delete();

        return response()->json(['message' => 'Estabelecimento apagado com sucesso!']);
    }

    /**
     * BUSCAR DADOS (SHOW)
     */
    public function show($id)
    {
        $estabelecimento = Estabelecimento::whereHas('proprietarios', function ($query) {
            $query->where('users.id', Auth::id());
        })->findOrFail($id);

        return response()->json($estabelecimento, 200);
    }

    /**
     * ATIVAR / DESATIVAR
     */
    public function toggleStatus($id)
    {
        $estabelecimento = Estabelecimento::findOrFail($id);
        $estabelecimento->update(['ativo' => !$estabelecimento->ativo]);
        
        return response()->json([
            'message' => $estabelecimento->ativo ? 'Estabelecimento reativado!' : 'Desativado temporariamente.',
            'ativo' => $estabelecimento->ativo
        ], 200);
    }

    /**
     * Helper para limpar máscaras
     */
    private function limparMascaras(Request $request)
    {
        if ($request->filled('cnpj')) {
            $request->merge(['cnpj' => preg_replace('/[^0-9]/', '', $request->cnpj)]);
        }
        if ($request->filled('cep')) {
            $request->merge(['cep' => preg_replace('/[^0-9]/', '', $request->cep)]);
        }
        if ($request->filled('telefone')) {
            $request->merge(['telefone' => preg_replace('/[^0-9]/', '', $request->telefone)]);
        }
    }
}
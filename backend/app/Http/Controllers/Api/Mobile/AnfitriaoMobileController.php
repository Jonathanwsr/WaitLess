<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;

class AnfitriaoMobileController extends Controller
{
    /**
     * Atualiza os dados extras do perfil do Anfitrião
     */
    public function updatePerfil(Request $request)
    {
        $user = Auth::user();

        // Trava de segurança: Apenas donos e admins podem ter esse perfil preenchido
        if (!in_array($user->papel, ['admin', 'socio', 'proprietario'])) {
            return response()->json(['error' => 'Acesso negado. Apenas anfitriões podem editar este perfil.'], 403);
        }

        $validated = $request->validate([
            'onde_estudei' => 'nullable|string|max:255',
            'onde_moro'    => 'nullable|string|max:255',
            'idiomas'      => 'nullable|string|max:255',
            'profissao'    => 'nullable|string|max:255',
            'sobre_mim'    => 'nullable|string|max:1000',
        ]);

        $user->update($validated);

        return response()->json([
            'message' => 'Perfil de anfitrião atualizado com sucesso!',
            'anfitriao' => $user
        ], 200);
    }

    /**
     * Retorna os dados do Perfil Público do Anfitrião/Estabelecimento
     * Utilizado na tela "PerfilAnfitriao" do React Native
     */
    public function getPerfil($id)
    {
        try {
            // Busca o Estabelecimento (ou falha se não existir)
            $estabelecimento = Estabelecimento::find($id);

            if (!$estabelecimento) {
                return response()->json(['error' => 'Estabelecimento não encontrado.'], 404);
            }

            // Busca os Itens de Aluguel vinculados a este estabelecimento
            $itensAluguel = ItemAluguel::where('estabelecimento_id', $id)
                ->where('ativo', true)
                ->get();

            // Busca os Serviços normais vinculados a este estabelecimento
            $servicos = Servico::where('estabelecimento_id', $id)
                ->where('ativo', true)
                ->get();

            // Formatação dos Itens de Aluguel (Locação de Carros, Espaços, etc)
            $destaquesItens = $itensAluguel->map(function ($item) {
                $precoFinal = $item->valor_diaria ?? 0;
                // Cálculo visual de desconto (exemplo: 10% de desconto fictício ou real do BD)
                $precoAntigo = $precoFinal > 0 ? $precoFinal * 1.10 : 0;

                return [
                    'id' => $item->id,
                    'tipo' => 'item',
                    'nome' => $item->nome ?? 'Locação',
                    'preco' => number_format($precoFinal, 2, ',', '.'),
                    'precoAntigo' => number_format($precoAntigo, 2, ',', '.'),
                    'desconto' => '-10%',
                    'img' => $item->foto_principal ?? 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1000&auto=format&fit=crop',
                    'badge' => 'Disponível',
                    'desc' => "Diária • " . ($item->possui_ar_condicionado ? 'Ar Condicionado' : 'Econômico')
                ];
            });

            // Formatação dos Serviços de Agendamento
            $destaquesServicos = $servicos->map(function ($servico) {
                $precoFinal = $servico->valor ?? 0;
                
                return [
                    'id' => 's' . $servico->id, // Para não chocar chaves no React
                    'tipo' => 'servico',
                    'nome' => $servico->nome ?? 'Serviço',
                    'preco' => number_format($precoFinal, 2, ',', '.'),
                    'precoAntigo' => null,
                    'desconto' => null,
                    'img' => $servico->foto ?? 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop',
                    'badge' => 'Agendamento',
                    'desc' => "Serviço Padrão"
                ];
            });

            // Junta os Itens e os Serviços na mesma lista de Destaques
            $destaques = $destaquesItens->merge($destaquesServicos);

            // Monta o JSON Blindado para o Front-end
            return response()->json([
                'anfitriao' => [
                    'nome' => $estabelecimento->nome ?? 'Auto Reserva',
                    'subtitulo' => 'Estabelecimento • 2,9 km',
                    'foto_perfil' => $estabelecimento->foto_perfil ?? 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=256&auto=format&fit=crop', // Imagem Genérica do Rosto
                    'capa' => $estabelecimento->foto_capa ?? 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=1000&auto=format&fit=crop', // Imagem Genérica dos Carros
                    'total_avaliacoes' => $estabelecimento->total_avaliacoes ?? 93,
                    'avaliacao_media' => $estabelecimento->avaliacao_media ?? '4,86',
                    'status' => 'Superhost',
                    'onde_estudei' => 'Não informado',
                    'onde_moro' => $estabelecimento->cidade ? $estabelecimento->cidade . ', Brasil' : 'Não informado',
                    'idiomas' => 'Português',
                ],
                'destaques' => $destaques
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao buscar perfil: ' . $e->getMessage()], 500);
        }
    }
}
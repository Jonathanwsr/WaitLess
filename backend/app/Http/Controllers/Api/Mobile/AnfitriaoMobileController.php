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
     * "fotos" é salvo como JSON (array de URLs) tanto em itens_aluguel quanto em servicos.
     */
    private function primeiraFoto($fotos): ?string
    {
        if (!$fotos) return null;
        if (is_array($fotos)) return $fotos[0] ?? null;
        $decoded = json_decode($fotos, true);
        return is_array($decoded) ? ($decoded[0] ?? null) : null;
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

            // itens_aluguel.estabelecimento_id na verdade referencia USERS (o
            // sócio dono do item), não a tabela "estabelecimentos" — por isso
            // precisamos resolver primeiro quem são os sócios/proprietários
            // deste estabelecimento antes de buscar os itens deles.
            $proprietarioIds = $estabelecimento->proprietarios()
                ->wherePivotIn('tipo', ['proprietario', 'socio'])
                ->pluck('users.id');

            // Só as reservas cadastradas neste local (as avulsas do dono e as de outros locais ficam de fora).
            $itensAluguel = ItemAluguel::catalogo()->doLocal((int) $estabelecimento->id)
                ->where('ativo', true)
                ->get();

            // Busca os Serviços normais vinculados a este estabelecimento
            $servicos = Servico::where('estabelecimento_id', $id)
                ->where('ativo', true)
                ->get();

            // Formatação dos Itens de Aluguel (Locação de Carros, Espaços, etc) — só
            // aplica desconto/badge quando o item realmente tem promoção cadastrada,
            // nunca um valor fictício fixo.
            $destaquesItens = $itensAluguel->map(function ($item) {
                $precoFinal = (float) ($item->valor_diaria ?? 0);
                $temPromocao = (bool) ($item->tem_promocao ?? false) && (float) ($item->valor_desconto ?? 0) > 0;
                $precoAntigo = null;
                $desconto = null;

                if ($temPromocao) {
                    if (($item->tipo_desconto ?? null) === 'percentual') {
                        $precoAntigo = $precoFinal;
                        $precoFinal = round($precoFinal * (1 - $item->valor_desconto / 100), 2);
                        $desconto = '-' . rtrim(rtrim(number_format($item->valor_desconto, 1), '0'), '.') . '%';
                    } else {
                        $precoAntigo = $precoFinal;
                        $precoFinal = max(0, round($precoFinal - $item->valor_desconto, 2));
                        $desconto = '-R$ ' . number_format($item->valor_desconto, 2, ',', '.');
                    }
                }

                return [
                    'id' => $item->id,
                    'tipo' => 'item',
                    'categoria' => $item->categoria,
                    'nome' => $item->nome ?? 'Locação',
                    'preco' => number_format($precoFinal, 2, ',', '.'),
                    'precoAntigo' => $precoAntigo !== null ? number_format($precoAntigo, 2, ',', '.') : null,
                    'desconto' => $desconto,
                    'img' => $this->primeiraFoto($item->fotos),
                    'badge' => $item->avaliacao_media && $item->avaliacao_media >= 4.5 ? 'Mais reservado' : null,
                    'desc' => ($item->lugares || $item->capacidade_pessoas) ? "Até " . ($item->lugares ?? $item->capacidade_pessoas) . ' pessoas' : 'Diária'
                ];
            });

            // Formatação dos Serviços de Agendamento
            $destaquesServicos = $servicos->map(function ($servico) {
                $precoFinal = (float) ($servico->valor ?? 0);
                $temPromocao = (bool) ($servico->tem_promocao ?? false) && (float) ($servico->valor_desconto ?? 0) > 0;
                $precoAntigo = null;
                $desconto = null;

                if ($temPromocao) {
                    if (($servico->tipo_desconto ?? null) === 'percentual') {
                        $precoAntigo = $precoFinal;
                        $precoFinal = round($precoFinal * (1 - $servico->valor_desconto / 100), 2);
                        $desconto = '-' . rtrim(rtrim(number_format($servico->valor_desconto, 1), '0'), '.') . '%';
                    } else {
                        $precoAntigo = $precoFinal;
                        $precoFinal = max(0, round($precoFinal - $servico->valor_desconto, 2));
                        $desconto = '-R$ ' . number_format($servico->valor_desconto, 2, ',', '.');
                    }
                }

                return [
                    'id' => 's' . $servico->id, // Para não chocar chaves no React
                    'tipo' => 'servico',
                    'categoria' => null,
                    'nome' => $servico->nome ?? 'Serviço',
                    'preco' => number_format($precoFinal, 2, ',', '.'),
                    'precoAntigo' => $precoAntigo !== null ? number_format($precoAntigo, 2, ',', '.') : null,
                    'desconto' => $desconto,
                    'img' => $this->primeiraFoto($servico->fotos),
                    'badge' => null,
                    'desc' => $servico->duracao_minutos ? "{$servico->duracao_minutos} min" : 'Serviço'
                ];
            });

            // Junta os Itens e os Serviços na mesma lista de Destaques — precisa
            // virar Collection "base" antes do merge, porque ->map() numa
            // Eloquent\Collection retorna itens como array (não Model), e o
            // merge() dessa classe assume Model (chama getKey() e quebra).
            $destaques = collect($destaquesItens->all())->merge($destaquesServicos->all())->values();

            // Monta o JSON Blindado para o Front-end
            return response()->json([
                'anfitriao' => [
                    'nome' => $estabelecimento->nome,
                    'subtitulo' => trim('Estabelecimento' . ($estabelecimento->cidade ? " • {$estabelecimento->cidade}" : '')),
                    'foto_perfil' => $estabelecimento->foto_perfil,
                    'capa' => $estabelecimento->foto_banner,
                    'total_avaliacoes' => $estabelecimento->total_avaliacoes ?? 0,
                    'avaliacao_media' => $estabelecimento->avaliacao_media,
                    'status' => $estabelecimento->avaliacao_media && $estabelecimento->avaliacao_media >= 4.8 ? 'Superanfitrião' : 'Verificado',
                    'onde_estudei' => null,
                    'onde_moro' => $estabelecimento->cidade ? $estabelecimento->cidade . ($estabelecimento->estado ? ", {$estabelecimento->estado}" : '') : null,
                    'idiomas' => null,
                ],
                'destaques' => $destaques
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao buscar perfil: ' . $e->getMessage()], 500);
        }
    }
}
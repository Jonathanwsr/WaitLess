<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Api\AssinaturaController;
use App\Models\Avaliacao;
use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Models\Servico;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

class WelcomeController extends Controller
{
    public function index(AssinaturaController $assinaturaController)
    {
        $servicos = Servico::query()
            ->where('ativo', true)
            ->whereHas('estabelecimento', fn ($query) => $query->where('ativo', true))
            ->with('estabelecimento:id,nome,rua,numero,bairro,cidade,estado')
            ->latest()
            ->take(8)
            ->get(['id', 'estabelecimento_id', 'nome', 'descricao', 'valor', 'duracao_minutos', 'fotos'])
            ->map(fn (Servico $servico) => [
                'id' => $servico->id,
                'tipo' => 'servico',
                'nome' => $servico->nome,
                'descricao' => $servico->descricao,
                'valor' => (float) $servico->valor,
                'duracao_minutos' => $servico->duracao_minutos,
                'foto' => $this->primeiraFoto($servico->fotos),
                'estabelecimento' => $servico->estabelecimento?->nome,
                'endereco' => $servico->estabelecimento?->endereco_completo,
            ]);

        $itensAluguel = ItemAluguel::query()
            ->where('ativo', true)
            ->where('disponivel', true)
            ->latest()
            ->take(8)
            ->get(['id', 'nome', 'descricao', 'categoria', 'valor', 'valor_diaria', 'valor_semanal', 'valor_mensal', 'endereco', 'numero', 'bairro', 'cidade', 'estado'])
            ->map(fn (ItemAluguel $item) => [
                'id' => $item->id,
                'tipo' => 'aluguel',
                'nome' => $item->nome,
                'descricao' => $item->descricao,
                'categoria' => $item->categoria,
                'valor' => (float) ($item->valor ?? $item->valor_diaria ?? $item->valor_semanal ?? $item->valor_mensal ?? 0),
                'periodo' => $item->valor
                    ? null
                    : ($item->valor_diaria ? 'dia' : ($item->valor_semanal ? 'semana' : ($item->valor_mensal ? 'mês' : null))),
                'endereco' => $item->endereco_completo,
            ]);

        $destaquesPremium = $assinaturaController->montarVitrinePremium(10);

        $estatisticas = [
            'estabelecimentos' => Estabelecimento::where('ativo', true)->count(),
            'cidades' => Estabelecimento::where('ativo', true)->whereNotNull('cidade')->distinct('cidade')->count('cidade'),
            'servicos' => Servico::where('ativo', true)->count(),
            'itensAluguel' => ItemAluguel::where('ativo', true)->where('disponivel', true)->count(),
        ];

        return Inertia::render('Welcome', [
            'canLogin' => Route::has('login'),
            'canRegister' => Route::has('register'),
            'servicosDestaque' => $servicos,
            'itensAluguelDestaque' => $itensAluguel,
            'destaquesPremium' => $destaquesPremium,
            'estatisticas' => $estatisticas,
        ]);
    }

    /**
     * Tela pública de detalhes de um serviço ou item de aluguel: fotos, descrição
     * completa, endereço real e as avaliações já publicadas para o item.
     * Não exige login — o botão de reservar é quem leva ao cadastro.
     */
    public function detalhes(string $tipo, int $id)
    {
        abort_unless(in_array($tipo, ['servico', 'aluguel'], true), 404);

        if ($tipo === 'servico') {
            $servico = Servico::with('estabelecimento:id,nome,rua,numero,bairro,cidade,estado')
                ->where('ativo', true)
                ->findOrFail($id);

            $item = [
                'id' => $servico->id,
                'tipo' => 'servico',
                'nome' => $servico->nome,
                'descricao' => $servico->descricao,
                'valor' => (float) $servico->valor,
                'duracao_minutos' => $servico->duracao_minutos,
                'fotos' => $this->todasFotos($servico->fotos),
                'estabelecimento' => $servico->estabelecimento?->nome,
                'endereco' => $servico->estabelecimento?->endereco_completo,
                'avaliacao_media' => (float) ($servico->avaliacao_media ?? 0),
                'total_avaliacoes' => (int) ($servico->total_avaliacoes ?? 0),
            ];

            // Mesma lógica de consulta usada em AvaliacaoController::indexReact para avaliações públicas de um serviço.
            $avaliacoes = Avaliacao::with('usuario:id,name,foto_perfil')
                ->where('publica', true)
                ->whereNull('justificativa_admin')
                ->whereHas('agendamento', fn ($q) => $q->where('servico_id', $id))
                ->latest()
                ->take(20)
                ->get();
        } else {
            $itemAluguel = ItemAluguel::where('ativo', true)->findOrFail($id);

            $item = [
                'id' => $itemAluguel->id,
                'tipo' => 'aluguel',
                'nome' => $itemAluguel->nome,
                'descricao' => $itemAluguel->descricao,
                'categoria' => $itemAluguel->categoria,
                'valor' => (float) ($itemAluguel->valor ?? $itemAluguel->valor_diaria ?? $itemAluguel->valor_semanal ?? $itemAluguel->valor_mensal ?? 0),
                'periodo' => $itemAluguel->valor
                    ? null
                    : ($itemAluguel->valor_diaria ? 'dia' : ($itemAluguel->valor_semanal ? 'semana' : ($itemAluguel->valor_mensal ? 'mês' : null))),
                'fotos' => [],
                'estabelecimento' => null,
                'endereco' => $itemAluguel->endereco_completo,
                'avaliacao_media' => (float) ($itemAluguel->avaliacao_media ?? 0),
                'total_avaliacoes' => (int) ($itemAluguel->total_avaliacoes ?? 0),
            ];

            // O vínculo avaliação -> item de aluguel específico ainda não existe no banco,
            // então mostramos apenas o resumo (média/total) já calculado no próprio item.
            $avaliacoes = collect();
        }

        $avaliacoes = $avaliacoes->map(fn (Avaliacao $avaliacao) => [
            'id' => $avaliacao->id,
            'nota' => $avaliacao->nota,
            'comentario' => $avaliacao->comentario,
            'criado_em' => $avaliacao->created_at?->format('d/m/Y'),
            'usuario' => $avaliacao->usuario?->name,
            'foto_usuario' => $avaliacao->usuario?->foto_perfil,
            'resposta_anfitriao' => $avaliacao->resposta_anfitriao,
        ]);

        return Inertia::render('Public/VitrineDetalhe', [
            'item' => $item,
            'avaliacoes' => $avaliacoes,
            'canRegister' => Route::has('register'),
        ]);
    }

    private function primeiraFoto(?string $fotosJson): ?string
    {
        $fotos = $this->todasFotos($fotosJson);

        return $fotos[0] ?? null;
    }

    private function todasFotos(?string $fotosJson): array
    {
        if (! $fotosJson) {
            return [];
        }

        return json_decode($fotosJson, true) ?: [];
    }
}

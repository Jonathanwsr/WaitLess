<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Aluguel;
use App\Models\ItemAluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

/**
 * "Locações Avulsas": itens de aluguel (imóveis, veículos, equipamentos...)
 * que o próprio sócio/proprietário cadastra e aluga diretamente, sem precisar
 * ter um Estabelecimento — usa `itens_aluguel.estabelecimento_id` apontando
 * para o próprio `users.id` do dono (é assim que a coluna já funciona hoje).
 */
class LocacaoAvulsaController extends Controller
{
    private function garantirPapelPermitido(): void
    {
        $papel = mb_strtolower((string) Auth::user()->papel);
        if (!in_array($papel, ['socio', 'sócio', 'proprietario', 'proprietário', 'admin'], true)) {
            abort(403, 'Apenas sócios/proprietários podem gerenciar locações avulsas.');
        }
    }

    public function index()
    {
        $this->garantirPapelPermitido();
        $donoId = Auth::id();

        $itens = ItemAluguel::catalogo()
            ->where('estabelecimento_id', $donoId)
            ->orderBy('created_at', 'desc')
            ->get();

        $emUsoAgora = Aluguel::with('item', 'locatario:id,name,telefone')
            ->whereIn('item_aluguel_id', $itens->pluck('id'))
            ->where('status', 'em_andamento')
            ->orderBy('data_inicio', 'asc')
            ->get()
            ->map(fn ($aluguel) => [
                'id'            => $aluguel->id,
                'item_nome'     => $aluguel->item->nome ?? '—',
                'locatario'     => $aluguel->locatario->name ?? '—',
                'data_inicio'   => $aluguel->data_inicio,
                'data_fim'      => $aluguel->data_fim,
            ]);

        return Inertia::render('Estabelecimentos/LocacoesAvulsas', [
            'itens'      => $itens,
            'emUsoAgora' => $emUsoAgora,
            'categorias' => ItemAluguel::CATEGORIAS_LOCACAO_AVULSA,
        ]);
    }

    public function store(Request $request)
    {
        $this->garantirPapelPermitido();

        $validated = $this->validarDados($request);
        $validated['estabelecimento_id'] = Auth::id();
        $validated['fotos'] = $this->processarFotos($request);

        $item = ItemAluguel::create($validated);

        return redirect()->back()->with('success', 'Locação "' . $item->nome . '" criada com sucesso!');
    }

    public function update(Request $request, ItemAluguel $item)
    {
        $this->garantirPapelPermitido();

        if ((int) $item->estabelecimento_id !== Auth::id()) {
            abort(403, 'Você não tem permissão para editar esta locação.');
        }

        $validated = $this->validarDados($request);

        if ($request->hasFile('fotos')) {
            $validated['fotos'] = $this->processarFotos($request);
        }

        $item->update($validated);

        return redirect()->back()->with('success', 'Locação atualizada com sucesso!');
    }

    public function destroy(ItemAluguel $item)
    {
        $this->garantirPapelPermitido();

        if ((int) $item->estabelecimento_id !== Auth::id()) {
            abort(403, 'Você não tem permissão para excluir esta locação.');
        }

        $item->delete();

        return redirect()->back()->with('success', 'Locação removida.');
    }

    private function validarDados(Request $request): array
    {
        return $request->validate([
            'nome'                     => 'required|string|max:255',
            'categoria'                => 'required|string|max:100',
            'descricao'                => 'nullable|string',
            'valor_diaria'             => 'required|numeric|min:0',
            'quantidade'               => 'nullable|integer|min:1',
            'somente_premium'          => 'nullable|boolean',
            'tem_promocao'             => 'nullable|boolean',
            'tipo_desconto'            => 'nullable|string|in:percentual,fixo',
            'valor_desconto'           => 'nullable|numeric|min:0',
            'aceita_pontos'            => 'nullable|boolean',
            'maximo_pontos_permitidos' => 'nullable|integer|min:0',
            'ativo'                    => 'nullable|boolean',
        ]);
    }

    private function processarFotos(Request $request): array
    {
        if (!$request->hasFile('fotos')) {
            return [];
        }

        $fotos = $request->file('fotos');
        if (count($fotos) > 6) {
            abort(400, 'Você só pode enviar no máximo 6 fotos por locação.');
        }

        $caminhos = [];
        foreach ($fotos as $foto) {
            if ($this->imagemContemConteudoInadequado($foto)) {
                abort(400, 'Uma das imagens enviadas violou nossos termos de uso (conteúdo inadequado detectado).');
            }
            $caminhos[] = $this->uploadParaImageKit($foto);
        }

        return $caminhos;
    }

    private function imagemContemConteudoInadequado($foto): bool
    {
        try {
            $hiveKey = env('HIVE_API_KEY');
            if (!$hiveKey) return false;

            $response = Http::withHeaders([
                'authorization' => 'token ' . $hiveKey,
                'accept'        => 'application/json',
            ])->attach('media', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName())
              ->post('https://api.thehive.ai/api/v2/task/sync', ['classes' => 'nsfw']);

            if ($response->successful()) {
                $classes = $response->json()['status'][0]['response']['output'][0]['classes'] ?? [];
                foreach ($classes as $class) {
                    if (in_array($class['class'], ['yes_nsfw', 'pornography']) && $class['score'] > 0.70) {
                        return true;
                    }
                }
            }
        } catch (\Exception $e) {
            Log::error('Hive AI error (locação avulsa): ' . $e->getMessage());
        }
        return false;
    }

    private function uploadParaImageKit($foto): string
    {
        $privateKey = env('IMAGEKIT_PRIVATE_KEY');
        if (!$privateKey) throw new \Exception('Chave ImageKit ausente.');

        $response = Http::withBasicAuth($privateKey, '')
            ->attach('file', file_get_contents($foto->getRealPath()), $foto->getClientOriginalName())
            ->post('https://upload.imagekit.io/api/v1/files/upload', [
                'fileName' => uniqid() . '_' . preg_replace('/[^A-Za-z0-9\-\.]/', '', $foto->getClientOriginalName()),
                'folder'   => '/locacoes_avulsas',
            ]);

        if ($response->successful()) {
            return $response->json('url');
        }

        throw new \Exception('Falha no upload para o ImageKit.');
    }
}

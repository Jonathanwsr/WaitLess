<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Roteiro;
use App\Models\RoteiroItem;
use App\Services\Viagem\GuiaLocalService;
use App\Services\Viagem\LocacoesProximasService;
use App\Services\Viagem\RoteiroReservaService;
use App\Services\Viagem\RoteiroViagemService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Guia do Local e Roteiros de Viagem (dentro de Planejamento de Viagem).
 * Os mesmos métodos JSON atendem o site (sessão) e o app (Sanctum). A localização do usuário só é usada
 * na consulta — nunca é gravada.
 */
class RoteiroController extends Controller
{
    public function __construct(
        private GuiaLocalService $guia,
        private LocacoesProximasService $proximas,
        private RoteiroViagemService $roteiros,
    ) {}

    /** Rotas JSON (mesmas no site e no app): registradas em routes/web.php e routes/api.php. */
    public static function rotas(): void
    {
        $c = self::class;
        \Illuminate\Support\Facades\Route::get('/guia-local', [$c, 'guia'])->middleware('throttle:30,1')->name('guia');
        \Illuminate\Support\Facades\Route::post('/roteiros/gerar', [$c, 'gerar'])->middleware('throttle:20,1')->name('roteiros.gerar');
        \Illuminate\Support\Facades\Route::get('/roteiros/hoje', [$c, 'hoje'])->name('roteiros.hoje');
        \Illuminate\Support\Facades\Route::get('/roteiros', [$c, 'index'])->name('roteiros.index');
        \Illuminate\Support\Facades\Route::post('/roteiros', [$c, 'store'])->middleware('throttle:30,1')->name('roteiros.store');
        \Illuminate\Support\Facades\Route::get('/roteiros/{roteiro}', [$c, 'show'])->whereNumber('roteiro')->name('roteiros.show');
        \Illuminate\Support\Facades\Route::put('/roteiros/{roteiro}', [$c, 'update'])->whereNumber('roteiro')->name('roteiros.update');
        \Illuminate\Support\Facades\Route::delete('/roteiros/{roteiro}', [$c, 'destroy'])->whereNumber('roteiro')->name('roteiros.destroy');
        \Illuminate\Support\Facades\Route::post('/roteiros/{roteiro}/duplicar', [$c, 'duplicar'])->whereNumber('roteiro')->name('roteiros.duplicar');
        \Illuminate\Support\Facades\Route::post('/roteiros/{roteiro}/compartilhar', [$c, 'compartilhar'])->whereNumber('roteiro')->name('roteiros.compartilhar');
        \Illuminate\Support\Facades\Route::delete('/roteiros/{roteiro}/compartilhar', [$c, 'pararCompartilhar'])->whereNumber('roteiro')->name('roteiros.descompartilhar');
        \Illuminate\Support\Facades\Route::post('/roteiros/{roteiro}/reservar', [$c, 'reservar'])->whereNumber('roteiro')->middleware('throttle:10,1')->name('roteiros.reservar');
        \Illuminate\Support\Facades\Route::get('/roteiros/{roteiro}/pdf', [$c, 'pdf'])->whereNumber('roteiro')->name('roteiros.pdf');
    }

    // ------------------------------------------------------------------ Guia do Local

    public function guia(Request $request)
    {
        $dados = $request->validate([
            'termo' => 'nullable|string|min:2|max:120|required_without_all:lat,lng',
            'lat' => 'nullable|numeric|between:-90,90|required_with:lng',
            'lng' => 'nullable|numeric|between:-180,180|required_with:lat',
            'raio_km' => 'nullable|numeric|min:1|max:50',
        ], [
            'termo.required_without_all' => 'Digite uma cidade ou ponto turístico, ou use "Perto de mim".',
        ]);
        $raio = (float) ($dados['raio_km'] ?? LocacoesProximasService::RAIO_PADRAO_KM);
        $termo = isset($dados['termo']) ? strip_tags(trim($dados['termo'])) : null;

        $local = null;
        $ponto = null;
        if ($termo) {
            $local = $this->guia->porTermo($termo);
            $ponto = $local['coordenadas'] ?? null;
            if (!$ponto && ($geo = app(\App\Services\GeocodificacaoService::class)->coordenadas($termo))) {
                $ponto = ['lat' => $geo[0], 'lng' => $geo[1]];
            }
        } else {
            $ponto = ['lat' => (float) $dados['lat'], 'lng' => (float) $dados['lng']];
            $local = $this->guia->porCoordenadas($ponto['lat'], $ponto['lng']);
        }

        if (!$ponto) {
            return response()->json([
                'local' => null, 'pontos_turisticos' => [], 'locacoes_proximas' => (object) [],
                'mensagem' => 'Não encontramos esse lugar. Confira o nome ou tente um termo mais conhecido (ex.: nome da cidade).',
            ], 404);
        }

        $pontos = collect($this->guia->pontosProximos($ponto['lat'], $ponto['lng'], (int) min(10000, $raio * 1000), 20))
            ->reject(fn ($p) => $local && Str::lower($p['titulo']) === Str::lower($local['titulo']))
            ->values()->all();

        return response()->json([
            'local' => $local ? array_merge($local, ['coordenadas' => $local['coordenadas'] ?? $ponto]) : null,
            'centro' => $ponto,
            'pontos_turisticos' => $pontos,
            'locacoes_proximas' => (object) $this->proximas->agrupadas($ponto['lat'], $ponto['lng'], $raio),
            'raio_km' => $raio,
            'mensagem' => $local ? null : 'As informações turísticas não estão disponíveis agora. Mostramos as locações do Lokyva por perto.',
        ]);
    }

    // ------------------------------------------------------------------ Roteiros (JSON)

    public function gerar(Request $request)
    {
        $dados = $request->validate([
            'destino' => 'nullable|string|min:2|max:120|required_without_all:latitude,longitude',
            'latitude' => 'nullable|numeric|between:-90,90|required_with:longitude',
            'longitude' => 'nullable|numeric|between:-180,180|required_with:latitude',
            'data_inicio' => 'required|date|after_or_equal:today',
            'data_fim' => 'nullable|date|after_or_equal:data_inicio',
            'dias' => 'nullable|integer|min:1|max:' . RoteiroViagemService::MAX_DIAS,
            'pessoas' => 'nullable|integer|min:1|max:50',
            'orcamento' => 'nullable|numeric|min:0|max:10000000',
            'interesses' => 'nullable|array|max:8',
            'interesses.*' => ['string', Rule::in(RoteiroViagemService::INTERESSES)],
            'partida' => 'nullable|in:centro,hospedagem,localizacao',
            'partida_latitude' => 'nullable|numeric|between:-90,90|required_if:partida,localizacao',
            'partida_longitude' => 'nullable|numeric|between:-180,180|required_if:partida,localizacao',
            'precisa_hospedagem' => 'nullable|boolean',
            'precisa_veiculo' => 'nullable|boolean',
            'raio_km' => 'nullable|numeric|min:1|max:50',
            'titulo' => 'nullable|string|max:200',
        ], [
            'destino.required_without_all' => 'Informe o destino ou use a sua localização.',
            'data_inicio.after_or_equal' => 'A data de ida não pode estar no passado.',
            'partida_latitude.required_if' => 'Permita a localização para começar o roteiro de onde você está.',
        ]);
        if (isset($dados['destino'])) {
            $dados['destino'] = strip_tags($dados['destino']);
        }

        return response()->json($this->roteiros->gerar($dados));
    }

    public function index(Request $request)
    {
        return response()->json(['roteiros' => $this->resumos($request)]);
    }

    public function store(Request $request)
    {
        $roteiro = $this->roteiros->salvar($request->user(), $this->validarRoteiro($request));

        return response()->json(['mensagem' => 'Roteiro salvo.', 'id' => $roteiro->id] + $this->roteiros->paraTela($roteiro), 201);
    }

    public function show(Request $request, Roteiro $roteiro)
    {
        $this->autorizar($request, $roteiro);

        return response()->json($this->roteiros->paraTela($roteiro));
    }

    public function update(Request $request, Roteiro $roteiro)
    {
        $this->autorizar($request, $roteiro);
        $roteiro = $this->roteiros->salvar($request->user(), $this->validarRoteiro($request), $roteiro);

        return response()->json(['mensagem' => 'Roteiro atualizado.'] + $this->roteiros->paraTela($roteiro));
    }

    public function destroy(Request $request, Roteiro $roteiro)
    {
        $this->autorizar($request, $roteiro);
        $roteiro->delete();

        return response()->json(['mensagem' => 'Roteiro excluído.']);
    }

    public function duplicar(Request $request, Roteiro $roteiro)
    {
        $this->autorizar($request, $roteiro);
        $novo = $this->roteiros->duplicar($roteiro);

        return response()->json(['mensagem' => 'Roteiro duplicado.', 'id' => $novo->id], 201);
    }

    public function compartilhar(Request $request, Roteiro $roteiro)
    {
        $this->autorizar($request, $roteiro);
        if (!$roteiro->token_compartilhamento) {
            $roteiro->update(['token_compartilhamento' => Str::random(40)]);
        }

        return response()->json(['link' => url('/roteiro/' . $roteiro->token_compartilhamento), 'mensagem' => 'Link criado. Quem abrir vê o roteiro, mas não consegue editar.']);
    }

    public function pararCompartilhar(Request $request, Roteiro $roteiro)
    {
        $this->autorizar($request, $roteiro);
        $roteiro->update(['token_compartilhamento' => null]);

        return response()->json(['mensagem' => 'O link antigo deixou de funcionar.']);
    }

    public function reservar(Request $request, Roteiro $roteiro, RoteiroReservaService $reservas)
    {
        $this->autorizar($request, $roteiro);
        $pedido = $reservas->reservar($roteiro, $request->user());
        $faltaram = count($pedido->nao_reservados ?? []);

        return response()->json([
            'mensagem' => $faltaram
                ? 'Pedido criado com ' . count($pedido->reservas) . ' reserva(s). ' . $faltaram . ' item(ns) não puderam ser reservados — veja o motivo abaixo.'
                : 'Pedido criado! Todas as locações do roteiro foram reservadas.',
            'pedido' => $pedido,
        ], 201);
    }

    public function pdf(Request $request, Roteiro $roteiro)
    {
        $this->autorizar($request, $roteiro);

        return $this->gerarPdf($roteiro);
    }

    public function hoje(Request $request)
    {
        return response()->json(['hoje' => $this->roteiros->hoje($request->user())]);
    }

    /** Link compartilhado: somente leitura, sem login. */
    public function compartilhado(string $token)
    {
        $roteiro = $this->porToken($token);

        return response()->json($this->roteiros->paraTela($roteiro, false));
    }

    public function compartilhadoPdf(string $token)
    {
        return $this->gerarPdf($this->porToken($token), false);
    }

    // ------------------------------------------------------------------ páginas do site

    public function paginaGuia(Request $request)
    {
        return Inertia::render('Cliente/Viagens/Guia', ['termoInicial' => (string) $request->query('termo', '')]);
    }

    public function paginaRoteiros(Request $request)
    {
        return Inertia::render('Cliente/Viagens/Roteiros', [
            'roteiros' => $this->resumos($request),
            'hoje' => $this->roteiros->hoje($request->user()),
        ]);
    }

    public function paginaNovo(Request $request)
    {
        return Inertia::render('Cliente/Viagens/RoteiroEditor', [
            'inicial' => null,
            'destinoInicial' => (string) $request->query('destino', ''),
            'interesses' => RoteiroViagemService::INTERESSES,
        ]);
    }

    public function paginaEditar(Request $request, Roteiro $roteiro)
    {
        $this->autorizar($request, $roteiro);

        return Inertia::render('Cliente/Viagens/RoteiroEditor', [
            'inicial' => $this->roteiros->paraTela($roteiro),
            'destinoInicial' => '',
            'interesses' => RoteiroViagemService::INTERESSES,
        ]);
    }

    public function paginaCompartilhado(string $token)
    {
        return Inertia::render('Cliente/Viagens/RoteiroCompartilhado', [
            'dados' => $this->roteiros->paraTela($this->porToken($token), false),
            'token' => $token,
        ]);
    }

    // ------------------------------------------------------------------ apoio

    private function autorizar(Request $request, Roteiro $roteiro): void
    {
        abort_unless((int) $roteiro->user_id === (int) $request->user()?->id, 403, 'Só quem criou o roteiro pode ver e editar. Peça o link de compartilhamento.');
    }

    private function porToken(string $token): Roteiro
    {
        abort_unless(preg_match('/^[A-Za-z0-9]{40}$/', $token), 404, 'Roteiro não encontrado.');

        return Roteiro::where('token_compartilhamento', $token)->firstOr(fn () => abort(404, 'Este link de roteiro não existe mais.'));
    }

    private function resumos(Request $request): array
    {
        return Roteiro::where('user_id', $request->user()->id)
            ->withCount(['itens', 'itens as locacoes_count' => fn ($q) => $q->where('tipo', 'locacao')])
            ->orderByDesc('data_inicio')
            ->get()
            ->map(fn (Roteiro $r) => [
                'id' => $r->id,
                'titulo' => $r->titulo,
                'destino' => $r->destino,
                'estado' => $r->estado,
                'data_inicio' => $r->data_inicio->toDateString(),
                'data_fim' => $r->data_fim->toDateString(),
                'dias' => (int) $r->data_inicio->diffInDays($r->data_fim) + 1,
                'pessoas' => (int) $r->pessoas,
                'itens' => (int) $r->itens_count,
                'locacoes' => (int) $r->locacoes_count,
                'compartilhado' => (bool) $r->token_compartilhamento,
                'capa' => $r->itens()->whereNotNull('imagem')->value('imagem'),
            ])->all();
    }

    private function gerarPdf(Roteiro $roteiro, bool $doDono = true)
    {
        $dados = $this->roteiros->paraTela($roteiro, $doDono);
        $nome = 'roteiro-' . Str::slug($roteiro->destino ?: 'viagem') . '.pdf';

        return Pdf::loadView('pdfs.roteiro', ['dados' => $dados, 'periodos' => RoteiroViagemService::PERIODOS])
            ->setPaper('a4')
            ->download($nome);
    }

    private function validarRoteiro(Request $request): array
    {
        return $request->validate([
            'titulo' => 'nullable|string|max:200',
            'destino' => 'required|string|max:150',
            'estado' => 'nullable|string|max:60',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'data_inicio' => 'required|date',
            'data_fim' => 'required|date|after_or_equal:data_inicio',
            'pessoas' => 'required|integer|min:1|max:50',
            'orcamento' => 'nullable|numeric|min:0|max:10000000',
            'interesses' => 'nullable|array|max:8',
            'interesses.*' => ['string', Rule::in(RoteiroViagemService::INTERESSES)],
            'partida' => 'nullable|in:centro,hospedagem,localizacao',
            'dias' => 'required|array|min:1|max:' . RoteiroViagemService::MAX_DIAS,
            'dias.*.itens' => 'nullable|array|max:40',
            'dias.*.itens.*.tipo' => ['required', Rule::in(RoteiroItem::TIPOS)],
            'dias.*.itens.*.periodo' => ['required', Rule::in(RoteiroItem::PERIODOS)],
            'dias.*.itens.*.titulo' => 'nullable|string|max:250',
            'dias.*.itens.*.descricao' => 'nullable|string|max:2000',
            'dias.*.itens.*.hora' => ['nullable', 'regex:/^\d{2}:\d{2}$/'],
            'dias.*.itens.*.latitude' => 'nullable|numeric|between:-90,90',
            'dias.*.itens.*.longitude' => 'nullable|numeric|between:-180,180',
            'dias.*.itens.*.link' => 'nullable|string|max:500',
            'dias.*.itens.*.imagem' => 'nullable|string|max:500',
            'dias.*.itens.*.servico_id' => 'nullable|integer|exists:servicos,id',
            'dias.*.itens.*.item_aluguel_id' => 'nullable|integer|exists:itens_aluguel,id',
            'dias.*.itens.*.custo_estimado' => 'nullable|numeric|min:0|max:1000000',
            'dias.*.itens.*.anotacao' => 'nullable|string|max:2000',
        ], [
            'dias.*.itens.*.hora.regex' => 'Use o horário no formato HH:MM.',
        ]);
    }
}

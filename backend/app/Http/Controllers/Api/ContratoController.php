<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ContratoParaClienteMail;
use App\Models\ContratoTemplate;
use App\Models\Contrato;
use App\Models\Estabelecimento;
use App\Models\Aluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Shared\Html as PhpWordHtml;
use PhpOffice\PhpWord\IOFactory;

/**
 * Contratos: o lojista cria/edita um modelo de texto, gera o documento pra
 * uma reserva específica (preenchendo as variáveis {{TAG}}) e baixa em PDF
 * ou Word pra mandar pro cliente dele. Sem assinatura eletrônica — isso não
 * usa mais nenhum serviço externo (a integração com a Assinafy foi removida).
 */
class ContratoController extends Controller
{
    public function autorizarEstabelecimento(Estabelecimento $estabelecimento): void
    {
        $user = Auth::user();

        if (mb_strtolower((string) $user->papel) === 'admin') {
            return;
        }

        // `estabelecimentos` não tem coluna `user_id` — o vínculo de quem
        // administra qual Estabelecimento vive na pivot `estabelecimento_usuario`.
        $vinculado = \Illuminate\Support\Facades\DB::table('estabelecimento_usuario')
            ->where('usuario_id', $user->id)
            ->where('estabelecimento_id', $estabelecimento->id)
            ->exists();

        if (!$vinculado) {
            abort(403, 'Acesso não autorizado.');
        }
    }

    /**
     * `alugueis.estabelecimento_id` é o `users.id` direto do dono (não um
     * Estabelecimento de verdade), então a autorização aqui é comparar contra
     * o usuário logado diretamente, e não contra um vínculo de Estabelecimento.
     */
    private function autorizarAluguel(Aluguel $aluguel): void
    {
        $user = Auth::user();
        if ((int) $aluguel->estabelecimento_id !== (int) $user->id && $user->papel !== 'admin') {
            abort(403, 'Acesso não autorizado a esta reserva.');
        }
    }

    /**
     * Contratos é um recurso Premium. Vale o plano de quem está logado ou de
     * qualquer sócio/proprietário vinculado (assim gerente e sócios do mesmo
     * local também usam). O admin da plataforma sempre tem acesso.
     *
     * @param iterable<int> $donosIds ids de `users` que respondem pelo local/locação
     */
    public function temPremium(iterable $donosIds = []): bool
    {
        $user = Auth::user();

        if (mb_strtolower((string) $user->papel) === 'admin' || $user->isPremium()) {
            return true;
        }

        return \App\Models\User::whereIn('id', collect($donosIds)->all())
            ->whereIn('papel', ['socio', 'sócio', 'proprietario', 'proprietário'])
            ->get()
            ->contains(fn ($u) => $u->isPremium());
    }

    public function donosDoEstabelecimento($estabelecimentoId)
    {
        return \Illuminate\Support\Facades\DB::table('estabelecimento_usuario')
            ->where('estabelecimento_id', $estabelecimentoId)
            ->pluck('usuario_id');
    }

    /** Devolve null quando liberado; senão a resposta 403 (JSON para API, página de erro para web). */
    private function exigirPremium(iterable $donosIds = [])
    {
        if ($this->temPremium($donosIds)) {
            return null;
        }

        $mensagem = 'Contratos é um recurso Premium. Assine um plano Premium para liberar.';

        if (request()->wantsJson() && !request()->header('X-Inertia')) {
            return response()->json(['error' => $mensagem, 'premium_necessario' => true], 403);
        }

        throw new \App\Exceptions\PremiumRequiredException($mensagem);
    }

    public function index($estabelecimento_id)
    {
        $estabelecimento = Estabelecimento::findOrFail($estabelecimento_id);
        $this->autorizarEstabelecimento($estabelecimento);

        if (!$this->temPremium($this->donosDoEstabelecimento($estabelecimento_id))) {
            return Inertia::render('Estabelecimentos/Contratos', [
                'estabelecimento' => $estabelecimento,
                'premiumNecessario' => true,
            ]);
        }

        $templates = ContratoTemplate::where('estabelecimento_id', $estabelecimento_id)->latest()->get();

        // `alugueis.estabelecimento_id` guarda o users.id direto do dono, não
        // o id do Estabelecimento — passa pela pivot pra achar quem administra
        // este Estabelecimento antes de filtrar as reservas/contratos dele.
        $donosDoEstabelecimento = $this->donosDoEstabelecimento($estabelecimento_id);

        $contratosGerados = Contrato::whereHas('aluguel', function ($q) use ($donosDoEstabelecimento) {
            $q->whereIn('estabelecimento_id', $donosDoEstabelecimento);
        })->with(['aluguel.locatario', 'aluguel.item'])->latest()->paginate(15);

        $reservasPendentes = Aluguel::whereIn('estabelecimento_id', $donosDoEstabelecimento)
            ->whereNull('contrato_id')
            ->with(['item:id,nome', 'locatario:id,name,email,cpf_cnpj'])
            ->latest()
            ->take(50)
            ->get(['id', 'codigo_reserva', 'item_aluguel_id', 'locatario_id', 'data_inicio', 'data_fim', 'valor_total']);

        return Inertia::render('Estabelecimentos/Contratos', [
            'estabelecimento' => $estabelecimento,
            'templates' => $templates,
            'contratosGerados' => $contratosGerados,
            'reservasPendentes' => $reservasPendentes,
        ]);
    }

    public function storeTemplate(Request $request, $estabelecimento_id)
    {
        $estabelecimento = Estabelecimento::findOrFail($estabelecimento_id);
        $this->autorizarEstabelecimento($estabelecimento);
        if ($bloqueio = $this->exigirPremium($this->donosDoEstabelecimento($estabelecimento_id))) {
            return $bloqueio;
        }

        $validated = $request->validate([
            'titulo' => 'required|string|max:255',
            'conteudo' => 'required|string',
            'tipo_reserva' => 'required|string',
            'padrao' => 'boolean',
        ]);

        if ($request->padrao) {
            ContratoTemplate::where('estabelecimento_id', $estabelecimento_id)->update(['padrao' => false]);
        }

        $validated['estabelecimento_id'] = $estabelecimento_id;
        ContratoTemplate::create($validated);

        return redirect()->back()->with('success', 'Modelo de contrato salvo com sucesso!');
    }

    public function updateTemplate(Request $request, $id)
    {
        $template = ContratoTemplate::findOrFail($id);
        $estabelecimento = Estabelecimento::find($template->estabelecimento_id);

        if ($estabelecimento) {
            $this->autorizarEstabelecimento($estabelecimento);
        }
        if ($bloqueio = $this->exigirPremium($this->donosDoEstabelecimento($template->estabelecimento_id))) {
            return $bloqueio;
        }

        $validated = $request->validate([
            'titulo' => 'required|string|max:255',
            'conteudo' => 'required|string',
            'tipo_reserva' => 'required|string',
            'padrao' => 'boolean',
        ]);

        if ($request->padrao) {
            ContratoTemplate::where('estabelecimento_id', $template->estabelecimento_id)->update(['padrao' => false]);
        }

        $template->update($validated);

        return redirect()->back()->with('success', 'Modelo atualizado com sucesso!');
    }

    public function destroyTemplate($id)
    {
        $template = ContratoTemplate::findOrFail($id);
        $estabelecimento = Estabelecimento::find($template->estabelecimento_id);

        if ($estabelecimento) {
            $this->autorizarEstabelecimento($estabelecimento);
        }

        $template->delete();

        return redirect()->back()->with('success', 'Modelo removido.');
    }

    private function montarTextoContrato(Aluguel $aluguel, ?string $conteudoCustomizado): string
    {
        if (!empty($conteudoCustomizado)) {
            $textoHtml = $conteudoCustomizado;
        } else {
            // `alugueis.estabelecimento_id` é o users.id direto do dono, mas
            // `contrato_templates.estabelecimento_id` é um Estabelecimento de
            // verdade — precisa passar pela pivot pra achar o(s) Estabelecimento(s)
            // que esse dono administra antes de procurar o modelo.
            $estabelecimentosDoDono = \Illuminate\Support\Facades\DB::table('estabelecimento_usuario')
                ->where('usuario_id', $aluguel->estabelecimento_id)
                ->pluck('estabelecimento_id');

            $template = ContratoTemplate::whereIn('estabelecimento_id', $estabelecimentosDoDono)
                ->where('tipo_reserva', $aluguel->item->categoria)
                ->first();

            if (!$template) {
                $template = ContratoTemplate::whereIn('estabelecimento_id', $estabelecimentosDoDono)
                    ->where('padrao', true)
                    ->first();
            }

            if (!$template) {
                abort(400, 'Nenhum modelo de contrato configurado. Crie um modelo ou digite o texto manualmente.');
            }

            $textoHtml = $template->conteudo;
        }

        $tags = [
            '{{LOCADOR_NOME}}' => $aluguel->proprietario->name ?? 'Estabelecimento',
            '{{LOCADOR_DOCUMENTO}}' => $aluguel->proprietario->cpf_cnpj ?? '00.000.000/0001-00',
            '{{LOCATARIO_NOME}}' => $aluguel->locatario->name,
            '{{LOCATARIO_DOCUMENTO}}' => $aluguel->locatario->cpf_cnpj ?? '___.___.___-__',
            '{{LOCATARIO_EMAIL}}' => $aluguel->locatario->email,
            '{{ITEM_NOME}}' => $aluguel->item->nome,
            '{{VALOR_TOTAL}}' => number_format($aluguel->valor_total, 2, ',', '.'),
            '{{DATA_INICIO}}' => \Carbon\Carbon::parse($aluguel->data_inicio)->format('d/m/Y'),
            '{{DATA_FIM}}' => \Carbon\Carbon::parse($aluguel->data_fim)->format('d/m/Y'),
        ];

        return str_replace(array_keys($tags), array_values($tags), $textoHtml);
    }

    /**
     * Gera o contrato pra uma reserva específica em PDF e Word. Não envolve
     * nenhuma assinatura eletrônica nem serviço externo — o dono baixa os
     * arquivos e decide como mandar pro cliente dele (ou usa o botão de
     * enviar por e-mail abaixo).
     */
    public function gerarContrato(Request $request, $aluguelId)
    {
        $validated = $request->validate([
            'conteudo_customizado' => 'nullable|string',
            'titulo' => 'nullable|string|max:255',
        ]);

        $aluguel = Aluguel::with(['item', 'locatario', 'proprietario'])->findOrFail($aluguelId);
        $this->autorizarAluguel($aluguel);
        if ($bloqueio = $this->exigirPremium([$aluguel->estabelecimento_id])) {
            return $bloqueio;
        }

        $textoHtml = $this->montarTextoContrato($aluguel, $validated['conteudo_customizado'] ?? null);
        $titulo = ($validated['titulo'] ?? null) ?: ('Contrato ' . $aluguel->codigo_reserva);

        $htmlCompleto = "
        <html>
        <head><style>body { font-family: 'Helvetica', Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; }</style></head>
        <body>
            {$textoHtml}
            <div style='margin-top: 50px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px;'>
                Contrato gerado via Lokyva <br>
                Localizador: {$aluguel->codigo_reserva}
            </div>
        </body>
        </html>";

        // PDF
        $pdf = Pdf::loadHTML($htmlCompleto);
        $pdfPath = 'contratos/' . $aluguel->codigo_reserva . '_' . uniqid() . '.pdf';
        Storage::disk('public')->put($pdfPath, $pdf->output());

        // Word (.docx) — conversão do mesmo HTML. O parser do PhpWord exige
        // XML bem-formado (ex: <br/> fechado), mas o texto do contrato é HTML
        // "solto" digitado pelo lojista — normaliza via DOMDocument (que lê
        // HTML de verdade, tolerante a tags meio-abertas) antes de converter.
        $dom = new \DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadHTML('<?xml encoding="utf-8" ?>' . $htmlCompleto, LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        $htmlNormalizado = $dom->saveXML($dom->documentElement) ?: $htmlCompleto;

        $phpWord = new PhpWord();
        $section = $phpWord->addSection();
        PhpWordHtml::addHtml($section, $htmlNormalizado, false, false);
        $docxPath = 'contratos/' . $aluguel->codigo_reserva . '_' . uniqid() . '.docx';
        $docxAbsolutePath = Storage::disk('public')->path($docxPath);
        IOFactory::createWriter($phpWord, 'Word2007')->save($docxAbsolutePath);

        $contrato = Contrato::create([
            'aluguel_id' => $aluguel->id,
            'numero_contrato' => 'CTR-' . strtoupper(Str::random(8)),
            'titulo' => $titulo,
            'arquivo_pdf' => $pdfPath,
            'arquivo_docx' => $docxPath,
            'hash_documento' => Str::random(15),
            'plataforma_assinatura' => 'Nenhuma (documento simples)',
            'assinado' => false,
        ]);

        $aluguel->update(['contrato_id' => $contrato->id]);

        return response()->json([
            'success' => true,
            'message' => 'Contrato gerado com sucesso!',
            'contrato' => $contrato,
            'pdf_url' => Storage::disk('public')->url($pdfPath),
            'docx_url' => Storage::disk('public')->url($docxPath),
        ]);
    }

    /**
     * Manda o PDF + Word do contrato já gerado direto pro e-mail do cliente.
     */
    public function enviarPorEmail($id)
    {
        $contrato = Contrato::with('aluguel.locatario', 'aluguel.item')->findOrFail($id);
        $this->autorizarAluguel($contrato->aluguel);
        if ($bloqueio = $this->exigirPremium([$contrato->aluguel->estabelecimento_id])) {
            return $bloqueio;
        }

        if (!$contrato->aluguel->locatario?->email) {
            return response()->json(['error' => 'O cliente não tem e-mail cadastrado.'], 400);
        }

        // Na fila: enviar o contrato (com PDF anexado) não pode travar a resposta da API.
        Mail::to($contrato->aluguel->locatario->email)->queue(new ContratoParaClienteMail($contrato));

        $contrato->update(['enviado_em' => now()]);

        return response()->json(['success' => true, 'message' => 'Contrato enviado pro e-mail do cliente!']);
    }

    public function destroyContrato($id)
    {
        $contrato = Contrato::with('aluguel')->findOrFail($id);
        $this->autorizarAluguel($contrato->aluguel);

        if ($contrato->arquivo_pdf) {
            Storage::disk('public')->delete($contrato->arquivo_pdf);
        }
        if ($contrato->arquivo_docx) {
            Storage::disk('public')->delete($contrato->arquivo_docx);
        }

        if ($contrato->aluguel && $contrato->aluguel->contrato_id === $contrato->id) {
            $contrato->aluguel->update(['contrato_id' => null]);
        }

        $contrato->delete();

        return redirect()->back()->with('success', 'Contrato removido.');
    }
}

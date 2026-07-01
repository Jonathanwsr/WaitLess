<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContratoTemplate;
use App\Models\Contrato;
use App\Models\Estabelecimento;
use App\Models\Aluguel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ContratoController extends Controller
{
    public function index($estabelecimento_id)
    {
        $estabelecimento = Estabelecimento::findOrFail($estabelecimento_id);
        $user = Auth::user();
        
        if ($estabelecimento->user_id !== $user->id && !in_array($user->papel, ['admin', 'proprietario'])) {
            abort(403, 'Acesso não autorizado.');
        }

        $templates = ContratoTemplate::where('estabelecimento_id', $estabelecimento_id)->latest()->get();
        
        $contratosGerados = Contrato::whereHas('aluguel', function($q) use ($estabelecimento_id) {
            $q->where('estabelecimento_id', $estabelecimento_id);
        })->with(['aluguel.locatario', 'aluguel.item'])->latest()->paginate(15);

        return Inertia::render('Estabelecimentos/Contratos', [
            'estabelecimento' => $estabelecimento,
            'templates' => $templates,
            'contratosGerados' => $contratosGerados,
        ]);
    }

    public function storeTemplate(Request $request, $estabelecimento_id)
    {
        $estabelecimento = Estabelecimento::findOrFail($estabelecimento_id);
        $user = Auth::user();
        
        if ($estabelecimento->user_id !== $user->id && !in_array($user->papel, ['admin', 'proprietario'])) {
            abort(403, 'Acesso não autorizado.');
        }

        $validated = $request->validate([
            'titulo' => 'required|string|max:255',
            'conteudo' => 'required|string',
            'tipo_reserva' => 'required|string',
            'padrao' => 'boolean'
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
        $user = Auth::user();
        $estabelecimento = Estabelecimento::find($template->estabelecimento_id);
        
        if ($estabelecimento && $estabelecimento->user_id !== $user->id && !in_array($user->papel, ['admin', 'proprietario'])) {
            abort(403, 'Acesso não autorizado.');
        }
        
        $validated = $request->validate([
            'titulo' => 'required|string|max:255',
            'conteudo' => 'required|string',
            'tipo_reserva' => 'required|string',
            'padrao' => 'boolean'
        ]);

        if ($request->padrao) {
            ContratoTemplate::where('estabelecimento_id', $template->estabelecimento_id)->update(['padrao' => false]);
        }

        $template->update($validated);

        return redirect()->back()->with('success', 'Modelo atualizado com sucesso!');
    }

    /**
     * 👉 INTEGRAÇÃO REAL ASSINAFY: Gerar e Enviar
     */
    public function gerarEEnviarAssinafy($aluguelId)
    {
        $aluguel = Aluguel::with(['item', 'locatario', 'proprietario'])->findOrFail($aluguelId);
        
        $template = ContratoTemplate::where('estabelecimento_id', $aluguel->estabelecimento_id)
                                    ->where('tipo_reserva', $aluguel->item->categoria)
                                    ->first();
                                    
        if (!$template) {
            $template = ContratoTemplate::where('estabelecimento_id', $aluguel->estabelecimento_id)->where('padrao', true)->first();
        }

        if (!$template) {
            return response()->json(['error' => 'Nenhum modelo de contrato configurado.'], 400);
        }

        $textoHtml = $template->conteudo;
        $tags = [
            '{{LOCADOR_NOME}}' => $aluguel->proprietario->name ?? 'Estabelecimento',
            '{{LOCADOR_DOCUMENTO}}' => $aluguel->proprietario->cpf_cnpj ?? '00.000.000/0001-00',
            '{{LOCATARIO_NOME}}' => $aluguel->locatario->name,
            '{{LOCATARIO_DOCUMENTO}}' => $aluguel->locatario->cpf ?? '___.___.___-__',
            '{{LOCATARIO_EMAIL}}' => $aluguel->locatario->email,
            '{{ITEM_NOME}}' => $aluguel->item->nome,
            '{{VALOR_TOTAL}}' => number_format($aluguel->valor_total, 2, ',', '.'),
            '{{DATA_INICIO}}' => \Carbon\Carbon::parse($aluguel->data_inicio)->format('d/m/Y'),
            '{{DATA_FIM}}' => \Carbon\Carbon::parse($aluguel->data_fim)->format('d/m/Y'),
        ];

        foreach ($tags as $tag => $valor) {
            $textoHtml = str_replace($tag, $valor, $textoHtml);
        }

        $htmlCompleto = "
        <html>
        <head><style>body { font-family: 'Helvetica', Arial, sans-serif; color: #333; line-height: 1.6; padding: 40px; }</style></head>
        <body>
            {$textoHtml}
            <div style='margin-top: 50px; font-size: 10px; text-align: center; color: #999; border-top: 1px solid #eee; padding-top: 20px;'>
                Contrato digital via Waitless <br>
                Localizador Jurídico: {$aluguel->codigo_reserva}
            </div>
        </body>
        </html>";

        // 1. Gera PDF e converte para Base64 (padrão de envio Assinafy)
        $pdf = Pdf::loadHTML($htmlCompleto);
        $pdfConteudo = $pdf->output();
        $pdfBase64 = base64_encode($pdfConteudo);
        
        $pdfPath = 'contratos/assinafy_' . $aluguel->codigo_reserva . '.pdf';
        Storage::disk('public')->put($pdfPath, $pdfConteudo);

        // 2. Disparo para a API Assinafy
        $tokenAssinafy = config('services.assinafy.token'); // Certifique-se de ter isso no .env
        
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $tokenAssinafy,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json'
        ])->post('https://api.assinafy.com/v1/documents/create', [
            'name' => 'Contrato - ' . $aluguel->codigo_reserva,
            'file_base64' => $pdfBase64,
            'send_email' => true, // O sistema deles já dispara o e-mail pro cliente
            'signers' => [
                [
                    'name' => $aluguel->locatario->name,
                    'email' => $aluguel->locatario->email,
                    'action' => 'SIGN'
                ]
            ],
            // URL de retorno: Para onde o cliente vai depois de desenhar a assinatura
            'redirect_url' => route('marketplace.explorar.index') 
        ]);

        if ($response->failed()) {
            return response()->json(['error' => 'Falha de comunicação com a plataforma de assinaturas.'], 500);
        }

        $dadosAssinafy = $response->json();

        // 3. Salva no Banco o Hash e o Link
        $contrato = Contrato::create([
            'aluguel_id' => $aluguel->id,
            'numero_contrato' => 'CTR-' . strtoupper(Str::random(8)),
            'titulo' => 'Contrato ' . $aluguel->codigo_reserva,
            'arquivo_pdf' => $pdfPath,
            'hash_documento' => $dadosAssinafy['document_id'] ?? Str::random(15), 
            'plataforma_assinatura' => 'Assinafy',
            'url_assinatura' => $dadosAssinafy['sign_url'] ?? null, 
            'assinado' => false
        ]);

        $aluguel->update([
            'contrato_id' => $contrato->id,
            'status' => 'aguardando_assinatura'
        ]);

        return response()->json(['success' => true, 'message' => 'Contrato gerado, e-mail enviado ao cliente e link disponibilizado!']);
    }

    /**
     * 👉 WEBHOOK: Recebe o aviso da Assinafy de que o cliente assinou
     */
    public function webhookAssinafy(Request $request)
    {
        // Padrão de retorno de webhook de assinaturas
        $documentId = $request->input('document_id') ?? $request->input('id');
        $status = $request->input('status');

        if ($status === 'SIGNED' || $status === 'COMPLETED') {
            $contrato = Contrato::where('hash_documento', $documentId)->first();

            if ($contrato) {
                $contrato->update([
                    'assinado' => true,
                    'data_assinatura' => now(),
                    'ip_assinatura' => $request->ip(),
                ]);

                // Atualiza a reserva correspondente
                $contrato->aluguel->update([
                    'contrato_assinado' => true,
                    'status' => 'confirmado' 
                ]);
            }
        }

        return response()->json(['status' => 'received']);
    }
}
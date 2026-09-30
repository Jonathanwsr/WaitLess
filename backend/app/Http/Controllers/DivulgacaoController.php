<?php

namespace App\Http\Controllers;

use App\Models\Estabelecimento;
use App\Models\Servico;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\RoundBlockSizeMode;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Http\Request;

/**
 * Divulgação do local: página pública com prévia bonita (WhatsApp/Instagram), QR Code e o
 * link que o proprietário compartilha. O cliente que chega por aqui vai direto para o agendamento.
 */
class DivulgacaoController extends Controller
{
    private function localAtivo($id): Estabelecimento
    {
        $local = Estabelecimento::findOrFail($id);
        abort_if($local->ativo === false, 404);

        return $local;
    }

    public static function linkDoLocal(int $id, ?int $servicoId = null): string
    {
        return url('/l/' . $id) . ($servicoId ? '?servico=' . $servicoId : '');
    }

    /** Página pública do local (HTML renderizado no servidor, para a prévia de links funcionar). */
    public function pagina(Request $request, $id)
    {
        $local = $this->localAtivo($id);

        $servicos = Servico::where('estabelecimento_id', $local->id)
            ->where('ativo', true)
            ->orderBy('valor')
            ->limit(8)
            ->get(['id', 'nome', 'valor', 'duracao_minutos', 'descricao', 'fotos']);

        $destaqueId = (int) $request->query('servico');
        $destaque = $destaqueId ? $servicos->firstWhere('id', $destaqueId) : null;

        $foto = $local->foto_banner ?: $local->foto_perfil;
        $cidade = collect([$local->cidade, $local->estado])->filter()->implode(' - ');
        $descricao = trim(($local->bio ?: $local->ramo_atuacao ?: 'Agende online, sem fila e sem ligar.'))
            . ($cidade ? " · {$cidade}" : '');

        return view('local-publico', [
            'local' => $local,
            'servicos' => $servicos,
            'destaque' => $destaque,
            'foto' => $foto,
            'cidade' => $cidade,
            'descricao' => mb_substr($descricao, 0, 180),
            'urlAgendar' => route('cliente.agendar', $local->id) . ($destaque ? '?servico=' . $destaque->id : ''),
            'urlPagina' => self::linkDoLocal($local->id, $destaque?->id),
        ]);
    }

    /** QR Code (PNG) que leva à página pública do local. */
    public function qr(Request $request, $id)
    {
        $local = $this->localAtivo($id);
        $servicoId = $request->integer('servico') ?: null;

        $resultado = (new Builder(
            writer: new PngWriter(),
            data: self::linkDoLocal($local->id, $servicoId),
            encoding: new Encoding('UTF-8'),
            errorCorrectionLevel: ErrorCorrectionLevel::Medium,
            size: 600,
            margin: 20,
            roundBlockSizeMode: RoundBlockSizeMode::Margin,
        ))->build();

        return response($resultado->getString(), 200, [
            'Content-Type' => $resultado->getMimeType(),
            'Cache-Control' => 'public, max-age=86400',
        ]);
    }

    /** Dados de divulgação dos locais do proprietário (usado pelo app e pelo site). */
    public static function dadosDoProprietario($user): array
    {
        $locais = $user->estabelecimentosGerenciados()->get(['estabelecimentos.id', 'estabelecimentos.nome', 'estabelecimentos.foto_perfil']);

        return $locais->map(function ($l) {
            $link = self::linkDoLocal($l->id);

            return [
                'id' => $l->id,
                'nome' => $l->nome,
                'foto_perfil' => $l->foto_perfil,
                'link' => $link,
                'qr_url' => url('/l/' . $l->id . '/qr.png'),
                'mensagem' => "Agende seu horário na {$l->nome} pelo Lokyva, sem fila e sem ligar: {$link}",
                'servicos' => Servico::where('estabelecimento_id', $l->id)->where('ativo', true)->orderBy('nome')->get(['id', 'nome', 'valor'])
                    ->map(fn ($s) => [
                        'id' => $s->id,
                        'nome' => $s->nome,
                        'valor' => (float) $s->valor,
                        'link' => self::linkDoLocal($l->id, $s->id),
                        'qr_url' => url('/l/' . $l->id . '/qr.png') . '?servico=' . $s->id,
                    ])->values(),
            ];
        })->values()->all();
    }
}

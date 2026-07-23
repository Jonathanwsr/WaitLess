<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Servico;
use App\Models\Estabelecimento;
use App\Models\Avaliacao;
use Carbon\Carbon;

class CatalogoMobileController extends Controller
{
    public function detalhesServico($id)
    {
        try {
            // Puxa o serviço e os dados vitais do estabelecimento dono dele
            $servico = Servico::with(['estabelecimento' => function($q) {
                $q->select('id', 'nome', 'foto_perfil', 'avaliacao_media', 'total_avaliacoes', 'cidade', 'estado', 'created_at');
            }])->findOrFail($id);

            // Calcula os anos de parceria baseado na coluna created_at da tabela estabelecimentos
            $anosPlataforma = Carbon::parse($servico->estabelecimento->created_at)->diffInYears(Carbon::now());
            $servico->estabelecimento->anos_plataforma = $anosPlataforma < 1 ? 'Novo' : $anosPlataforma . ' anos';

            $avaliacoes = Avaliacao::with('usuario:id,name,foto_perfil')
                ->where('estabelecimento_id', $servico->estabelecimento_id)
                ->where('publica', true)
                ->latest()
                ->take(3)
                ->get();

            return response()->json([
                'servico' => $servico,
                'avaliacoes_previa' => $avaliacoes
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Serviço não encontrado.'], 404);
        }
    }

    public function perfilEstabelecimento($id)
    {
        try {
            $estabelecimento = Estabelecimento::findOrFail($id);

            $outrosServicos = Servico::where('estabelecimento_id', $id)
                ->where('ativo', true)
                ->get();

            $avaliacoes = Avaliacao::with('usuario:id,name,foto_perfil')
                ->where('estabelecimento_id', $id)
                ->where('publica', true)
                ->latest()
                ->get();

            $anosPlataforma = Carbon::parse($estabelecimento->created_at)->diffInYears(Carbon::now());

            return response()->json([
                'anfitriao' => [
                    'id' => $estabelecimento->id,
                    'nome' => $estabelecimento->nome,
                    'foto_perfil' => $estabelecimento->foto_perfil,
                    'avaliacao_media' => $estabelecimento->avaliacao_media,
                    'total_avaliacoes' => $estabelecimento->total_avaliacoes,
                    'anos_plataforma' => $anosPlataforma < 1 ? 'Novo' : $anosPlataforma,
                    'cidade' => $estabelecimento->cidade,
                    'estado' => $estabelecimento->estado,
                ],
                'servicos_oferecidos' => $outrosServicos,
                'todas_avaliacoes' => $avaliacoes
            ], 200);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Estabelecimento não encontrado.'], 404);
        }
    }
}
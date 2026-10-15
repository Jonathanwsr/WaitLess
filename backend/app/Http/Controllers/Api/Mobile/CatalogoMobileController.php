<?php

namespace App\Http\Controllers\Api\Mobile;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Servico;
use App\Models\Estabelecimento;
use App\Models\Avaliacao;
use App\Models\ItemAluguel; // Importante adicionar o Model
use App\Models\Agendamento; // Importante adicionar o Model
use Carbon\Carbon;

class CatalogoMobileController extends Controller
{
    public function detalhesServico($id)
    {
        try {
            // Puxa o serviço e os dados vitais do estabelecimento dono dele
            $servico = Servico::with(['estabelecimento' => function($q) {
                $q->select('id', 'nome', 'foto_perfil', 'avaliacao_media', 'total_avaliacoes', 'cidade', 'estado', 'created_at', 'telefone');
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

            // Mesmas regras da página web (DetalheServicoService): avaliações, horários lotados e outros serviços.
            $detalhe = app(\App\Services\Servico\DetalheServicoService::class);
            $user = request()->user();
            $valor = (float) $servico->valor;

            return response()->json([
                'servico' => $servico,
                'avaliacoes_previa' => $avaliacoes,
                'funcionarios' => \App\Models\Funcionario::where('estabelecimento_id', $servico->estabelecimento_id)->where('ativo', true)->orderBy('nome')->get(['id', 'nome', 'cargo']),
                'avaliacoes' => $detalhe->avaliacoes($servico, (int) $servico->estabelecimento_id),
                'ocupados' => $detalhe->horariosOcupados($servico),
                'horarios' => $detalhe->listaDeHorarios($servico->horarios_disponiveis),
                // Sem horários fixos: o cliente combina com o dono (chat ou telefone).
                'horario_a_combinar' => $servico->horarioACombinar(),
                'vagas_por_horario' => $detalhe->capacidade($servico),
                'valor_com_promocao' => round($detalhe->comPromocao($valor, $servico), 2),
                'outros_servicos' => $detalhe->outros($servico, (int) $servico->estabelecimento_id),
                'favorito' => $user ? \App\Models\Favorito::where('usuario_id', $user->id)->where('servico_id', $servico->id)->exists() : false,
                // Sócio sem carteira Asaas: só pagamento no local.
                'aceita_pagamento_online' => app(\App\Services\PagamentoService::class)->estabelecimentoTemCarteiraAsaas($servico->estabelecimento_id),
            ], 200);

        } catch (\Exception $e) {
            // Adicionado log para ajudar você a debugar caso dê erro 500
            \Log::error('Erro ao buscar detalhes do serviço: ' . $e->getMessage());
            return response()->json(['error' => 'Serviço não encontrado.'], 404);
        }
    }

    /** Confere se o horário ainda tem vaga; quando já tem alguém, devolve o motivo e horários livres. */
    public function disponibilidade(\Illuminate\Http\Request $request, Servico $servico)
    {
        $dados = $request->validate([
            'data' => 'required|date_format:Y-m-d',
            'hora' => 'required|date_format:H:i',
        ]);

        return response()->json(app(\App\Services\Servico\DetalheServicoService::class)->disponibilidade($servico, $dados['data'], $dados['hora']));
    }

    public function perfilEstabelecimento($id)
    {
        try {
            $estabelecimento = Estabelecimento::findOrFail($id);

            // 1. Busca os serviços ativos
            $servicos = Servico::where('estabelecimento_id', $id)
                ->where('ativo', true)
                ->get();

            // 2. Busca os itens de aluguel ativos e disponíveis
            $itensAluguel = ItemAluguel::catalogo()->doLocal((int) $id)
                ->where('ativo', true)
                ->get()
                ->each(fn ($i) => $i->setAttribute('foto_principal', $i->foto_principal));

            // 3. Busca as avaliações
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
                'servicos_oferecidos' => $servicos,
                'itens_aluguel' => $itensAluguel, // Enviando os itens de aluguel para o app
                'todas_avaliacoes' => $avaliacoes
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Erro ao buscar catálogo do estabelecimento: ' . $e->getMessage());
            return response()->json(['error' => 'Estabelecimento não encontrado.'], 404);
        }
    }
}
<?php

namespace App\Services\Servico;

use App\Models\Avaliacao;
use App\Models\Servico;
use App\Services\Agendamento\VagasServicoService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Regras da página de detalhes de um serviço, usadas igualmente no web e no app:
 * avaliações, horários já lotados, conferência de vaga com sugestões e "outros serviços do local".
 */
class DetalheServicoService
{
    public function __construct(private VagasServicoService $vagas)
    {
    }

    public function capacidade(Servico $servico): int
    {
        return $this->vagas->capacidade($servico);
    }

    /** Avaliações do serviço (pelos agendamentos dele); sem nenhuma, mostra as do estabelecimento. */
    public function avaliacoes(Servico $servico, int $localId): array
    {
        $base = fn () => Avaliacao::query()->where('publica', true)->whereNotNull('nota');

        $consulta = $base()->whereHas('agendamento', fn ($q) => $q->where('servico_id', $servico->id));
        $escopo = 'servico';
        if (!(clone $consulta)->exists()) {
            $consulta = $base()->where('estabelecimento_id', $localId);
            $escopo = 'estabelecimento';
        }

        $notas = (clone $consulta)->selectRaw('nota, COUNT(*) as total')->groupBy('nota')->pluck('total', 'nota');
        $total = (int) $notas->sum();

        return [
            'escopo' => $escopo,
            'media' => $total ? round((clone $consulta)->avg('nota'), 1) : 0,
            'total' => $total,
            'distribuicao' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($n) => [$n => (int) ($notas[$n] ?? 0)])->all(),
            'lista' => (clone $consulta)->with('usuario:id,name,foto_perfil')
                ->latest()->limit(8)
                ->get(['id', 'usuario_id', 'nota', 'comentario', 'fotos', 'resposta_anfitriao', 'created_at'])
                ->map(fn (Avaliacao $a) => [
                    'id' => $a->id,
                    'nome' => $a->usuario ? $this->primeiroNome($a->usuario->name) : 'Cliente',
                    'foto' => $a->usuario?->foto_perfil,
                    'nota' => (int) $a->nota,
                    'comentario' => $a->comentario,
                    'fotos' => array_values(array_filter((array) $a->fotos, 'is_string')),
                    'resposta' => $a->resposta_anfitriao,
                    'data' => $a->created_at?->toDateString(),
                ])->all(),
        ];
    }

    /** Horários já lotados nos próximos 15 dias: ['2026-10-12' => ['09:00', ...]]. */
    public function horariosOcupados(Servico $servico): array
    {
        $vagas = $this->vagas->capacidade($servico);

        return DB::table('agendamentos')
            ->where('servico_id', $servico->id)
            ->whereBetween('data_agendamento', [now()->toDateString(), now()->addDays(15)->toDateString()])
            ->whereNotIn('status', VagasServicoService::STATUS_LIVRES)
            ->selectRaw("data_agendamento, to_char(hora_agendamento, 'HH24:MI') as hora, COUNT(*) as total")
            ->groupBy('data_agendamento', 'hora_agendamento')
            ->get()
            ->filter(fn ($l) => (int) $l->total >= $vagas)
            ->groupBy(fn ($l) => substr((string) $l->data_agendamento, 0, 10))
            ->map(fn ($l) => $l->pluck('hora')->values()->all())
            ->all();
    }

    /**
     * Confere na hora se o horário ainda tem vaga (alguém pode ter acabado de reservar).
     * Sem vaga: devolve o motivo e os próximos horários livres do mesmo dia.
     */
    public function disponibilidade(Servico $servico, string $data, string $hora): array
    {
        $quando = Carbon::parse("{$data} {$hora}");
        if ($quando->isPast()) {
            return ['livre' => false, 'motivo' => 'Esse horário já passou. Escolha outro.', 'sugestoes' => $this->proximosLivres($servico, $data, $hora)];
        }

        $livres = $this->vagas->vagasLivres($servico, $data, $hora);
        if ($livres > 0) {
            return ['livre' => true, 'vagas' => $livres];
        }

        return [
            'livre' => false,
            'motivo' => 'Já tem alguém agendado nesse horário. Escolha outro.',
            'sugestoes' => $this->proximosLivres($servico, $data, $hora),
        ];
    }

    /** Outros serviços do mesmo local, com foto, preço e horários (para trocar sem voltar). */
    public function outros(Servico $servico, int $localId, int $limite = 6): array
    {
        return Servico::where('estabelecimento_id', $localId)->where('ativo', true)->where('id', '!=', $servico->id)
            ->orderByDesc('avaliacao_media')->orderBy('nome')->limit($limite)
            ->get(['id', 'nome', 'valor', 'duracao_minutos', 'fotos', 'horarios_disponiveis', 'configuracoes', 'avaliacao_media', 'total_avaliacoes', 'tem_promocao', 'tipo_desconto', 'valor_desconto', 'vagas_por_horario'])
            ->map(function (Servico $o) {
                $cfg = $this->json($o->configuracoes);
                $valor = (float) $o->valor;

                return [
                    'id' => $o->id,
                    'nome' => $o->nome,
                    'valor' => round($valor, 2),
                    'valor_com_promocao' => round($this->comPromocao($valor, $o), 2),
                    'duracao_minutos' => (int) $o->duracao_minutos,
                    'foto' => $this->primeiraFoto($o->fotos),
                    'horarios' => array_slice($this->listaDeHorarios($o->horarios_disponiveis), 0, 6),
                    'horario_a_combinar' => $o->horarioACombinar(),
                    'dias_disponiveis' => array_values($cfg['dias_disponiveis'] ?? []),
                    'avaliacao_media' => (float) $o->avaliacao_media,
                    'total_avaliacoes' => (int) $o->total_avaliacoes,
                ];
            })
            ->all();
    }

    public function comPromocao(float $valor, Servico $s): float
    {
        if (!$s->tem_promocao || (float) $s->valor_desconto <= 0) {
            return $valor;
        }

        $final = $s->tipo_desconto === 'percentual'
            ? $valor * (1 - (float) $s->valor_desconto / 100)
            : $valor - (float) $s->valor_desconto;

        return max(0, $final);
    }

    public function listaDeHorarios($horarios): array
    {
        $lista = array_values(array_filter($this->json($horarios), 'is_string'));
        sort($lista);

        return $lista;
    }

    public function json($valor): array
    {
        if (is_array($valor)) {
            return $valor;
        }
        $decodificado = json_decode((string) $valor, true);
        if (is_string($decodificado)) {
            $decodificado = json_decode($decodificado, true);
        }

        return is_array($decodificado) ? $decodificado : [];
    }

    private function proximosLivres(Servico $servico, string $data, string $hora): array
    {
        $agora = now();

        return collect($this->listaDeHorarios($servico->horarios_disponiveis))
            ->filter(fn ($h) => $h > $hora && Carbon::parse("{$data} {$h}")->gt($agora))
            ->filter(fn ($h) => $this->vagas->vagasLivres($servico, $data, $h) > 0)
            ->take(4)
            ->values()
            ->all();
    }

    private function primeiraFoto($fotos): ?string
    {
        $foto = $this->json($fotos)[0] ?? null;

        return is_string($foto) && $foto !== '' ? $foto : null;
    }

    private function primeiroNome(?string $nome): string
    {
        $partes = preg_split('/\s+/', trim((string) $nome));

        return trim(($partes[0] ?? 'Cliente') . (isset($partes[1]) ? ' ' . mb_substr($partes[1], 0, 1) . '.' : ''));
    }
}

<?php

namespace App\Services\Viagem;

use App\Models\Agendamento;
use App\Models\Aluguel;
use App\Models\ItemAluguel;
use App\Models\Pagamento;
use App\Models\Roteiro;
use App\Models\RoteiroPedido;
use App\Models\Servico;
use App\Models\User;
use App\Services\Agendamento\VagasServicoService;
use App\Services\Locacao\DisponibilidadeService;
use App\Services\NotificacaoService;
use App\Services\PrecificacaoService;
use App\Support\Taxas;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * "Reservar tudo": todas as locações do Lokyva de um roteiro viram UM pedido (roteiro_pedidos), com as datas e a
 * quantidade de pessoas do roteiro já preenchidas. Cada reserva nasce como "pagar no local" — funciona para qualquer
 * sócio (com ou sem carteira); onde o sócio aceita, o cliente ainda pode pagar online depois, na própria reserva.
 * Tudo ou nada: se alguma criação falhar no meio, nada fica gravado. Itens sem vaga entram em "nao_reservados".
 */
class RoteiroReservaService
{
    public function __construct(
        private PrecificacaoService $precos,
        private VagasServicoService $vagas,
        private DisponibilidadeService $disponibilidade,
    ) {}

    public function reservar(Roteiro $roteiro, User $user): RoteiroPedido
    {
        $roteiro->loadMissing('dias.itens');
        $pessoas = max(1, (int) $roteiro->pessoas);
        $inicioViagem = Carbon::parse($roteiro->data_inicio)->startOfDay();
        $fimViagem = Carbon::parse($roteiro->data_fim)->startOfDay();
        $totalDias = (int) $inicioViagem->diffInDays($fimViagem) + 1;

        $itens = $roteiro->dias->flatMap(fn ($d) => $d->itens->map(fn ($i) => [$d, $i]))
            ->filter(fn ($par) => $par[1]->tipo === 'locacao' && ($par[1]->servico_id || $par[1]->item_aluguel_id));
        if ($itens->isEmpty()) {
            throw ValidationException::withMessages(['roteiro' => 'Este roteiro ainda não tem locações do Lokyva para reservar.']);
        }

        $reservas = [];
        $naoReservados = [];
        $donosAvisar = [];
        $codigo = 'ROT-' . strtoupper(Str::random(8));
        $hoje = now()->startOfDay();

        $pedido = DB::transaction(function () use ($itens, $roteiro, $user, $pessoas, $inicioViagem, $fimViagem, $totalDias, $codigo, $hoje, &$reservas, &$naoReservados, &$donosAvisar) {
            foreach ($itens as [$dia, $item]) {
                $data = Carbon::parse($dia->data)->startOfDay();
                if ($data->lt($hoje)) {
                    $naoReservados[] = ['titulo' => $item->titulo, 'motivo' => 'A data deste dia já passou.'];
                    continue;
                }

                if ($item->servico_id) {
                    $servico = Servico::with('estabelecimento')->find($item->servico_id);
                    $motivo = $this->motivoServicoIndisponivel($servico, $data, $item->hora);
                    if ($motivo) {
                        $naoReservados[] = ['titulo' => $item->titulo, 'motivo' => $motivo];
                        continue;
                    }
                    $valor = round($this->precos->comPromocao((float) $servico->valor, (bool) $servico->tem_promocao, $servico->tipo_desconto, $servico->valor_desconto) * $pessoas, 2);
                    $hora = $this->horaDoServico($servico, $item->hora);

                    $agendamento = Agendamento::create([
                        'estabelecimento_id' => $servico->estabelecimento_id,
                        'usuario_id' => $user->id,
                        'servico_id' => $servico->id,
                        'data_agendamento' => $data->toDateString(),
                        'hora_agendamento' => $hora,
                        'quantidade_pessoas' => $pessoas,
                        'status' => $valor > 0 ? 'pendente' : 'confirmado',
                        'status_pagamento' => $valor > 0 ? 'presencial' : 'pago',
                        'valor_final' => $valor,
                        'codigo_verificacao' => (string) random_int(1000, 9999),
                    ]);
                    $taxa = round($valor * Taxas::fracao(), 2);
                    Pagamento::create([
                        'usuario_id' => $user->id, 'estabelecimento_id' => $servico->estabelecimento_id, 'agendamento_id' => $agendamento->id,
                        'gateway_pagamento' => null, 'valor' => $valor, 'taxa' => $taxa, 'valor_liquido' => $valor - $taxa,
                        'status' => $valor > 0 ? 'pendente' : 'pago', 'metodo_pagamento' => $valor > 0 ? 'presencial' : 'gratuito',
                    ]);
                    $reservas[] = ['tipo' => 'agendamento', 'id' => $agendamento->id, 'titulo' => $servico->nome, 'local' => $servico->estabelecimento?->nome,
                        'data' => $data->toDateString(), 'hora' => substr($hora, 0, 5), 'valor' => $valor];
                    $donosAvisar = array_merge($donosAvisar, DB::table('estabelecimento_usuario')->where('estabelecimento_id', $servico->estabelecimento_id)
                        ->whereIn('tipo', ['socio', 'proprietario'])->pluck('usuario_id')->all());

                    continue;
                }

                $locavel = ItemAluguel::find($item->item_aluguel_id);
                if (!$locavel || !$locavel->ativo || $locavel->disponivel === false) {
                    $naoReservados[] = ['titulo' => $item->titulo, 'motivo' => 'Esta locação não está mais disponível.'];
                    continue;
                }

                // Hospedagem: da ida até a volta (noites); veículo: todos os dias da viagem; demais: só aquele dia.
                $categoria = LocacoesProximasService::categoriaDoItem($locavel->categoria);
                [$inicio, $fim, $periodos] = match ($categoria) {
                    'hospedagem' => [$inicioViagem->copy(), $totalDias > 1 ? $fimViagem->copy() : $inicioViagem->copy()->addDay(), max(1, $totalDias - 1)],
                    'veiculos' => [$inicioViagem->copy(), $fimViagem->copy()->addDay(), $totalDias],
                    default => [$data->copy(), $data->copy()->addDay(), 1],
                };
                if ($inicio->lt($hoje)) {
                    $inicio = $hoje->copy();
                }
                $capacidade = (int) ($locavel->capacidade_pessoas ?: $locavel->lugares ?: 0);
                $unidades = $capacidade > 0 ? (int) ceil($pessoas / $capacidade) : 1;

                try {
                    $this->disponibilidade->verificar($locavel, $inicio, $fim, $unidades);
                } catch (ValidationException $e) {
                    $naoReservados[] = ['titulo' => $item->titulo, 'motivo' => collect($e->errors())->flatten()->first() ?? 'Sem disponibilidade nessas datas.'];
                    continue;
                }

                $diaria = $this->precos->comPromocao((float) $locavel->valor_diaria, (bool) $locavel->tem_promocao, $locavel->tipo_desconto, $locavel->valor_desconto);
                $caucao = (float) ($locavel->valor_caucao ?? 0);
                $total = round($diaria * $periodos * $unidades + $caucao, 2);

                $aluguel = Aluguel::create([
                    'codigo_reserva' => 'RES-' . strtoupper(Str::random(8)),
                    'item_aluguel_id' => $locavel->id,
                    'estabelecimento_id' => $locavel->estabelecimento_id,
                    'proprietario_id' => $locavel->estabelecimento_id,
                    'locatario_id' => $user->id,
                    'tipo_periodo' => 'diaria',
                    'quantidade_periodos' => $periodos,
                    'data_inicio' => $inicio->toDateString(),
                    'data_fim' => $fim->toDateString(),
                    'quantidade' => $unidades,
                    'quantidade_pessoas' => $pessoas,
                    'valor_unitario' => $diaria,
                    'valor_caucao' => $caucao,
                    'valor_bruto' => $total,
                    'valor_total' => $total,
                    'taxa_plataforma' => Taxas::sobre($total),
                    'forma_pagamento' => 'presencial',
                    'status' => 'pendente',
                    'exige_contrato' => (bool) $locavel->exige_contrato,
                    'observacoes' => "Reserva feita pelo roteiro \"{$roteiro->titulo}\" (pedido {$codigo}).",
                ]);
                $reservas[] = ['tipo' => 'aluguel', 'id' => $aluguel->id, 'titulo' => $locavel->nome, 'local' => null,
                    'data' => $inicio->toDateString(), 'data_fim' => $fim->toDateString(), 'valor' => $total];
                $donosAvisar[] = (int) $locavel->estabelecimento_id;
            }

            if (!$reservas) {
                throw ValidationException::withMessages(['roteiro' => 'Nenhuma locação pôde ser reservada: ' . collect($naoReservados)->pluck('motivo')->unique()->implode(' ')]);
            }

            return RoteiroPedido::create([
                'roteiro_id' => $roteiro->id,
                'user_id' => $user->id,
                'codigo' => $codigo,
                'status' => 'criado',
                'total' => round(array_sum(array_column($reservas, 'valor')), 2),
                'reservas' => $reservas,
                'nao_reservados' => $naoReservados ?: null,
            ]);
        });

        $this->avisarDonos(array_unique($donosAvisar), $user, $codigo);

        return $pedido;
    }

    private function motivoServicoIndisponivel(?Servico $servico, Carbon $data, ?string $hora): ?string
    {
        if (!$servico || !$servico->ativo || !$servico->estabelecimento?->ativo) {
            return 'Este serviço não está mais disponível.';
        }
        if ($servico->horarioACombinar()) {
            return 'Horário a combinar: fale com o local para marcar.';
        }
        try {
            $this->vagas->verificar($servico, $data->toDateString(), $this->horaDoServico($servico, $hora));
        } catch (ValidationException $e) {
            return collect($e->errors())->flatten()->first() ?? 'Sem vaga nesse horário.';
        }

        return null;
    }

    /** Usa o horário do roteiro quando o serviço atende nele; senão, o primeiro horário cadastrado do serviço. */
    private function horaDoServico(Servico $servico, ?string $hora): string
    {
        $lista = collect(is_array($servico->horarios_disponiveis) ? $servico->horarios_disponiveis : (json_decode((string) $servico->horarios_disponiveis, true) ?: []))
            ->filter(fn ($h) => is_string($h))->map(fn ($h) => substr($h, 0, 5))->values();
        if ($hora && ($lista->isEmpty() || $lista->contains($hora))) {
            return $hora;
        }

        return $lista->first(fn ($h) => !$hora || $h >= $hora) ?? $lista->first() ?? ($hora ?: '09:00');
    }

    private function avisarDonos(array $donos, User $cliente, string $codigo): void
    {
        $notificacao = app(NotificacaoService::class);
        foreach (User::whereIn('id', $donos)->get() as $dono) {
            try {
                $notificacao->enviarPush($dono, 'Nova reserva pelo roteiro', "{$cliente->name} reservou pelo roteiro de viagem (pedido {$codigo}). Pagamento no local.", ['tipo' => 'roteiro_pedido']);
            } catch (\Throwable $e) {
                Log::info('Aviso de reserva do roteiro não enviado: ' . $e->getMessage());
            }
        }
    }
}

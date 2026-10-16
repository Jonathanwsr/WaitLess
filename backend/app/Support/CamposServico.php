<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Campos de atendimento do serviço (fonte única para site, app e telas do cliente):
 * onde é atendido, 24h, raio, taxa de deslocamento, tempo de chegada, tipo de preço,
 * o que inclui, como se preparar e garantia.
 */
class CamposServico
{
    public const MODALIDADES = [
        'no_local' => 'No estabelecimento',
        'a_domicilio' => 'Vai até o cliente',
        'ambos' => 'No local ou até o cliente',
        'online' => 'Online',
    ];

    public const TIPOS_PRECO = [
        'fixo' => 'Preço fixo',
        'a_partir_de' => 'A partir de',
        'por_hora' => 'Por hora',
        'por_km' => 'Por km rodado',
        'sob_orcamento' => 'Sob orçamento',
    ];

    public const CAMPOS = ['modalidade_atendimento', 'atende_24h', 'raio_atendimento_km', 'taxa_deslocamento', 'tempo_chegada_minutos', 'tipo_preco', 'o_que_inclui', 'como_se_preparar', 'garantia_dias'];

    /** Opções para os formulários (site e app). */
    public static function opcoes(): array
    {
        $lista = fn (array $m) => collect($m)->map(fn ($r, $v) => ['valor' => $v, 'rotulo' => $r])->values()->all();

        return ['modalidades' => $lista(self::MODALIDADES), 'tipos_preco' => $lista(self::TIPOS_PRECO)];
    }

    public static function regras(): array
    {
        return [
            'modalidade_atendimento' => ['nullable', Rule::in(array_keys(self::MODALIDADES))],
            'atende_24h' => 'nullable|boolean',
            'raio_atendimento_km' => 'nullable|integer|min:1|max:1000',
            'taxa_deslocamento' => 'nullable|numeric|min:0|max:100000',
            'tempo_chegada_minutos' => 'nullable|integer|min:1|max:1440',
            'tipo_preco' => ['nullable', Rule::in(array_keys(self::TIPOS_PRECO))],
            'o_que_inclui' => 'nullable|string|max:2000',
            'como_se_preparar' => 'nullable|string|max:2000',
            'garantia_dias' => 'nullable|integer|min:0|max:3650',
        ];
    }

    public static function mensagens(): array
    {
        return [
            'modalidade_atendimento.in' => 'Escolha onde o serviço é feito.',
            'tipo_preco.in' => 'Escolha como o preço é cobrado.',
            'raio_atendimento_km.max' => 'O raio de atendimento pode ser de até 1000 km.',
            'tempo_chegada_minutos.max' => 'O tempo de chegada pode ser de até 24 horas.',
        ];
    }

    /** Só os campos enviados (para editar sem apagar o que não veio), já limpos. */
    public static function doRequest(Request $request): array
    {
        $dados = [];
        foreach (self::CAMPOS as $campo) {
            if (!$request->exists($campo)) {
                continue;
            }
            $v = $request->input($campo);
            $dados[$campo] = match ($campo) {
                'atende_24h' => $request->boolean($campo),
                'modalidade_atendimento' => array_key_exists((string) $v, self::MODALIDADES) ? $v : 'no_local',
                'tipo_preco' => array_key_exists((string) $v, self::TIPOS_PRECO) ? $v : 'fixo',
                'raio_atendimento_km', 'tempo_chegada_minutos', 'garantia_dias' => ($v === null || $v === '') ? null : (int) $v,
                'taxa_deslocamento' => ($v === null || $v === '' || (float) $v <= 0) ? null : round((float) $v, 2),
                default => ($v === null || trim(strip_tags((string) $v)) === '') ? null : trim(strip_tags((string) $v)),
            };
        }

        // Sem deslocamento (atende só no local/online): raio e taxa não fazem sentido.
        if (isset($dados['modalidade_atendimento']) && in_array($dados['modalidade_atendimento'], ['no_local', 'online'], true)) {
            $dados['raio_atendimento_km'] = null;
            $dados['taxa_deslocamento'] = null;
        }

        return $dados;
    }

    public static function vaiAteOCliente(object $servico): bool
    {
        return in_array($servico->modalidade_atendimento ?? 'no_local', ['a_domicilio', 'ambos'], true);
    }

    /** Endereço do cliente é obrigatório quando o serviço só acontece onde o cliente está. */
    public static function exigeEndereco(object $servico): bool
    {
        return ($servico->modalidade_atendimento ?? 'no_local') === 'a_domicilio';
    }

    /**
     * Taxa de deslocamento cobrada no agendamento: só quando o atendimento é no endereço do cliente
     * (no "ambos", só se o cliente informou um endereço).
     */
    public static function taxaDoAgendamento(object $servico, ?string $endereco): float
    {
        if (!self::vaiAteOCliente($servico) || !(float) ($servico->taxa_deslocamento ?? 0)) {
            return 0.0;
        }
        if (($servico->modalidade_atendimento ?? null) === 'ambos' && !trim((string) $endereco)) {
            return 0.0;
        }

        return round((float) $servico->taxa_deslocamento, 2);
    }

    /** Bloco pronto para as telas do cliente (site e app). */
    public static function paraTela(object $servico): array
    {
        $modalidade = $servico->modalidade_atendimento ?? 'no_local';
        $tipoPreco = $servico->tipo_preco ?? 'fixo';
        $selos = [];
        if (!empty($servico->atende_24h)) {
            $selos[] = ['id' => '24h', 'texto' => 'Atende 24h', 'icone' => 'time'];
        }
        if (in_array($modalidade, ['a_domicilio', 'ambos'], true)) {
            $selos[] = ['id' => 'domicilio', 'texto' => 'Vai até você', 'icone' => 'navigate'];
        }
        if ($modalidade === 'online') {
            $selos[] = ['id' => 'online', 'texto' => 'Online', 'icone' => 'videocam'];
        }
        if (!empty($servico->tempo_chegada_minutos)) {
            $selos[] = ['id' => 'chegada', 'texto' => 'Chega em ~' . self::tempo((int) $servico->tempo_chegada_minutos), 'icone' => 'flash'];
        }
        if (!empty($servico->garantia_dias)) {
            $selos[] = ['id' => 'garantia', 'texto' => 'Garantia de ' . $servico->garantia_dias . ' dia' . ($servico->garantia_dias == 1 ? '' : 's'), 'icone' => 'shield-checkmark'];
        }

        return [
            'modalidade' => $modalidade,
            'modalidade_rotulo' => self::MODALIDADES[$modalidade] ?? self::MODALIDADES['no_local'],
            'atende_24h' => (bool) ($servico->atende_24h ?? false),
            'raio_atendimento_km' => $servico->raio_atendimento_km ? (int) $servico->raio_atendimento_km : null,
            'taxa_deslocamento' => (float) ($servico->taxa_deslocamento ?? 0) ?: null,
            'tempo_chegada_minutos' => $servico->tempo_chegada_minutos ? (int) $servico->tempo_chegada_minutos : null,
            'tipo_preco' => $tipoPreco,
            'tipo_preco_rotulo' => self::TIPOS_PRECO[$tipoPreco] ?? self::TIPOS_PRECO['fixo'],
            // Texto curto antes/depois do preço: "A partir de R$ 80", "R$ 5 /km", "Sob orçamento".
            'preco_prefixo' => match ($tipoPreco) { 'a_partir_de', 'sob_orcamento' => 'A partir de', default => null },
            'preco_sufixo' => match ($tipoPreco) { 'por_hora' => '/hora', 'por_km' => '/km', default => null },
            'sob_orcamento' => $tipoPreco === 'sob_orcamento',
            'o_que_inclui' => $servico->o_que_inclui ?: null,
            'como_se_preparar' => $servico->como_se_preparar ?: null,
            'garantia_dias' => $servico->garantia_dias ? (int) $servico->garantia_dias : null,
            'exige_endereco' => $modalidade === 'a_domicilio',
            'pede_endereco' => in_array($modalidade, ['a_domicilio', 'ambos'], true),
            'selos' => $selos,
        ];
    }

    private static function tempo(int $min): string
    {
        if ($min < 60) {
            return "{$min} min";
        }
        $h = intdiv($min, 60);
        $m = $min % 60;

        return $m ? "{$h}h{$m}" : "{$h}h";
    }
}

<?php

namespace App\Services\Locacao;

use App\Models\ItemAluguel;
use App\Services\Viagem\CrossSellViagemService;

/**
 * Tudo o que o sócio cadastrou numa reserva, organizado para o cliente ler na página de detalhes:
 * o tipo (hospedagem, veículo, equipamento ou espaço) define os textos ("noite" x "dia", "hóspedes" x
 * "pessoas"), e cada bloco só traz os campos preenchidos — nada de "R$ 0" ou endereço ", - ,".
 */
class FichaDoItemService
{
    private const ESPACOS = ['sala', 'auditorio', 'espaco_eventos', 'salão_festas', 'quadra', 'quadra_futebol', 'quadra_volei', 'academia'];

    private const COMBUSTIVEL = ['gasolina' => 'Gasolina', 'etanol' => 'Etanol', 'flex' => 'Flex', 'diesel' => 'Diesel', 'eletrico' => 'Elétrico', 'hibrido' => 'Híbrido', 'gnv' => 'GNV'];
    private const CAMBIO = ['manual' => 'Manual', 'automatico' => 'Automático', 'cvt' => 'Automático (CVT)', 'automatizado' => 'Automatizado'];
    private const PERIODOS = ['hora' => 'hora', 'diaria' => 'dia', 'semanal' => 'semana', 'mensal' => 'mês'];

    public function montar(ItemAluguel $item): array
    {
        $perfil = $this->perfil($item->categoria);
        $local = $item->local_id ? $item->local()->first(['id', 'nome', 'rua', 'numero', 'bairro', 'cidade', 'estado', 'cep', 'latitude', 'longitude', 'telefone']) : null;

        return [
            'perfil' => $perfil,
            'textos' => $this->textos($perfil, $item),
            'local' => $local ? ['id' => $local->id, 'nome' => $local->nome, 'telefone' => $local->telefone] : null,
            'endereco' => $this->endereco($item, $local),
            'especificacoes' => $this->especificacoes($perfil, $item),
            'precos' => $this->precos($item),
            'regras' => $this->regras($item, $perfil),
            'retirada' => $this->pontoDeEntrega($item, 'retirada', $local),
            'devolucao' => $this->pontoDeEntrega($item, 'entrega', $local),
            'acessorios' => $this->lista($item->acessorios),
            'comodidades' => $this->lista($item->recursos_oferecidos),
            'especificacoes_texto' => $this->texto($item->especificacoes),
            'observacoes' => $this->texto($item->observacoes),
            'observacoes_disponibilidade' => $this->texto($item->observacoes_disponibilidade),
        ];
    }

    public function perfil(?string $categoria): string
    {
        return match (true) {
            in_array($categoria, CrossSellViagemService::CATEGORIAS_HOSPEDAGEM, true) => 'hospedagem',
            in_array($categoria, CrossSellViagemService::CATEGORIAS_VEICULO, true) => 'veiculo',
            in_array($categoria, self::ESPACOS, true) => 'espaco',
            default => 'equipamento',
        };
    }

    private function textos(string $perfil, ItemAluguel $item): array
    {
        $periodo = self::PERIODOS[$item->periodo_faturamento_padrao ?? 'diaria'] ?? 'dia';

        return match ($perfil) {
            'hospedagem' => ['unidade' => $periodo === 'dia' ? 'noite' : $periodo, 'unidades' => $periodo === 'dia' ? 'noites' : $periodo . 's', 'inicio' => 'Check-in', 'fim' => 'Check-out', 'pessoa' => 'hóspede', 'pessoas' => 'hóspedes', 'sobre' => 'Sobre a hospedagem', 'quem' => 'Anfitrião'],
            'veiculo' => ['unidade' => $periodo, 'unidades' => $periodo === 'mês' ? 'meses' : $periodo . 's', 'inicio' => 'Retirada', 'fim' => 'Devolução', 'pessoa' => 'passageiro', 'pessoas' => 'passageiros', 'sobre' => 'Sobre o veículo', 'quem' => 'Locador'],
            'espaco' => ['unidade' => $periodo, 'unidades' => $periodo === 'mês' ? 'meses' : $periodo . 's', 'inicio' => 'Início', 'fim' => 'Fim', 'pessoa' => 'pessoa', 'pessoas' => 'pessoas', 'sobre' => 'Sobre o espaço', 'quem' => 'Responsável'],
            default => ['unidade' => $periodo, 'unidades' => $periodo === 'mês' ? 'meses' : $periodo . 's', 'inicio' => 'Retirada', 'fim' => 'Devolução', 'pessoa' => 'pessoa', 'pessoas' => 'pessoas', 'sobre' => 'Sobre o equipamento', 'quem' => 'Locador'],
        };
    }

    /** Endereço do item; sem endereço próprio, o do local (estabelecimento) onde ele é alugado. */
    private function endereco(ItemAluguel $item, $local): ?array
    {
        $doItem = $this->juntar([$item->endereco, $item->numero, $item->complemento]);
        $fonte = $doItem || $item->cidade ? 'item' : ($local ? 'local' : null);
        if (!$fonte) {
            return null;
        }

        $linha1 = $fonte === 'item' ? $doItem : $this->juntar([$local->rua, $local->numero]);
        $bairro = $fonte === 'item' ? $item->bairro : $local->bairro;
        $cidade = $fonte === 'item' ? $item->cidade : $local->cidade;
        $estado = $fonte === 'item' ? $item->estado : $local->estado;
        $cep = $fonte === 'item' ? $item->cep : $local->cep;
        $lat = $fonte === 'item' ? $item->latitude : $local->latitude;
        $lng = $fonte === 'item' ? $item->longitude : $local->longitude;

        $linha2 = $this->juntar([$bairro, $this->juntar([$cidade, $estado], ' - ')], ', ');
        if (!$linha1 && !$linha2) {
            return null;
        }

        $busca = $this->juntar([$linha1, $linha2]);

        return [
            'linha1' => $linha1 ?: null,
            'linha2' => $linha2 ?: null,
            'cep' => $cep ?: null,
            'cidade' => $cidade ?: null,
            'estado' => $estado ?: null,
            'do_local' => $fonte === 'local',
            'mapa' => $lat && $lng
                ? "https://www.google.com/maps/search/?api=1&query={$lat},{$lng}"
                : 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode($busca),
        ];
    }

    private function especificacoes(string $perfil, ItemAluguel $item): array
    {
        $kmFmt = fn ($v) => $v ? number_format((float) $v, 0, ',', '.') . ' km' : null;
        $m2 = fn ($v) => $v ? rtrim(rtrim(number_format((float) $v, 2, ',', '.'), '0'), ',') . ' m²' : null;
        $placaFinal = $item->placa ? 'Final ' . substr(preg_replace('/\W/', '', $item->placa), -1) : null;

        $campos = match ($perfil) {
            'veiculo' => [
                'Marca' => $item->marca ?: $item->fabricante, 'Modelo' => $item->modelo, 'Ano' => $item->ano,
                'Combustível' => self::COMBUSTIVEL[$item->combustivel] ?? ($item->combustivel ? ucfirst($item->combustivel) : null),
                'Câmbio' => self::CAMBIO[$item->cambio] ?? ($item->cambio ? ucfirst($item->cambio) : null),
                'Quilometragem' => $kmFmt($item->quilometragem), 'Cilindrada' => $item->cilindrada, 'Potência' => $item->potencia,
                'Lugares' => $item->lugares ?: $item->capacidade_pessoas, 'Placa' => $placaFinal,
                'Seguro' => $item->possui_seguro ? 'Incluso' : null, 'Tipo' => $item->tipo,
            ],
            'hospedagem' => [
                'Tipo' => $item->tipo ?: $this->rotuloCategoria($item->categoria), 'Área total' => $m2($item->area_total),
                'Área construída' => $m2($item->area_construida), 'Quartos' => $item->numero_quartos ?: null,
                'Suítes' => $item->numero_suites ?: null, 'Banheiros' => $item->numero_banheiros ?: null,
                'Cômodos' => $item->numero_comodos ?: null, 'Vagas de garagem' => $item->numero_vagas ?: null,
                'Mobiliado' => $item->mobiliado ? 'Sim' : null, 'Capacidade' => $item->capacidade_pessoas ? $item->capacidade_pessoas . ' pessoas' : null,
            ],
            'espaco' => [
                'Tipo' => $item->tipo ?: $this->rotuloCategoria($item->categoria), 'Área' => $m2($item->area_total),
                'Capacidade' => $item->capacidade_pessoas ? $item->capacidade_pessoas . ' pessoas' : null,
                'Vagas de garagem' => $item->numero_vagas ?: null, 'Mobiliado' => $item->mobiliado ? 'Sim' : null,
            ],
            default => [
                'Marca' => $item->marca ?: $item->fabricante, 'Modelo' => $item->modelo, 'Tipo' => $item->tipo,
                'Voltagem' => $item->voltagem, 'Potência' => $item->potencia_equipamento ?: $item->potencia,
                'Peso' => $item->peso, 'Dimensões' => $item->dimensoes, 'Garantia' => $item->garantia,
                'Seguro' => $item->possui_seguro ? 'Incluso' : null,
            ],
        };

        return collect($campos)
            ->filter(fn ($v) => $v !== null && $v !== '' && $v !== 0)
            ->map(fn ($v, $rotulo) => ['rotulo' => $rotulo, 'valor' => (string) $v])
            ->values()
            ->all();
    }

    private function precos(ItemAluguel $item): array
    {
        $linhas = [
            ['rotulo' => 'Diária', 'valor' => (float) $item->valor_diaria],
            ['rotulo' => 'Semana', 'valor' => (float) $item->valor_semanal],
            ['rotulo' => 'Mês', 'valor' => (float) $item->valor_mensal],
            ['rotulo' => 'Pessoa extra (por dia)', 'valor' => (float) $item->valor_pessoa_extra],
            ['rotulo' => 'Caução (volta no fim)', 'valor' => (float) $item->valor_caucao],
        ];

        return array_values(array_filter($linhas, fn ($l) => $l['valor'] > 0));
    }

    private function regras(ItemAluguel $item, string $perfil): array
    {
        $h = fn ($v) => $v ? substr((string) $v, 0, 5) : null;
        $duracao = function ($horas) {
            $horas = (int) $horas;
            if ($horas <= 0) {
                return null;
            }

            return $horas % 24 === 0 ? ($horas / 24) . ' ' . ($horas === 24 ? 'dia' : 'dias') : $horas . ' ' . ($horas === 1 ? 'hora' : 'horas');
        };

        $regras = [
            ['icone' => 'clock', 'texto' => $item->horario_inicio || $item->horario_fim ? 'Atendimento: ' . $this->juntar([$h($item->horario_inicio), $h($item->horario_fim)], ' às ') : null],
            ['icone' => 'clock', 'texto' => $h($item->horario_limite_devolucao) ? 'Devolução até as ' . $h($item->horario_limite_devolucao) : null],
            ['icone' => 'calendar', 'texto' => $duracao($item->antecedencia_reserva_horas) ? 'Reserve com pelo menos ' . $duracao($item->antecedencia_reserva_horas) . ' de antecedência' : null],
            ['icone' => 'calendar', 'texto' => $duracao($item->duracao_minima_horas) ? 'Mínimo de ' . $duracao($item->duracao_minima_horas) : null],
            ['icone' => 'calendar', 'texto' => $duracao($item->duracao_maxima_horas) ? 'Máximo de ' . $duracao($item->duracao_maxima_horas) : null],
            ['icone' => 'users', 'texto' => $item->capacidade_pessoas && $perfil !== 'veiculo' ? 'Até ' . $item->capacidade_pessoas . ' pessoas' : null],
            ['icone' => 'doc', 'texto' => $item->exige_contrato ? 'É preciso assinar um contrato antes da retirada' : null],
            ['icone' => 'shield', 'texto' => (float) $item->valor_caucao > 0 ? 'Caução de R$ ' . number_format((float) $item->valor_caucao, 2, ',', '.') . ', devolvida no fim' : null],
            ['icone' => 'pet', 'texto' => $perfil === 'hospedagem' ? ($item->aceita_pet ? 'Pets são bem-vindos' : 'Pets não permitidos') : null],
            ['icone' => 'star', 'texto' => $item->somente_premium ? 'Exclusivo para assinantes Premium' : null],
        ];

        return array_values(array_filter($regras, fn ($r) => $r['texto']));
    }

    /** Onde retirar e onde devolver (itens móveis). Sem endereço próprio: "no local" ou combinar. */
    private function pontoDeEntrega(ItemAluguel $item, string $tipo, $local): ?array
    {
        if (!ItemAluguel::categoriaPermiteEntrega($item->categoria)) {
            return null;
        }

        $endereco = $this->juntar([
            $this->juntar([$item->{"rua_{$tipo}"}, $item->{"numero_{$tipo}"}, $item->{"complemento_{$tipo}"}]),
            $item->{"bairro_{$tipo}"},
            $this->juntar([$item->{"cidade_{$tipo}"}, $item->{"estado_{$tipo}"}], ' - '),
        ]);

        $horario = $tipo === 'retirada'
            ? ($item->horario_retirada ? substr((string) $item->horario_retirada, 0, 5) : null)
            : ($item->horario_entrega ? substr((string) $item->horario_entrega, 0, 5) : ($item->horario_limite_devolucao ? substr((string) $item->horario_limite_devolucao, 0, 5) : null));

        return [
            'endereco' => $endereco ?: ($local ? trim($local->nome . ' — ' . $this->juntar([$local->rua, $local->numero, $local->bairro, $local->cidade]), ' —') : null),
            'combinar' => !$endereco && !$local,
            'horario' => $horario,
        ];
    }

    private function lista($valor): array
    {
        $lista = is_array($valor) ? $valor : (json_decode((string) $valor, true) ?: []);
        if (is_string($lista)) {
            $lista = json_decode($lista, true) ?: [];
        }

        return array_values(array_filter(array_map(fn ($v) => is_string($v) ? trim($v) : null, (array) $lista)));
    }

    private function texto(?string $v): ?string
    {
        $v = trim((string) $v);

        return $v !== '' ? $v : null;
    }

    private function juntar(array $partes, string $sep = ', '): string
    {
        return implode($sep, array_filter(array_map(fn ($p) => trim((string) $p), $partes), fn ($p) => $p !== ''));
    }

    private function rotuloCategoria(?string $c): ?string
    {
        return $c ? ucfirst(str_replace('_', ' ', $c)) : null;
    }
}

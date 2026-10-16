<?php

namespace App\Console\Commands;

use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use App\Services\GeocodificacaoService;
use Illuminate\Console\Command;

/** Completa latitude/longitude dos locais e reservas antigos a partir do endereço (uma vez, ou de tempos em tempos). */
class GeocodificarLocacoes extends Command
{
    protected $signature = 'locacoes:geocodificar {--limite=500 : Máximo de registros por execução}';

    protected $description = 'Preenche as coordenadas dos locais e das reservas que ainda não têm latitude/longitude';

    public function handle(GeocodificacaoService $geo): int
    {
        if (!$geo->ativo()) {
            $this->warn('Geocodificação desligada: configure MAPBOX_ACCESS_TOKEN (e MAPBOX_GEOCODIFICAR=true).');

            return self::SUCCESS;
        }

        $limite = (int) $this->option('limite');
        $locais = 0;
        $itens = 0;

        Estabelecimento::where(fn ($q) => $q->whereNull('latitude')->orWhereNull('longitude'))
            ->whereNotNull('cidade')->limit($limite)->get()
            ->each(function (Estabelecimento $e) use ($geo, &$locais) {
                $locais += (int) $geo->preencherEstabelecimento($e);
                usleep(120000); // respeita o limite de requisições do Mapbox
            });

        ItemAluguel::where(fn ($q) => $q->whereNull('latitude')->orWhereNull('longitude'))
            ->where(fn ($q) => $q->whereNotNull('cidade')->orWhereNotNull('local_id'))->limit($limite)->get()
            ->each(function (ItemAluguel $i) use ($geo, &$itens) {
                $itens += (int) $geo->preencherItem($i);
                usleep(120000);
            });

        $this->info("Coordenadas preenchidas: {$locais} local(is) e {$itens} reserva(s).");

        return self::SUCCESS;
    }
}

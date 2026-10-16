<?php

namespace App\Services;

use App\Models\Estabelecimento;
use App\Models\ItemAluguel;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Endereço → coordenadas (Mapbox Geocoding), para os locais e as reservas que ainda não têm latitude/longitude.
 * Sem coordenada, a locação continua aparecendo nas buscas por cidade — só fica fora das buscas por distância.
 */
class GeocodificacaoService
{
    private const URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';

    public function ativo(): bool
    {
        return (bool) config('services.mapbox.geocodificar') && filled(config('services.mapbox.token'));
    }

    /** @return array{0: float, 1: float}|null [lat, lng] */
    public function coordenadas(?string ...$partes): ?array
    {
        $endereco = collect($partes)->map(fn ($p) => trim((string) $p))->filter()->implode(', ');
        if (!$this->ativo() || mb_strlen($endereco) < 4) {
            return null;
        }

        return Cache::remember('geocod:' . md5(mb_strtolower($endereco)), now()->addDays(30), function () use ($endereco) {
            try {
                $resposta = Http::timeout(5)->get(self::URL . rawurlencode($endereco) . '.json', [
                    'access_token' => config('services.mapbox.token'),
                    'country' => 'br',
                    'language' => 'pt',
                    'limit' => 1,
                ]);
                $centro = $resposta->successful() ? ($resposta->json('features.0.center') ?? null) : null;

                return is_array($centro) && count($centro) === 2 ? [(float) $centro[1], (float) $centro[0]] : null;
            } catch (\Throwable $e) {
                Log::info('Geocodificação indisponível: ' . $e->getMessage());

                return null;
            }
        });
    }

    /** Preenche latitude/longitude de um local a partir do endereço (sem disparar eventos). */
    public function preencherEstabelecimento(Estabelecimento $e): bool
    {
        if ($e->latitude && $e->longitude) {
            return false;
        }
        $ponto = $this->coordenadas(trim(($e->rua ?? '') . ' ' . ($e->numero ?? '')), $e->bairro, $e->cidade, $e->estado, $e->cep);
        if (!$ponto) {
            return false;
        }
        Estabelecimento::whereKey($e->id)->update(['latitude' => $ponto[0], 'longitude' => $ponto[1]]);

        return true;
    }

    /** Reserva sem endereço próprio herda o ponto do local (quando o item é de um local). */
    public function preencherItem(ItemAluguel $i): bool
    {
        if ($i->latitude && $i->longitude) {
            return false;
        }
        $ponto = $this->coordenadas(trim(($i->endereco ?? '') . ' ' . ($i->numero ?? '')), $i->bairro, $i->cidade, $i->estado, $i->cep);
        if (!$ponto && $i->local_id) {
            $local = Estabelecimento::find($i->local_id);
            if ($local && !$local->latitude) {
                $this->preencherEstabelecimento($local);
                $local->refresh();
            }
            $ponto = $local && $local->latitude ? [(float) $local->latitude, (float) $local->longitude] : null;
        }
        if (!$ponto) {
            return false;
        }
        ItemAluguel::withoutGlobalScopes()->whereKey($i->id)->update(['latitude' => $ponto[0], 'longitude' => $ponto[1]]);

        return true;
    }
}

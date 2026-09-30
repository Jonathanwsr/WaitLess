<?php

namespace App\Services;

use Illuminate\Support\Str;

/**
 * "Áreas" do Explorar: agrupamentos por tipo de oferta (hotéis, casas, lugares, passeios, veículos).
 * Cada área junta as categorias de locação (itens_aluguel.categoria) e os ramos de atuação dos
 * estabelecimentos (para os serviços) que pertencem a ela.
 */
class AreasExplorar
{
    public const AREAS = [
        'hoteis' => [
            'rotulo' => 'Hotéis', 'icone' => 'bed',
            'categorias' => ['flat', 'apartamento', 'kitnet', 'cobertura', 'chalé', 'cabana'],
            'ramos' => ['hotel', 'pousada', 'hospedagem', 'hostel', 'resort', 'flat'],
        ],
        'casas' => [
            'rotulo' => 'Casas', 'icone' => 'home',
            'categorias' => ['casa', 'casa_praia', 'sitio', 'chacara'],
            'ramos' => ['casa', 'temporada', 'imobili'],
        ],
        'lugares' => [
            'rotulo' => 'Lugares', 'icone' => 'business',
            'categorias' => ['sala', 'auditorio', 'espaco_eventos', 'salão_festas', 'quadra', 'quadra_futebol', 'quadra_volei', 'academia'],
            'ramos' => ['evento', 'espaco', 'quadra', 'festa', 'coworking', 'academia'],
        ],
        'passeios' => [
            'rotulo' => 'Passeios', 'icone' => 'boat',
            'categorias' => ['barco', 'lancha', 'bicicleta', 'bicicleta_eletrica', 'patinete', 'patinete_eletrico'],
            'ramos' => ['turismo', 'passeio', 'lazer', 'aventura', 'tour', 'viagem', 'mergulho'],
        ],
        'veiculos' => [
            'rotulo' => 'Veículos', 'icone' => 'car',
            'categorias' => ['carro', 'moto', 'van', 'motorhome', 'trailer', 'caminhao'],
            'ramos' => ['automotivo', 'veiculo', 'locadora', 'carro', 'moto'],
        ],
    ];

    public static function existe(?string $chave): bool
    {
        return $chave !== null && isset(self::AREAS[$chave]);
    }

    public static function categorias(string $chave): array
    {
        return self::AREAS[$chave]['categorias'] ?? [];
    }

    public static function ramos(string $chave): array
    {
        return self::AREAS[$chave]['ramos'] ?? [];
    }

    /** Um ramo de atuação pertence à área? (comparação sem acento, por trecho) */
    public static function ramoPertence(?string $ramo, string $chave): bool
    {
        $r = Str::of((string) $ramo)->ascii()->lower()->value();

        foreach (self::ramos($chave) as $trecho) {
            if ($r !== '' && str_contains($r, $trecho)) {
                return true;
            }
        }

        return false;
    }

    public static function normalizar(?string $texto): string
    {
        return Str::of((string) $texto)->ascii()->lower()->replaceMatches('/[^a-z0-9 ]/', '')->squish()->value();
    }

    /** "Maceió" e "maceio" são a mesma cidade; aceita também "Maceió, AL". */
    public static function mesmaCidade(?string $procurada, ?string $cidade): bool
    {
        $a = self::normalizar($procurada);
        $b = self::normalizar($cidade);

        return $a !== '' && $b !== '' && ($a === $b || str_contains($a, $b) || str_contains($b, $a));
    }
}

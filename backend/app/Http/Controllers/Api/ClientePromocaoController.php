<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Promocao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class ClientePromocaoController extends Controller
{
    /**
     * Lista as promoções vigentes e elegíveis para o usuário logado — nunca
     * mostra uma promoção expirada, esgotada ou fora do público-alvo. Usado
     * tanto pela tela web quanto pelo endpoint JSON do mobile.
     */
    public static function montarLista($user): array
    {
        $papel = strtolower((string) ($user->papel ?? ''));
        $ehProprietario = in_array($papel, ['socio', 'proprietario', 'gerente']);

        $promocoes = Promocao::vigentes()
            ->where(function ($q) use ($ehProprietario) {
                $q->where('publico_alvo', 'todos')
                    ->orWhere('publico_alvo', $ehProprietario ? 'proprietarios' : 'clientes');
            })
            ->orderByDesc('created_at')
            ->get();

        return $promocoes->map(function ($promo) use ($user) {
            $elegivel = !$promo->plano_necessario || $promo->plano_necessario === $user->plano_assinatura;

            return [
                'id' => $promo->id,
                'nome' => $promo->nome,
                'descricao' => $promo->descricao,
                'tipo' => $promo->tipo,
                'quantidade_pontos' => $promo->quantidade_pontos,
                'desconto_percentual' => $promo->desconto_percentual,
                'desconto_valor' => $promo->desconto_valor,
                'plano_necessario' => $promo->plano_necessario,
                'data_fim' => $promo->data_fim,
                'condicoes' => $promo->condicoes,
                'imagem' => $promo->imagem,
                'elegivel' => $elegivel,
            ];
        })->values()->all();
    }

    public function index(Request $request)
    {
        return Inertia::render('Cliente/Promocoes', [
            'promocoes' => self::montarLista($request->user()),
        ]);
    }
}

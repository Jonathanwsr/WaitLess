<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Pagamento;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ClienteController extends Controller
{
    public function detalhes($id)
    {
        // ==========================================
        // TRAVA DE SEGURANÇA: Verifica quem está logado
        // ==========================================
        $usuarioLogado = auth()->user();
        $papeisPermitidos = ['admin', 'gerente', 'socio', 'atendente'];

        if (!$usuarioLogado || !in_array($usuarioLogado->papel, $papeisPermitidos)) {
            abort(403, 'Acesso negado. Apenas administradores, gerentes, sócios ou atendentes podem acessar esses dados.');
        }
        // ==========================================

        // 1. Busca o cliente
        $cliente = User::findOrFail($id);

        // 2. Busca os pagamentos do usuário excluindo estornos
        $pagamentos = Pagamento::with(['agendamento.servico'])
            ->where('usuario_id', $cliente->id)
            ->where('status', '!=', 'estornado')
            ->where(function ($query) {
                $query->whereNull('status_estorno')
                      ->orWhere('status_estorno', '!=', 'estornado');
            })
            ->get();

        // 3. Renderiza a tela no React enviando os dados como props
        return Inertia::render('Estabelecimentos/PerfilCliente', [
            'cliente' => [
                'id'                    => $cliente->id,
                'name'                  => $cliente->name,
                'email'                 => $cliente->email,
                'telefone'              => $cliente->telefone,
                'numero_servicos'       => $cliente->numero_servicos,
                'numero_reservas'       => $cliente->numero_reservas,
                'cpf_cnpj'              => $cliente->cpf_cnpj,
                'mobile_phone'          => $cliente->mobile_phone,
                'phone'                 => $cliente->phone,
                'postal_code'           => $cliente->postal_code,
                'address'               => $cliente->address,
                'address_number'        => $cliente->address_number,
                'complement'            => $cliente->complement,
                'province'              => $cliente->province,
                'city'                  => $cliente->city,
                'state'                 => $cliente->state,
                'person_type'           => $cliente->person_type,
                'birth_date'            => $cliente->birth_date,
                'notification_disabled' => $cliente->notification_disabled,
                'foto'                  => $cliente->foto ?? $cliente->profile_photo_url ?? null,
            ],
            'agendamentos' => $cliente->agendamentos,
            'pagamentos'   => $pagamentos,
        ]);
    }
}
<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProfileUpdateRequest;
use App\Services\ImageKitService;
use Carbon\Carbon;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Profile/Edit', [
            'mustVerifyEmail' => $user instanceof MustVerifyEmail,
            'status' => session('status'),
            
            // Agrupamos os dados para facilitar a exibição e bloqueio no Front-end
            'profile' => [
                // Campos Gerais (Editáveis - Regra de 15 dias)
                'name' => $user->name,
                'cpf_cnpj' => $user->cpf_cnpj,
                'telefone' => $user->telefone,
                'mobile_phone' => $user->mobile_phone,
                'phone' => $user->phone,
                'birth_date' => $user->birth_date,
                'person_type' => $user->person_type,
                'onde_estudei' => $user->onde_estudei,
                'onde_moro' => $user->onde_moro,
                'idiomas' => $user->idiomas,
                'profissao' => $user->profissao,
                'sobre_mim' => $user->sobre_mim,
                'foto_perfil' => $user->foto_perfil,
                
                // E-mail e Endereço (Editáveis - Regra de 30 dias)
                'email' => $user->email,
                'cep' => $user->cep,
                'endereco' => $user->endereco,
                'bairro' => $user->bairro,
                'referencia' => $user->referencia,
                'cidade' => $user->cidade,
                'estado' => $user->estado,
                'postal_code' => $user->postal_code,
                'address' => $user->address,
                'address_number' => $user->address_number,
                'complement' => $user->complement,
                'province' => $user->province,

                // Apenas Leitura (Assinaturas, Saldos e Papel)
                'plano_assinatura' => $user->plano_assinatura,
                'plano_expira_em' => $user->plano_expira_em,
                'pontos_saldo' => $user->pontos_saldo,
                'numero_servicos' => $user->numero_servicos,
                'numero_reservas' => $user->numero_reservas,
                'papel' => $user->papel,

                // Datas de controle (Útil para o front-end desabilitar os inputs)
                'last_profile_update' => $user->last_profile_update,
                'last_address_email_update' => $user->last_address_email_update ?? null,
            ]
        ]);
    }

    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        // 1. Definição dos grupos de campos para checagem
        $generalFields = ['name', 'cpf_cnpj', 'telefone', 'mobile_phone', 'phone', 'birth_date', 'person_type', 'onde_estudei', 'onde_moro', 'idiomas', 'profissao', 'sobre_mim'];
        $addressEmailFields = ['email', 'cep', 'endereco', 'bairro', 'referencia', 'cidade', 'estado', 'postal_code', 'address', 'address_number', 'complement', 'province'];

        // 2. Verifica quais grupos sofreram alterações
        $hasGeneralChanges = collect($validated)->only($generalFields)->filter(fn($value, $key) => $user->{$key} !== $value)->isNotEmpty();
        $hasAddressEmailChanges = collect($validated)->only($addressEmailFields)->filter(fn($value, $key) => $user->{$key} !== $value)->isNotEmpty();

        // 3. Travas de Tempo
        if ($hasGeneralChanges && $user->last_profile_update && Carbon::parse($user->last_profile_update)->diffInDays(now()) < 15) {
            return Redirect::route('profile.edit')->withErrors([
                'geral' => 'Você só pode alterar as informações gerais do perfil uma vez a cada 15 dias.'
            ]);
        }

        if ($hasAddressEmailChanges && $user->last_address_email_update && Carbon::parse($user->last_address_email_update)->diffInDays(now()) < 30) {
            return Redirect::route('profile.edit')->withErrors([
                'endereco_email' => 'Você só pode alterar seu e-mail e endereço uma vez a cada 30 dias.'
            ]);
        }

        // 4. Preenche os dados validados
        $user->fill($validated);

        // 5. Reseta verificação se o e-mail mudar
        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        // 6. Upload e Substituição da foto via ImageKit
        if ($request->hasFile('foto_perfil')) {
            // Verifica se o usuário já possui uma foto para excluí-la
            if ($user->foto_perfil) {
                // Descomente e ajuste de acordo com o método de delete do seu ImageKitService
                // ImageKitService::delete($user->foto_perfil);
            }
            
            $url = ImageKitService::upload($request->file('foto_perfil'), '/waitless/usuarios');
            $user->foto_perfil = $url;
        }

        // 7. Atualização no Asaas
        if ($user->asaas_customer_id && ($user->isDirty('cpf_cnpj') || $user->isDirty('name') || $user->isDirty('email') || $hasAddressEmailChanges)) {
            // AsaasService::updateCustomer(...)
            $user->last_asaas_update = now();
        }

        // 8. Atualiza os timestamps de controle
        if ($hasGeneralChanges) {
            $user->last_profile_update = now();
        }
        if ($hasAddressEmailChanges) {
            $user->last_address_email_update = now();
        }

        $user->save();

        return Redirect::route('profile.edit')->with('status', 'profile-updated');
    }

    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();
        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return Redirect::to('/');
    }
}
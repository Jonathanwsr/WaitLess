<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProfileUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', Rule::unique(User::class)->ignore($this->user()->id)],
            'cpf_cnpj' => ['nullable', 'string', 'max:20'],
            'foto_perfil' => ['nullable', 'image', 'mimes:jpeg,png,jpg,gif', 'max:2048'], // Validação da imagem
            'telefone' => ['nullable', 'string', 'max:20'],
            'birth_date' => ['nullable', 'date'],
            'cep' => ['nullable', 'string', 'max:10'],
            'endereco' => ['nullable', 'string', 'max:255'],
            'bairro' => ['nullable', 'string', 'max:255'],
            'cidade' => ['nullable', 'string', 'max:255'],
            'estado' => ['nullable', 'string', 'max:2'],
            'referencia' => ['nullable', 'string', 'max:255'],
            'onde_estudei' => ['nullable', 'string', 'max:255'],
            'onde_moro' => ['nullable', 'string', 'max:255'],
            'idiomas' => ['nullable', 'string', 'max:255'],
            'profissao' => ['nullable', 'string', 'max:255'],
            'sobre_mim' => ['nullable', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'O seu nome é obrigatório.',
            'email.required' => 'Precisamos do seu e-mail para contato.',
            'email.unique' => 'Este e-mail já está sendo usado por outra pessoa.',
            'foto_perfil.image' => 'O arquivo enviado deve ser uma imagem válida.',
            'foto_perfil.max' => 'A foto de perfil não pode ter mais de 2MB.',
            'birth_date.date' => 'A data de nascimento não é válida.',
        ];
    }
}
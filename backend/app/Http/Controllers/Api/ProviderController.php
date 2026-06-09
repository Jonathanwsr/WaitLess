<?php


namespace App\Http\Controllers\Api;

namespace App\Http\Controllers;

use App\Models\Provider;
use Illuminate\Http\Request;

class ProviderController extends Controller
{
    public function store(Request $request)
    {
        // Validação Extremamente Restrita
        $validated = $request->validate([
            // Aceita apenas letras (incluindo acentos) e espaços. Sem números, emojis ou símbolos.
            'name' => ['required', 'string', 'max:255', 'regex:/^[a-zA-ZÀ-ÿ\s]+$/'],
            
            'email' => 'required|email|unique:providers,email',
            
            // Garante que o documento tenha apenas números após a limpeza (sem letras ou scripts escondidos)
            'document' => ['required', 'string'], 
            
            'pix_key_type' => 'required|in:CPF,CNPJ,EMAIL,PHONE,RANDOM',
            
            // Bloqueia as tags < e > (evita XSS injection)
            'pix_key' => ['required', 'string', 'max:255', 'regex:/^[^<>]+$/'], 
        ], [
            'name.regex' => 'O nome deve conter apenas letras.',
            'pix_key.regex' => 'A chave Pix contém caracteres inválidos.'
        ]);

        $cleanDocument = preg_replace('/[^0-9]/', '', $validated['document']);

        $provider = Provider::create([
            'user_id' => $request->user()->id, 
            'name' => $validated['name'],
            'email' => $validated['email'],
            'document' => $cleanDocument,
            'pix_key_type' => $validated['pix_key_type'],
            'pix_key' => trim($validated['pix_key']), // Remove espaços acidentais nas pontas
        ]);

        return response()->json([
            'message' => 'Dados de recebimento salvos com segurança.',
            'provider' => $provider
        ], 201);
    }
}
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAdmin
{
   
    public function handle(Request $request, Closure $next): Response
    {
       
        if (auth()->check() && auth()->user()->papel === 'admin') {
            return $next($request); 
        }

      
        abort(403, 'Acesso restrito. Apenas administradores do sistema podem visualizar esta página.');
    }
}
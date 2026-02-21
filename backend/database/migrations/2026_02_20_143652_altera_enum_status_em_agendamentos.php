<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
     
        DB::statement('ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check');
        
        
        DB::statement("ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_status_check CHECK (status::text = ANY (ARRAY['pendente'::character varying, 'confirmado'::character varying, 'finalizado'::character varying, 'cancelado'::character varying, 'aguardando_pagamento'::character varying]::text[]))");
    }

    public function down(): void
    {
      
        DB::statement('ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_status_check');
        
        DB::statement("ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_status_check CHECK (status::text = ANY (ARRAY['pendente'::character varying, 'confirmado'::character varying, 'finalizado'::character varying, 'cancelado'::character varying]::text[]))");
    }
};
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {

            $table->string('cpf_cnpj', 18)->nullable()->after('email');

            $table->string('mobile_phone', 20)->nullable()->after('cpf_cnpj');

            $table->string('phone', 20)->nullable()->after('mobile_phone');

            $table->string('postal_code', 10)->nullable()->after('phone');

            $table->string('address')->nullable()->after('postal_code');

            $table->string('address_number', 20)->nullable()->after('address');

            $table->string('complement')->nullable()->after('address_number');

            $table->string('province')->nullable()->after('complement');

            $table->string('city')->nullable()->after('province');

            $table->char('state', 2)->nullable()->after('city');

            $table->enum('person_type', ['FISICA', 'JURIDICA'])
                  ->default('FISICA')
                  ->after('state');

            $table->date('birth_date')->nullable()->after('person_type');

            $table->boolean('notification_disabled')
                  ->default(false)
                  ->after('birth_date');

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {

            $table->dropColumn([
                'cpf_cnpj',
                'mobile_phone',
                'phone',
                'postal_code',
                'address',
                'address_number',
                'complement',
                'province',
                'city',
                'state',
                'person_type',
                'birth_date',
                'notification_disabled',
            ]);

        });
    }
};
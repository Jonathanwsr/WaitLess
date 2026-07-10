<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
public function up()
{
    Schema::table('providers', function (Blueprint $table) {
        // Cria o campo do tipo 'date' logo após o campo 'document'
        $table->date('birth_date')->nullable()->after('document');
    });
}

public function down()
{
    Schema::table('providers', function (Blueprint $table) {
        $table->dropColumn('birth_date');
    });
}
};

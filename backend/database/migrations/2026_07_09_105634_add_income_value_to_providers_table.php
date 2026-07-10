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
        $table->decimal('income_value', 10, 2)->nullable()->after('birth_date');
    });
}

public function down()
{
    Schema::table('providers', function (Blueprint $table) {
        $table->dropColumn('income_value');
    });
}
};

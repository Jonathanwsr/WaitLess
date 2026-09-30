<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;

abstract class TestCase extends BaseTestCase
{
    /**
     * Trava de segurança: um teste já rodou RefreshDatabase (migrate:fresh)
     * contra o banco de desenvolvimento de verdade uma vez, porque o
     * phpunit.xml apontava pra ele, e apagou todos os dados. Isso barra
     * QUALQUER teste antes mesmo de rodar se o banco configurado não for
     * claramente um banco de teste — não importa o que phpunit.xml diga no
     * futuro, nem se alguém rodar com um .env.testing diferente.
     */
    protected function setUp(): void
    {
        parent::setUp();

        $database = (string) config('database.connections.' . config('database.default') . '.database');

        if ($database !== '' && $database !== ':memory:' && !str_contains($database, 'test')) {
            self::fail(
                "Testes travados por segurança: o banco configurado é \"{$database}\", que não parece ser um banco de teste " .
                "(o nome precisa conter \"test\"). Isso existe porque um teste com RefreshDatabase já rodou migrate:fresh " .
                "contra o banco de desenvolvimento real e apagou todos os dados. Configure DB_DATABASE para um banco " .
                "dedicado a testes antes de rodar a suíte."
            );
        }
    }
}

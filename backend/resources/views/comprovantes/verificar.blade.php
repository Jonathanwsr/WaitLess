<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verificar comprovante · Lokyva</title>
    <style>
        :root { --fundo: #f5f5f5; --card: #fff; --texto: #18181b; --suave: #71717a; --marca: #FF7A00; }
        @media (prefers-color-scheme: dark) { :root { --fundo: #18181b; --card: #27272a; --texto: #fafafa; --suave: #a1a1aa; } }
        body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background: var(--fundo); color: var(--texto); }
        main { max-width: 440px; margin: 40px auto; padding: 0 16px; }
        .card { background: var(--card); border-radius: 20px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .marca { color: var(--marca); font-weight: 900; font-size: 22px; margin-bottom: 16px; }
        p { color: var(--suave); font-size: 14px; }
        form { display: flex; gap: 8px; margin-top: 16px; }
        input { flex: 1; min-width: 0; padding: 12px; border-radius: 12px; border: 1px solid #d4d4d8; font-size: 14px; background: transparent; color: inherit; }
        button { padding: 12px 16px; border: 0; border-radius: 12px; background: var(--marca); color: #fff; font-weight: 800; cursor: pointer; }
        .ok, .erro { margin-top: 18px; padding: 14px; border-radius: 14px; font-size: 14px; }
        .ok { background: #ecfdf5; color: #065f46; }
        .erro { background: #fef2f2; color: #991b1b; }
        dl { margin: 8px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; }
        dt { font-weight: 700; }
        dd { margin: 0; }
    </style>
</head>
<body>
<main>
    <div class="card">
        <div class="marca">Lokyva.</div>
        <h1>Verificar comprovante</h1>
        <p>Digite o código de autenticação que aparece no comprovante de pagamento.</p>
        <form method="get">
            <input name="codigo" value="{{ $codigo }}" placeholder="LKY-123-ABCDEF0123456789" autocomplete="off" required>
            <button type="submit">Verificar</button>
        </form>

        @if ($codigo !== '')
            @if ($resultado)
                <div class="ok">
                    <strong>Comprovante autêntico.</strong>
                    <dl>
                        <dt>Situação</dt><dd>{{ $resultado['situacao'] }}</dd>
                        <dt>Valor</dt><dd>R$ {{ number_format($resultado['valor'], 2, ',', '.') }}</dd>
                        <dt>Data</dt><dd>{{ $resultado['data'] }}</dd>
                        <dt>Recebedor</dt><dd>{{ $resultado['recebedor'] }}</dd>
                    </dl>
                </div>
            @else
                <div class="erro"><strong>Código não encontrado.</strong> Este comprovante não foi emitido pela Lokyva ou foi alterado.</div>
            @endif
        @endif
    </div>
</main>
</body>
</html>

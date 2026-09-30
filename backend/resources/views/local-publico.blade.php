<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $local->nome }} · Agende no Lokyva</title>
    <meta name="description" content="{{ $descricao }}">

    {{-- Prévia ao compartilhar no WhatsApp, Instagram, Facebook, Telegram... --}}
    <meta property="og:type" content="website">
    <meta property="og:title" content="{{ $local->nome }} · Agende no Lokyva">
    <meta property="og:description" content="{{ $descricao }}">
    <meta property="og:url" content="{{ $urlPagina }}">
    @if($foto)<meta property="og:image" content="{{ $foto }}">@endif
    <meta name="twitter:card" content="summary_large_image">

    <style>
        :root { --laranja:#FF7A00; --tinta:#282828; --cinza:#6A6C72; --linha:#E6E7E9; --fundo:#F5F5F5; }
        * { box-sizing: border-box; }
        body { margin:0; font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background: var(--fundo); color: var(--tinta); }
        .capa { height: 220px; background: #FFE3CC center/cover no-repeat; }
        .cartao { max-width: 560px; margin: -56px auto 0; padding: 0 16px 120px; position: relative; }
        .topo { background:#fff; border-radius: 28px; padding: 22px; box-shadow: 0 8px 30px rgba(0,0,0,.08); }
        .avatar { width: 72px; height: 72px; border-radius: 22px; background: #FFF1E4; color: var(--laranja); display:flex; align-items:center; justify-content:center; font-size: 30px; font-weight: 800; overflow:hidden; margin-top: -58px; border: 4px solid #fff; }
        .avatar img { width:100%; height:100%; object-fit:cover; }
        h1 { margin: 12px 0 4px; font-size: 26px; letter-spacing: -.5px; }
        .sub { color: var(--cinza); font-size: 14px; }
        .nota { display:inline-block; margin-top: 10px; background:#FFF1E4; color:#C2570A; font-weight:700; font-size:13px; padding:6px 12px; border-radius: 14px; }
        h2 { font-size: 16px; margin: 26px 4px 10px; }
        .servico { background:#fff; border-radius: 20px; padding: 16px; margin-bottom: 10px; display:flex; justify-content:space-between; gap: 12px; align-items:center; box-shadow: 0 4px 14px rgba(0,0,0,.05); border: 2px solid transparent; }
        .servico.destaque { border-color: var(--laranja); }
        .servico b { font-size: 15px; } .servico small { color: var(--cinza); display:block; margin-top: 2px; }
        .preco { font-weight: 800; white-space: nowrap; }
        .barra { position: fixed; left:0; right:0; bottom:0; padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); background:#fff; box-shadow: 0 -8px 24px rgba(0,0,0,.08); border-radius: 24px 24px 0 0; }
        .btn { display:block; max-width: 528px; margin: 0 auto; text-align:center; background: var(--laranja); color:#fff; text-decoration:none; font-weight:800; font-size:16px; padding: 16px; border-radius: 999px; }
        .rodape { text-align:center; color:#A0A2A8; font-size: 12px; margin-top: 24px; }
    </style>
</head>
<body>
    <div class="capa" @if($foto) style="background-image:url('{{ $foto }}')" @endif></div>

    <main class="cartao">
        <section class="topo">
            <div class="avatar">
                @if($local->foto_perfil)<img src="{{ $local->foto_perfil }}" alt="">@else{{ mb_strtoupper(mb_substr($local->nome, 0, 1)) }}@endif
            </div>
            <h1>{{ $local->nome }}</h1>
            <div class="sub">{{ $local->ramo_atuacao }}@if($local->ramo_atuacao && $cidade) · @endif{{ $cidade }}</div>
            @if(($local->total_avaliacoes ?? 0) > 0)
                <span class="nota">★ {{ number_format((float) $local->avaliacao_media, 1, ',', '') }} · {{ $local->total_avaliacoes }} {{ $local->total_avaliacoes == 1 ? 'avaliação' : 'avaliações' }}</span>
            @endif
        </section>

        @if($servicos->isNotEmpty())
            <h2>Serviços</h2>
            @foreach($servicos as $s)
                <a class="servico {{ $destaque && $destaque->id === $s->id ? 'destaque' : '' }}" href="{{ route('cliente.agendar', $local->id) }}?servico={{ $s->id }}" style="text-decoration:none;color:inherit">
                    <div>
                        <b>{{ $s->nome }}</b>
                        <small>{{ $s->duracao_minutos }} min</small>
                    </div>
                    <span class="preco">R$ {{ number_format((float) $s->valor, 2, ',', '.') }}</span>
                </a>
            @endforeach
        @endif

        <p class="rodape">Agendamento online pelo Lokyva · pagamento seguro</p>
    </main>

    <div class="barra"><a class="btn" href="{{ $urlAgendar }}">Agendar agora</a></div>
</body>
</html>

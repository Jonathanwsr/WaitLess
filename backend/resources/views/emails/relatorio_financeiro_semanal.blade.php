<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #FF5A00;">Seu resumo financeiro chegou 📊</h2>
    <p>Olá! Segue em anexo o balanço completo da sua semana ({{ $relatorio->semana_inicio->format('d/m') }} a {{ $relatorio->semana_fim->format('d/m/Y') }}) na Lokyva.</p>

    <div style="background: #FFF3EC; border-radius: 10px; padding: 18px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 600;">Receita líquida da semana</p>
        <p style="margin: 0; font-size: 28px; font-weight: 700; color: #FF5A00;">R$ {{ number_format($relatorio->receita_liquida_total, 2, ',', '.') }}</p>
    </div>

    <p>O detalhamento completo (agendamentos, locações via estabelecimento e locações avulsas) está no PDF em anexo.</p>

    <a href="{{ route('tela.financeiro.extrato') }}" style="background-color: #FF5A00; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 10px;">Ver extrato completo</a>

    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">
        Você recebe este e-mail toda semana por ser assinante do plano Premium. Se cancelar sua assinatura, o envio para automaticamente.
    </p>
</div>

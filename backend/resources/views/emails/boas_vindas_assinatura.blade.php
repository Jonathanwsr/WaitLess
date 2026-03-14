<div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #4f46e5;">Olá, {{ $user->name }}! 🎉</h2>
    <p>O seu pagamento foi aprovado e a sua assinatura <strong>WaitLess {{ $plano }}</strong> já está ativa!</p>
    <p>A partir de agora, você tem acesso a todos os benefícios premium da nossa plataforma.</p>
    <br>
    <a href="{{ route('dashboard') }}" style="background-color: #5be546; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Acessar Minha Conta</a>
    <br><br>
    <p>Obrigado por confiar no WaitLess!</p>
</div>
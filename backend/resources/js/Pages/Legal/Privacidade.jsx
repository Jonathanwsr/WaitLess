import { Head, Link } from '@inertiajs/react';

function Secao({ titulo, children }) {
    return (
        <section className="mb-8">
            <h2 className="text-lg font-black text-gray-900 mb-3">{titulo}</h2>
            <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
        </section>
    );
}

export default function Privacidade() {
    return (
        <div className="min-h-screen bg-[#FAFAFA]">
            <Head title="Política de Privacidade" />

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
                <Link href="/" className="inline-flex items-center gap-2 mb-8">
                    <img src="/images/logo_lokyva.png" alt="Lokyva" className="h-8 object-contain" />
                </Link>

                <div className="bg-white border border-gray-100 rounded-3xl shadow-[0_4px_25px_rgba(0,0,0,0.04)] p-6 sm:p-10">
                    <span className="text-xs font-black text-[#FF5A00] tracking-widest">LGPD</span>
                    <h1 className="text-2xl font-black text-gray-900 mt-2 mb-1">Política de Privacidade</h1>
                    <p className="text-xs text-gray-400 mb-8">Última atualização: 22 de setembro de 2026</p>

                    <Secao titulo="1. Quem somos">
                        <p>
                            A Lokyva é uma plataforma que conecta clientes a estabelecimentos e prestadores de
                            serviço para agendamentos sem fila e locação de itens e veículos. Esta política explica
                            quais dados coletamos, para que usamos e quais direitos você tem sobre eles, em
                            conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
                        </p>
                        <p className="text-xs text-gray-400 italic">
                            [Preencher: razão social, CNPJ e endereço da empresa responsável pelo tratamento dos dados.]
                        </p>
                    </Secao>

                    <Secao titulo="2. Quais dados coletamos">
                        <p><strong className="text-gray-800">Dados de cadastro:</strong> nome, e-mail, telefone, CPF/CNPJ e senha (armazenada de forma criptografada).</p>
                        <p><strong className="text-gray-800">Dados de uso:</strong> agendamentos, reservas, itens no carrinho, avaliações, mensagens trocadas dentro do app e histórico de pedidos.</p>
                        <p><strong className="text-gray-800">Dados de localização:</strong> quando você usa recursos de rastreamento em tempo real (como acompanhar uma entrega ou atendimento a domicílio), coletamos sua localização apenas enquanto o recurso está ativo.</p>
                        <p><strong className="text-gray-800">Dados de pagamento:</strong> os pagamentos são processados por um parceiro de pagamentos especializado; a Lokyva não armazena números completos de cartão de crédito.</p>
                        <p><strong className="text-gray-800">Dados de dispositivo:</strong> informações técnicas do aparelho e identificador de push notification, usados para enviar avisos sobre suas reservas.</p>
                    </Secao>

                    <Secao titulo="3. Para que usamos seus dados">
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Viabilizar agendamentos, locações e pagamentos dentro da plataforma;</li>
                            <li>Enviar notificações sobre o status de reservas, pagamentos e estornos;</li>
                            <li>Exibir rastreamento em tempo real quando o recurso for utilizado;</li>
                            <li>Prevenir fraudes e garantir a segurança da plataforma;</li>
                            <li>Cumprir obrigações legais e fiscais;</li>
                            <li>Melhorar a experiência de uso do aplicativo e do site.</li>
                        </ul>
                    </Secao>

                    <Secao titulo="4. Com quem compartilhamos seus dados">
                        <p>
                            Compartilhamos apenas os dados necessários com: o estabelecimento ou prestador de
                            serviço envolvido na sua reserva (nome, contato e detalhes do pedido); nosso parceiro de
                            processamento de pagamentos, para viabilizar cobranças e estornos; e autoridades
                            públicas, quando exigido por lei. Não vendemos seus dados pessoais a terceiros.
                        </p>
                    </Secao>

                    <Secao titulo="5. Por quanto tempo guardamos seus dados">
                        <p>
                            Mantemos seus dados enquanto sua conta estiver ativa e pelo período adicional exigido
                            por obrigações legais, fiscais e contábeis (geralmente até 5 anos após o encerramento da
                            conta). Após esse prazo, os dados são eliminados ou anonimizados.
                        </p>
                    </Secao>

                    <Secao titulo="6. Seus direitos como titular dos dados">
                        <p>De acordo com a LGPD, você pode a qualquer momento:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Confirmar a existência de tratamento dos seus dados;</li>
                            <li>Acessar, corrigir ou atualizar seus dados cadastrais direto no app;</li>
                            <li>Solicitar a exclusão da sua conta e dos dados associados;</li>
                            <li>Solicitar a portabilidade dos seus dados a outro fornecedor;</li>
                            <li>Revogar consentimentos dados anteriormente, como o de localização em tempo real.</li>
                        </ul>
                        <p>
                            Para exercer qualquer um desses direitos, entre em contato pelo{' '}
                            <a href="mailto:suporte@lokyva.com" className="text-[#FF5A00] font-semibold">suporte@lokyva.com</a>.
                        </p>
                    </Secao>

                    <Secao titulo="7. Segurança dos dados">
                        <p>
                            Adotamos medidas técnicas e administrativas para proteger seus dados contra acessos não
                            autorizados, perda, alteração ou vazamento, incluindo criptografia de senhas e controle
                            de acesso por autenticação.
                        </p>
                    </Secao>

                    <Secao titulo="8. Alterações nesta política">
                        <p>
                            Podemos atualizar esta política periodicamente. Mudanças relevantes serão comunicadas
                            dentro do aplicativo. A data da última atualização está sempre indicada no topo desta
                            página.
                        </p>
                    </Secao>

                    <Secao titulo="9. Contato">
                        <p>
                            Dúvidas sobre esta política ou sobre o tratamento dos seus dados podem ser enviadas
                            para <a href="mailto:suporte@lokyva.com" className="text-[#FF5A00] font-semibold">suporte@lokyva.com</a>.
                        </p>
                    </Secao>
                </div>

                <p className="text-xs text-gray-400 mt-6 text-center">
                    Veja também os <Link href="/termos" className="text-[#FF5A00] font-semibold">Termos de Uso</Link>.
                </p>
            </div>
        </div>
    );
}

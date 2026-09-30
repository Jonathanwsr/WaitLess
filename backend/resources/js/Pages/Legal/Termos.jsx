import { Head, Link, usePage } from '@inertiajs/react';

function Secao({ titulo, children }) {
    return (
        <section className="mb-8">
            <h2 className="text-lg font-black text-gray-900 mb-3">{titulo}</h2>
            <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
        </section>
    );
}

function SubSecao({ titulo, children }) {
    return (
        <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-800 mb-1.5">{titulo}</h3>
            <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
        </div>
    );
}

export default function Termos({ versaoAtual }) {
    const { auth } = usePage().props;
    const versao = versaoAtual || '2.0';

    return (
        <div className="min-h-screen bg-[#FAFAFA]">
            <Head title="Termo de Compromisso" />

            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
                <Link href="/" className="inline-flex items-center gap-2 mb-8">
                    <img src="/images/logo_lokyva.png" alt="Lokyva" className="h-8 object-contain" />
                </Link>

                <div className="bg-white border border-gray-100 rounded-3xl shadow-[0_4px_25px_rgba(0,0,0,0.04)] p-6 sm:p-10">
                    <span className="text-xs font-black text-[#FF5A00] tracking-widest">CONTRATO</span>
                    <h1 className="text-2xl font-black text-gray-900 mt-2 mb-1">Termo de Compromisso</h1>
                    <p className="text-xs text-gray-400 mb-8">Versão {versao} · Última atualização: 22 de setembro de 2026</p>

                    <Secao titulo="1. O que é a Lokyva">
                        <p>
                            A Lokyva é uma plataforma digital que conecta clientes a estabelecimentos, profissionais,
                            proprietários e prestadores de serviços independentes. Através dela você pode agendar
                            serviços sem fila, reservar horários com profissionais, e alugar itens, veículos,
                            equipamentos, espaços e hospedagens diretamente com quem os oferece.
                        </p>
                        <p>
                            A Lokyva atua como intermediadora dessas operações — ela não é a prestadora dos serviços
                            nem a proprietária dos itens anunciados. Cada estabelecimento, profissional ou proprietário
                            é responsável pelo que oferece; a Lokyva viabiliza a descoberta, o agendamento/reserva, o
                            pagamento e a comunicação entre as partes.
                        </p>
                        <p className="text-xs text-gray-400 italic">
                            [Preencher: razão social, CNPJ e endereço da empresa responsável pela plataforma.]
                        </p>
                    </Secao>

                    <Secao titulo="2. Cadastro e conta">
                        <p>
                            Para usar a plataforma é necessário criar uma conta com dados verdadeiros e mantê-los
                            atualizados. Você é responsável por manter sua senha em sigilo e por todas as atividades
                            realizadas na sua conta. Menores de 18 anos devem usar a plataforma com autorização de um
                            responsável legal.
                        </p>
                    </Secao>

                    <Secao titulo="3. Quais dados a Lokyva coleta e por quê">
                        <p>
                            Só coletamos os dados necessários para o funcionamento das funcionalidades que você
                            utiliza. Veja abaixo o que cada grupo de dados é usado para fazer:
                        </p>

                        <SubSecao titulo="Identificação (nome, e-mail, telefone, CPF/CNPJ, data de nascimento)">
                            <p>
                                Usados para criar e proteger sua conta, identificar você nas reservas e agendamentos,
                                emitir comprovantes e, quando aplicável, processar pagamentos junto ao nosso parceiro
                                de pagamentos.
                            </p>
                        </SubSecao>

                        <SubSecao titulo="Endereço e localização (endereço, CEP, cidade, estado, país, coordenadas de GPS)">
                            <p>
                                Usados para encontrar estabelecimentos e serviços próximos de você, melhorar os
                                resultados de busca, calcular distâncias, viabilizar entregas/retiradas e, quando um
                                atendimento ou entrega estiver em andamento, mostrar o rastreamento em tempo real.
                                Localização em tempo real só é coletada enquanto o recurso de rastreamento estiver
                                ativo — nunca em segundo plano sem esse contexto.
                            </p>
                        </SubSecao>

                        <SubSecao titulo="Dados de acesso e dispositivo (login, sessão, identificador de notificação push)">
                            <p>
                                Usados para manter sua sessão segura, prevenir fraudes e acessos indevidos, e enviar
                                notificações sobre o andamento de reservas, pagamentos e estornos.
                            </p>
                        </SubSecao>

                        <SubSecao titulo="Dados de reservas, agendamentos e locações">
                            <p>
                                Histórico de serviços agendados, itens alugados, datas, horários e status, usados para
                                que você acompanhe suas reservas, para que o estabelecimento saiba quem está por vir,
                                e para gerar comprovantes e, quando aplicável, contratos de locação.
                            </p>
                        </SubSecao>

                        <SubSecao titulo="Dados de pagamento">
                            <p>
                                Os pagamentos são processados por um parceiro de pagamentos especializado; a Lokyva não
                                armazena números completos de cartão de crédito. Guardamos o registro da transação
                                (valor, status, forma de pagamento) para emitir comprovantes, calcular repasses e
                                processar eventuais estornos.
                            </p>
                        </SubSecao>

                        <SubSecao titulo="Dados bancários e financeiros de proprietários/prestadores">
                            <p>
                                Quando você cadastra uma conta de recebimento (para receber repasses de reservas),
                                coletamos os dados exigidos pelo parceiro de pagamentos para criar essa conta
                                (documento, endereço, chave PIX, dados da empresa quando pessoa jurídica). Esses dados
                                são usados exclusivamente para viabilizar pagamentos, recebimentos e repasses — nunca
                                para outra finalidade.
                            </p>
                        </SubSecao>

                        <SubSecao titulo="Dados de estabelecimentos, empresas e funcionários">
                            <p>
                                Usados para identificar e validar o estabelecimento, permitir o cadastro da empresa na
                                plataforma, viabilizar pagamentos e repasses, emitir documentos/comprovantes e
                                gerenciar a equipe vinculada a cada estabelecimento.
                            </p>
                        </SubSecao>

                        <SubSecao titulo="Contratos de locação">
                            <p>
                                Quando um estabelecimento gera um contrato para uma locação, os dados da reserva
                                (locatário, item, período, valores) são usados para preencher o documento, que pode
                                ser baixado em PDF ou Word e enviado por e-mail.
                            </p>
                        </SubSecao>

                        <SubSecao titulo="Avaliações, favoritos, histórico, pontos, cupons e promoções">
                            <p>
                                Usados para exibir sua avaliação de estabelecimentos e serviços, guardar seus
                                favoritos, mostrar seu histórico de uso, calcular e exibir seu saldo de pontos, e
                                aplicar cupons e promoções elegíveis à sua conta.
                            </p>
                        </SubSecao>

                        <p className="text-xs text-gray-400 italic">
                            Esta lista reflete os dados realmente usados pelas funcionalidades atuais da plataforma.
                            Se novas funcionalidades passarem a usar outros dados, este termo será atualizado e uma
                            nova versão será apresentada para novo aceite.
                        </p>
                    </Secao>

                    <Secao titulo="4. Pagamentos">
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Ao confirmar um agendamento ou reserva, você concorda com o valor e as condições exibidas antes da confirmação;</li>
                            <li>Os pagamentos são processados por um parceiro de pagamentos especializado, de forma segura;</li>
                            <li>Um pagamento é considerado <strong className="text-gray-800">concluído</strong> quando o parceiro de pagamentos confirma o recebimento — a partir daí sua reserva é confirmada automaticamente;</li>
                            <li>Uma taxa de plataforma pode ser aplicada sobre o valor total, conforme informado no momento da compra;</li>
                            <li>Alguns estabelecimentos aceitam pagamento presencial (no local), quando essa opção estiver disponível para o serviço.</li>
                        </ul>
                    </Secao>

                    <Secao titulo="5. Cancelamentos e estornos">
                        <p>
                            As condições de cancelamento podem variar por estabelecimento e tipo de serviço ou
                            locação, e são exibidas antes da confirmação da reserva. De forma geral:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Solicitações de estorno podem ser abertas diretamente pelo app/site, na área financeira da sua conta, em até <strong className="text-gray-800">4 dias corridos</strong> após a finalização do serviço;</li>
                            <li>O prestador/estabelecimento responsável é notificado e tem um prazo para responder à solicitação;</li>
                            <li>Você acompanha o andamento da sua solicitação (pendente, em análise, aprovado, contestado ou concluído) na própria tela de estornos;</li>
                            <li>Quando aprovado, o estorno é processado junto ao parceiro de pagamentos e o valor retorna pela mesma forma de pagamento utilizada;</li>
                            <li>Todo o histórico da solicitação — quando foi aberta, respondida e concluída — fica registrado e disponível para consulta.</li>
                        </ul>
                    </Secao>

                    <Secao titulo="6. Pontos Lokyva">
                        <p>
                            A Lokyva recompensa o uso da plataforma com pontos, que ficam disponíveis no seu perfil.
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Você ganha pontos ao concluir agendamentos e, em alguns casos, ao avaliar um serviço já utilizado;</li>
                            <li>Pontos podem ser usados para resgatar cupons de desconto oferecidos pelos estabelecimentos, e em alguns serviços/itens que aceitam desconto direto por pontos;</li>
                            <li>Campanhas promocionais da própria Lokyva também podem conceder pontos extras, para todos os usuários ou para públicos específicos (por exemplo, assinantes de um plano);</li>
                            <li>Cada movimentação de pontos — ganho ou uso — fica registrada no seu histórico, com a data e o motivo;</li>
                            <li>Regras de cada promoção (quantidade de pontos, validade, condições de uso) são específicas de cada campanha e exibidas no momento em que ela está disponível.</li>
                        </ul>
                    </Secao>

                    <Secao titulo="7. Promoções, cupons e ofertas">
                        <p>
                            A Lokyva e os estabelecimentos parceiros podem oferecer promoções, cupons de desconto e
                            ofertas exclusivas. Você deve estar ciente de que:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Promoções podem ter data de início e de encerramento — fora desse período, deixam de estar disponíveis;</li>
                            <li>Algumas promoções têm quantidade limitada ou número máximo de utilizações;</li>
                            <li>Algumas ofertas são exclusivas para um público específico, como assinantes de determinado plano;</li>
                            <li>Cupons podem ter um custo em pontos e/ou uma data de validade própria;</li>
                            <li>A Lokyva nunca exibe como disponível uma promoção já expirada ou esgotada.</li>
                        </ul>
                    </Secao>

                    <Secao titulo="8. Planos de assinatura">
                        <p>
                            A Lokyva oferece planos de assinatura opcionais, com benefícios como ofertas exclusivas e
                            acesso a funcionalidades adicionais. As condições gerais são:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Cada plano tem um valor e uma periodicidade (mensal ou anual) informados antes da contratação;</li>
                            <li>A cobrança é recorrente e renovada automaticamente ao final de cada ciclo, salvo cancelamento prévio;</li>
                            <li>Você pode cancelar a qualquer momento pelo próprio app/site — o acesso aos benefícios permanece até o fim do ciclo já pago;</li>
                            <li>Quando um pagamento de renovação é <strong className="text-gray-800">aprovado</strong>, o plano é renovado automaticamente pelo novo ciclo;</li>
                            <li>Quando um pagamento fica <strong className="text-gray-800">pendente</strong>, o acesso aos benefícios do plano é mantido até a data de vencimento vigente, aguardando confirmação;</li>
                            <li>Quando um pagamento é <strong className="text-gray-800">recusado</strong> ou o plano <strong className="text-gray-800">expira</strong> sem renovação, o acesso aos benefícios exclusivos é encerrado e sua conta volta a operar no modo gratuito;</li>
                            <li>Mudanças de plano têm efeito a partir do próximo ciclo de cobrança, respeitando o período já pago do plano atual.</li>
                        </ul>
                    </Secao>

                    <Secao titulo="9. Repasses para estabelecimentos e proprietários">
                        <p>
                            Estabelecimentos, proprietários e prestadores cadastrados na Lokyva recebem os valores das
                            suas reservas através do parceiro de pagamentos, seguindo este fluxo:
                        </p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>O cliente paga pela reserva/agendamento dentro da plataforma;</li>
                            <li>O pagamento é registrado e vinculado ao estabelecimento/prestador responsável pelo serviço;</li>
                            <li>O valor líquido (já descontada a taxa da plataforma) fica disponível na conta de recebimento do estabelecimento/prestador;</li>
                            <li>Os repasses para a chave PIX cadastrada são processados periodicamente, de forma automática;</li>
                            <li>Cancelamentos e estornos aprovados são descontados do saldo disponível, já que o valor correspondente foi devolvido ao cliente;</li>
                            <li>O estabelecimento/prestador acompanha seu saldo, valores retidos e histórico de repasses na sua própria área financeira.</li>
                        </ul>
                    </Secao>

                    <Secao titulo="10. Locação de itens e veículos">
                        <p>
                            Ao reservar um item ou veículo para locação, o locatário se compromete a devolvê-lo nas
                            mesmas condições em que foi retirado, respeitando o período contratado. Contratos de
                            locação gerados pela plataforma podem ser baixados em PDF ou Word e devem ser lidos
                            integralmente antes da retirada do item.
                        </p>
                    </Secao>

                    <Secao titulo="11. Condutas proibidas">
                        <p>Ao usar a Lokyva, você concorda em não:</p>
                        <ul className="list-disc pl-5 space-y-1.5">
                            <li>Fornecer informações falsas no cadastro ou em avaliações;</li>
                            <li>Usar a plataforma para fins ilegais ou fraudulentos;</li>
                            <li>Tentar acessar contas ou dados de outros usuários sem autorização;</li>
                            <li>Realizar cobranças ou negociações fora da plataforma para burlar taxas de serviço.</li>
                        </ul>
                        <p>
                            O descumprimento destas regras pode levar à suspensão ou exclusão da conta, a critério da
                            Lokyva.
                        </p>
                    </Secao>

                    <Secao titulo="12. Limitação de responsabilidade">
                        <p>
                            A Lokyva atua como intermediadora e não se responsabiliza pela qualidade dos serviços
                            prestados nem pelo estado dos itens alugados por terceiros na plataforma. Sempre que
                            possível, disputas devem ser resolvidas primeiro entre cliente e estabelecimento/
                            prestador, com a Lokyva podendo intermediar quando necessário.
                        </p>
                    </Secao>

                    <Secao titulo="13. Alterações neste termo">
                        <p>
                            Este termo pode ser atualizado periodicamente. Quando uma alteração relevante for feita, a
                            versão é incrementada e o usuário pode precisar aceitar novamente antes de continuar
                            usando funcionalidades sensíveis. Você pode consultar a versão que aceitou e a data do
                            aceite a qualquer momento em <strong className="text-gray-800">Perfil → Termos e Compromissos</strong>.
                        </p>
                    </Secao>

                    <Secao titulo="14. Contato">
                        <p>
                            Dúvidas sobre este termo podem ser enviadas para{' '}
                            <a href="mailto:suporte@lokyva.com" className="text-[#FF5A00] font-semibold">suporte@lokyva.com</a>.
                        </p>
                    </Secao>

                    {auth?.user && (
                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <Link
                                href={route('perfil.termos')}
                                className="inline-flex items-center gap-2 text-sm font-bold text-[#FF5A00]"
                            >
                                Ver meu histórico de aceite →
                            </Link>
                        </div>
                    )}
                </div>

                <p className="text-xs text-gray-400 mt-6 text-center">
                    Veja também a <Link href="/privacidade" className="text-[#FF5A00] font-semibold">Política de Privacidade</Link>.
                </p>
            </div>
        </div>
    );
}

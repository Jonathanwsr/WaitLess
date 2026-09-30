/**
 * Conteúdo dos tutoriais do sócio: como cadastrar um local, um serviço e uma reserva (locação).
 * Cada passo descreve o que preencher exatamente como aparece nas telas do app.
 */
export type FluxoTutorial = 'local' | 'servico' | 'reserva';

export interface PassoTutorial {
  titulo: string;
  texto: string;
  /** Campos da tela, na ordem em que aparecem. */
  campos?: string[];
  dica?: string;
}

export interface Tutorial {
  id: FluxoTutorial;
  rotulo: string;
  icone: string;
  resumo: string;
  tempo: string;
  botao: string;
  passos: PassoTutorial[];
}

export const TUTORIAIS: Tutorial[] = [
  {
    id: 'local',
    rotulo: 'Local',
    icone: 'storefront-outline',
    resumo: 'O local é o seu estabelecimento: é nele que ficam a fila, a equipe e os serviços.',
    tempo: '3 min',
    botao: 'Criar meu local',
    passos: [
      {
        titulo: 'Abra o cadastro de local',
        texto: 'No Painel toque em “Novo local”. Se ainda não tem nenhum, use o botão “Cadastre seu primeiro local”.',
      },
      {
        titulo: 'Preencha os dados da empresa',
        texto: 'Os campos com asterisco (*) são obrigatórios. O restante pode ser completado depois em Ajustes.',
        campos: ['Nome *', 'CNPJ *', 'Razão social', 'Ramo de atuação', 'Telefone', 'Site'],
        dica: 'Use o nome pelo qual seus clientes já conhecem você — é ele que aparece na busca.',
      },
      {
        titulo: 'Informe o endereço',
        texto: 'Digite o CEP e toque fora do campo: rua, bairro, cidade e UF são preenchidos sozinhos. Falta só o número.',
        campos: ['CEP', 'Rua', 'Número *', 'Complemento', 'Bairro', 'Cidade', 'UF'],
        dica: 'Endereço correto ajuda o cliente a encontrar você e aparece no filtro por estado.',
      },
      {
        titulo: 'Salve e complete o perfil',
        texto: 'Toque no botão verde de salvar. Depois, em Ajustes → Perfil da Loja, adicione foto de perfil e banner para deixar a vitrine mais atraente.',
        dica: 'Confira como o cliente vê o seu local em “Vitrine”.',
      },
    ],
  },
  {
    id: 'servico',
    rotulo: 'Serviço',
    icone: 'cut-outline',
    resumo: 'Serviço é o que o cliente agenda no seu local: corte, consulta, revisão, massagem…',
    tempo: '4 min',
    botao: 'Criar meu serviço',
    passos: [
      {
        titulo: 'Tenha um local cadastrado',
        texto: 'Todo serviço pertence a um local. Se ainda não criou o seu, comece pelo tutorial “Local”.',
      },
      {
        titulo: 'Abra Ajustes → Serviços',
        texto: 'No Painel, no card do seu local, toque em “Ajustes” e escolha a aba “3. Serviços”. O formulário “Adicionar Novo Serviço” já aparece no topo da aba.',
      },
      {
        titulo: 'Descreva o serviço',
        texto: 'Diga o que é, quanto custa e quanto tempo leva. A duração define o tamanho de cada horário na agenda.',
        campos: ['Nome', 'Descrição', 'Valor', 'Duração (minutos)'],
        dica: 'Uma descrição curta e objetiva converte mais do que um texto longo.',
      },
      {
        titulo: 'Defina quando ele é oferecido',
        texto: 'Marque os dias da semana e digite cada horário no formato 09:00, tocando em “Adicionar” para incluir na lista.',
        campos: ['Dias da semana', 'Horários de atendimento'],
        dica: 'Horários já ocupados somem da agenda do cliente automaticamente.',
      },
      {
        titulo: 'Adicione fotos e salve',
        texto: 'Envie até 5 fotos — a primeira vira a capa. Toque no botão verde para publicar o serviço.',
        dica: 'Fotos reais do resultado do seu trabalho aumentam muito os agendamentos.',
      },
    ],
  },
  {
    id: 'reserva',
    rotulo: 'Reserva',
    icone: 'key-outline',
    resumo: 'Reservas (locações) são itens que você aluga por diária: quadra, sala, equipamento, veículo, imóvel…',
    tempo: '5 min',
    botao: 'Criar minha reserva',
    passos: [
      {
        titulo: 'Abra Locações avulsas',
        texto: 'No Painel use o atalho “Locações” (ou Mais → Locações avulsas) e toque no botão de adicionar para abrir o formulário de um novo item.',
      },
      {
        titulo: 'Identifique o item',
        texto: 'Escolha a categoria correta: ela define se o cliente verá campos de retirada e entrega.',
        campos: ['Nome', 'Categoria', 'Valor da diária', 'Unidades disponíveis', 'Descrição'],
        dica: 'Só itens e veículos têm local de retirada/entrega. Espaços e hospedagens não pedem esse dado.',
      },
      {
        titulo: 'Configure pessoas e preço',
        texto: 'Informe a capacidade máxima e quantas pessoas já estão incluídas na diária. Acima disso, cobra-se o valor extra por pessoa.',
        campos: ['Capacidade', 'Pessoas incluídas', 'Valor por pessoa extra'],
      },
      {
        titulo: 'Marque as comodidades e a disponibilidade',
        texto: 'Selecione o que está incluso e escolha os dias em que o item pode ser reservado. Datas já reservadas ficam bloqueadas sozinhas, sem risco de reserva dupla.',
        campos: ['Comodidades', 'Datas disponíveis', 'Dias da semana'],
      },
      {
        titulo: 'Adicione fotos e publique',
        texto: 'Envie boas fotos e toque em “Criar locação”. Sua reserva aparece em Explorar → Reservas para os clientes do estado do seu local.',
        dica: 'O cliente pode pagar no cartão em até 12x, e você recebe no próximo repasse semanal.',
      },
    ],
  },
];

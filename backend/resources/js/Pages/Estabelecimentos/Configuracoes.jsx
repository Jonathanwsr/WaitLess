import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';

import { Head, useForm, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    CheckBadgeIcon, 
    DocumentTextIcon, 
    PlusIcon, 
    XMarkIcon, 
    MapPinIcon, 
    CalendarIcon, 
    ArchiveBoxIcon, 
    TicketIcon, 
    Cog6ToothIcon, 
    UserPlusIcon, 
    PhotoIcon,
    ExclamationTriangleIcon,
    ArrowRightIcon,
    ArrowLeftIcon,
    BuildingOfficeIcon,
    ChevronRightIcon,
    TrashIcon,
    TruckIcon,
    ArrowDownTrayIcon,
    GiftIcon,
    ArrowTopRightOnSquareIcon,
    LockClosedIcon,
    DocumentCheckIcon,
    CurrencyDollarIcon
} from '@heroicons/react/24/solid';

export default function Configuracoes({ auth, estabelecimento, meusEstabelecimentos, funcionarios, servicos, itensAluguel = [], itens_aluguel = [] }) {
    // ==========================================
    // 1. RECUPERA A ABA ATIVA DO LOCALSTORAGE
    // ==========================================
    const [activeTab, setActiveTab] = useState(() => {
        let tab = localStorage.getItem('lokyva_active_tab') || 'detalhes';
        if (tab === 'financeiro') tab = 'detalhes'; // Fallback se tinha ficado no cache
        return tab;
    });

    useEffect(() => {
        localStorage.setItem('lokyva_active_tab', activeTab);
    }, [activeTab]);

    const getNomeAba = () => {
        switch(activeTab) {
            case 'detalhes': return 'Perfil da Loja';
            case 'equipe': return 'Equipe / Profissionais';
            case 'servicos': return 'Catálogo de Serviços';
            case 'reservas_alugueis': return 'Reservas / Locações';
            default: return '';
        }
    };

    const [mensagemSucesso, setMensagemSucesso] = useState('');
    const { flash = {} } = usePage().props;

    const mostrarMensagem = (msg) => {
        setMensagemSucesso(msg);
        setTimeout(() => setMensagemSucesso(''), 5000);
    };

    // ==========================================
    // 2. PARSERS DE SEGURANÇA E FORMATAÇÕES
    // ==========================================
    const parseJSONSeguro = (dados, fallback = null) => {
        if (!dados) return fallback;
        if (typeof dados === 'string') {
            try { 
                const parsed = JSON.parse(dados);
                return parsed !== null ? parsed : fallback;
            } catch (e) { return fallback; }
        }
        return dados;
    };

    const parseArraySeguro = (dados) => {
        const resultado = parseJSONSeguro(dados, []);
        return Array.isArray(resultado) ? resultado : [];
    };

    // Gerador de anos dinâmicos
    const anosDisponiveis = (() => {
        const anoAtual = new Date().getFullYear();
        const listaAnos = [];
        for (let i = anoAtual; i >= 1950; i--) {
            listaAnos.push(i);
        }
        return listaAnos;
    })();

    const ufsBrasil = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
        'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
        'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];

    const ramosAtuacao = [
        'Academia e Crossfit', 'Açougue e Casa de Carnes', 'Advocacia e Escritórios', 'Agência de Turismo', 'Aluguel de Equipamentos',
        'Aluguel de Imóveis', 'Aluguel de Roupas e Fantasias', 'Aluguel de Veículos', 'Artesanato e Costura', 'Assistência Técnica',
        'Auto Escola', 'Bar e Pub', 'Barbearia', 'Cafeteria e Casa de Chá', 'Centro Automotivo', 'Clínica de Estética',
        'Clínica Médica', 'Clínica Odontológica', 'Clínica Veterinária', 'Coworking', 'E-commerce e Loja Virtual', 
        'Espaço de Eventos', 'Estúdio de Fotografia', 'Farmácia e Drogaria', 'Hospedagem e Hotelaria',
        'Imobiliária', 'Logística e Fretes', 'Oficina Mecânica', 'Pet Shop', 'Restaurante', 'Salão de Beleza', 'Outros'
    ].sort();

    // ==========================================
    // 3. BUSCA DE ENDEREÇO E COORDENADAS
    // ==========================================
    const buscarEnderecoAutomatizado = async (cepStr, formSetter, prefix = '') => {
        const cepLimpo = cepStr.replace(/\D/g, '');
        if (cepLimpo.length !== 8) return;

        try {
            const resCep = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const viaCepData = await resCep.json();

            if (!viaCepData.erro) {
                const rua = viaCepData.logradouro || '';
                const bairro = viaCepData.bairro || '';
                const cidade = viaCepData.localidade || '';
                const estado = viaCepData.uf || '';

                formSetter(data => ({
                    ...data,
                    [`cep${prefix}`]: viaCepData.cep,
                    [`rua${prefix}`]: rua,
                    [`bairro${prefix}`]: bairro,
                    [`cidade${prefix}`]: cidade,
                    [`estado${prefix}`]: estado,
                }));

                const queryOSM = `${rua}, ${cidade}, ${estado}, Brazil`;
                const resNom = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryOSM)}`);
                const nomData = await resNom.json();

                if (nomData && nomData.length > 0) {
                    formSetter(data => ({
                        ...data,
                        [`latitude${prefix}`]: nomData[0].lat,
                        [`longitude${prefix}`]: nomData[0].lon,
                    }));
                }
            }
        } catch (error) {
            console.error("Erro na busca automatizada de endereço:", error);
        }
    };

    // ==========================================
    // 4. PAGINAÇÃO E BUSCA DE DADOS DINÂMICOS
    // ==========================================
    const [fetchedLocacoes, setFetchedLocacoes] = useState([]);

    const atualizarListaLocacoes = () => {
        fetch('/api/catalogo/itens', { headers: { 'Accept': 'application/json' } })
            .then(res => res.json())
            .then(data => {
                if (data && data.data) {
                    setFetchedLocacoes(data.data);
                } else if (Array.isArray(data)) {
                    setFetchedLocacoes(data);
                }
            })
            .catch(e => console.log('Buscando via props locais'));
    };

    useEffect(() => {
        if (activeTab === 'reservas_alugueis') {
            atualizarListaLocacoes();
        }
    }, [activeTab]);

    const itensPorPagina = 4;
    const [paginaFiliais, setPaginaFiliais] = useState(1);
    const totalPaginasFiliais = Math.ceil((meusEstabelecimentos || []).length / itensPorPagina);
    const filiaisPaginadas = (meusEstabelecimentos || []).slice((paginaFiliais - 1) * itensPorPagina, paginaFiliais * itensPorPagina);

    const itensPorPaginaFunc = 5;
    const [paginaFuncionarios, setPaginaFuncionarios] = useState(1);
    const totalPaginasFuncionarios = Math.ceil((funcionarios || []).length / itensPorPaginaFunc);
    const funcionariosPaginados = (funcionarios || []).slice((paginaFuncionarios - 1) * itensPorPaginaFunc, paginaFuncionarios * itensPorPaginaFunc);

    const [paginaItens, setPaginaItens] = useState(1);
    const itensPorPaginaLoc = 4;
    const rawLocacoes = fetchedLocacoes.length > 0 ? fetchedLocacoes : (itensAluguel.length > 0 ? itensAluguel : itens_aluguel);
    const arrayLocacoes = Array.isArray(rawLocacoes) ? rawLocacoes : [];
    const totalPaginasItens = Math.ceil(arrayLocacoes.length / itensPorPaginaLoc);
    const itensPaginados = arrayLocacoes.slice((paginaItens - 1) * itensPorPaginaLoc, paginaItens * itensPorPaginaLoc);

    // ==========================================
    // FORM 1: DETALHES DA LOJA
    // ==========================================
    const [fotoPerfilPreview, setFotoPerfilPreview] = useState(estabelecimento?.foto_perfil || null);
    const [fotoBannerPreview, setFotoBannerPreview] = useState(estabelecimento?.foto_banner || null);

    const formDetalhes = useForm({
        nome: estabelecimento?.nome || '',
        ramo_atuacao: estabelecimento?.ramo_atuacao || '',
        telefone: estabelecimento?.telefone || '',
        cep: estabelecimento?.cep || '',
        rua: estabelecimento?.rua || '',
        numero: estabelecimento?.numero || '',
        complemento: estabelecimento?.complemento || '',
        bairro: estabelecimento?.bairro || '',
        cidade: estabelecimento?.cidade || '',
        estado: estabelecimento?.estado || '',
        token_mercadopago: estabelecimento?.token_mercadopago || '', 
        foto_perfil: null, 
        foto_banner: null,
    });

    const handleFotoEstabelecimento = (e) => {
        const file = e.target.files[0];
        if (file) {
            formDetalhes.setData('foto_perfil', file);
            setFotoPerfilPreview(URL.createObjectURL(file)); 
        }
    };

    const handleFotoBanner = (e) => {
        const file = e.target.files[0];
        if (file) {
            formDetalhes.setData('foto_banner', file);
            setFotoBannerPreview(URL.createObjectURL(file)); 
        }
    };

    const submitDetalhes = (e) => {
        e.preventDefault();
        router.post(route('estabelecimentos.update', estabelecimento.id), {
            _method: 'put',
            ...formDetalhes.data
        }, {
            preserveScroll: true,
            onSuccess: () => {
                mostrarMensagem('Configurações salvas com sucesso!');
                formDetalhes.setData({ foto_perfil: null, foto_banner: null });
            },
            onError: (erros) => {
                formDetalhes.setError(erros);
            }
        });
    };

    const toggleStatusEstabelecimento = () => {
        const acao = estabelecimento.ativo ? 'desativar' : 'ativar';
        if (confirm(`Tem a certeza que deseja ${acao} este estabelecimento?`)) {
            router.patch(route('estabelecimentos.toggle-status', estabelecimento.id), {}, { preserveScroll: true });
        }
    };

    // ==========================================
    // FORM 2: EQUIPE / FUNCIONÁRIOS
    // ==========================================
    const [isEditingFuncionario, setIsEditingFuncionario] = useState(false);
    
    const formFuncionario = useForm({
        id: null,
        nome: '',
        telefone: '',
        cargo: 'Atendente',
        email: '',
        password: '',
    });

    const submitFuncionario = (e) => {
        e.preventDefault();
        if (isEditingFuncionario) {
            formFuncionario.put(route('funcionarios.update', formFuncionario.data.id), {
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicaoFuncionario();
                    mostrarMensagem('Funcionário atualizado com sucesso!');
                },
            });
        } else {
            formFuncionario.post(route('funcionarios.store', estabelecimento.id), {
                preserveScroll: true,
                onSuccess: () => {
                    formFuncionario.reset('nome', 'telefone', 'email', 'password');
                    mostrarMensagem('Funcionário criado com sucesso!');
                },
            });
        }
    };

    const editarFuncionario = (func) => {
        setIsEditingFuncionario(true);
        formFuncionario.setData({
            id: func.id,
            nome: func.nome,
            telefone: func.telefone || '',
            cargo: func.cargo || 'Atendente',
            email: '', 
            password: '', 
        });
    };

    const cancelarEdicaoFuncionario = () => {
        setIsEditingFuncionario(false);
        formFuncionario.reset();
        formFuncionario.clearErrors();
    };

    const deletarFuncionario = (id) => {
        if (confirm('Tem certeza que deseja desativar/remover este funcionário?')) {
            router.delete(route('funcionarios.destroy', id), { preserveScroll: true });
        }
    };

    // ==========================================
    // FORM 3: CATÁLOGO DE SERVIÇOS
    // ==========================================
    const [isEditingServico, setIsEditingServico] = useState(false);
    const [novoHorario, setNovoHorario] = useState(''); 
    const [visualizandoServico, setVisualizandoServico] = useState(null);
    
    const [quadradosFotos, setQuadradosFotos] = useState([null, null, null, null, null]);
    const [fotoDetalheIndexServico, setFotoDetalheIndexServico] = useState(0);

    const formServico = useForm({
        id: null,
        nome: '',
        tipo_servico: '',
        descricao: '',
        valor: '',
        duracao_minutos: '30',
        funcionario_id: '',
        tipo_pagamento: 'hibrido',
        dias_disponiveis: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
        horarios_disponiveis: [], 
        estabelecimentos_ids: [estabelecimento?.id],
        fotos: [], 
        fotos_existentes: [], 
        tem_cupom: false,
        tipo_desconto_cupom: 'percentual',
        valor_cupom: '',
        codigo_cupom: '',
    });

    useEffect(() => {
        if (!isEditingServico && !visualizandoServico) {
            const rascunho = localStorage.getItem('lokyva_servico_draft');
            if (rascunho) {
                try {
                    const dadosSalvos = JSON.parse(rascunho);
                    if (dadosSalvos) {
                        formServico.setData(data => ({
                            ...data,
                            ...dadosSalvos
                        }));
                    }
                } catch (e) {}
            }
        }
    }, [isEditingServico, visualizandoServico]); 

    useEffect(() => {
        if (!isEditingServico && !visualizandoServico) {
            const dadosParaSalvar = {
                nome: formServico.data.nome,
                tipo_servico: formServico.data.tipo_servico,
                descricao: formServico.data.descricao,
                valor: formServico.data.valor,
                duracao_minutos: formServico.data.duracao_minutos,
                horarios_disponiveis: formServico.data.horarios_disponiveis,
                dias_disponiveis: formServico.data.dias_disponiveis,
                tem_cupom: formServico.data.tem_cupom,
                tipo_desconto_cupom: formServico.data.tipo_desconto_cupom,
                valor_cupom: formServico.data.valor_cupom,
                codigo_cupom: formServico.data.codigo_cupom,
            };
            localStorage.setItem('lokyva_servico_draft', JSON.stringify(dadosParaSalvar));
        }
    }, [formServico.data, isEditingServico, visualizandoServico]); 

    const handleFotoQuadrado = (index, arquivoSelecionado) => {
        if (!arquivoSelecionado) return;
        const novaListaQuadrados = [...quadradosFotos];
        novaListaQuadrados[index] = arquivoSelecionado;
        setQuadradosFotos(novaListaQuadrados);
    };

    const removerFotoQuadrado = (index) => {
        const novaListaQuadrados = [...quadradosFotos];
        novaListaQuadrados[index] = null;
        setQuadradosFotos(novaListaQuadrados);
    };

    const adicionarHorario = () => {
        if (novoHorario && !formServico.data.horarios_disponiveis.includes(novoHorario)) {
            const listaAtualizada = [...formServico.data.horarios_disponiveis, novoHorario].sort();
            formServico.setData('horarios_disponiveis', listaAtualizada);
            setNovoHorario(''); 
        }
    };

    const removerHorario = (horarioParaRemover) => {
        formServico.setData('horarios_disponiveis', formServico.data.horarios_disponiveis.filter(h => h !== horarioParaRemover));
    };

    const gerarCodigoCupom = () => {
        const prefixo = estabelecimento?.nome?.replace(/[^A-Za-z0-9]/g, '').substring(0, 6).toUpperCase() || 'CUPOM';
        const aleatorio = Math.floor(1000 + Math.random() * 9000);
        return `${prefixo}${aleatorio}`;
    };

    const submitServico = (withEvent) => {
        withEvent.preventDefault();
        
        formServico.transform((data) => ({
            ...data,
            fotos_existentes: quadradosFotos.filter(f => typeof f === 'string' && f !== null),
            fotos: quadradosFotos.filter(f => f instanceof File),
            _method: isEditingServico ? 'put' : 'post'
        }));

        formServico.post(isEditingServico ? route('servicos.update', formServico.data.id) : route('servicos.store'), {
            preserveScroll: true,
            onSuccess: () => {
                cancelarEdicaoServico();
                mostrarMensagem(isEditingServico ? 'Serviço editado com sucesso!' : 'Serviço cadastrado com sucesso!');
                localStorage.removeItem('lokyva_servico_draft');
            }
        });
    };

    const editarServico = (servico) => {
        setIsEditingServico(true);
        setVisualizandoServico(null); 
        localStorage.removeItem('lokyva_servico_draft'); 
        
        let config = { dias_disponiveis: [], tipo_pagamento: 'hibrido', funcionario_padrao: '', tem_cupom: false, tipo_desconto_cupom: 'percentual', valor_cupom: '', codigo_cupom: '' };
        let horarios = [];
        try {
            config = typeof servico.configuracoes === 'string' ? JSON.parse(servico.configuracoes) : (servico.configuracoes || config);
            horarios = typeof servico.horarios_disponiveis === 'string' ? JSON.parse(servico.horarios_disponiveis) : (servico.horarios_disponiveis || []);
        } catch (error) {}

        const existingPhotos = parseArraySeguro(servico.fotos);
        const newQuadrados = [null, null, null, null, null];
        existingPhotos.forEach((url, i) => { if(i < 5) newQuadrados[i] = url; });
        setQuadradosFotos(newQuadrados); 

        formServico.setData({
            id: servico.id,
            nome: servico.nome,
            tipo_servico: servico.tipo_servico || '',
            descricao: servico.descricao || '',
            valor: servico.valor,
            duracao_minutos: servico.duracao_minutos,
            funcionario_id: config.funcionario_padrao || '',
            tipo_pagamento: config.tipo_pagamento || 'hibrido',
            dias_disponiveis: config.dias_disponiveis || ['segunda', 'terca', 'quarta', 'quinta', 'sexta'],
            horarios_disponiveis: horarios,
            estabelecimentos_ids: [estabelecimento.id], 
            fotos: [], 
            fotos_existentes: existingPhotos,
            tem_cupom: config.tem_cupom || false,
            tipo_desconto_cupom: config.tipo_desconto_cupom || 'percentual',
            valor_cupom: config.valor_cupom || '',
            codigo_cupom: config.codigo_cupom || '',
        });
        
        window.scrollTo({ top: 0, behavior: 'smooth' }); 
    };

    const visualizarServico = (servico) => {
        setVisualizandoServico(servico);
        setFotoDetalheIndexServico(0);
        setIsEditingServico(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const fecharVisualizacaoServico = () => {
        setVisualizandoServico(null);
    };

    const cancelarEdicaoServico = () => {
        setIsEditingServico(false);
        formServico.reset();
        formServico.setData('estabelecimentos_ids', [estabelecimento.id]);
        setNovoHorario('');
        formServico.clearErrors();
        setQuadradosFotos([null, null, null, null, null]);
    };

    const deletarServico = (id) => {
        const mensagem = "Atenção: Tem certeza que deseja apagar este serviço?\n\nEsta ação irá CANCELAR todos os agendamentos futuros e ESTORNAR automaticamente o dinheiro dos clientes que já pagaram online.\n\nDeseja prosseguir?";
        if (window.confirm(mensagem)) {
            router.delete(route('servicos.destroy', id), { 
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicaoServico();
                    setVisualizandoServico(null);
                    mostrarMensagem('Comando executado! A agenda está a ser limpa.');
                }
            });
        }
    };

    const handleDiaToggle = (dia) => {
        const novosDias = formServico.data.dias_disponiveis.includes(dia)
            ? formServico.data.dias_disponiveis.filter(d => d !== dia)
            : [...formServico.data.dias_disponiveis, dia];
        formServico.setData('dias_disponiveis', novosDias);
    };

    // =========================================================================
    // 👉 FORM 4: RESERVAS E LOCAÇÕES (MÓDULO SAAS COMPLETO)
    // =========================================================================
    const [isEditingItem, setIsEditingItem] = useState(false);
    const [visualizandoItem, setVisualizandoItem] = useState(null);
    const [fotoDetalheIndexItem, setFotoDetalheIndexItem] = useState(0);

    const [quadradosFotosItem, setQuadradosFotosItem] = useState(Array(24).fill(null));

    const [novaDataPermitida, setNovaDataPermitida] = useState('');
    const [novaDataBloqueada, setNovaDataBloqueada] = useState('');
    const [novoHorarioBloqueado, setNovoHorarioBloqueado] = useState({ data: '', inicio: '', fim: '' });
    const [diasMesInput, setDiasMesInput] = useState('');
    
    const [mostrarSimulador, setMostrarSimulador] = useState(false);
    const [simulacaoPontos, setSimulacaoPontos] = useState('');

    // Estados para controle dinâmico avançado (vagas/quantidade)
    const [novaDispData, setNovaDispData] = useState('');
    const [novaDispQtd, setNovaDispQtd] = useState('');
    const [novaHoraDispData, setNovaHoraDispData] = useState('');
    const [novaHoraDispInicio, setNovaHoraDispInicio] = useState('');
    const [novaHoraDispFim, setNovaHoraDispFim] = useState('');
    const [novaHoraDispQtd, setNovaHoraDispQtd] = useState('');

    const formItem = useForm({
        id: null,
        estabelecimento_id: estabelecimento?.id,
        nome: '',
        categoria: 'casa', 
        modelo: '',
        marca: '',
        tipo: '',
        descricao: '',
        especificacoes: '',
        quantidade: '1',
        capacidade_pessoas: '',
        valor_diaria: '',
        valor_semanal: '',
        valor_mensal: '',
        valor_caucao: '',
        fotos: [],
        fotos_existentes: [], 
        
        recursos_oferecidos: [], 
        acessorios: [], 
        funcionarios_responsaveis: [],
        
        // Imóvel Base
        endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
        latitude: '', longitude: '', numero_quartos: '', numero_banheiros: '', numero_suites: '',
        numero_comodos: '', numero_vagas: '', area_total: '', area_construida: '',
        mobiliado: false, aceita_pet: false, possui_wifi: false, possui_ar_condicionado: false, piscina: false, churrasqueira: false,
        
        // Veículos
        placa: '', renavam: '', chassis: '', ano: '', 
        combustivel: '', cambio: '', quilometragem: '', cilindrada: '', potencia: '', possui_seguro: false,
        
        // Equipamentos
        fabricante: '', numero_serie: '', patrimonio: '', voltagem: '', potencia_equipamento: '', peso: '', dimensoes: '', garantia: '',
        
        // Endereços de Retirada/Entrega
        cep_retirada: '', rua_retirada: '', numero_retirada: '', complemento_retirada: '', bairro_retirada: '', cidade_retirada: '', estado_retirada: '',
        latitude_retirada: '', longitude_retirada: '',
        cep_entrega: '', rua_entrega: '', numero_entrega: '', complemento_entrega: '', bairro_entrega: '', cidade_entrega: '', estado_entrega: '',
        latitude_entrega: '', longitude_entrega: '',
        
        observacoes: '',
        periodo_faturamento_padrao: 'diaria',
        permitir_pagamento: 'online',

        // Disponibilidade
        sempre_disponivel: true,
        tipo_disponibilidade: 'todos',
        data_inicio_disponibilidade: '',
        data_fim_disponibilidade: '',
        datas_permitidas: [],
        dias_semana_disponiveis: [],
        dias_mes_disponiveis: [],
        horario_inicio: '',
        horario_fim: '',
        horario_limite_devolucao: '',
        antecedencia_reserva_horas: '0',
        duracao_minima_horas: '1',
        duracao_maxima_horas: '',
        intervalo_entre_reservas_minutos: '0',
        datas_bloqueadas: [],
        horarios_bloqueados: [],
        observacoes_disponibilidade: '',
        
        // Regras Avançadas de Disponibilidade (Data e Horário específicos)
        disponibilidade_por_data: false,
        quantidade_padrao: '',
        tipo_quantidade: '',
        dias_disponiveis: [],
        horarios_disponiveis: [],
        
        // Promoções, Fidelidade, Contrato
        tem_promocao: false,
        tipo_desconto: 'percentual',
        valor_desconto: '',
        aceita_pontos: false,
        maximo_pontos_permitidos: '',
        exige_contrato: false,
    });

    // Funções para adicionar vagas por Data e Horário
    const handleAddDiaDisponivel = () => {
        if (!novaDispData || !novaDispQtd) return;
        const list = [...parseArraySeguro(formItem.data.dias_disponiveis)];
        const filtered = list.filter(item => item.data !== novaDispData);
        filtered.push({ data: novaDispData, quantidade: parseInt(novaDispQtd) });
        filtered.sort((a,b) => a.data.localeCompare(b.data));
        formItem.setData('dias_disponiveis', filtered);
        setNovaDispData('');
        setNovaDispQtd('');
    };

    const handleRemoveDiaDisponivel = (dataTarget) => {
        const list = [...parseArraySeguro(formItem.data.dias_disponiveis)].filter(item => item.data !== dataTarget);
        formItem.setData('dias_disponiveis', list);
    };

    const handleAddHorarioDisponivel = () => {
        if (!novaHoraDispData || !novaHoraDispInicio || !novaHoraDispFim || !novaHoraDispQtd) return;
        const list = [...parseArraySeguro(formItem.data.horarios_disponiveis)];
        const dataIndex = list.findIndex(item => item.data === novaHoraDispData);
        const newHorario = { inicio: novaHoraDispInicio, fim: novaHoraDispFim, quantidade: parseInt(novaHoraDispQtd) };

        if (dataIndex >= 0) {
            list[dataIndex].horarios.push(newHorario);
            list[dataIndex].horarios.sort((a,b) => a.inicio.localeCompare(b.inicio));
        } else {
            list.push({ data: novaHoraDispData, horarios: [newHorario] });
        }
        list.sort((a,b) => a.data.localeCompare(b.data));
        formItem.setData('horarios_disponiveis', list);
        setNovaHoraDispInicio('');
        setNovaHoraDispFim('');
        setNovaHoraDispQtd('');
    };

    const handleRemoveHorarioDisponivel = (dataTarget, indexHorario) => {
         const list = [...parseArraySeguro(formItem.data.horarios_disponiveis)];
         const dataIndex = list.findIndex(item => item.data === dataTarget);
         if(dataIndex >= 0) {
             list[dataIndex].horarios.splice(indexHorario, 1);
             if(list[dataIndex].horarios.length === 0) {
                 list.splice(dataIndex, 1);
             }
             formItem.setData('horarios_disponiveis', list);
         }
    };

    const formatarDecimaisItemOnBlur = (campo, valor) => {
        if (!valor) return;
        const numerico = parseFloat(valor.toString().replace(',', '.'));
        if (!isNaN(numerico)) {
            formItem.setData(campo, numerico.toFixed(2));
        }
    };

    const higienizarEntrada = (dados) => {
        const regexInseguro = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
        const regexEmoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        
        for (let chave in dados) {
            if (typeof dados[chave] === 'string' && chave !== 'fotos' && chave !== 'fotos_existentes') {
                if (regexInseguro.test(dados[chave]) || regexEmoji.test(dados[chave])) {
                    return false;
                }
            }
        }
        return true;
    };

    const handleFotoItemQuadrado = (index, arquivo) => {
        if (!arquivo) return;
        const novaLista = [...quadradosFotosItem];
        novaLista[index] = arquivo;
        setQuadradosFotosItem(novaLista);
    };

    const removerFotoItemQuadrado = (index) => {
        const novaLista = [...quadradosFotosItem];
        novaLista[index] = null;
        setQuadradosFotosItem(novaLista);
    };

    const handleDiaSemanaToggle = (dia) => {
        const atuais = parseArraySeguro(formItem.data.dias_semana_disponiveis);
        const novaLista = atuais.includes(dia) ? atuais.filter(d => d !== dia) : [...atuais, dia];
        formItem.setData('dias_semana_disponiveis', novaLista);
    };

    const addDataPermitida = () => {
        if (novaDataPermitida && !formItem.data.datas_permitidas.includes(novaDataPermitida)) {
            formItem.setData('datas_permitidas', [...formItem.data.datas_permitidas, novaDataPermitida]);
            setNovaDataPermitida('');
        }
    };

    const addDataBloqueada = () => {
        if (novaDataBloqueada && !formItem.data.datas_bloqueadas.includes(novaDataBloqueada)) {
            formItem.setData('datas_bloqueadas', [...formItem.data.datas_bloqueadas, novaDataBloqueada]);
            setNovaDataBloqueada('');
        }
    };

    const addHorarioBloqueado = () => {
        if (novoHorarioBloqueado.data && novoHorarioBloqueado.inicio && novoHorarioBloqueado.fim) {
            formItem.setData('horarios_bloqueados', [...parseArraySeguro(formItem.data.horarios_bloqueados), novoHorarioBloqueado]);
            setNovoHorarioBloqueado({ data: '', inicio: '', fim: '' });
        }
    };

    const calcularSimulacao = (valorOriginal) => {
        const val = parseFloat(valorOriginal) || 0;
        if (val === 0) return { cliente: '0.00', taxa: '0.00', liquido: '0.00', descPromocao: '0.00', descPontos: '0.00' };
        
        let descontoPromocao = 0;
        if (formItem.data.tem_promocao) {
            const valDesconto = parseFloat(formItem.data.valor_desconto) || 0;
            if (formItem.data.tipo_desconto === 'percentual') {
                descontoPromocao = val * (valDesconto / 100);
            } else {
                descontoPromocao = valDesconto;
            }
        }

        let descontoPontos = 0;
        if (formItem.data.aceita_pontos) {
            const pontosInseridos = parseInt(simulacaoPontos) || 0;
            const maxPontosPermitidos = parseInt(formItem.data.maximo_pontos_permitidos) || 0;
            const pontosValidos = Math.min(pontosInseridos, maxPontosPermitidos);
            descontoPontos = pontosValidos / 100; // 100 pontos = R$ 1,00
        }
        
        const valorClienteFinal = Math.max(0, val - descontoPromocao - descontoPontos);
        const taxaLokyva = valorClienteFinal * 0.12; 
        const valorLiquido = valorClienteFinal - taxaLokyva;
        
        return {
            cliente: valorClienteFinal.toFixed(2),
            taxa: taxaLokyva.toFixed(2),
            liquido: valorLiquido.toFixed(2),
            descPromocao: descontoPromocao.toFixed(2),
            descPontos: descontoPontos.toFixed(2)
        };
    };

    const SimularRepasse = ({ label, valor }) => {
        const sim = calcularSimulacao(valor);
        const valOriginal = parseFloat(valor) || 0;
        if(valOriginal === 0) return null;
        
        return (
            <div className="bg-gray-50 p-5 border border-gray-200 rounded-2xl shadow-sm flex flex-col h-full relative overflow-hidden flex-1">
               <h5 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2">{label}</h5>
               <div className="flex items-end gap-2 mb-3">
                   {(parseFloat(sim.descPromocao) > 0 || parseFloat(sim.descPontos) > 0) && (
                       <p className="text-xs line-through text-gray-400 mb-1">R$ {valOriginal.toFixed(2)}</p>
                   )}
                   <p className="text-2xl font-black text-gray-900">R$ {sim.cliente}</p>
               </div>
               
               <div className="mt-auto border-t border-dashed border-gray-300 pt-3 space-y-2">
                   {parseFloat(sim.descPromocao) > 0 && <p className="text-[11px] font-bold text-green-600 flex justify-between"><span>Promoção Ativa</span> <span>- R$ {sim.descPromocao}</span></p>}
                   {parseFloat(sim.descPontos) > 0 && <p className="text-[11px] font-bold text-blue-600 flex justify-between"><span>Desconto em Pontos</span> <span>- R$ {sim.descPontos}</span></p>}
                   <p className="text-[11px] font-bold text-red-500 flex justify-between"><span>Taxa LOKYVA (12%)</span> <span>- R$ {sim.taxa}</span></p>
                   <p className="text-sm text-green-700 font-black flex justify-between bg-green-100 px-3 py-2 rounded-xl mt-2 border border-green-200"><span>Líquido a Receber</span> <span>R$ {sim.liquido}</span></p>
               </div>
            </div>
        )
    };

    const submitItemLocacao = (e) => {
        e.preventDefault();

        if (!higienizarEntrada(formItem.data)) {
            alert('Aviso de Segurança: Caracteres especiais ou códigos não são permitidos nos formulários.');
            return;
        }

        formItem.transform((data) => {
            let diasMes = [];
            if (diasMesInput) {
                diasMes = diasMesInput.split(',').map(s => s.trim()).filter(s => !isNaN(s) && s !== '');
            }

            return {
                ...data,
                dias_mes_disponiveis: diasMes,
                fotos_existentes: quadradosFotosItem.filter(f => typeof f === 'string' && f !== null),
                fotos: quadradosFotosItem.filter(f => f instanceof File)
            };
        });
        
        formItem.post(isEditingItem ? route('catalogo.itens.update', formItem.data.id) : route('catalogo.itens.store'), {
            preserveScroll: true,
            onSuccess: () => {
                cancelarEdicaoItem();
                mostrarMensagem('Sua locação foi salva com sucesso!');
                atualizarListaLocacoes();
                router.reload({ only: ['itensAluguel', 'itens_aluguel', 'meusEstabelecimentos', 'estabelecimentos'] });
            }
        });

    };

    const editarItem = (item) => {
        setIsEditingItem(true);
        setVisualizandoItem(null);

        const existingPhotos = parseArraySeguro(item.fotos);
        const newQuadrados = Array(24).fill(null);
        existingPhotos.forEach((url, i) => { if(i < 24) newQuadrados[i] = url; });
        setQuadradosFotosItem(newQuadrados);

        formItem.setData({ 
            ...item,
            recursos_oferecidos: parseArraySeguro(item.recursos_oferecidos),
            acessorios: parseArraySeguro(item.acessorios),
            funcionarios_responsaveis: parseArraySeguro(item.funcionarios_responsaveis),
            datas_permitidas: parseArraySeguro(item.datas_permitidas),
            dias_semana_disponiveis: parseArraySeguro(item.dias_semana_disponiveis),
            dias_mes_disponiveis: parseArraySeguro(item.dias_mes_disponiveis),
            datas_bloqueadas: parseArraySeguro(item.datas_bloqueadas),
            horarios_bloqueados: parseArraySeguro(item.horarios_bloqueados),
            dias_disponiveis: parseArraySeguro(item.dias_disponiveis),
            horarios_disponiveis: parseArraySeguro(item.horarios_disponiveis),
            sempre_disponivel: item.sempre_disponivel === 1 || item.sempre_disponivel === true,
            disponibilidade_por_data: item.disponibilidade_por_data === 1 || item.disponibilidade_por_data === true,
            tem_promocao: item.tem_promocao === 1 || item.tem_promocao === true,
            aceita_pontos: item.aceita_pontos === 1 || item.aceita_pontos === true,
            exige_contrato: item.exige_contrato === 1 || item.exige_contrato === true,
        });
        setDiasMesInput(parseArraySeguro(item.dias_mes_disponiveis).join(', '));
        setSimulacaoPontos('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const visualizarItem = (item) => {
        setVisualizandoItem(item);
        setFotoDetalheIndexItem(0);
        setIsEditingItem(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelarEdicaoItem = () => {
        setIsEditingItem(false);
        formItem.reset();
        setDiasMesInput('');
        setSimulacaoPontos('');
        setQuadradosFotosItem(Array(24).fill(null));
        setNovaDispData(''); setNovaDispQtd('');
        setNovaHoraDispData(''); setNovaHoraDispInicio(''); setNovaHoraDispFim(''); setNovaHoraDispQtd('');
    };

    const deletarItem = (id) => {
        if (confirm('Tem certeza que deseja remover este item de locação do catálogo?')) {
            router.delete(route('catalogo.itens.destroy', id), { 
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicaoItem();
                    setVisualizandoItem(null);
                    mostrarMensagem('Item removido com sucesso.');
                    atualizarListaLocacoes();
                }
            });
        }
    };

    const cat = formItem.data.categoria;
    const esImovel = [
        'casa', 'apartamento', 'casa_praia', 'flat', 'hotel', 'pousada', 'hostel', 'chalé', 'cabana', 
        'loft', 'kitnet', 'cobertura', 'condominio', 'sitio', 'chacara', 'fazenda', 'galpao', 'armazem', 
        'terreno', 'escritorio', 'consultorio', 'sala', 'auditorio', 'espaco_eventos', 'salão_festas', 'coworking',
        'quadra', 'quadra_futebol', 'quadra_futsal', 'quadra_volei', 'quadra_basquete', 'quadra_tenis', 
        'quadra_beach_tennis', 'quadra_padel', 'campo_futebol', 'arena', 'ginasio', 'piscina', 'academia', 
        'estudio_danca', 'consultorio_estetica', 'salao_beleza', 'espaco_spa', 'espaco_pet', 'armazenamento', 'deposito'
    ].includes(cat);
    
    const esVeiculo = [
        'carro', 'moto', 'bicicleta', 'bicicleta_eletrica', 'patinete', 'patinete_eletrico', 'van', 'onibus', 
        'micro_onibus', 'caminhao', 'carreta', 'motorhome', 'trailer', 'jet_ski', 'barco', 'lancha', 'iate', 'caiaque'
    ].includes(cat);
    
    const esEquipamento = [
        'equipamento', 'ferramenta', 'equipamento_construcao', 'equipamento_agricola', 'equipamento_industrial', 
        'andaime', 'betoneira', 'gerador', 'compressor', 'escada', 'camera', 'camera_fotografica', 'camera_filmagem', 
        'drone', 'notebook', 'computador', 'tablet', 'projetor', 'impressora', 'monitor', 'videogame', 'audio_video', 
        'caixa_som', 'mesa_som', 'microfone', 'telão', 'painel_led', 'iluminacao', 'karaoke', 'palco', 'tenda', 
        'cadeira', 'mesa', 'decoracao', 'brinquedo_inflavel', 'roupa', 'terno', 'vestido', 'fantasia', 'cadeira_barbeiro'
    ].includes(cat);

    return (
        <AuthenticatedLayout
            header={
                <div className="flex flex-col">
                    <div className="text-xs text-gray-500 font-bold mb-2 flex items-center gap-1">
                        <BuildingOfficeIcon className="w-3 h-3"/> Estabelecimentos <ChevronRightIcon className="w-3 h-3"/> Configuração <ChevronRightIcon className="w-3 h-3"/> <span className="text-gray-900">{getNomeAba()}</span>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                        <div className="flex items-center gap-4">
                            <div>
                                <h2 className="text-2xl font-bold leading-tight text-gray-900 flex items-center gap-3">
                                    <Cog6ToothIcon className="w-7 h-7 text-gray-700" /> Configurações
                                    {estabelecimento.ativo ? (
                                        <span className="text-xs font-bold bg-green-100 text-green-700 px-3 py-1 rounded-full border border-green-200 uppercase tracking-wider">
                                            Loja Ativa
                                        </span>
                                    ) : (
                                        <span className="text-xs font-bold bg-red-100 text-red-700 px-3 py-1 rounded-full border border-red-200 uppercase tracking-wider">
                                            Desativado
                                        </span>
                                    )}
                                </h2>
                                <p className="text-sm text-gray-500">{estabelecimento.nome}</p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Link href={route('estabelecimentos.cupons', estabelecimento.id)} className="text-sm font-bold text-[#FF5A00] hover:text-[#C74B27] bg-[#FFF0E5] border border-orange-100 px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm">
                                <TicketIcon className="w-5 h-5"/> Marketing & Cupons
                            </Link>
                            <Link href={route('estabelecimentos.fila', estabelecimento.id)} className="text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-lg transition flex items-center gap-1 shadow-sm">
                                Ver Fila <ArrowRightIcon className="w-4 h-4"/>
                            </Link>
                        </div>
                    </div>
                </div>
            }
        >
            <Head title={`Configurações - ${estabelecimento.nome}`} />

            <div className="bg-[#FBF9F9] min-h-screen">
                {(mensagemSucesso || flash?.success || flash?.error || flash?.warning) && (
                    <div className="max-w-7xl mx-auto mt-4 px-4 sm:px-6 lg:px-8 space-y-2">
                        {(mensagemSucesso || flash?.success) && (
                            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
                                <CheckBadgeIcon className="w-5 h-5" /> <strong className="font-bold">Sucesso!</strong> {mensagemSucesso || flash.success}
                            </div>
                        )}
                        {flash?.error && (
                            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl shadow-sm flex items-center gap-2 animate-in fade-in">
                                <XMarkIcon className="w-5 h-5" /> <strong className="font-bold">Erro:</strong> {flash.error}
                            </div>
                        )}
                        {flash?.warning && (
                            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-xl shadow-sm flex items-center gap-2 animate-in fade-in">
                                <ExclamationTriangleIcon className="w-5 h-5" /> <strong className="font-bold">Atenção:</strong> {flash.warning}
                            </div>
                        )}
                    </div>
                )}

                <div className="max-w-7xl mx-auto mt-6 flex flex-col md:flex-row gap-8 pb-12 px-4 sm:px-6 lg:px-8">
                    
                    <aside className="w-full md:w-64 shrink-0">
                        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0">
                            <button onClick={() => setActiveTab('detalhes')} className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'detalhes' ? 'bg-[#FF5A00] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <MapPinIcon className="w-5 h-5"/> 1. Perfil da Loja
                            </button>
                            <button onClick={() => setActiveTab('equipe')} className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'equipe' ? 'bg-[#FF5A00] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <UserPlusIcon className="w-5 h-5"/> 2. Equipe / Profissionais
                            </button>
                            <button onClick={() => setActiveTab('servicos')} className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'servicos' ? 'bg-[#FF5A00] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <DocumentTextIcon className="w-5 h-5"/> 3. Catálogo de Serviços
                            </button>
                            <button onClick={() => setActiveTab('reservas_alugueis')} className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'reservas_alugueis' ? 'bg-[#FF5A00] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <CalendarIcon className="w-5 h-5"/> 4. Reservas / Locações
                            </button>

                            <Link href={route('estabelecimentos.contratos', estabelecimento.id)} className="text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap flex items-center gap-2 text-gray-600 hover:bg-gray-100">
                                <DocumentCheckIcon className="w-5 h-5"/> Contratos (Assinafy)
                            </Link>

                            <Link href={`/estabelecimentos/${estabelecimento.id}/loja`} className="mt-4 text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap flex items-center gap-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-sm">
                                <ArrowTopRightOnSquareIcon className="w-5 h-5"/> Ver a Loja Pública
                            </Link>
                        </nav>
                    </aside>

                    <main className="flex-1 min-w-0">

                        {/* ============================================================== */}
                        {/* ABA 1: PERFIL */}
                        {/* ============================================================== */}
                        {activeTab === 'detalhes' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                                    <form onSubmit={submitDetalhes} className="space-y-6">
                                        
                                        <div className="flex flex-col sm:flex-row items-center gap-6 pb-6 border-b border-gray-100">
                                            <div className="relative group cursor-pointer w-24 h-24 sm:w-32 sm:h-32 shrink-0">
                                                <label className="cursor-pointer w-full h-full block">
                                                    {fotoPerfilPreview ? (
                                                        <img 
                                                            src={fotoPerfilPreview} 
                                                            alt="Logo da Loja" 
                                                            className="w-full h-full object-cover rounded-2xl shadow-md border-2 border-white"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300 shadow-sm text-3xl font-bold text-gray-400 uppercase">
                                                            {formDetalhes.data.nome ? formDetalhes.data.nome.charAt(0) : 'L'}
                                                        </div>
                                                    )}
                                                    
                                                    <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1"><PhotoIcon className="w-4 h-4"/> Alterar</span>
                                                    </div>
                                                    
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        accept="image/*"
                                                        onChange={handleFotoEstabelecimento} 
                                                    />
                                                </label>
                                            </div>
                                            
                                            <div className="text-center sm:text-left">
                                                <h3 className="text-lg font-bold text-gray-900">Logo do Estabelecimento</h3>
                                                <p className="text-sm text-gray-400 mt-1 max-w-md">Esta imagem será exibida para os clientes na tela de agendamento e buscas. Formatos: JPG, PNG, WEBP (Max: 2MB).</p>
                                                <InputError message={formDetalhes.errors.foto_perfil} className="mt-2" />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-4 pb-6 border-b border-gray-100">
                                            <div className="w-full text-center sm:text-left">
                                                <h3 className="text-lg font-bold text-gray-900">Banner da Loja</h3>
                                                <p className="text-sm text-gray-400 mt-1">Este banner será exibido na parte superior da página pública do seu estabelecimento.</p>
                                            </div>
                                            
                                            <div className="relative group cursor-pointer w-full h-40 sm:h-56 shrink-0">
                                                <label className="cursor-pointer w-full h-full block">
                                                    {fotoBannerPreview ? (
                                                        <img 
                                                            src={fotoBannerPreview} 
                                                            alt="Banner da Loja" 
                                                            className="w-full h-full object-cover rounded-2xl shadow-md border-2 border-white"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-50 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-gray-300 shadow-sm text-xl font-bold text-gray-400 uppercase tracking-widest transition group-hover:bg-gray-100">
                                                            <PhotoIcon className="w-8 h-8 mb-2 text-gray-300"/>
                                                            Inserir Banner da Vitrine
                                                        </div>
                                                    )}
                                                    
                                                    <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2"><PhotoIcon className="w-5 h-5"/> Alterar Banner</span>
                                                    </div>
                                                    
                                                    <input 
                                                        type="file" 
                                                        className="hidden" 
                                                        accept="image/*"
                                                        onChange={handleFotoBanner} 
                                                    />
                                                </label>
                                            </div>
                                            <InputError message={formDetalhes.errors.foto_banner} className="mt-2" />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                                            <div className="md:col-span-2">
                                                <InputLabel value="Nome do Estabelecimento *" />
                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.nome ?? ''} onChange={e => formDetalhes.setData('nome', e.target.value)} required />
                                                <InputError message={formDetalhes.errors.nome} />
                                            </div>
                                            <div>
                                                <InputLabel value="Ramo de Atuação" />
                                                <select 
                                                    className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" 
                                                    value={formDetalhes.data.ramo_atuacao ?? ''} 
                                                    onChange={e => formDetalhes.setData('ramo_atuacao', e.target.value)}
                                                >
                                                    <option value="">Selecione a categoria...</option>
                                                    {ramosAtuacao.map(ramo => <option key={ramo} value={ramo}>{ramo}</option>)}
                                                </select>
                                                <InputError message={formDetalhes.errors.ramo_atuacao} />
                                            </div>
                                            <div>
                                                <InputLabel value="Telefone de Contato" />
                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.telefone ?? ''} onChange={e => formDetalhes.setData('telefone', e.target.value)} placeholder="(00) 00000-0000" />
                                                <InputError message={formDetalhes.errors.telefone} />
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-4 pt-6 border-t border-gray-100">Endereço</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                            <div className="md:col-span-2">
                                                <InputLabel value="CEP" />
                                                <TextInput 
                                                    className="mt-1 w-full focus:border-[#FF5A00]" 
                                                    value={formDetalhes.data.cep ?? ''} 
                                                    onChange={e => formDetalhes.setData('cep', e.target.value)} 
                                                    onBlur={(e) => buscarEnderecoAutomatizado(e.target.value, formDetalhes.setData, '')} 
                                                />
                                            </div>
                                            <div className="md:col-span-4"><InputLabel value="Rua / Avenida" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.rua ?? ''} onChange={e => formDetalhes.setData('rua', e.target.value)} /></div>
                                            <div className="md:col-span-2"><InputLabel value="Número" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.numero ?? ''} onChange={e => formDetalhes.setData('numero', e.target.value)} /></div>
                                            <div className="md:col-span-4"><InputLabel value="Complemento" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.complemento ?? ''} onChange={e => formDetalhes.setData('complemento', e.target.value)} placeholder="Sala, Loja, etc." /></div>
                                            <div className="md:col-span-2"><InputLabel value="Bairro" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.bairro ?? ''} onChange={e => formDetalhes.setData('bairro', e.target.value)} /></div>
                                            <div className="md:col-span-3"> <InputLabel value="Cidade" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.cidade ?? ''} onChange={e => formDetalhes.setData('cidade', e.target.value)} /></div>
                                            <div className="md:col-span-1">
                                                <InputLabel value="UF" />
                                                <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formDetalhes.data.estado ?? ''} onChange={e => formDetalhes.setData('estado', e.target.value)}>
                                                    <option value="">UF</option>
                                                    {ufsBrasil.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex justify-end pt-6"><PrimaryButton className="bg-[#FF5A00] px-8 py-3 rounded-xl shadow-lg">Salvar Alterações</PrimaryButton></div>
                                    </form>
                                </div>
                                
                                <div className={`p-6 sm:p-8 rounded-2xl shadow-sm border ${estabelecimento.ativo ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                    <h3 className={`text-lg font-bold mb-2 ${estabelecimento.ativo ? 'text-red-800' : 'text-green-800'}`}>
                                        {estabelecimento.ativo ? 'Desativar Estabelecimento' : 'Ativar Estabelecimento'}
                                    </h3>
                                    <p className={`text-sm mb-6 ${estabelecimento.ativo ? 'text-red-600' : 'text-green-600'}`}>
                                        {estabelecimento.ativo 
                                            ? 'Ao desativar, a sua loja deixará de aparecer para os clientes e não aceitará mais agendamentos.' 
                                            : 'A sua loja está fechada ao público. Clique no botão abaixo para ativar a loja.'}
                                    </p>
                                    <button onClick={toggleStatusEstabelecimento} className={`px-6 py-3 text-sm font-bold rounded-xl shadow-sm transition text-white ${estabelecimento.ativo ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                                        {estabelecimento.ativo ? 'Desativar Estabelecimento' : 'Ativar Estabelecimento'}
                                    </button>
                                </div>

                                {meusEstabelecimentos.length > 1 && (
                                    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200 mt-8">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">Navegar entre minhas lojas</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {filiaisPaginadas.map(est => (
                                                <div key={est.id} className={`p-4 rounded-xl border ${est.id === estabelecimento.id ? 'border-[#FF5A00] bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="font-bold text-gray-900 truncate pr-2">{est.nome}</span>
                                                        {est.ativo ? (
                                                            <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase">Ativo</span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-1 rounded-md uppercase">Inativo</span>
                                                        )}
                                                    </div>
                                                    {est.id === estabelecimento.id ? (
                                                        <span className="text-xs font-semibold text-orange-600 flex items-center gap-1"><MapPinIcon className="w-4 h-4"/> Você está aqui</span>
                                                    ) : (
                                                        <Link href={route('estabelecimentos.configuracoes', est.id)} className="text-sm font-bold text-orange-600 hover:text-orange-800 flex items-center gap-1">
                                                            Acessar Configurações <ArrowRightIcon className="w-4 h-4"/>
                                                        </Link>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {totalPaginasFiliais > 1 && (
                                            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                                                <span className="text-sm text-gray-500">Página {paginaFiliais} de {totalPaginasFiliais}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setPaginaFiliais(p => Math.max(1, p - 1))} disabled={paginaFiliais === 1} className="px-4 py-2 text-sm font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">Anterior</button>
                                                    <button onClick={() => setPaginaFiliais(p => Math.min(totalPaginasFiliais, p + 1))} disabled={paginaFiliais === totalPaginasFiliais} className="px-4 py-2 text-sm font-bold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition">Próxima</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ============================================================== */}
                        {/* ABA 2: EQUIPE */}
                        {/* ============================================================== */}
                        {activeTab === 'equipe' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                        {isEditingFuncionario ? <><DocumentTextIcon className="w-5 h-5 text-[#FF5A00]"/> Editar Profissional</> : <><PlusIcon className="w-5 h-5 text-[#FF5A00]"/> Cadastrar Novo Profissional</>}
                                    </h3>
                                    <form onSubmit={submitFuncionario} className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                            <div className="md:col-span-1">
                                                <InputLabel value="Nome Completo *" />
                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formFuncionario.data.nome ?? ''} onChange={e => formFuncionario.setData('nome', e.target.value)} required />
                                            </div>
                                            <div className="md:col-span-1">
                                                <InputLabel value="Telefone (Opcional)" />
                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formFuncionario.data.telefone ?? ''} onChange={e => formFuncionario.setData('telefone', e.target.value)} placeholder="(00) 00000-0000" />
                                            </div>
                                            <div className="md:col-span-1">
                                                <InputLabel value="Cargo / Papel no Sistema *" />
                                                <select className="mt-1 w-full py-3 border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formFuncionario.data.cargo ?? ''} onChange={e => formFuncionario.setData('cargo', e.target.value)} required>
                                                    <option value="Atendente">Atendente / Recepção</option>
                                                    <option value="Barbeiro">Barbeiro</option>
                                                    <option value="Médico">Médico(a) / Especialista</option>
                                                    <option value="Mecânico">Mecânico</option>
                                                    <option value="Gerente">Gerente</option>
                                                    <option value="Socio">Sócio</option>
                                                    <option value="Outro">Outro</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-2 border-t border-gray-100 pt-6">
                                                <InputLabel value="E-mail de Acesso *" />
                                                <TextInput type="email" className="mt-1 w-full focus:border-[#FF5A00]" value={formFuncionario.data.email ?? ''} onChange={e => formFuncionario.setData('email', e.target.value)} required={!isEditingFuncionario} placeholder="email@exemplo.com" />
                                            </div>
                                            <div className="md:col-span-1 border-t border-gray-100 pt-6">
                                                <InputLabel value="Senha de Acesso *" />
                                                <TextInput type="password" className="mt-1 w-full focus:border-[#FF5A00]" value={formFuncionario.data.password ?? ''} onChange={e => formFuncionario.setData('password', e.target.value)} required={!isEditingFuncionario} placeholder="Mínimo 8 caracteres" />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-4 gap-4">
                                            {isEditingFuncionario && (
                                                <button type="button" onClick={cancelarEdicaoFuncionario} className="px-6 py-3 text-gray-600 font-bold hover:text-gray-900 transition">Cancelar</button>
                                            )}
                                            <PrimaryButton className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg" disabled={formFuncionario.processing}>
                                                {isEditingFuncionario ? 'Salvar Alterações' : 'Cadastrar Profissional'}
                                            </PrimaryButton>
                                        </div>
                                    </form>
                                </div>

                                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
                                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                        <h3 className="text-lg font-bold text-gray-900">Equipe Atual ({funcionarios.length})</h3>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {funcionarios.length === 0 ? <p className="p-6 text-gray-500 text-center">Nenhum profissional cadastrado.</p> : funcionariosPaginados.map(func => (
                                            <div key={func.id} className={`p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center transition ${func.ativo ? 'hover:bg-gray-50' : 'bg-red-50/50 opacity-75'}`}>
                                                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold uppercase ${func.ativo ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>{func.nome.charAt(0)}</div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className={`font-bold ${func.ativo ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{func.nome}</h4>
                                                            {func.ativo ? <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">Ativo</span> : <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">Desativado</span>}
                                                        </div>
                                                        <p className="text-sm text-gray-500 font-medium">{func.cargo} {func.telefone && `• ${func.telefone}`}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 border-t sm:border-0 border-gray-100 pt-4 sm:pt-0">
                                                    <button onClick={() => editarFuncionario(func)} className="text-white font-bold text-sm bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg border border-orange-600 transition">Editar</button>
                                                    {func.ativo && <button onClick={() => deletarFuncionario(func.id)} className="text-white font-bold text-sm bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg border border-red-700 transition">Remover</button>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {totalPaginasFuncionarios > 1 && (
                                        <div className="flex items-center justify-between p-6 border-t border-gray-100 bg-gray-50">
                                            <span className="text-sm text-gray-500">Página {paginaFuncionarios} de {totalPaginasFuncionarios}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setPaginaFuncionarios(p => Math.max(1, p - 1))} disabled={paginaFuncionarios === 1} className="px-4 py-2 text-sm font-bold bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition">Anterior</button>
                                                <button onClick={() => setPaginaFuncionarios(p => Math.min(totalPaginasFuncionarios, p + 1))} disabled={paginaFuncionarios === totalPaginasFuncionarios} className="px-4 py-2 text-sm font-bold bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition">Próxima</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ============================================================== */}
                        {/* ABA 3: CATÁLOGO DE SERVIÇOS (COM HORA MARCADA) */}
                        {/* ============================================================== */}
                        {activeTab === 'servicos' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                {visualizandoServico ? (
                                    <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100">
                                        <button onClick={fecharVisualizacaoServico} className="mb-8 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#FF5A00] transition">
                                            <ArrowLeftIcon className="w-4 h-4" /> Voltar para o Catálogo
                                        </button>
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                            <div className="lg:col-span-5 space-y-4">
                                                <div className="aspect-square bg-gray-50 rounded-[2rem] overflow-hidden border shadow-sm relative">
                                                    {parseArraySeguro(visualizandoServico.fotos).length > 0 ? <img src={parseArraySeguro(visualizandoServico.fotos)[fotoDetalheIndexServico] || parseArraySeguro(visualizandoServico.fotos)[0]} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-gray-300"><PhotoIcon className="w-16 h-16 mb-2" /><span className="text-xs font-bold uppercase tracking-widest">Sem Imagem</span></div>}
                                                </div>
                                            </div>
                                            <div className="lg:col-span-7 flex flex-col pt-2">
                                                <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">{visualizandoServico.nome}</h1>
                                                <p className="text-lg font-bold text-gray-400 uppercase tracking-widest mb-6">{visualizandoServico.tipo_servico}</p>
                                                <div className="mt-10 flex justify-between items-end mt-auto">
                                                    <button onClick={() => { fecharVisualizacaoServico(); editarServico(visualizandoServico); }} className="px-8 py-4 bg-[#0F172A] text-white font-bold rounded-2xl shadow-lg">Editar Serviço</button>
                                                    <div className="text-right">
                                                        <span className="text-5xl font-black text-[#FF5A00] tracking-tight"><span className="text-2xl text-gray-400">R$ </span>{Number(visualizandoServico.valor).toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                                        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                            {isEditingServico ? <><DocumentTextIcon className="w-5 h-5 text-[#FF5A00]"/> Editar Serviço</> : <><PlusIcon className="w-5 h-5 text-[#FF5A00]"/> Adicionar Novo Serviço</>}
                                        </h3>
                                        <form onSubmit={submitServico} className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <InputLabel value="Categoria / Tipo de Serviço *" />
                                                    <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formServico.data.tipo_servico ?? ''} onChange={e => formServico.setData('tipo_servico', e.target.value)} required>
                                                        <option value="">Selecione...</option>
                                                        <option value="Beleza e Estética">Beleza e Estética</option>
                                                        <option value="Saúde e Bem-Estar">Saúde e Bem-Estar</option>
                                                         <option value="Automotivo">Automotivo</option>
                                                         <option value="Turismo e Viagens">Turismo e Viagens</option>
                                                        <option value="Casa e Construção">Casa e Construção</option>
                                                        <option value="Casa e Construção">Casamentos e aniversários</option>
                                                        <option value="Tecnologia">Tecnologia</option>
                                                        <option value="Educação e Cursos">Educação e Cursos</option>
                                                        <option value="Eventos e Entretenimento">Eventos e Entretenimento</option>
                                                        <option value="Serviços Profissionais">Serviços Profissionais</option>
                                                        <option value="Pets e Animais">Pets e Animais</option>
                                                    </select>
                                                </div>
                                                <div><InputLabel value="Nome do Serviço *" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formServico.data.nome ?? ''} onChange={e => formServico.setData('nome', e.target.value)} required /></div>
                                                <div><InputLabel value="Valor (R$) *" /><TextInput type="number" step="0.01" className="w-full mt-1 focus:border-[#FF5A00]" value={formServico.data.valor ?? ''} onChange={e => formServico.setData('valor', e.target.value)} required /></div>
                                                <div><InputLabel value="Duração (Minutos) *" /><TextInput type="number" className="w-full mt-1 focus:border-[#FF5A00]" value={formServico.data.duracao_minutos ?? ''} onChange={e => formServico.setData('duracao_minutos', e.target.value)} required /></div>
                                                
                                                <div className="md:col-span-2">
                                                    <InputLabel value="Descrição Pública" />
                                                    <textarea className="mt-1 w-full border-gray-300 rounded-xl focus:border-[#FF5A00]" rows="3" value={formServico.data.descricao ?? ''} onChange={e => formServico.setData('descricao', e.target.value)}></textarea>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <InputLabel value="Profissional Padrão Allocado (Opcional)" />
                                                    <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formServico.data.funcionario_id ?? ''} onChange={e => formServico.setData('funcionario_id', e.target.value)}>
                                                        <option value="">Qualquer profissional disponível</option>
                                                        {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                                                    </select>
                                                </div>

                                                <div className="md:col-span-2 border-t border-gray-100 pt-6">
                                                    <InputLabel value="Fotos de Demonstração do Serviço" />
                                                    <p className="text-xs text-gray-500 mb-4 mt-1">
                                                        Adicione até 5 fotos. <strong className="text-[#FF5A00]">A primeira foto será a capa.</strong>
                                                    </p>
                                                    <div className="flex flex-wrap gap-4">
                                                        {[0, 1, 2, 3, 4].map((index) => {
                                                            const arquivo = quadradosFotos[index];
                                                            const previewUrl = arquivo instanceof File ? URL.createObjectURL(arquivo) : arquivo;
                                                            const isCapa = index === 0;
                                                            return (
                                                                <div key={index} className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                                                                    {arquivo ? (
                                                                        <>
                                                                            <img src={previewUrl} className={`w-full h-full object-cover rounded-xl shadow-sm ${isCapa ? 'border-2 border-[#FF5A00]' : 'border border-gray-200'}`} />
                                                                            {isCapa && <div className="absolute bottom-0 left-0 w-full bg-[#FF5A00]/90 text-white text-[9px] font-bold text-center py-1 rounded-b-xl uppercase tracking-widest backdrop-blur-sm">Capa</div>}
                                                                            <button type="button" onClick={() => removerFotoQuadrado(index)} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-md z-10"><XMarkIcon className="w-4 h-4"/></button>
                                                                        </>
                                                                    ) : (
                                                                        <label className={`cursor-pointer w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition ${isCapa ? 'border-orange-300 bg-orange-50/50 hover:border-[#FF5A00] hover:bg-orange-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-orange-400'}`}>
                                                                            <span className={`text-2xl font-light ${isCapa ? 'text-[#FF5A00]' : 'text-gray-400'}`}><PlusIcon className="w-6 h-6"/></span>
                                                                            <span className={`text-[10px] font-bold mt-1 uppercase ${isCapa ? 'text-[#FF5A00]' : 'text-gray-400'}`}>{isCapa ? 'Capa' : `Foto ${index + 1}`}</span>
                                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFotoQuadrado(index, e.target.files[0])} />
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <InputError message={formServico.errors.fotos} className="mt-2" />
                                                </div>

                                                <div className="md:col-span-2">
                                                    <InputLabel value="Dias Disponíveis" className="mb-2" />
                                                    <div className="flex flex-wrap gap-2">
                                                        {['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'].map(dia => (
                                                            <button type="button" key={dia} onClick={() => handleDiaToggle(dia)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize border ${formServico.data.dias_disponiveis.includes(dia) ? 'bg-orange-100 text-[#FF5A00] border-orange-300' : 'bg-white text-gray-500'}`}>{dia.substring(0,3)}</button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="md:col-span-2 p-5 bg-gray-50 rounded-xl border">
                                                    <InputLabel value="Horários Operacionais *" className="mb-2" />
                                                    <div className="flex gap-3 mb-4">
                                                        <TextInput type="time" value={novoHorario ?? ''} onChange={e => setNovoHorario(e.target.value)} className="w-32 text-center focus:border-[#FF5A00]" />
                                                        <button type="button" onClick={adicionarHorario} className="px-4 py-2 bg-gray-200 text-sm font-bold rounded-lg hover:bg-gray-300">Incluir Horário</button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {formServico.data.horarios_disponiveis.map(h => (
                                                            <span key={h} className="inline-flex items-center gap-2 bg-[#FF5A00] text-white px-3 py-1 rounded-full text-sm font-bold">
                                                                {h} <button type="button" onClick={() => removerHorario(h)}><XMarkIcon className="w-4 h-4"/></button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex justify-end pt-4 gap-2">
                                                {isEditingServico && <button type="button" onClick={cancelarEdicaoServico} className="px-4 py-2 text-gray-500 font-bold">Cancelar</button>}
                                                <PrimaryButton className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg" disabled={formServico.processing}>
                                                    {isEditingServico ? 'Salvar Alterações' : 'Salvar Serviço'}
                                                </PrimaryButton>
                                            </div>
                                        </form>
                                    </div>
                                )}
                                <div className="bg-white rounded-2xl border p-6 shadow-sm">
                                    <h3 className="font-bold text-gray-900 text-lg mb-4">Serviços Cadastrados</h3>
                                    <div className="divide-y">
                                        {servicos.map(s => (
                                            <div key={s.id} className="py-4 flex justify-between items-center">
                                                <div>
                                                    <h4 className="font-bold text-gray-900">{s.nome}</h4>
                                                    <p className="text-sm text-gray-500">R$ {s.valor} • {s.duracao_minutos} min</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => visualizarServico(s)} className="text-xs font-bold text-gray-700 bg-gray-100 border px-3 py-1.5 rounded-lg transition">Ver</button>
                                                    <button onClick={() => editarServico(s)} className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 border-orange-600 px-3 py-1.5 rounded-lg transition">Editar</button>
                                                    <button onClick={() => deletarServico(s.id)} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 border-red-700 px-3 py-1.5 rounded-lg transition">Remover</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* 👉 ABA 4: RESERVAS E LOCAÇÕES (MÓDULO TOTALMENTE PROTEGIDO E INTEGRADO)   */}
                        {/* ========================================================================= */}
                        {activeTab === 'reservas_alugueis' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                
                                {visualizandoItem ? (
                                    <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                                        <button onClick={() => setVisualizandoItem(null)} className="mb-8 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#FF5A00] transition">
                                            <ArrowLeftIcon className="w-4 h-4" /> Voltar para o Catálogo
                                        </button>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                            <div className="lg:col-span-5 space-y-4">
                                                <div className="aspect-square bg-gray-50 rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm relative">
                                                    {parseArraySeguro(visualizandoItem.fotos).length > 0 ? (
                                                        <img src={parseArraySeguro(visualizandoItem.fotos)[fotoDetalheIndexItem] || parseArraySeguro(visualizandoItem.fotos)[0]} className="w-full h-full object-cover" alt="Item" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300"><PhotoIcon className="w-16 h-16 mb-2" /><span className="text-xs font-bold uppercase tracking-widest">Sem Imagem</span></div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="lg:col-span-7 flex flex-col pt-2">
                                                <span className="text-xs font-bold text-[#FF5A00] uppercase tracking-widest mb-2">{visualizandoItem.categoria.replace(/_/g, ' ')}</span>
                                                <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-tight mb-4">{visualizandoItem.nome}</h1>

                                                <div className="mb-6 flex items-end gap-3">
                                                    <span className="text-5xl font-black text-[#FF5A00] tracking-tight flex items-baseline gap-1">
                                                        <span className="text-2xl text-gray-400">R$ </span>
                                                        {Number(visualizandoItem.valor_diaria || visualizandoItem.valor_mensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-gray-500 font-bold mb-1 uppercase text-xs tracking-wider">/ Faturamento Base</span>
                                                </div>

                                                <div className="p-4 bg-gray-50 border rounded-xl font-medium text-sm text-gray-700 space-y-2">
                                                    <p><strong>Cobrança Ativa por:</strong> <span className="capitalize">{visualizandoItem.periodo_faturamento_padrao}</span></p>
                                                    <p><strong>Regra de Transação:</strong> {visualizandoItem.permitir_pagamento === 'online' ? 'Online (Taxa Retida de 12%)' : 'Presencial (Saldo Devedor de 12% Acumulado)'}</p>
                                                    {visualizandoItem.exige_contrato && <p className="text-orange-600 mt-2 flex items-center gap-1"><DocumentCheckIcon className="w-4 h-4"/> Este item exige assinatura de contrato.</p>}
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-4 mt-auto border-t border-gray-100 pt-8">
                                                    <button onClick={() => { setVisualizandoItem(null); editarItem(visualizandoItem); }} className="flex-1 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full shadow-lg flex justify-center items-center gap-2">
                                                        <DocumentTextIcon className="w-5 h-5" /> Editar Configurações
                                                    </button>
                                                    <button onClick={() => deletarItem(visualizandoItem.id)} className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition flex justify-center items-center gap-2">
                                                        <TrashIcon className="w-5 h-5" /> Apagar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
                                        <form onSubmit={submitItemLocacao} className="space-y-8">
                                            
                                            {/* SESSÃO 1: INFORMAÇÕES BÁSICAS */}
                                            <div>
                                                <h3 className="text-xl font-black text-gray-900 mb-2 flex items-center gap-2">
                                                    {isEditingItem ? <><DocumentTextIcon className="w-5 h-5 text-gray-400"/> Editar Item de Locação</> : <><PlusIcon className="w-5 h-5 text-gray-400"/> Adicionar Novo Item de Locação</>}
                                                </h3>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                                    <div>
                                                        <InputLabel value="Nome do Item *" />
                                                        <TextInput maxLength={100} className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.nome ?? ''} onChange={e => formItem.setData('nome', e.target.value)} required />
                                                    </div>
                                                    <div>
                                                        <InputLabel value="Categoria *" />
                                                        <select className="mt-1 w-full py-3 border-gray-300 rounded-xl text-sm focus:border-[#FF5A00]" value={formItem.data.categoria ?? ''} onChange={e => formItem.setData('categoria', e.target.value)} required>
                                                            <option value="casa">Casa / Espaço</option>
                                                            <option value="carro">Carro / Frota</option>
                                                            <option value="casa">Restaurante / Mesa</option>
                                                            <option value="barco">Barco / Passeio Náutico</option>
<option value="bicicleta">Bicicleta / Equipamento Esportivo</option>
<option value="moto">Moto / Motocicleta</option>
<option value="motorhome">Motorhome / Trailer</option>
<option value="coworking">Coworking / Estação de Trabalho</option>
<option value="sala_reuniao">Sala de Reunião</option>
<option value="pesque_pague">Pesque-Pague / Área de Pesca</option>
<option value="parque">Parque / Área Recreativa</option>
<option value="area_camping">Camping / Área para Acampamento</option>
<option value="turismo">Atrativo Turístico / Visitação</option>
                                                            <option value="equipamento">Equipamento / Máquina</option>
                                                        </select>
                                                    </div>
                                                    <div><InputLabel value="Quantidade Estoque *" /><TextInput type="number" className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.quantidade ?? ''} onChange={e => formItem.setData('quantidade', e.target.value)} required /></div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                                    <div><InputLabel value="Marca / Fabricante" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.marca ?? ''} onChange={e => formItem.setData('marca', e.target.value)} /></div>
                                                    
                                                    {(esVeiculo || esEquipamento) && (
                                                        <div>
                                                            <InputLabel value="Modelo" />
                                                            {esVeiculo ? (
                                                                <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formItem.data.modelo ?? ''} onChange={e => formItem.setData('modelo', e.target.value)}>
                                                                    <option value="">Selecione...</option>
                                                                    <option value="Hatches compactos">Hatches </option>
                                                                    <option value="Sedãs">Sedãs</option>
                                                                    <option value="SUVs">SUVs</option>
                                                                    <option value="Picapes">Picapes</option>
                                                                    <option value="Outros">Outros</option>
                                                                </select>
                                                            ) : (
                                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.modelo ?? ''} onChange={e => formItem.setData('modelo', e.target.value)} />
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    <div>
                                                        <InputLabel value="Tipo / Subtipo" />
                                                        <input 
                                                            list="opcoes-tipo" 
                                                            className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]" 
                                                            value={formItem.data.tipo ?? ''} 
                                                            onChange={e => formItem.setData('tipo', e.target.value)} 
                                                            placeholder="Escolha ou digite..."
                                                        />
                                                        <datalist id="opcoes-tipo">
                                                            {esImovel && <><option value="Residencial"/><option value="Comercial"/><option value="Lazer"/></>}
                                                            {esVeiculo && <><option value="Passeio"/><option value="Utilitário"/><option value="Luxo"/></>}
                                                            {esEquipamento && <><option value="Construção"/><option value="Audiovisual"/><option value="Festa"/></>}
                                                        </datalist>
                                                    </div>
                                                </div>
                                            </div>

                                            <hr className="border-gray-100" />

                                            {/* 👉 FOTOS DA LOCAÇÃO DE VOLTA AQUI COM 24 QUADRADOS */}
                                            <div className="border-t border-gray-100 pt-6">
                                                <InputLabel value="Fotos da Vitrine de Locação" />
                                                <p className="text-xs text-gray-500 mb-4 mt-1">
                                                    Adicione até 24 fotos. <strong className="text-[#FF5A00]">A primeira foto será a capa.</strong> Formatos: JPG, PNG, WEBP (Max: 4MB).
                                                </p>
                                                <div className="flex flex-wrap gap-4 mt-4">
                                                    {Array.from({ length: 24 }).map((_, index) => {
                                                        const arquivo = quadradosFotosItem[index];
                                                        const previewUrl = arquivo instanceof File ? URL.createObjectURL(arquivo) : arquivo;
                                                        const isCapa = index === 0;
                                                        return (
                                                            <div key={index} className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                                                                {arquivo ? (
                                                                    <>
                                                                        <img src={previewUrl} className={`w-full h-full object-cover rounded-xl border ${isCapa ? 'border-[#FF5A00]' : 'border-gray-200'} shadow-sm`} />
                                                                        {isCapa && <div className="absolute bottom-0 left-0 w-full bg-[#FF5A00]/90 text-white text-[9px] font-bold text-center py-1 rounded-b-xl uppercase tracking-widest backdrop-blur-sm">Capa</div>}
                                                                        <button type="button" onClick={() => removerFotoItemQuadrado(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow-md z-10"><XMarkIcon className="w-4 h-4"/></button>
                                                                    </>
                                                                ) : (
                                                                    <label className={`cursor-pointer w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-gray-50/50 hover:bg-gray-100 transition-colors ${isCapa ? 'border-orange-200 hover:border-orange-400' : 'border-gray-200'}`}>
                                                                        <span className="text-xl font-light text-gray-400"><PlusIcon className="w-6 h-6"/></span>
                                                                        <span className="text-[10px] font-bold mt-1 text-gray-400 uppercase tracking-widest">{isCapa ? 'Capa' : `Foto ${index + 1}`}</span>
                                                                        <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFotoItemQuadrado(index, e.target.files[0])} />
                                                                    </label>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <InputError message={formItem.errors.fotos} className="mt-2" />
                                            </div>

                                            <hr className="border-gray-100" />

                                            {/* SESSÃO 2: FINANCEIRO E REGRAS DA PLATAFORMA */}
                                            <div>
                                                <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2"><CurrencyDollarIcon className="w-5 h-5 text-[#FF5A00]"/> Matriz Financeira Base</h4>
                                                <div className="p-6 bg-gray-50 rounded-2xl border grid grid-cols-1 md:grid-cols-4 gap-4">
                                                    <div><InputLabel value="Valor Diária (R$)" /><TextInput type="number" step="0.01" onBlur={(e) => formatarDecimaisItemOnBlur('valor_diaria', e.target.value)} className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.valor_diaria ?? ''} onChange={e => formItem.setData('valor_diaria', e.target.value)} /></div>
                                                    <div><InputLabel value="Valor Semanal (R$)" /><TextInput type="number" step="0.01" onBlur={(e) => formatarDecimaisItemOnBlur('valor_semanal', e.target.value)} className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.valor_semanal ?? ''} onChange={e => formItem.setData('valor_semanal', e.target.value)} /></div>
                                                    <div><InputLabel value="Valor Mensal (R$)" /><TextInput type="number" step="0.01" onBlur={(e) => formatarDecimaisItemOnBlur('valor_mensal', e.target.value)} className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.valor_mensal ?? ''} onChange={e => formItem.setData('valor_mensal', e.target.value)} /></div>
                                                    <div><InputLabel value="Valor Caução (R$)" /><TextInput type="number" step="0.01" onBlur={(e) => formatarDecimaisItemOnBlur('valor_caucao', e.target.value)} className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.valor_caucao ?? ''} onChange={e => formItem.setData('valor_caucao', e.target.value)} /></div>
                                                </div>

                                                <div className="p-6 bg-white border rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 shadow-sm">
                                                    <div>
                                                        <InputLabel value="Período Escolhido para Cobrança Padrão *" />
                                                        <select className="mt-1 w-full py-3 border-gray-300 rounded-xl font-medium text-sm focus:border-[#FF5A00]" value={formItem.data.periodo_faturamento_padrao ?? ''} onChange={e => formItem.setData('periodo_faturamento_padrao', e.target.value)} required>
                                                            <option value="diaria">Cobrar por Diária</option>
                                                            <option value="semanal">Cobrar por Semana</option>
                                                            <option value="mensal">Cobrar por Mês</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <InputLabel value="Forma de Liquidação / Pagamento *" />
                                                        <select className="mt-1 w-full py-3 border-gray-300 rounded-xl font-medium text-sm focus:border-[#FF5A00]" value={formItem.data.permitir_pagamento ?? ''} onChange={e => formItem.setData('permitir_pagamento', e.target.value)} required>
                                                            <option value="online">Pagamento Online (Via App com Split Direto)</option>
                                                            <option value="presencial">Pagamento Presencial (Direto ao Estabelecimento)</option>
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="mt-6 flex flex-col lg:flex-row gap-6">
                                                    {/* 👉 NOVO BLOCO: PROMOÇÕES E PONTUAÇÃO */}
                                                    <div className="flex-1 bg-gradient-to-br from-orange-50 to-orange-100/50 p-6 rounded-3xl border border-orange-200">
                                                        <h4 className="text-sm font-black text-orange-900 uppercase tracking-wider mb-6 flex items-center gap-2"><GiftIcon className="w-5 h-5"/> Promoções e Fidelidade</h4>
                                                        
                                                        {/* Promoção */}
                                                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 mb-4">
                                                            <label className="flex items-center justify-between cursor-pointer mb-4">
                                                                <div>
                                                                    <span className="font-bold text-sm text-gray-900 block">Habilitar Preço Promocional?</span>
                                                                    <span className="text-xs text-gray-500">Crie iscas para alugar mais rápido.</span>
                                                                </div>
                                                                <div className="relative inline-flex items-center">
                                                                    <input type="checkbox" className="sr-only peer" checked={formItem.data.tem_promocao} onChange={e => formItem.setData('tem_promocao', e.target.checked)} />
                                                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF5A00]"></div>
                                                                </div>
                                                            </label>

                                                            {formItem.data.tem_promocao && (
                                                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 pt-4 border-t border-gray-100">
                                                                    <div>
                                                                        <InputLabel value="Tipo de Desconto" />
                                                                        <select className="mt-1 w-full border-gray-300 rounded-lg text-sm focus:border-[#FF5A00]" value={formItem.data.tipo_desconto ?? ''} onChange={e => formItem.setData('tipo_desconto', e.target.value)}>
                                                                            <option value="percentual">Porcentagem (%)</option>
                                                                            <option value="fixo">Fixo (R$)</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <InputLabel value="Valor do Desconto" />
                                                                        <TextInput type="number" min="0" step="0.01" className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.valor_desconto ?? ''} onChange={e => formItem.setData('valor_desconto', e.target.value)} placeholder="Ex: 20" required={formItem.data.tem_promocao} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Pontos */}
                                                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100">
                                                            <label className="flex items-center justify-between cursor-pointer mb-4">
                                                                <div>
                                                                    <span className="font-bold text-sm text-gray-900 block">Aceitar Pontos LOKYVA?</span>
                                                                    <span className="text-xs text-gray-500">Permitir desconto usando a carteira do app.</span>
                                                                </div>
                                                                <div className="relative inline-flex items-center">
                                                                    <input type="checkbox" className="sr-only peer" checked={formItem.data.aceita_pontos} onChange={e => formItem.setData('aceita_pontos', e.target.checked)} />
                                                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF5A00]"></div>
                                                                </div>
                                                            </label>

                                                            {formItem.data.aceita_pontos && (
                                                                <div className="animate-in fade-in slide-in-from-top-2 pt-4 border-t border-gray-100">
                                                                    <InputLabel value="Máximo de Pontos Permitidos por Reserva" />
                                                                    <TextInput type="number" min="1" className="mt-1 w-full focus:border-[#FF5A00]" value={formItem.data.maximo_pontos_permitidos ?? ''} onChange={e => formItem.setData('maximo_pontos_permitidos', e.target.value)} placeholder="Ex: 100 pontos" required={formItem.data.aceita_pontos} />
                                                                    <p className="text-[10px] text-gray-400 mt-1">Lembre-se: 100 pontos = R$ 1,00 de desconto.</p>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Burocracia - Contrato */}
                                                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 mt-4">
                                                            <label className="flex items-center justify-between cursor-pointer">
                                                                <div>
                                                                    <span className="font-bold text-sm text-gray-900 block flex items-center gap-1"><DocumentCheckIcon className="w-4 h-4"/> Exigir Assinatura de Contrato</span>
                                                                    <span className="text-xs text-gray-500">O cliente deverá assinar digitalmente.</span>
                                                                </div>
                                                                <div className="relative inline-flex items-center">
                                                                    <input type="checkbox" className="sr-only peer" checked={formItem.data.exige_contrato} onChange={e => formItem.setData('exige_contrato', e.target.checked)} />
                                                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                                </div>
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {/* 👉 NOVO BLOCO: SIMULADOR FINANCEIRO (CLARO E COM TOGGLE) */}
                                                    <div className="w-full mt-6 flex-1">
                                                        {!mostrarSimulador ? (
                                                            <button type="button" onClick={() => setMostrarSimulador(true)} className="px-6 py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl border border-indigo-200 hover:bg-indigo-100 transition flex items-center gap-2">
                                                                <CurrencyDollarIcon className="w-5 h-5"/> Abrir Simulador de Repasse
                                                            </button>
                                                        ) : (
                                                            <div className="w-full bg-white p-6 rounded-3xl border border-gray-200 shadow-lg flex flex-col relative animate-in fade-in zoom-in duration-300">
                                                                <button type="button" onClick={() => setMostrarSimulador(false)} className="absolute top-4 right-4 bg-gray-100 text-gray-500 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition">
                                                                    <XMarkIcon className="w-5 h-5" />
                                                                </button>
                                                                <h4 className="text-sm font-black uppercase tracking-wider mb-2 flex items-center gap-2 text-gray-800">
                                                                    <CurrencyDollarIcon className="w-5 h-5 text-[#FF5A00]"/> Simulador de Repasse Financeiro
                                                                </h4>
                                                                <p className="text-[11px] text-gray-500 mb-6 leading-relaxed max-w-2xl">
                                                                    Veja quanto o cliente vai pagar e o valor líquido exato que vai entrar na sua conta após aplicar a taxa da LOKYVA (12%) e os seus descontos e pontos.
                                                                </p>
                                                                
                                                                {formItem.data.aceita_pontos && (
                                                                    <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200 max-w-md">
                                                                        <InputLabel value="Simular uso de pontos:" className="text-gray-700 text-xs font-bold" />
                                                                        <div className="flex items-center gap-2 mt-2">
                                                                            <TextInput 
                                                                                type="number" 
                                                                                min="0" 
                                                                                max={formItem.data.maximo_pontos_permitidos || 0}
                                                                                className="w-full text-sm font-bold bg-white text-gray-900 border-gray-300 focus:border-[#FF5A00]" 
                                                                                value={simulacaoPontos ?? ''} 
                                                                                onChange={e => setSimulacaoPontos(e.target.value)} 
                                                                                placeholder="Ex: 100"
                                                                            />
                                                                            <span className="text-xs font-bold text-gray-500 w-32 bg-gray-200 px-3 py-2 rounded-lg text-center">
                                                                                -R$ {((parseInt(simulacaoPontos)||0)/100).toFixed(2)}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-[10px] text-gray-500 mt-2 font-medium">Máx permitido: {formItem.data.maximo_pontos_permitidos || 0} pts</p>
                                                                    </div>
                                                                )}

                                                                <div className="flex flex-col xl:flex-row gap-6 items-stretch">
                                                                    <SimularRepasse label="Base: 1 Diária" valor={formItem.data.valor_diaria} />
                                                                    {formItem.data.valor_semanal && <SimularRepasse label="Base: 1 Semana" valor={formItem.data.valor_semanal} />}
                                                                    {formItem.data.valor_mensal && <SimularRepasse label="Base: 1 Mês" valor={formItem.data.valor_mensal} />}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <hr className="border-gray-100" />

                                            {/* 👉 SESSÃO GIGANTE 3: CONFIGURAÇÕES DE DISPONIBILIDADE */}
                                            <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6 md:p-8 space-y-8">
                                                <div className="flex items-center gap-3 border-b border-gray-200 pb-4">
                                                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center shrink-0">
                                                        <CalendarIcon className="w-6 h-6 text-[#FF5A00]" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-black text-gray-900">Configurações de Disponibilidade</h3>
                                                        <p className="text-xs text-gray-500">Defina perfeitamente quando e como este item pode ser reservado pelos clientes.</p>
                                                    </div>
                                                </div>

                                                {/* BLOCO 1 E 2: CONFIGURAÇÃO GERAL E DATAS */}
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                    <div className="space-y-5">
                                                        <h4 className="font-bold text-gray-800 text-sm">1. Configuração Geral</h4>
                                                        
                                                        <label className="flex items-center justify-between bg-white p-4 rounded-xl border cursor-pointer hover:border-orange-300 transition shadow-sm">
                                                            <div>
                                                                <span className="font-bold text-sm text-gray-900 block">Sempre Disponível</span>
                                                                <span className="text-xs text-gray-500">Ative para ignorar o período fixo abaixo.</span>
                                                            </div>
                                                            <div className="relative inline-flex items-center">
                                                                <input type="checkbox" className="sr-only peer" checked={formItem.data.sempre_disponivel} onChange={e => formItem.setData('sempre_disponivel', e.target.checked)} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF5A00]"></div>
                                                            </div>
                                                        </label>

                                                        <div>
                                                            <InputLabel value="Tipo de Disponibilidade do Item" />
                                                            <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formItem.data.tipo_disponibilidade ?? ''} onChange={e => formItem.setData('tipo_disponibilidade', e.target.value)}>
                                                                <option value="todos">Todos os dias</option>
                                                                <option value="dias_semana">Apenas Dias da Semana Específicos</option>
                                                                <option value="dias_mes">Apenas Dias do Mês Específicos</option>
                                                                <option value="datas_especificas">Apenas Datas Específicas</option>
                                                            </select>
                                                        </div>

                                                        {!formItem.data.sempre_disponivel && (
                                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                                                <div><InputLabel value="Início da Temporada" /><TextInput type="date" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.data_inicio_disponibilidade ?? ''} onChange={e => formItem.setData('data_inicio_disponibilidade', e.target.value)} /></div>
                                                                <div><InputLabel value="Fim da Temporada" /><TextInput type="date" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.data_fim_disponibilidade ?? ''} onChange={e => formItem.setData('data_fim_disponibilidade', e.target.value)} /></div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-5">
                                                        <h4 className="font-bold text-gray-800 text-sm">2. Seleção de Regras e Datas</h4>
                                                        
                                                        {(formItem.data.tipo_disponibilidade === 'todos' || formItem.data.tipo_disponibilidade === 'dias_semana') && (
                                                            <div>
                                                                <InputLabel value="Quais dias da semana está liberado?" />
                                                                <div className="flex flex-wrap gap-1.5 mt-2">
                                                                    {['segunda','terca','quarta','quinta','sexta','sabado','domingo'].map(dia => {
                                                                        const isSel = parseArraySeguro(formItem.data.dias_semana_disponiveis).includes(dia);
                                                                        return (
                                                                            <button type="button" key={dia} onClick={() => handleDiaSemanaToggle(dia)} className={`px-3 py-2 text-xs font-bold uppercase rounded-lg border transition ${isSel ? 'bg-[#FF5A00] text-white border-[#FF5A00]' : 'bg-white text-gray-500 hover:bg-gray-100'}`}>
                                                                                {dia.substring(0,3)}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {formItem.data.tipo_disponibilidade === 'dias_mes' && (
                                                            <div className="animate-in fade-in">
                                                                <InputLabel value="Dias do mês permitidos" />
                                                                <TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={diasMesInput ?? ''} onChange={e => setDiasMesInput(e.target.value)} placeholder="Ex: 1, 5, 10, 15, 20" />
                                                            </div>
                                                        )}

                                                        {formItem.data.tipo_disponibilidade === 'datas_especificas' && (
                                                            <div className="animate-in fade-in bg-white p-4 rounded-xl border">
                                                                <InputLabel value="Datas Especificas Permitidas" />
                                                                <div className="flex items-center gap-2 mt-1 mb-3">
                                                                    <TextInput type="date" value={novaDataPermitida ?? ''} onChange={e => setNovaDataPermitida(e.target.value)} className="flex-1 focus:border-[#FF5A00]" />
                                                                    <button type="button" onClick={addDataPermitida} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 font-bold rounded-lg">+</button>
                                                                </div>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {parseArraySeguro(formItem.data.datas_permitidas).map(d => (
                                                                        <span key={d} className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold flex items-center gap-2">
                                                                            {d} <button type="button" onClick={() => formItem.setData('datas_permitidas', formItem.data.datas_permitidas.filter(x => x !== d))}><XMarkIcon className="w-3 h-3"/></button>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <hr className="border-gray-200" />

                                                {/* BLOCO 3: HORÁRIOS DE OPERAÇÃO */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-800 text-sm">3. Horários de Operação Diária</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-5 rounded-2xl border shadow-sm">
                                                        <div>
                                                            <InputLabel value="Horário Início (Retirada / Check-in)" />
                                                            <TextInput type="time" className="w-full mt-1 bg-gray-50 focus:border-[#FF5A00]" value={formItem.data.horario_inicio ?? ''} onChange={e => formItem.setData('horario_inicio', e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <InputLabel value="Horário Fim (Devolução Padrão)" />
                                                            <TextInput type="time" className="w-full mt-1 bg-gray-50 focus:border-[#FF5A00]" value={formItem.data.horario_fim ?? ''} onChange={e => formItem.setData('horario_fim', e.target.value)} />
                                                        </div>
                                                        <div>
                                                            <InputLabel value="Horário Limite para Devolução" />
                                                            <TextInput type="time" className="w-full mt-1 bg-red-50 text-red-700 border-red-200 focus:border-red-400" value={formItem.data.horario_limite_devolucao ?? ''} onChange={e => formItem.setData('horario_limite_devolucao', e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 👉 NOVO BLOCO DE DISPONIBILIDADE DINÂMICA (VAGAS E HORÁRIOS) */}
                                                <div className="bg-white p-5 rounded-2xl border shadow-sm mt-4">
                                                    <label className="flex items-center justify-between cursor-pointer mb-4">
                                                        <div>
                                                            <span className="font-bold text-sm text-gray-900 block flex items-center gap-2">Controlar Vagas por Data e Horário?</span>
                                                            <span className="text-xs text-gray-500">Ex: 15 vagas hoje, 2 amanhã. Ou 5 vagas às 18h, 5 às 19h.</span>
                                                        </div>
                                                        <div className="relative inline-flex items-center">
                                                            <input type="checkbox" className="sr-only peer" checked={formItem.data.disponibilidade_por_data} onChange={e => formItem.setData('disponibilidade_por_data', e.target.checked)} />
                                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF5A00]"></div>
                                                        </div>
                                                    </label>

                                                    {formItem.data.disponibilidade_por_data && (
                                                        <div className="space-y-6 pt-6 border-t border-gray-100 animate-in fade-in">
                                                            {/* Qtd Padrão */}
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <InputLabel value="Qtd. Padrão Diária" />
                                                                    <TextInput type="number" min="0" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.quantidade_padrao ?? ''} onChange={e => formItem.setData('quantidade_padrao', e.target.value)} placeholder="Ex: 10" />
                                                                </div>
                                                                <div>
                                                                    <InputLabel value="Tipo (vagas, pessoas, etc)" />
                                                                    <TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.tipo_quantidade ?? ''} onChange={e => formItem.setData('tipo_quantidade', e.target.value)} placeholder="Ex: mesas" />
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pt-4">
                                                                {/* Dias Específicos */}
                                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                                                    <InputLabel value="Quantidade por Dia Específico" className="mb-2 font-bold text-indigo-700" />
                                                                    <div className="flex gap-2 mb-4">
                                                                        <TextInput type="date" className="flex-1 text-sm focus:border-indigo-500" value={novaDispData} onChange={e => setNovaDispData(e.target.value)} />
                                                                        <TextInput type="number" min="0" placeholder="Qtd" className="w-20 text-center text-sm focus:border-indigo-500" value={novaDispQtd} onChange={e => setNovaDispQtd(e.target.value)} />
                                                                        <button type="button" onClick={handleAddDiaDisponivel} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-bold">+</button>
                                                                    </div>
                                                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                                        {parseArraySeguro(formItem.data.dias_disponiveis).map((item, idx) => (
                                                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 shadow-sm text-sm">
                                                                                <span className="font-bold text-gray-700">{item.data}</span>
                                                                                <span className="flex items-center gap-3">
                                                                                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold text-xs">{item.quantidade} {formItem.data.tipo_quantidade || 'vagas'}</span>
                                                                                    <button type="button" onClick={() => handleRemoveDiaDisponivel(item.data)} className="text-red-500 hover:text-red-700"><XMarkIcon className="w-4 h-4"/></button>
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                        {parseArraySeguro(formItem.data.dias_disponiveis).length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">Nenhum dia específico configurado.</p>}
                                                                    </div>
                                                                </div>

                                                                {/* Horários Específicos */}
                                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                                                    <InputLabel value="Quantidade por Horário Específico" className="mb-2 font-bold text-emerald-700" />
                                                                    <div className="flex flex-col gap-2 mb-4">
                                                                        <TextInput type="date" className="w-full text-sm focus:border-emerald-500" value={novaHoraDispData} onChange={e => setNovaHoraDispData(e.target.value)} />
                                                                        <div className="flex gap-2">
                                                                            <TextInput type="time" className="flex-1 text-sm focus:border-emerald-500" value={novaHoraDispInicio} onChange={e => setNovaHoraDispInicio(e.target.value)} />
                                                                            <span className="self-center text-gray-400 text-xs">às</span>
                                                                            <TextInput type="time" className="flex-1 text-sm focus:border-emerald-500" value={novaHoraDispFim} onChange={e => setNovaHoraDispFim(e.target.value)} />
                                                                            <TextInput type="number" min="0" placeholder="Qtd" className="w-16 text-center text-sm focus:border-emerald-500" value={novaHoraDispQtd} onChange={e => setNovaHoraDispQtd(e.target.value)} />
                                                                            <button type="button" onClick={handleAddHorarioDisponivel} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-bold">+</button>
                                                                        </div>
                                                                    </div>
                                                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                                        {parseArraySeguro(formItem.data.horarios_disponiveis).map((item, dIdx) => (
                                                                            <div key={dIdx} className="bg-white p-2 rounded border border-gray-200 shadow-sm text-sm">
                                                                                <div className="font-bold text-gray-800 border-b pb-1 mb-2">{item.data}</div>
                                                                                {item.horarios.map((h, hIdx) => (
                                                                                    <div key={hIdx} className="flex justify-between items-center py-1">
                                                                                        <span className="text-gray-600 text-xs">{h.inicio} às {h.fim}</span>
                                                                                        <span className="flex items-center gap-2">
                                                                                            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px]">{h.quantidade} {formItem.data.tipo_quantidade || 'vagas'}</span>
                                                                                            <button type="button" onClick={() => handleRemoveHorarioDisponivel(item.data, hIdx)} className="text-red-500 hover:text-red-700"><XMarkIcon className="w-3 h-3"/></button>
                                                                                        </span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ))}
                                                                        {parseArraySeguro(formItem.data.horarios_disponiveis).length === 0 && <p className="text-xs text-gray-400 italic text-center py-2">Nenhum horário configurado.</p>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* BLOCO 4: REGRAS DE RESERVA */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-800 text-sm">4. Regras de Reserva Mínima e Máxima</h4>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                        <div className="bg-white p-4 rounded-xl border text-center">
                                                            <span className="text-xs font-bold text-gray-400 uppercase block mb-2">Antecedência Min</span>
                                                            <TextInput type="number" min="0" className="w-20 text-center font-bold focus:border-[#FF5A00]" value={formItem.data.antecedencia_reserva_horas ?? ''} onChange={e => formItem.setData('antecedencia_reserva_horas', e.target.value)} />
                                                        </div>
                                                        <div className="bg-white p-4 rounded-xl border text-center">
                                                            <span className="text-xs font-bold text-gray-400 uppercase block mb-2">Duração Mínima</span>
                                                            <TextInput type="number" min="1" className="w-20 text-center font-bold focus:border-[#FF5A00]" value={formItem.data.duracao_minima_horas ?? ''} onChange={e => formItem.setData('duracao_minima_horas', e.target.value)} />
                                                        </div>
                                                        <div className="bg-white p-4 rounded-xl border text-center">
                                                            <span className="text-xs font-bold text-gray-400 uppercase block mb-2">Duração Máxima</span>
                                                            <TextInput type="number" min="1" className="w-20 text-center font-bold focus:border-[#FF5A00]" value={formItem.data.duracao_maxima_horas ?? ''} onChange={e => formItem.setData('duracao_maxima_horas', e.target.value)} />
                                                        </div>
                                                        <div className="bg-white p-4 rounded-xl border text-center">
                                                            <span className="text-xs font-bold text-gray-400 uppercase block mb-2">Intervalo (Min)</span>
                                                            <TextInput type="number" min="0" className="w-20 text-center font-bold focus:border-[#FF5A00]" value={formItem.data.intervalo_entre_reservas_minutos ?? ''} onChange={e => formItem.setData('intervalo_entre_reservas_minutos', e.target.value)} />
                                                        </div>
                                                    </div>
                                                </div>

                                                <hr className="border-gray-200" />

                                                {/* BLOCO 5: BLOQUEIOS MANUAIS */}
                                                <div className="space-y-4">
                                                    <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2"><LockClosedIcon className="w-4 h-4 text-red-500"/> 5. Bloqueios Manuais</h4>
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                                        <div className="bg-white p-5 rounded-2xl border shadow-sm">
                                                            <InputLabel value="Bloquear Datas Inteiras (Dias Fechados)" />
                                                            <div className="flex items-center gap-2 mt-2 mb-4">
                                                                <TextInput type="date" value={novaDataBloqueada ?? ''} onChange={e => setNovaDataBloqueada(e.target.value)} className="flex-1 border-red-200 focus:border-red-400" />
                                                                <button type="button" onClick={addDataBloqueada} className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-lg">+</button>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                {parseArraySeguro(formItem.data.datas_bloqueadas).map(d => (
                                                                    <span key={d} className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-bold flex items-center gap-2">
                                                                        {d} <button type="button" onClick={() => formItem.setData('datas_bloqueadas', formItem.data.datas_bloqueadas.filter(x => x !== d))}><XMarkIcon className="w-3 h-3"/></button>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <div className="bg-white p-5 rounded-2xl border shadow-sm">
                                                            <InputLabel value="Bloquear Horários Específicos" />
                                                            <div className="flex items-center gap-2 mt-2 mb-4">
                                                                <TextInput type="date" className="w-1/3 text-xs focus:border-[#FF5A00]" value={novoHorarioBloqueado.data ?? ''} onChange={e => setNovoHorarioBloqueado({...novoHorarioBloqueado, data: e.target.value})} />
                                                                <TextInput type="time" className="w-1/4 text-xs text-center focus:border-[#FF5A00]" value={novoHorarioBloqueado.inicio ?? ''} onChange={e => setNovoHorarioBloqueado({...novoHorarioBloqueado, inicio: e.target.value})} />
                                                                <TextInput type="time" className="w-1/4 text-xs text-center focus:border-[#FF5A00]" value={novoHorarioBloqueado.fim ?? ''} onChange={e => setNovoHorarioBloqueado({...novoHorarioBloqueado, fim: e.target.value})} />
                                                                <button type="button" onClick={addHorarioBloqueado} className="px-3 py-2 bg-red-100 text-red-700 font-bold rounded-lg">+</button>
                                                            </div>
                                                            <div className="space-y-2">
                                                                {parseArraySeguro(formItem.data.horarios_bloqueados).map((hb, i) => (
                                                                    <div key={i} className="flex justify-between items-center bg-red-50 px-3 py-2 rounded-lg border border-red-100">
                                                                        <span className="text-xs font-bold text-red-800">{hb.data} • {hb.inicio} às {hb.fim}</span>
                                                                        <button type="button" onClick={() => formItem.setData('horarios_bloqueados', formItem.data.horarios_bloqueados.filter((_, idx) => idx !== i))} className="text-red-500"><XMarkIcon className="w-4 h-4"/></button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    <InputLabel value="6. Observações e Regras para o Cliente" />
                                                    <textarea className="mt-1 w-full border-gray-300 rounded-xl focus:border-[#FF5A00] text-sm" rows="2" value={formItem.data.observacoes_disponibilidade ?? ''} onChange={e => formItem.setData('observacoes_disponibilidade', e.target.value)} placeholder="Ex: Manutenção aos domingos, não garantimos entrega em feriados..."></textarea>
                                                </div>
                                            </div>

                                            <hr className="border-gray-100 mt-8 mb-8" />

                                            {/* SESSÃO 4: DETALHAMENTO LOGÍSTICO */}
                                            {esImovel && (
                                                <div className="p-6 bg-orange-50/40 border border-orange-100 rounded-3xl space-y-4">
                                                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2"><MapPinIcon className="w-4 h-4"/> Especificações do Imóvel</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        <div><InputLabel value="CEP" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cep ?? ''} onChange={e => formItem.setData('cep', e.target.value)} onBlur={(e) => buscarEnderecoAutomatizado(e.target.value, formItem.setData, '')} placeholder="Digite para auto-preencher" /></div>
                                                        <div className="md:col-span-2"><InputLabel value="Rua" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.endereco ?? ''} onChange={e => formItem.setData('endereco', e.target.value)} /></div>
                                                        <div><InputLabel value="Número" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero ?? ''} onChange={e => formItem.setData('numero', e.target.value)} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        <div><InputLabel value="Bairro" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.bairro ?? ''} onChange={e => formItem.setData('bairro', e.target.value)} /></div>
                                                        <div><InputLabel value="Cidade" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cidade ?? ''} onChange={e => formItem.setData('cidade', e.target.value)} /></div>
                                                        <div>
                                                            <InputLabel value="Estado (UF)" />
                                                            <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formItem.data.estado ?? ''} onChange={e => formItem.setData('estado', e.target.value)}>
                                                                <option value="">UF</option>
                                                                {ufsBrasil.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                                            </select>
                                                        </div>
                                                        <div><InputLabel value="Complemento" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.complemento ?? ''} onChange={e => formItem.setData('complemento', e.target.value)} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div><InputLabel value="Latitude (Auto)" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 text-gray-500 cursor-not-allowed select-all" value={formItem.data.latitude ?? ''} /></div>
                                                        <div><InputLabel value="Longitude (Auto)" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 text-gray-500 cursor-not-allowed select-all" value={formItem.data.longitude ?? ''} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-orange-200">
                                                        <div><InputLabel value="Quartos" /><TextInput type="number" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_quartos ?? ''} onChange={e => formItem.setData('numero_quartos', e.target.value)} /></div>
                                                        <div><InputLabel value="Banheiros" /><TextInput type="number" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_banheiros ?? ''} onChange={e => formItem.setData('numero_banheiros', e.target.value)} /></div>
                                                        <div><InputLabel value="Suítes" /><TextInput type="number" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_suites ?? ''} onChange={e => formItem.setData('numero_suites', e.target.value)} /></div>
                                                        <div><InputLabel value="Garagem" /><TextInput type="number" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_vagas ?? ''} onChange={e => formItem.setData('numero_vagas', e.target.value)} /></div>
                                                        <div><InputLabel value="Cômodos" /><TextInput type="number" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_comodos ?? ''} onChange={e => formItem.setData('numero_comodos', e.target.value)} /></div>
                                                    </div>
                                                </div>
                                            )}

                                            {esVeiculo && (
                                                <div className="p-6 bg-blue-50/40 border border-blue-100 rounded-3xl space-y-4">
                                                    <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Especificações de Frota</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                        <div><InputLabel value="Placa *" /><TextInput maxLength="7" className="w-full mt-1 uppercase focus:border-[#FF5A00]" value={formItem.data.placa ?? ''} onChange={e => formItem.setData('placa', e.target.value.toUpperCase())} /></div>
                                                        <div><InputLabel value="Renavam" /><TextInput maxLength="11" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.renavam ?? ''} onChange={e => formItem.setData('renavam', e.target.value.replace(/\D/g, ''))} /></div>
                                                        <div><InputLabel value="Chassis" /><TextInput maxLength="17" className="w-full mt-1 uppercase focus:border-[#FF5A00]" value={formItem.data.chassis ?? ''} onChange={e => formItem.setData('chassis', e.target.value.toUpperCase())} /></div>
                                                        <div><InputLabel value="Quilometragem (KM)" /><TextInput type="number" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.quilometragem ?? ''} onChange={e => formItem.setData('quilometragem', e.target.value)} /></div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                        <div>
                                                            <InputLabel value="Ano de Fabricação" />
                                                            <select className="mt-1 w-full py-3 border-gray-300 rounded-xl font-medium text-sm text-gray-700 focus:border-[#FF5A00]" value={formItem.data.ano ?? ''} onChange={e => formItem.setData('ano', e.target.value)}>
                                                                <option value="">Selecione o ano...</option>
                                                                {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <InputLabel value="Combustível" />
                                                            <select className="mt-1 w-full py-3 border-gray-300 rounded-xl font-medium text-sm text-gray-700 focus:border-[#FF5A00]" value={formItem.data.combustivel ?? ''} onChange={e => formItem.setData('combustivel', e.target.value)}>
                                                                <option value="Flex">Flex</option>
                                                                <option value="Gasolina">Gasolina</option>
                                                                <option value="Álcool">Álcool</option>
                                                                <option value="Diesel">Diesel</option>
                                                                <option value="Elétrico">Elétrico</option>
                                                                <option value="Outro">Outro</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <InputLabel value="Câmbio" />
                                                            <select className="mt-1 w-full py-3 border-gray-300 rounded-xl font-medium text-sm text-gray-700 focus:border-[#FF5A00]" value={formItem.data.cambio ?? ''} onChange={e => formItem.setData('cambio', e.target.value)}>
                                                                <option value="Manual">Manual</option>
                                                                <option value="Automático">Automático</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {!esImovel && (
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
                                                    <div className="p-6 bg-gray-50 border rounded-3xl space-y-4">
                                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2"><ArrowDownTrayIcon className="w-4 h-4 text-gray-400" /> Endereço de Retirada Completo</h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            <div className="sm:col-span-1"><InputLabel value="CEP" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cep_retirada ?? ''} onChange={e => formItem.setData('cep_retirada', e.target.value)} onBlur={(e) => buscarEnderecoAutomatizado(e.target.value, formItem.setData, '_retirada')} /></div>
                                                            <div className="sm:col-span-2"><InputLabel value="Rua de Retirada" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.rua_retirada ?? ''} onChange={e => formItem.setData('rua_retirada', e.target.value)} /></div>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            <div><InputLabel value="Bairro" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.bairro_retirada ?? ''} onChange={e => formItem.setData('bairro_retirada', e.target.value)} /></div>
                                                            <div><InputLabel value="Cidade" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cidade_retirada ?? ''} onChange={e => formItem.setData('cidade_retirada', e.target.value)} /></div>
                                                            <div>
                                                                <InputLabel value="UF" />
                                                                <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formItem.data.estado_retirada ?? ''} onChange={e => formItem.setData('estado_retirada', e.target.value)}>
                                                                    <option value="">UF</option>
                                                                    {ufsBrasil.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div><InputLabel value="Latitude" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 text-gray-500 font-mono text-xs" value={formItem.data.latitude_retirada ?? ''} /></div>
                                                            <div><InputLabel value="Longitude" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 text-gray-500 font-mono text-xs" value={formItem.data.longitude_retirada ?? ''} /></div>
                                                        </div>
                                                    </div>

                                                    <div className="p-6 bg-gray-50 border rounded-3xl space-y-4">
                                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2"><TruckIcon className="w-4 h-4 text-gray-400" /> Endereço de Entrega Completo</h4>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            <div className="sm:col-span-1"><InputLabel value="CEP" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cep_entrega ?? ''} onChange={e => formItem.setData('cep_entrega', e.target.value)} onBlur={(e) => buscarEnderecoAutomatizado(e.target.value, formItem.setData, '_entrega')} /></div>
                                                            <div className="sm:col-span-2"><InputLabel value="Rua de Entrega" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.rua_entrega ?? ''} onChange={e => formItem.setData('rua_entrega', e.target.value)} /></div>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                            <div><InputLabel value="Bairro" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.bairro_entrega ?? ''} onChange={e => formItem.setData('bairro_entrega', e.target.value)} /></div>
                                                            <div><InputLabel value="Cidade" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cidade_entrega ?? ''} onChange={e => formItem.setData('cidade_entrega', e.target.value)} /></div>
                                                            <div>
                                                                <InputLabel value="UF" />
                                                                <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formItem.data.estado_entrega ?? ''} onChange={e => formItem.setData('estado_entrega', e.target.value)}>
                                                                    <option value="">UF</option>
                                                                    {ufsBrasil.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <div><InputLabel value="Latitude" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 text-gray-500 font-mono text-xs" value={formItem.data.latitude_entrega ?? ''} /></div>
                                                            <div><InputLabel value="Longitude" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 text-gray-500 font-mono text-xs" value={formItem.data.longitude_entrega ?? ''} /></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 👉 BOTAO VERDE NOS ITENS/RESERVAS COMO PEDIDO */}
                                            <div className="flex justify-end pt-8">
                                                {isEditingItem && <button type="button" onClick={cancelarEdicaoItem} className="px-6 py-4 text-gray-500 font-bold hover:text-gray-900 transition mr-4">Cancelar Edição</button>}
                                                <button type="submit" disabled={formItem.processing} className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-2xl shadow-xl transform active:scale-95 text-lg disabled:opacity-50 transition">
                                                    {isEditingItem ? 'Atualizar Toda Locação' : 'Finalizar Cadastro do Item'}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                {/* LISTA DOS ITENS ATIVOS MODERNA */}
                                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-8">
                                    <div className="p-6 border-b border-gray-100">
                                        <h3 className="text-lg font-bold text-gray-900">Catálogo de Locações Ativas ({arrayLocacoes.length})</h3>
                                    </div>

                                    {arrayLocacoes.length === 0 ? (
                                        <div className="p-12 text-center">
                                            <ArchiveBoxIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                            <h4 className="text-base font-bold text-gray-700">Nenhuma locação ativa encontrada</h4>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-gray-100">
                                            {itensPaginados.map(item => (
                                                <div key={item.id} className="p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center hover:bg-gray-50/50 transition">
                                                    <div className="mb-4 sm:mb-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-black bg-orange-50 text-[#FF5A00] px-2 py-0.5 rounded uppercase tracking-wider border border-orange-100">{item.categoria.replace(/_/g, ' ')}</span>
                                                            {item.tem_promocao && <span className="text-[10px] font-black bg-red-100 text-red-700 px-2 py-0.5 rounded uppercase tracking-wider">Promoção Ativa</span>}
                                                            {item.exige_contrato && <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase tracking-wider">Com Contrato</span>}
                                                        </div>
                                                        <h4 className="font-bold text-gray-900 text-lg mt-1">{item.nome}</h4>
                                                        <p className="text-xs font-semibold text-gray-400 mt-0.5">
                                                            {item.modelo ? `${item.marca || ''} ${item.modelo}` : 'Sob demanda'} • Qtd Disponível: {item.quantidade}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-4 sm:mt-0">
                                                        <button onClick={() => visualizarItem(item)} className="text-xs font-bold text-gray-700 bg-gray-100 border border-gray-200 px-4 py-2 rounded-lg transition">Ver Detalhes</button>
                                                        <button onClick={() => editarItem(item)} className="text-xs font-bold text-white bg-orange-500 hover:bg-orange-600 border border-orange-600 px-4 py-2 rounded-lg transition">Editar</button>
                                                        <button onClick={() => deletarItem(item.id)} className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 border border-red-700 px-4 py-2 rounded-lg transition">Apagar</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {totalPaginasItens > 1 && (
                                        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50">
                                            <span className="text-xs text-gray-400 font-bold">Página {paginaItens} de {totalPaginasItens}</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setPaginaItens(p => Math.max(1, p - 1))} disabled={paginaItens === 1} className="px-3 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">Anterior</button>
                                                <button onClick={() => setPaginaItens(p => Math.min(totalPaginasItens, p + 1))} disabled={paginaItens === totalPaginasItens} className="px-3 py-1 bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition">Próxima</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
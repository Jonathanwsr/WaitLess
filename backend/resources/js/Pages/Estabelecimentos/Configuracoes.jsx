import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm, Link, router, usePage } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { 
    StarIcon, 
    CheckBadgeIcon, 
    ShieldCheckIcon, 
    DocumentTextIcon, 
    CurrencyDollarIcon, 
    PlusIcon, 
    XMarkIcon, 
    MapPinIcon, 
    ClockIcon, 
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
    InformationCircleIcon,
    CheckCircleIcon,
    TrashIcon,
    TruckIcon,
    ArrowDownTrayIcon,
    ClipboardDocumentListIcon,
    GiftIcon,
    ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/solid';

export default function Configuracoes({ auth, estabelecimento, meusEstabelecimentos, funcionarios, servicos, itensAluguel = [], itens_aluguel = [] }) {
    // ==========================================
    // 1. RECUPERA A ABA ATIVA DO LOCALSTORAGE
    // ==========================================
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('waitless_active_tab') || 'detalhes';
    });

    useEffect(() => {
        localStorage.setItem('waitless_active_tab', activeTab);
    }, [activeTab]);

    const getNomeAba = () => {
        switch(activeTab) {
            case 'detalhes': return 'Perfil da Loja';
            case 'equipe': return 'Equipe / Profissionais';
            case 'servicos': return 'Catálogo de Serviços';
            case 'reservas_alugueis': return 'Reservas / Locações';
            case 'financeiro': return 'Financeiro / Integração';
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

    const blockInvalidNumberChars = (e) => {
        if (['e', 'E', '+', '-'].includes(e.key)) {
            e.preventDefault();
        }
    };

    // Gerador de anos dinâmicos: do ano atual para trás até 1950
    const anosDisponiveis = (() => {
        const anoAtual = new Date().getFullYear();
        const listaAnos = [];
        for (let i = anoAtual; i >= 1950; i--) {
            listaAnos.push(i);
        }
        return listaAnos;
    })();

    // Lista de UFs Brasileiras
    const ufsBrasil = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
        'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
        'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];

    // Ramos de Atuação Mais Completos
    const ramosAtuacao = [
        'Barbearia', 'Salão de Beleza', 'Clínica Médica', 'Clínica Odontológica',
        'Estética e Spa', 'Oficina Mecânica', 'Estética Automotiva', 'Pet Shop e Veterinária',
        'Locação de Imóveis', 'Locação de Veículos', 'Locação de Equipamentos', 'Locação de Roupas e Fantasias',
        'Estúdio de Tatuagem', 'Estúdio de Fotografia', 'Academia e Crossfit', 'Educação e Cursos',
        'Advocacia e Escritórios', 'Consultoria', 'Eventos e Festas', 'Serviços Gerais', 'Outro'
    ];

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
        tem_cupom: false,
        tipo_desconto_cupom: 'percentual',
        valor_cupom: '',
        codigo_cupom: '',
    });

    useEffect(() => {
        if (!isEditingServico && !visualizandoServico) {
            const rascunho = localStorage.getItem('waitless_servico_draft');
            if (rascunho) {
                try {
                    const dadosSalvos = JSON.parse(rascunho);
                    if (dadosSalvos) {
                        formServico.setData(data => ({
                            ...data,
                            nome: dadosSalvos.nome || '',
                            tipo_servico: dadosSalvos.tipo_servico || '',
                            descricao: dadosSalvos.descricao || '',
                            valor: dadosSalvos.valor || '',
                            duracao_minutos: dadosSalvos.duracao_minutos || '30',
                            horarios_disponiveis: dadosSalvos.horarios_disponiveis || [],
                            dias_disponiveis: dadosSalvos.dias_disponiveis || [],
                            tem_cupom: dadosSalvos.tem_cupom || false,
                            tipo_desconto_cupom: dadosSalvos.tipo_desconto_cupom || 'percentual',
                            valor_cupom: dadosSalvos.valor_cupom || '',
                            codigo_cupom: dadosSalvos.codigo_cupom || '',
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
            localStorage.setItem('waitless_servico_draft', JSON.stringify(dadosParaSalvar));
        }
    }, [formServico.data.nome, formServico.data.descricao, formServico.data.valor, formServico.data.tem_cupom, formServico.data.valor_cupom, formServico.data.horarios_disponiveis, formServico.data.dias_disponiveis, isEditingServico, visualizandoServico]); 

    const handleFotoQuadrado = (index, arquivoSelecionado) => {
        if (!arquivoSelecionado) return;
        const novaListaQuadrados = [...quadradosFotos];
        novaListaQuadrados[index] = arquivoSelecionado;
        setQuadradosFotos(novaListaQuadrados);
        formServico.setData('fotos', novaListaQuadrados.filter(f => f !== null));
    };

    const removerFotoQuadrado = (index) => {
        const novaListaQuadrados = [...quadradosFotos];
        novaListaQuadrados[index] = null;
        setQuadradosFotos(novaListaQuadrados);
        formServico.setData('fotos', novaListaQuadrados.filter(f => f !== null));
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

    const handleToggleCupom = (checked) => {
        formServico.setData(data => ({
            ...data,
            tem_cupom: checked,
            codigo_cupom: checked && !data.codigo_cupom ? gerarCodigoCupom() : data.codigo_cupom
        }));
    };

    const submitServico = (withEvent) => {
        withEvent.preventDefault();
        if (isEditingServico) {
            formServico.post(route('servicos.update', formServico.data.id), {
                _method: 'put',
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicaoServico();
                    mostrarMensagem('Serviço editado com sucesso!');
                    localStorage.removeItem('waitless_servico_draft');
                }
            });
        } else {
            formServico.post(route('servicos.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    formServico.reset();
                    formServico.setData('estabelecimentos_ids', [estabelecimento.id]);
                    setNovoHorario('');
                    setQuadradosFotos([null, null, null, null, null]);
                    mostrarMensagem('Serviço cadastrado com sucesso!');
                    localStorage.removeItem('waitless_servico_draft');
                }
            });
        }
    };

    const editarServico = (servico) => {
        setIsEditingServico(true);
        setVisualizandoServico(null); 
        localStorage.removeItem('waitless_servico_draft'); 
        
        let config = { dias_disponiveis: [], tipo_pagamento: 'hibrido', funcionario_padrao: '', tem_cupom: false, tipo_desconto_cupom: 'percentual', valor_cupom: '', codigo_cupom: '' };
        let horarios = [];
        try {
            config = typeof servico.configuracoes === 'string' ? JSON.parse(servico.configuracoes) : (servico.configuracoes || config);
            horarios = typeof servico.horarios_disponiveis === 'string' ? JSON.parse(servico.horarios_disponiveis) : (servico.horarios_disponiveis || []);
        } catch (error) {}

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
            tem_cupom: config.tem_cupom || false,
            tipo_desconto_cupom: config.tipo_desconto_cupom || 'percentual',
            valor_cupom: config.valor_cupom || '',
            codigo_cupom: config.codigo_cupom || '',
        });
        
        setQuadradosFotos([null, null, null, null, null]); 
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
    const [quadradosFotosItem, setQuadradosFotosItem] = useState([null, null, null, null, null]);
    const [visualizandoItem, setVisualizandoItem] = useState(null);
    const [fotoDetalheIndexItem, setFotoDetalheIndexItem] = useState(0);

    const comodidadesPreDefinidas = [
        'Ar-condicionado', 'Piscina', 'Wi-Fi', 'Churrasqueira', 'Varanda Gourmet',
        'Aceita Pets', 'Direção Hidráulica', 'Câmbio Automático', 'Câmera de Ré', 
        'Bluetooth', 'Sensor de Estacionamento', 'Cadeira de Bebê', 'Som Premium',
        'Cozinha Completa', 'TV a Cabo', 'Roupas de Cama', 'Vaga Coberta'
    ];

    const formItem = useForm({
        id: null,
        estabelecimento_id: estabelecimento?.id,
        servico_id: '',
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
        
        recursos_oferecidos: [], 
        acessorios: [], 
        funcionarios_responsaveis: [],
        
        // Imóvel Base
        endereco: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '',
        latitude: '', longitude: '', numero_quartos: '', numero_banheiros: '', numero_suites: '',
        numero_comodos: '', numero_vagas: '', area_total: '', area_construida: '',
        mobiliado: false, aceita_pet: false, possui_wifi: false, possui_ar_condicionado: false, piscina: false, churrasqueira: false,
        
        // Veículos
        placa: '', renavam: '', chassis: '', marca_veiculo: '', modelo_veiculo: '', ano: '', cor: '',
        combustivel: '', cambio: '', quilometragem: '', cilindrada: '', potencia: '', portas: '', lugares: '', possui_seguro: false,
        
        // Equipamentos
        fabricante: '', numero_serie: '', patrimonio: '', voltagem: '', potencia_equipamento: '', peso: '', dimensoes: '', garantia: '',
        
        // Endereço de Retirada Completo
        cep_retirada: '', rua_retirada: '', numero_retirada: '', complemento_retirada: '', bairro_retirada: '', cidade_retirada: '', estado_retirada: '',
        latitude_retirada: '', longitude_retirada: '',

        // Endereço de Entrega Completo
        cep_entrega: '', rua_entrega: '', numero_entrega: '', complemento_entrega: '', bairro_entrega: '', cidade_entrega: '', estado_entrega: '',
        latitude_entrega: '', longitude_entrega: '',
        
        observacoes: ''
    });

    const formatarDecimaisItemOnBlur = (campo, valor) => {
        if (!valor) return;
        const numerico = parseFloat(valor.toString().replace(',', '.'));
        if (!isNaN(numerico)) {
            formItem.setData(campo, numerico.toFixed(2));
        }
    };

    const formatarDecimaisAcessorioOnBlur = (index, valor) => {
        if (!valor) return;
        const numerico = parseFloat(valor.toString().replace(',', '.'));
        if (!isNaN(numerico)) {
            const novaLista = [...parseArraySeguro(formItem.data.acessorios)];
            if(novaLista[index]) {
                novaLista[index]['valor'] = numerico.toFixed(2);
                formItem.setData('acessorios', novaLista);
            }
        }
    };

    const higienizarEntrada = (dados) => {
        const regexInseguro = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
        const regexEmoji = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
        
        for (let chave in dados) {
            if (typeof dados[chave] === 'string' && chave !== 'fotos') {
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
        formItem.setData('fotos', novaLista.filter(f => f !== null));
    };

    const removerFotoItemQuadrado = (index) => {
        const novaLista = [...quadradosFotosItem];
        novaLista[index] = null;
        setQuadradosFotosItem(novaLista);
        formItem.setData('fotos', novaLista.filter(f => f !== null));
    };

    const toggleComodidade = (recurso) => {
        const atual = parseArraySeguro(formItem.data.recursos_oferecidos);
        const novaLista = atual.includes(recurso) ? atual.filter(r => r !== recurso) : [...atual, recurso];
        formItem.setData('recursos_oferecidos', novaLista);
    };

    const toggleFuncionarioResponsavel = (idFunc) => {
        const atual = parseArraySeguro(formItem.data.funcionarios_responsaveis);
        const novaLista = atual.includes(idFunc) ? atual.filter(id => id !== idFunc) : [...atual, idFunc];
        formItem.setData('funcionarios_responsaveis', novaLista);
    };

    const adicionarAcessorio = () => {
        const atual = parseArraySeguro(formItem.data.acessorios);
        formItem.setData('acessorios', [...atual, { nome: '', valor: '' }]);
    };
    
    const removerAcessorio = (indexToRemove) => {
        const atual = parseArraySeguro(formItem.data.acessorios);
        formItem.setData('acessorios', atual.filter((_, i) => i !== indexToRemove));
    };

    const atualizarAcessorioTexto = (index, valor) => {
        const novaLista = [...parseArraySeguro(formItem.data.acessorios)];
        if(novaLista[index]) {
            const regexSanitize = /[^a-zA-Z0-9 áéíóúâêîôûãõçÇ]/g;
            novaLista[index]['nome'] = valor.replace(regexSanitize, '');
            formItem.setData('acessorios', novaLista);
        }
    };

    const atualizarAcessorioValor = (index, valor) => {
        const novaLista = [...parseArraySeguro(formItem.data.acessorios)];
        if(novaLista[index]) {
            novaLista[index]['valor'] = valor;
            formItem.setData('acessorios', novaLista);
        }
    };

    const submitItemLocacao = (e) => {
        e.preventDefault();

        if (!higienizarEntrada(formItem.data)) {
            alert('Aviso de Segurança: Caracteres especiais ou códigos não são permitidos nos formulários.');
            return;
        }

        if (isEditingItem) {
            formItem.post(route('catalogo.itens.update', formItem.data.id), {
                preserveScroll: true,
                onSuccess: () => {
                    cancelarEdicaoItem();
                    mostrarMensagem('Sua reserva foi salva com sucesso!');
                    atualizarListaLocacoes();
                    router.reload({ only: ['itensAluguel', 'itens_aluguel', 'meusEstabelecimentos', 'estabelecimentos'] });
                }
            });
        } else {
            formItem.post(route('catalogo.itens.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    formItem.reset();
                    setQuadradosFotosItem([null, null, null, null, null]);
                    mostrarMensagem('Sua reserva foi salva com sucesso!');
                    atualizarListaLocacoes();
                    router.reload({ only: ['itensAluguel', 'itens_aluguel', 'meusEstabelecimentos', 'estabelecimentos'] });
                }
            });
        }
    };

    const editarItem = (item) => {
        setIsEditingItem(true);
        setVisualizandoItem(null);
        formItem.setData({ 
            ...item,
            recursos_oferecidos: parseArraySeguro(item.recursos_oferecidos),
            acessorios: parseArraySeguro(item.acessorios),
            funcionarios_responsaveis: parseArraySeguro(item.funcionarios_responsaveis)
        });
        setQuadradosFotosItem([null, null, null, null, null]);
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
        setQuadradosFotosItem([null, null, null, null, null]);
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

    // ==========================================
    // FORM 5: FINANÇAS E FATURAMENTO
    // ==========================================
    const formFinanceiro = useForm({
        nome_razao_social: estabelecimento.nome_razao_social || '',
        email_financeiro: estabelecimento.email_financeiro || '',
        cpf_cnpj: estabelecimento.cpf_cnpj || '',
        banco_codigo: estabelecimento.banco_codigo || '',
        agencia: estabelecimento.agencia || '',
        conta_numero: estabelecimento.conta_numero || '',
        conta_digito: estabelecimento.conta_digito || '',
    });

    const [sucessoFinanceiro, setSucessoFinanceiro] = useState(false);

    const submitFinanceiro = (e) => {
        e.preventDefault();
        router.post(route('estabelecimentos.financeiro.update', estabelecimento.id), {
            _method: 'put',
            ...formFinanceiro.data
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setSucessoFinanceiro(true);
                setTimeout(() => setSucessoFinanceiro(false), 5000);
            },
        });
    };

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
                                <ShieldCheckIcon className="w-5 h-5" /> <strong className="font-bold">Erro:</strong> {flash.error}
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
                            <button onClick={() => setActiveTab('financeiro')} className={`text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap flex items-center gap-2 ${activeTab === 'financeiro' ? 'bg-[#FF5A00] text-white shadow-md' : 'text-gray-600 hover:bg-gray-100'}`}>
                                <CurrencyDollarIcon className="w-5 h-5"/> 5. Financeiro / Recebimentos
                            </button>

                            {/* 👉 NOVO: BOTÃO EXTERNO PARA VER A LOJA PÚBLICA */}
                            <a href={`/estabelecimentos/${estabelecimento.id}/loja`} target="_blank" rel="noopener noreferrer" className="mt-4 text-left px-4 py-3 rounded-xl text-sm font-bold transition whitespace-nowrap flex items-center gap-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-sm">
                                <ArrowTopRightOnSquareIcon className="w-5 h-5"/> 6. Ver a Loja
                            </a>
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
                                        
                                        {/* LOGO DA LOJA */}
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

                                        {/* 👉 NOVO: BANNER DA LOJA */}
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
                                                            Inserir Banner
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
                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.nome} onChange={e => formDetalhes.setData('nome', e.target.value)} required />
                                                <InputError message={formDetalhes.errors.nome} />
                                            </div>
                                            <div>
                                                {/* 👉 NOVO: SELECT COM CATEGORIAS AMPLIADAS */}
                                                <InputLabel value="Ramo de Atuação" />
                                                <select 
                                                    className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]" 
                                                    value={formDetalhes.data.ramo_atuacao} 
                                                    onChange={e => formDetalhes.setData('ramo_atuacao', e.target.value)}
                                                >
                                                    <option value="">Selecione a categoria...</option>
                                                    {ramosAtuacao.map(ramo => <option key={ramo} value={ramo}>{ramo}</option>)}
                                                </select>
                                                <InputError message={formDetalhes.errors.ramo_atuacao} />
                                            </div>
                                            <div>
                                                <InputLabel value="Telefone de Contato" />
                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.telefone} onChange={e => formDetalhes.setData('telefone', e.target.value)} placeholder="(00) 00000-0000" />
                                                <InputError message={formDetalhes.errors.telefone} />
                                            </div>
                                        </div>

                                        <h3 className="text-lg font-bold text-gray-900 mt-8 mb-4 pt-6 border-t border-gray-100">Endereço</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                                            <div className="md:col-span-2">
                                                <InputLabel value="CEP" />
                                                <TextInput 
                                                    className="mt-1 w-full focus:border-[#FF5A00]" 
                                                    value={formDetalhes.data.cep} 
                                                    onChange={e => formDetalhes.setData('cep', e.target.value)} 
                                                    onBlur={(e) => buscarEnderecoAutomatizado(e.target.value, formDetalhes.setData, '')} 
                                                />
                                            </div>
                                            <div className="md:col-span-4"><InputLabel value="Rua / Avenida" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.rua} onChange={e => formDetalhes.setData('rua', e.target.value)} /></div>
                                            <div className="md:col-span-2"><InputLabel value="Número" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.numero} onChange={e => formDetalhes.setData('numero', e.target.value)} /></div>
                                            <div className="md:col-span-4"><InputLabel value="Complemento" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.complemento} onChange={e => formDetalhes.setData('complemento', e.target.value)} placeholder="Sala, Loja, etc." /></div>
                                            <div className="md:col-span-2"><InputLabel value="Bairro" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.bairro} onChange={e => formDetalhes.setData('bairro', e.target.value)} /></div>
                                            <div className="md:col-span-3"> <InputLabel value="Cidade" /><TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formDetalhes.data.cidade} onChange={e => formDetalhes.setData('cidade', e.target.value)} /></div>
                                            <div className="md:col-span-1">
                                                {/* 👉 NOVO: DROPDOWN UF */}
                                                <InputLabel value="UF" />
                                                <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formDetalhes.data.estado} onChange={e => formDetalhes.setData('estado', e.target.value)}>
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
                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formFuncionario.data.nome} onChange={e => formFuncionario.setData('nome', e.target.value)} required />
                                                <InputError message={formFuncionario.errors.nome} />
                                            </div>
                                            <div className="md:col-span-1">
                                                <InputLabel value="Telefone (Opcional)" />
                                                <TextInput className="mt-1 w-full focus:border-[#FF5A00]" value={formFuncionario.data.telefone} onChange={e => formFuncionario.setData('telefone', e.target.value)} placeholder="(00) 00000-0000" />
                                                <InputError message={formFuncionario.errors.telefone} />
                                            </div>
                                            <div className="md:col-span-1">
                                                <InputLabel value="Cargo / Papel no Sistema *" />
                                                <select className="mt-1 w-full py-3 border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formFuncionario.data.cargo} onChange={e => formFuncionario.setData('cargo', e.target.value)} required>
                                                    <option value="Atendente">Atendente / Recepção</option>
                                                    <option value="Barbeiro">Barbeiro</option>
                                                    <option value="Médico">Médico(a) / Especialista</option>
                                                    <option value="Mecânico">Mecânico</option>
                                                    <option value="Gerente">Gerente</option>
                                                    <option value="Socio">Sócio</option>
                                                    <option value="Outro">Outro</option>
                                                </select>
                                                <InputError message={formFuncionario.errors.cargo} />
                                            </div>
                                            <div className="md:col-span-2 border-t border-gray-100 pt-6">
                                                <InputLabel value="E-mail de Acesso *" />
                                                <TextInput type="email" className="mt-1 w-full focus:border-[#FF5A00]" value={formFuncionario.data.email} onChange={e => formFuncionario.setData('email', e.target.value)} required={!isEditingFuncionario} placeholder="email@exemplo.com" />
                                                <InputError message={formFuncionario.errors.email} />
                                            </div>
                                            <div className="md:col-span-1 border-t border-gray-100 pt-6">
                                                <InputLabel value="Senha de Acesso *" />
                                                <TextInput type="password" className="mt-1 w-full focus:border-[#FF5A00]" value={formFuncionario.data.password} onChange={e => formFuncionario.setData('password', e.target.value)} required={!isEditingFuncionario} placeholder="Mínimo 8 caracteres" />
                                                <InputError message={formFuncionario.errors.password} />
                                            </div>
                                        </div>
                                        <div className="flex justify-end pt-4 gap-4">
                                            {isEditingFuncionario && (
                                                <button type="button" onClick={cancelarEdicaoFuncionario} className="px-6 py-3 text-gray-600 font-bold hover:text-gray-900 transition">Cancelar</button>
                                            )}
                                            <PrimaryButton className="px-8 py-3 bg-[#FF5A00] rounded-xl shadow-lg" disabled={formFuncionario.processing}>
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
                                        {funcionarios.length === 0 ? (
                                            <p className="p-6 text-gray-500 text-center">Nenhum profissional cadastrado.</p>
                                        ) : (
                                            funcionariosPaginados.map(func => (
                                                <div key={func.id} className={`p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center transition ${func.ativo ? 'hover:bg-gray-50' : 'bg-red-50/50 opacity-75'}`}>
                                                    <div className="flex items-center gap-4 mb-4 sm:mb-0">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold uppercase ${func.ativo ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                                            {func.nome.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className={`font-bold ${func.ativo ? 'text-gray-900' : 'text-gray-500 line-through'}`}>{func.nome}</h4>
                                                                {func.ativo ? (
                                                                    <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">Ativo</span>
                                                                ) : (
                                                                    <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase">Desativado</span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-500 font-medium">
                                                                {func.cargo} {func.telefone && `• ${func.telefone}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 border-t sm:border-0 border-gray-100 pt-4 sm:pt-0">
                                                        <button onClick={() => editarFuncionario(func)} className="text-[#FF5A00] hover:text-[#C74B27] font-bold text-sm bg-orange-50 px-3 py-1.5 rounded-lg transition border border-orange-100">Editar</button>
                                                        {func.ativo && (
                                                            <button onClick={() => deletarFuncionario(func.id)} className="text-red-600 hover:text-red-800 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg transition border border-red-100">Remover</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
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
                        {/* ABA 3: CATÁLOGO DE SERVIÇOS */}
                        {/* ============================================================== */}
                        {activeTab === 'servicos' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                
                                {/* TELA DE DETALHE DE SERVIÇOS */}
                                {visualizandoServico ? (
                                    <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                                        <button 
                                            onClick={fecharVisualizacaoServico} 
                                            className="mb-8 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#FF5A00] transition"
                                        >
                                            <ArrowLeftIcon className="w-4 h-4" /> Voltar para o Catálogo
                                        </button>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                            <div className="lg:col-span-5 space-y-4">
                                                <div className="aspect-square bg-gray-50 rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm relative">
                                                    {parseArraySeguro(visualizandoServico.fotos).length > 0 ? (
                                                        <img src={parseArraySeguro(visualizandoServico.fotos)[fotoDetalheIndexServico] || parseArraySeguro(visualizandoServico.fotos)[0]} className="w-full h-full object-cover" alt="Imagem" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                                            <PhotoIcon className="w-16 h-16 mb-2" />
                                                            <span className="text-xs font-bold uppercase tracking-widest">Sem Imagem</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {parseArraySeguro(visualizandoServico.fotos).length > 1 && (
                                                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                                                        {parseArraySeguro(visualizandoServico.fotos).map((url, i) => (
                                                            <button key={i} onClick={() => setFotoDetalheIndexServico(i)} className={`shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all ${fotoDetalheIndexServico === i ? 'border-[#FF5A00] scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                                                                <img src={url} alt={`Min ${i}`} className="w-20 h-20 object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="lg:col-span-7 flex flex-col pt-2">
                                                <span className="text-xs font-bold text-[#FF5A00] uppercase tracking-widest mb-2">
                                                    {visualizandoServico.tipo_servico}
                                                </span>
                                                <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-4">
                                                    {visualizandoServico.nome}
                                                </h1>

                                                <div className="flex items-center gap-1 mb-6">
                                                    <StarIcon className="w-5 h-5 text-yellow-400" />
                                                    <StarIcon className="w-5 h-5 text-yellow-400" />
                                                    <StarIcon className="w-5 h-5 text-yellow-400" />
                                                    <StarIcon className="w-5 h-5 text-yellow-400" />
                                                    <StarIcon className="w-5 h-5 text-yellow-400" />
                                                    <span className="text-sm text-gray-500 ml-2 font-medium">(Novidade)</span>
                                                </div>

                                                <div className="mb-6 flex items-end gap-3">
                                                    <span className="text-5xl font-black text-[#FF5A00] tracking-tight flex items-baseline gap-1">
                                                        <span className="text-2xl text-gray-400 font-medium">R$</span>
                                                        {Number(visualizandoServico.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                </div>

                                                <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed font-medium mb-8">
                                                    <p>{visualizandoServico.descricao || 'Nenhuma descrição detalhada informada.'}</p>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-4 mb-8">
                                                    <span className="flex items-center gap-1.5 text-sm font-bold text-gray-700 bg-gray-50 border border-gray-200 px-4 py-2 rounded-full">
                                                        <ClockIcon className="w-4 h-4 text-[#FF5A00]"/> {visualizandoServico.duracao_minutos} min
                                                    </span>
                                                    {parseJSONSeguro(visualizandoServico.configuracoes)?.tem_cupom && (
                                                        <span className="flex items-center gap-1.5 text-sm font-bold text-orange-700 bg-orange-50 border border-orange-200 px-4 py-2 rounded-full">
                                                            <TicketIcon className="w-4 h-4"/> Cupom Ativo
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex flex-col sm:flex-row gap-4 mt-auto border-t border-gray-100 pt-8">
                                                    <button onClick={() => { fecharVisualizacaoServico(); editarServico(visualizandoServico); }} className="flex-1 py-4 bg-[#0F172A] hover:bg-black text-white font-bold rounded-full shadow-lg transition transform active:scale-95 flex justify-center items-center gap-2">
                                                        <Cog6ToothIcon className="w-5 h-5"/> Editar Serviço
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-16 pt-12 border-t border-gray-100">
                                            <h3 className="text-2xl font-black text-gray-900 mb-8 text-center">Detalhes Adicionais</h3>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 hover:shadow-md transition">
                                                    <CalendarIcon className="w-8 h-8 text-[#FF5A00] mb-4" />
                                                    <h4 className="font-bold text-gray-900 mb-3">Dias Abertos</h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {parseArraySeguro(parseJSONSeguro(visualizandoServico.configuracoes)?.dias_disponiveis).map((dia, i) => (
                                                            <span key={i} className="px-2.5 py-1 bg-white text-gray-600 rounded-lg text-xs font-bold capitalize border border-gray-200">{dia.substring(0,3)}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 hover:shadow-md transition">
                                                    <ClockIcon className="w-8 h-8 text-[#FF5A00] mb-4" />
                                                    <h4 className="font-bold text-gray-900 mb-3">Horários Livres</h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {parseArraySeguro(visualizandoServico.horarios_disponiveis).slice(0,6).map((hora, i) => (
                                                            <span key={i} className="px-2.5 py-1 bg-white text-gray-600 rounded-lg text-xs font-bold border border-gray-200">{hora}</span>
                                                        ))}
                                                        {parseArraySeguro(visualizandoServico.horarios_disponiveis).length > 6 && <span className="px-2.5 py-1 bg-white text-gray-400 rounded-lg text-xs font-bold border border-gray-200">+{parseArraySeguro(visualizandoServico.horarios_disponiveis).length - 6}</span>}
                                                    </div>
                                                </div>
                                                <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 hover:shadow-md transition">
                                                    <UserPlusIcon className="w-8 h-8 text-[#FF5A00] mb-4" />
                                                    <h4 className="font-bold text-gray-900 mb-2">Profissional</h4>
                                                    <p className="text-sm text-gray-500 font-medium">
                                                        {parseJSONSeguro(visualizandoServico.configuracoes)?.funcionario_padrao ? 'Atribuído a profissional específico' : 'Qualquer profissional da equipe'}
                                                    </p>
                                                </div>
                                                <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 hover:shadow-md transition">
                                                    <CurrencyDollarIcon className="w-8 h-8 text-[#FF5A00] mb-4" />
                                                    <h4 className="font-bold text-gray-900 mb-2">Pagamento</h4>
                                                    <span className="inline-block px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 uppercase tracking-wider mt-1">
                                                        {parseJSONSeguro(visualizandoServico.configuracoes)?.tipo_pagamento === 'online' ? 'Obrigatório Online' : 'Cliente Escolhe'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* FORMULÁRIO DE CRIAR/EDITAR SERVIÇOS */}
                                        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
                                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                                {isEditingServico ? <><DocumentTextIcon className="w-5 h-5 text-[#FF5A00]"/> Editar Serviço</> : <><PlusIcon className="w-5 h-5 text-[#FF5A00]"/> Adicionar Novo Serviço</>}
                                            </h3>
                                            
                                            {!isEditingServico && (
                                                <div className="mb-6 p-4 bg-blue-50 text-blue-700 text-sm rounded-xl flex items-center gap-3 border border-blue-100">
                                                    <ArchiveBoxIcon className="w-5 h-5"/> <span><strong>Rascunho Automático:</strong> O texto digitado aqui é salvo localmente no navegador.</span>
                                                </div>
                                            )}

                                            <form onSubmit={submitServico} className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="md:col-span-1">
                                                        <InputLabel value="Categoria / Tipo de Serviço *" />
                                                        <select 
                                                            className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00] focus:ring-[#FF5A00] text-gray-700"
                                                            value={formServico.data.tipo_servico} 
                                                            onChange={e => formServico.setData('tipo_servico', e.target.value)} 
                                                            required
                                                        >
                                                            <option value="" disabled>Selecione uma categoria...</option>
                                                            <option value="Beleza e Estética">Beleza e Estética</option>
                                                            <option value="Saúde e Bem-Estar">Saúde e Bem-Estar</option>
                                                            <option value="Serviços Automotivos">Serviços Automotivos</option>
                                                            <option value="Assistência Técnica e Manutenção">Assistência Técnica e Manutenção</option>
                                                        </select>
                                                        <InputError message={formServico.errors.tipo_servico} />
                                                    </div>

                                                    <div className="md:col-span-1">
                                                        <InputLabel value="Nome Específico do Serviço *" />
                                                        <TextInput className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formServico.data.nome} onChange={e => formServico.setData('nome', e.target.value)} placeholder="Ex: Corte Degradê" required />
                                                        <InputError message={formServico.errors.nome} />
                                                    </div>

                                                    <div>
                                                        <InputLabel value="Valor (R$) *" />
                                                        <TextInput type="number" min="0" step="0.01" onKeyDown={blockInvalidNumberChars} className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formServico.data.valor} onChange={e => formServico.setData('valor', e.target.value)} required />
                                                        <InputError message={formServico.errors.valor} />
                                                    </div>

                                                    <div>
                                                        <InputLabel value="Duração Estimada (minutos) *" />
                                                        <TextInput type="number" min="1" onKeyDown={blockInvalidNumberChars} className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formServico.data.duracao_minutos} onChange={e => formServico.setData('duracao_minutos', e.target.value)} required />
                                                        <InputError message={formServico.errors.duracao_minutos} />
                                                    </div>

                                                    <div className="md:col-span-2">
                                                        <InputLabel value="Descrição" />
                                                        <textarea 
                                                            className="mt-1 w-full border-gray-300 focus:border-[#FF5A00] focus:ring-[#FF5A00] rounded-md shadow-sm" 
                                                            rows="3" 
                                                            maxLength="300"
                                                            value={formServico.data.descricao} 
                                                            onChange={e => formServico.setData('descricao', e.target.value)} 
                                                            placeholder="Descreva os detalhes do serviço..."
                                                        ></textarea>
                                                        <InputError message={formServico.errors.descricao} />
                                                    </div>

                                                    <div className="md:col-span-2 border-t border-gray-100 pt-6">
                                                        <InputLabel value="Profissional Responsável (Opcional)" />
                                                        <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formServico.data.funcionario_id} onChange={e => formServico.setData('funcionario_id', e.target.value)}>
                                                            <option value="">Qualquer profissional disponível</option>
                                                            {funcionarios.map(func => (<option key={func.id} value={func.id}>{func.nome} ({func.cargo})</option>))}
                                                        </select>
                                                    </div>

                                                    <div className="md:col-span-2">
                                                        <InputLabel value="Dias Disponíveis para este serviço" className="mb-2" />
                                                        <div className="flex flex-wrap gap-2">
                                                            {['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'].map(dia => (
                                                                <button type="button" key={dia} onClick={() => handleDiaToggle(dia)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors border ${formServico.data.dias_disponiveis.includes(dia) ? 'bg-orange-100 text-[#FF5A00] border-orange-300' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{dia.substring(0, 3)}</button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="md:col-span-2 p-5 bg-gray-50 border border-gray-200 rounded-xl">
                                                        <InputLabel value="Horários Disponíveis *" className="mb-2 text-gray-800" />
                                                        <div className="flex items-center gap-3 mb-4">
                                                            <TextInput type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} className="w-32 text-center focus:border-[#FF5A00] focus:ring-[#FF5A00]" />
                                                            <button type="button" onClick={adicionarHorario} className="px-4 py-2 bg-gray-200 text-gray-800 font-bold text-sm rounded-lg hover:bg-gray-300 transition flex items-center gap-1"><PlusIcon className="w-4 h-4"/> Adicionar Horário</button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {formServico.data.horarios_disponiveis.map(h => (
                                                                <span key={h} className="inline-flex items-center gap-2 bg-[#FF5A00] text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                                                                    {h}
                                                                    <button type="button" onClick={() => removerHorario(h)} className="text-orange-200 hover:text-white transition"><XMarkIcon className="w-4 h-4"/></button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="md:col-span-2 border-t border-gray-100 pt-6">
                                                        <InputLabel value="Fotos de Demonstração do Serviço" />
                                                        <p className="text-xs text-gray-500 mb-4 mt-1">
                                                            Adicione até 5 fotos. <strong className="text-[#FF5A00]">A primeira foto (quadro em destaque) será usada como a capa principal do serviço.</strong> Clique no quadro vazio para escolher a imagem. Formatos: JPG, PNG, WEBP (Max. 2MB).
                                                        </p>
                                                        
                                                        <div className="flex flex-wrap gap-4">
                                                            {[0, 1, 2, 3, 4].map((index) => {
                                                                const arquivo = quadradosFotos[index];
                                                                const previewUrl = arquivo ? URL.createObjectURL(arquivo) : null;
                                                                const isCapa = index === 0; 

                                                                return (
                                                                    <div key={index} className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                                                                        {arquivo ? (
                                                                            <>
                                                                                <img src={previewUrl} alt={`Foto ${index + 1}`} className={`w-full h-full object-cover rounded-xl shadow-sm ${isCapa ? 'border-2 border-[#FF5A00]' : 'border border-gray-200'}`} />
                                                                                
                                                                                {isCapa && (
                                                                                    <div className="absolute bottom-0 left-0 w-full bg-[#FF5A00]/90 text-white text-[9px] font-bold text-center py-1 rounded-b-xl uppercase tracking-widest backdrop-blur-sm">
                                                                                        Principal
                                                                                    </div>
                                                                                )}

                                                                                <button 
                                                                                    type="button" 
                                                                                    onClick={() => removerFotoQuadrado(index)}
                                                                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-md transition text-xs z-10"
                                                                                    title="Remover foto"
                                                                                >
                                                                                    <XMarkIcon className="w-4 h-4"/>
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <label className={`cursor-pointer w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition ${isCapa ? 'border-orange-300 bg-orange-50/50 hover:border-[#FF5A00] hover:bg-orange-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-orange-400'}`}>
                                                                                <span className={`text-2xl font-light ${isCapa ? 'text-[#FF5A00]' : 'text-gray-400'}`}><PlusIcon className="w-6 h-6"/></span>
                                                                                <span className={`text-[10px] font-bold mt-1 uppercase tracking-wider text-center px-1 ${isCapa ? 'text-[#FF5A00]' : 'text-gray-400 font-medium'}`}>
                                                                                    {isCapa ? 'Capa' : `Foto ${index + 1}`}
                                                                                </span>
                                                                                <input 
                                                                                    type="file" 
                                                                                    className="hidden" 
                                                                                    accept="image/*" 
                                                                                    onChange={(e) => handleFotoQuadrado(index, e.target.files[0])}
                                                                                />
                                                                            </label>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {isEditingServico && (
                                                            <p className="text-xs text-yellow-600 font-bold mt-4 flex items-center gap-1">
                                                                <ExclamationTriangleIcon className="w-4 h-4"/> Aviso: Enviar novas fotos substituirá todas as imagens antigas deste serviço na vitrine.
                                                            </p>
                                                        )}

                                                        <InputError message={formServico.errors.fotos} className="mt-2" />
                                                    </div>

                                                    <div className="md:col-span-2 border-t border-gray-100 pt-6">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div>
                                                                <InputLabel value="Habilitar Cupom de Desconto Automático?" className="flex items-center gap-2"><TicketIcon className="w-4 h-4 text-gray-500"/> Habilitar Cupom de Desconto Automático?</InputLabel>
                                                                <p className="text-xs text-gray-500 mt-1">Crie um cupom exclusivo para os clientes usarem neste serviço.</p>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input type="checkbox" className="sr-only peer" checked={formServico.data.tem_cupom} onChange={e => handleToggleCupom(e.target.checked)} />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF5A00]"></div>
                                                            </label>
                                                        </div>

                                                        {formServico.data.tem_cupom && (
                                                            <div className="p-5 bg-orange-50 border border-orange-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
                                                                <div>
                                                                    <InputLabel value="Código Gerado (Automático)" />
                                                                    <TextInput className="mt-1 w-full bg-gray-100 text-gray-600 font-mono tracking-widest cursor-not-allowed border-gray-200" value={formServico.data.codigo_cupom} readOnly />
                                                                </div>
                                                                <div>
                                                                    <InputLabel value="Tipo de Desconto" />
                                                                    <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-orange-500" value={formServico.data.tipo_desconto_cupom} onChange={e => formServico.setData('tipo_desconto_cupom', e.target.value)}>
                                                                        <option value="percentual">Porcentagem (%)</option>
                                                                        <option value="fixo">Valor Fixo (R$)</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <InputLabel value="Valor do Desconto *" />
                                                                    <TextInput type="number" min="0" step="0.01" onKeyDown={blockInvalidNumberChars} className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formServico.data.valor_cupom} onChange={e => formServico.setData('valor_cupom', e.target.value)} required={formServico.data.tem_cupom} placeholder="Ex: 10" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="md:col-span-2 border-t border-gray-100 pt-6">
                                                        <InputLabel value="Regra de Pagamento" className="mb-2" />
                                                        <div className="flex flex-col sm:flex-row gap-4">
                                                            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 w-full transition"><input type="radio" name="pagamento" value="hibrido" checked={formServico.data.tipo_pagamento === 'hibrido'} onChange={e => formServico.setData('tipo_pagamento', e.target.value)} className="text-[#FF5A00] focus:ring-[#FF5A00]" /><span className="text-sm font-medium text-gray-700">Cliente escolhe</span></label>
                                                            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 w-full transition"><input type="radio" name="pagamento" value="online" checked={formServico.data.tipo_pagamento === 'online'} onChange={e => formServico.setData('tipo_pagamento', e.target.value)} className="text-[#FF5A00] focus:ring-[#FF5A00]" /><span className="text-sm font-medium text-gray-700">Obrigatório Online</span></label>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end pt-4 gap-4 border-t border-gray-100 mt-6">
                                                    {isEditingServico && (
                                                        <button type="button" onClick={cancelarEdicaoServico} className="px-6 py-3 text-gray-600 font-bold hover:text-gray-900 transition">Cancelar</button>
                                                    )}
                                                    <PrimaryButton className="px-8 py-3 bg-[#FF5A00] rounded-xl shadow-lg" disabled={formServico.processing}>
                                                        {isEditingServico ? 'Salvar Alterações' : '+ Salvar Serviço'}
                                                    </PrimaryButton>
                                                </div>
                                            </form>
                                        </div>

                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
                                            <div className="p-6 border-b border-gray-100">
                                                <h3 className="text-lg font-bold text-gray-900">Serviços Ativos neste Local ({servicos.length})</h3>
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {servicos.length === 0 ? (
                                                    <p className="p-6 text-gray-500 text-center">Nenhum serviço cadastrado ainda.</p>
                                                ) : (
                                                    servicos.map(s => (
                                                        <div key={s.id} className="p-6 flex flex-col sm:flex-row sm:justify-between sm:items-center hover:bg-gray-50 transition">
                                                            <div className="mb-4 sm:mb-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-[10px] font-bold bg-orange-100 text-[#FF5A00] px-2 py-0.5 rounded-md uppercase tracking-wide">
                                                                        {s.tipo_servico || 'Serviço'}
                                                                    </span>
                                                                </div>
                                                                <h4 className="font-bold text-gray-900 text-lg">{s.nome}</h4>
                                                                <p className="text-sm text-gray-500 font-medium">{s.duracao_minutos} min • R$ {s.valor}</p>
                                                            </div>
                                                            <div className="flex items-center flex-wrap gap-2 border-t sm:border-0 border-gray-100 pt-4 sm:pt-0">
                                                                <button onClick={() => visualizarServico(s)} className="text-[#FF5A00] hover:text-[#C74B27] font-bold text-sm bg-orange-50 px-3 py-1.5 rounded-lg transition border border-orange-100">
                                                                    Ver Detalhes
                                                                </button>
                                                                <button onClick={() => editarServico(s)} className="text-[#FF5A00] hover:text-[#C74B27] font-bold text-sm bg-orange-50 px-3 py-1.5 rounded-lg transition border border-orange-100">
                                                                    Editar
                                                                </button>
                                                                <button onClick={() => deletarServico(s.id)} className="text-red-600 hover:text-red-800 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg transition border border-red-100">
                                                                    Remover (Apagar)
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* ========================================================================= */}
                        {/* 👉 ABA 4: RESERVAS E LOCAÇÕES - MÓDULO CATÁLOGO SAAS                      */}
                        {/* ========================================================================= */}
                        {activeTab === 'reservas_alugueis' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                
                                {/* TELA DE DETALHE DE LOCAÇÕES */}
                                {visualizandoItem ? (
                                    <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                                        <button 
                                            onClick={() => setVisualizandoItem(null)} 
                                            className="mb-8 flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#FF5A00] transition"
                                        >
                                            <ArrowLeftIcon className="w-4 h-4" /> Voltar para o Catálogo
                                        </button>
                                        
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                                            <div className="lg:col-span-5 space-y-4">
                                                <div className="aspect-square bg-gray-50 rounded-[2rem] overflow-hidden border border-gray-100 shadow-sm relative">
                                                    {parseArraySeguro(visualizandoItem.fotos).length > 0 ? (
                                                        <img src={parseArraySeguro(visualizandoItem.fotos)[fotoDetalheIndexItem] || parseArraySeguro(visualizandoItem.fotos)[0]} className="w-full h-full object-cover" alt="Imagem do item" />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                                            <PhotoIcon className="w-16 h-16 mb-2" />
                                                            <span className="text-xs font-bold uppercase tracking-widest">Sem Imagem</span>
                                                        </div>
                                                    )}
                                                </div>
                                                
                                                {parseArraySeguro(visualizandoItem.fotos).length > 1 && (
                                                    <div className="flex gap-3 overflow-x-auto pb-2 snap-x">
                                                        {parseArraySeguro(visualizandoItem.fotos).map((url, i) => (
                                                            <button key={i} onClick={() => setFotoDetalheIndexItem(i)} className={`shrink-0 snap-start rounded-xl overflow-hidden border-2 transition-all ${fotoDetalheIndexItem === i ? 'border-[#FF5A00] scale-105 shadow-md' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                                                                <img src={url} alt={`Miniatura ${i}`} className="w-20 h-20 object-cover" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="lg:col-span-7 flex flex-col pt-2">
                                                <span className="text-xs font-bold text-[#FF5A00] uppercase tracking-widest mb-2">
                                                    {visualizandoItem.categoria.replace(/_/g, ' ')} {visualizandoItem.marca ? `• ${visualizandoItem.marca}` : ''}
                                                </span>
                                                <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight mb-4">
                                                    {visualizandoItem.nome}
                                                </h1>

                                                <div className="flex flex-wrap items-center gap-4 mb-6">
                                                    <div className="flex items-center gap-1">
                                                        {[1,2,3,4,5].map(s => <StarIcon key={s} className="w-5 h-5 text-yellow-400" />)}
                                                        <span className="text-sm text-gray-500 ml-1 font-medium">(Novidade)</span>
                                                    </div>
                                                    <span className="text-gray-300">|</span>
                                                    <span className="flex items-center gap-1.5 text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                                                        <CheckBadgeIcon className="w-4 h-4"/> Em Estoque: {visualizandoItem.quantidade}
                                                    </span>
                                                </div>

                                                <div className="mb-6 flex items-end gap-3">
                                                    <span className="text-5xl font-black text-[#FF5A00] tracking-tight flex items-baseline gap-1">
                                                        <span className="text-2xl text-gray-400 font-medium">R$</span>
                                                        {Number(visualizandoItem.valor_diaria || visualizandoItem.valor_mensal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-gray-500 font-bold mb-1 uppercase text-xs tracking-wider">/ {visualizandoItem.valor_diaria ? 'diária' : 'mensal'}</span>
                                                </div>

                                                <div className="mt-8 prose prose-gray max-w-none text-gray-600 leading-relaxed font-medium mb-8">
                                                    <p>{visualizandoItem.descricao || 'Nenhuma descrição detalhada informada.'}</p>
                                                    {visualizandoItem.especificacoes && (
                                                        <p className="mt-2 text-sm italic text-gray-500">"{visualizandoItem.especificacoes}"</p>
                                                    )}
                                                </div>

                                                {parseArraySeguro(visualizandoItem.recursos_oferecidos).length > 0 && (
                                                    <div className="mb-8 border-t border-gray-100 pt-6">
                                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Comodidades Inclusas</h4>
                                                        <div className="flex flex-wrap gap-2">
                                                            {parseArraySeguro(visualizandoItem.recursos_oferecidos).map((rec, idx) => (
                                                                <span key={idx} className="px-4 py-2 border border-gray-200 rounded-full text-sm font-bold text-gray-700 bg-white shadow-sm hover:border-[#FF5A00] hover:text-[#FF5A00] transition cursor-default">
                                                                    {rec}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex flex-col sm:flex-row gap-4 mt-auto border-t border-gray-100 pt-8">
                                                    <button onClick={() => { setVisualizandoItem(null); editarItem(visualizandoItem); }} className="flex-1 py-4 bg-[#0F172A] hover:bg-black text-white font-bold rounded-full shadow-lg transition transform active:scale-95 flex justify-center items-center gap-2">
                                                        <DocumentTextIcon className="w-5 h-5" /> Editar Configurações
                                                    </button>
                                                    <button onClick={() => deletarItem(visualizandoItem.id)} className="px-8 py-4 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-full transition flex justify-center items-center gap-2">
                                                        <TrashIcon className="w-5 h-5" /> Remover
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Fichas de Exibição de Localizações Inferiores */}
                                        <div className="mt-16 pt-12 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                                            {visualizandoItem.endereco && (
                                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                                    <MapPinIcon className="w-6 h-6 text-[#FF5A00] mb-3" />
                                                    <h4 className="font-bold text-gray-900 mb-2">Localização Base</h4>
                                                    <p className="text-sm text-gray-600 font-medium">{visualizandoItem.endereco}, nº {visualizandoItem.numero} - {visualizandoItem.cidade}/{visualizandoItem.estado}</p>
                                                    {visualizandoItem.latitude && <p className="text-xs text-gray-400 font-mono mt-1">COORD: {visualizandoItem.latitude}, {visualizandoItem.longitude}</p>}
                                                </div>
                                            )}
                                            {!parseArraySeguro(visualizandoItem.categoria).includes('casa') && visualizandoItem.rua_retirada && (
                                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                                    <ArrowDownTrayIcon className="w-6 h-6 text-[#FF5A00] mb-3" />
                                                    <h4 className="font-bold text-gray-900 mb-2">Ponto de Retirada</h4>
                                                    <p className="text-sm text-gray-600 font-medium">{visualizandoItem.rua_retirada}, nº {visualizandoItem.numero_retirada} - {visualizandoItem.cidade_retirada}</p>
                                                </div>
                                            )}
                                            {!parseArraySeguro(visualizandoItem.categoria).includes('casa') && visualizandoItem.rua_entrega && (
                                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                                    <TruckIcon className="w-6 h-6 text-[#FF5A00] mb-3" />
                                                    <h4 className="font-bold text-gray-900 mb-2">Ponto de Entrega</h4>
                                                    <p className="text-sm text-gray-600 font-medium">{visualizandoItem.rua_entrega}, nº {visualizandoItem.numero_entrega} - {visualizandoItem.cidade_entrega}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* INTERFACE DE FOMULÁRIO DO PAINEL */
                                    <>
                                        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-gray-100">
                                            <h3 className="text-xl font-black text-gray-900 mb-2 flex items-center gap-2">
                                                {isEditingItem ? <><DocumentTextIcon className="w-5 h-5 text-gray-400"/> Editar Item de Locação</> : <><PlusIcon className="w-5 h-5 text-gray-400"/> Adicionar Novo Item de Locação</>}
                                            </h3>
                                            <p className="text-gray-400 text-sm mb-6 font-medium">Cadastre e configure o seu produto ou imóvel para aluguel.</p>

                                            <form onSubmit={submitItemLocacao} className="space-y-6">
                                                {/* INFORMAÇÕES GERAIS */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <div>
                                                        <InputLabel value="Nome do Item *" />
                                                        <TextInput className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.nome} onChange={e => formItem.setData('nome', e.target.value)} placeholder="Ex: Flat Vista Mar, Corolla XEI" required />
                                                        <InputError message={formItem.errors.nome} />
                                                    </div>

                                                    <div>
                                                        {/* CATEGORIAS MESTRAS MÚLTIPLAS */}
                                                        <InputLabel value="Categoria de Locação *" />
                                                        <select 
                                                            className="mt-1 w-full py-3 border-gray-300 rounded-xl font-semibold text-sm text-gray-700 focus:border-[#FF5A00] focus:ring-[#FF5A00]"
                                                            value={formItem.data.categoria}
                                                            onChange={e => formItem.setData('categoria', e.target.value)}
                                                            required
                                                        >
                                                            <optgroup label="Imóveis e Espaços">
                                                                <option value="casa">Casa</option>
                                                                <option value="apartamento">Apartamento</option>
                                                                <option value="casa_praia">Casa de Praia</option>
                                                                <option value="flat">Flat / Studio</option>
                                                                <option value="hotel">Hotel</option>
                                                                <option value="pousada">Pousada</option>
                                                                <option value="hostel">Hostel</option>
                                                                <option value="chalé">Chalé</option>
                                                                <option value="cabana">Cabana</option>
                                                                <option value="loft">Loft</option>
                                                                <option value="kitnet">Kitnet</option>
                                                                <option value="cobertura">Cobertura</option>
                                                                <option value="condominio">Condomínio</option>
                                                                <option value="sitio">Sítio</option>
                                                                <option value="chacara">Chácara</option>
                                                                <option value="fazenda">Fazenda</option>
                                                                <option value="galpao">Galpão</option>
                                                                <option value="armazem">Armazém</option>
                                                                <option value="terreno">Terreno</option>
                                                                <option value="escritorio">Escritório</option>
                                                                <option value="consultorio">Consultório</option>
                                                                <option value="sala">Sala Comercial</option>
                                                                <option value="auditorio">Auditório</option>
                                                                <option value="espaco_eventos">Espaço de Eventos</option>
                                                                <option value="salão_festas">Salão de Festas</option>
                                                                <option value="coworking">Coworking</option>
                                                            </optgroup>
                                                            <optgroup label="Esportes">
                                                                <option value="quadra">Quadra</option>
                                                                <option value="quadra_futebol">Quadra de Futebol</option>
                                                                <option value="quadra_futsal">Quadra de Futsal</option>
                                                                <option value="quadra_volei">Quadra de Vôlei</option>
                                                                <option value="quadra_basquete">Quadra de Basquete</option>
                                                                <option value="quadra_tenis">Quadra de Tênis</option>
                                                                <option value="quadra_beach_tennis">Quadra Beach Tennis</option>
                                                                <option value="quadra_padel">Quadra de Padel</option>
                                                                <option value="campo_futebol">Campo de Futebol</option>
                                                                <option value="arena">Arena Esportiva</option>
                                                                <option value="ginasio">Ginásio</option>
                                                                <option value="piscina">Piscina</option>
                                                                <option value="academia">Academia</option>
                                                                <option value="estudio_danca">Estúdio de Dança</option>
                                                            </optgroup>
                                                            <optgroup label="Veículos e Náuticos">
                                                                <option value="carro">Carro</option>
                                                                <option value="moto">Moto</option>
                                                                <option value="bicicleta">Bicicleta</option>
                                                                <option value="bicicleta_eletrica">Bicicleta Elétrica</option>
                                                                <option value="patinete">Patinete</option>
                                                                <option value="patinete_eletrico">Patinete Elétrico</option>
                                                                <option value="van">Van</option>
                                                                <option value="onibus">Ônibus</option>
                                                                <option value="micro_onibus">Micro Ônibus</option>
                                                                <option value="caminhao">Caminhão</option>
                                                                <option value="carreta">Carreta</option>
                                                                <option value="motorhome">Motorhome</option>
                                                                <option value="trailer">Trailer</option>
                                                                <option value="jet_ski">Jet Ski</option>
                                                                <option value="barco">Barco</option>
                                                                <option value="lancha">Lancha</option>
                                                                <option value="iate">Iate</option>
                                                                <option value="caiaque">Caiaque</option>
                                                            </optgroup>
                                                            <optgroup label="Ferramentas e Equipamentos">
                                                                <option value="equipamento">Equipamento Geral</option>
                                                                <option value="ferramenta">Ferramenta</option>
                                                                <option value="equipamento_construcao">Maquinário de Construção</option>
                                                                <option value="equipamento_agricola">Máquina Agrícola</option>
                                                                <option value="equipamento_industrial">Máquina Industrial</option>
                                                                <option value="andaime">Andaime</option>
                                                                <option value="betoneira">Betoneira</option>
                                                                <option value="gerador">Gerador</option>
                                                                <option value="compressor">Compressor</option>
                                                                <option value="escada">Escada</option>
                                                            </optgroup>
                                                            <optgroup label="Tecnologia">
                                                                <option value="camera">Câmera</option>
                                                                <option value="camera_fotografica">Câmera Fotográfica</option>
                                                                <option value="camera_filmagem">Câmera de Filmagem</option>
                                                                <option value="drone">Drone</option>
                                                                <option value="notebook">Notebook</option>
                                                                <option value="computador">Computador</option>
                                                                <option value="tablet">Tablet</option>
                                                                <option value="projetor">Projetor</option>
                                                                <option value="impressora">Impressora</option>
                                                                <option value="monitor">Monitor</option>
                                                                <option value="videogame">Videogame</option>
                                                            </optgroup>
                                                            <optgroup label="Áudio, Vídeo e Festas">
                                                                <option value="audio_video">Áudio e Vídeo</option>
                                                                <option value="caixa_som">Caixa de Som</option>
                                                                <option value="mesa_som">Mesa de Som</option>
                                                                <option value="microfone">Microfone</option>
                                                                <option value="telão">Telão</option>
                                                                <option value="painel_led">Painel de LED</option>
                                                                <option value="iluminacao">Iluminação</option>
                                                                <option value="karaoke">Karaokê</option>
                                                                <option value="palco">Palco</option>
                                                                <option value="tenda">Tenda</option>
                                                                <option value="cadeira">Cadeira</option>
                                                                <option value="mesa">Mesa</option>
                                                                <option value="decoracao">Decoração</option>
                                                                <option value="brinquedo_inflavel">Brinquedo Inflável</option>
                                                            </optgroup>
                                                            <optgroup label="Vestuário">
                                                                <option value="roupa">Roupas</option>
                                                                <option value="terno">Ternos</option>
                                                                <option value="vestido">Vestidos</option>
                                                                <option value="fantasia">Fantasias</option>
                                                            </optgroup>
                                                            <optgroup label="Saúde e Beleza">
                                                                <option value="consultorio_estetica">Consultório Estética</option>
                                                                <option value="cadeira_barbeiro">Cadeira de Barbeiro</option>
                                                                <option value="salao_beleza">Salão de Beleza</option>
                                                                <option value="espaco_spa">Espaço Spa</option>
                                                            </optgroup>
                                                            <optgroup label="Outros / Diversos">
                                                                <option value="animal">Animal</option>
                                                                <option value="pet">Pet</option>
                                                                <option value="espaco_pet">Espaço Pet</option>
                                                                <option value="armazenamento">Armazenamento</option>
                                                                <option value="deposito">Depósito</option>
                                                                <option value="outro">Outro (Geral)</option>
                                                            </optgroup>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <InputLabel value="Quantidade no Estoque *" />
                                                        <TextInput type="number" className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.quantidade} onChange={e => formItem.setData('quantidade', e.target.value)} required />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                    <div><InputLabel value="Marca / Fabricante" /><TextInput className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.marca} onChange={e => formItem.setData('marca', e.target.value)} /></div>
                                                    <div><InputLabel value="Modelo" /><TextInput className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.modelo} onChange={e => formItem.setData('modelo', e.target.value)} /></div>
                                                    <div><InputLabel value="Tipo / Subtipo" /><TextInput className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.tipo} onChange={e => formItem.setData('tipo', e.target.value)} /></div>
                                                </div>

                                                {/* TABELA DE VALORES COM PARSER DECIMAL EM TEMPO REAL onBlur */}
                                                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
                                                    <div><InputLabel value="Valor Diária (R$) *" /><TextInput type="number" step="0.01" onKeyDown={blockInvalidNumberChars} onBlur={(e) => formatarDecimaisItemOnBlur('valor_diaria', e.target.value)} className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.valor_diaria} onChange={e => formItem.setData('valor_diaria', e.target.value)} /></div>
                                                    <div><InputLabel value="Valor Semanal (R$)" /><TextInput type="number" step="0.01" onKeyDown={blockInvalidNumberChars} onBlur={(e) => formatarDecimaisItemOnBlur('valor_semanal', e.target.value)} className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.valor_semanal} onChange={e => formItem.setData('valor_semanal', e.target.value)} /></div>
                                                    <div><InputLabel value="Valor Mensal (R$)" /><TextInput type="number" step="0.01" onKeyDown={blockInvalidNumberChars} onBlur={(e) => formatarDecimaisItemOnBlur('valor_mensal', e.target.value)} className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.valor_mensal} onChange={e => formItem.setData('valor_mensal', e.target.value)} /></div>
                                                    <div><InputLabel value="Valor Caução Garantia (R$)" /><TextInput type="number" step="0.01" onKeyDown={blockInvalidNumberChars} onBlur={(e) => formatarDecimaisItemOnBlur('valor_caucao', e.target.value)} className="mt-1 w-full focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={formItem.data.valor_caucao} onChange={e => formItem.setData('valor_caucao', e.target.value)} /></div>
                                                </div>

                                                {/* COMODIDADES CLICÁVEIS */}
                                                <div className="bg-white border border-gray-200 rounded-3xl p-6">
                                                    <InputLabel value="Selecione as Comodidades Oferecidas" />
                                                    <p className="text-xs text-gray-500 mb-4 mt-1">Clique para selecionar as facilidades que seu produto/imóvel oferece.</p>
                                                    <div className="flex flex-wrap gap-2">
                                                         {comodidadesPreDefinidas.map(comodidade => {
                                                            const isSelected = parseArraySeguro(formItem.data.recursos_oferecidos).includes(comodidade);
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={comodidade}
                                                                    onClick={() => toggleComodidade(comodidade)}
                                                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${isSelected ? 'bg-[#FF5A00] text-white border-[#FF5A00] shadow-md' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}
                                                                >
                                                                    {comodidade}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* ACESSÓRIOS COM VALORES */}
                                                <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div>
                                                            <InputLabel value="Produtos e Acessórios Adicionais com Valores" />
                                                            <p className="text-xs text-gray-500 mt-1">Insira opcionais que o cliente pode contratar junto à locação principal.</p>
                                                        </div>
                                                        <button type="button" onClick={adicionarAcessorio} className="px-4 py-2 bg-[#0F172A] text-white font-bold text-xs rounded-xl hover:bg-black transition flex items-center gap-1">
                                                            <PlusIcon className="w-4 h-4"/> Adicionar Opcional Extra
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="space-y-3">
                                                        {parseArraySeguro(formItem.data.acessorios).length === 0 && <p className="text-sm text-gray-400 font-medium">Nenhum opcional extra adicionado ao item.</p>}
                                                        {parseArraySeguro(formItem.data.acessorios).map((acessorio, idx) => (
                                                            <div key={idx} className="flex gap-4 items-center bg-white p-3 rounded-2xl border border-gray-200 shadow-xs">
                                                                <div className="flex-1">
                                                                    <InputLabel value="Nome do Acessório Extra" />
                                                                    <TextInput className="w-full mt-1 focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={acessorio.nome} onChange={(e) => atualizarAcessorioTexto(idx, e.target.value)} placeholder="Ex: Cadeirinha de Bebê, Kit Churrasco" required />
                                                                </div>
                                                                <div className="w-44">
                                                                    <InputLabel value="Custo do Extra (R$)" />
                                                                    <TextInput type="number" min="0" step="0.01" onKeyDown={blockInvalidNumberChars} onBlur={(e) => formatarDecimaisAcessorioOnBlur(idx, e.target.value)} className="w-full mt-1 focus:border-[#FF5A00] focus:ring-[#FF5A00]" value={acessorio.valor} onChange={(e) => atualizarAcessorioValor(idx, e.target.value)} placeholder="50.00" required />
                                                                </div>
                                                                <button type="button" onClick={() => removerAcessorio(idx)} className="mt-6 w-10 h-10 bg-red-50 hover:bg-red-100 text-red-600 rounded-full flex items-center justify-center transition">
                                                                    <TrashIcon className="w-4 h-4"/>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* ======================================================= */}
                                                {/* 👉 CONDICIONAL 1: EXIBE APENAS SE FOR IMÓVEL OU ESPAÇO   */}
                                                {/* ======================================================= */}
                                                {esImovel && (
                                                    <div className="p-6 bg-orange-50/40 border border-orange-100 rounded-3xl space-y-4 animate-in fade-in duration-300">
                                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2"><MapPinIcon className="w-4 h-4"/> Especificações do Imóvel</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div>
                                                                <InputLabel value="CEP" />
                                                                <TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cep} onChange={e => formItem.setData('cep', e.target.value)} onBlur={(e) => buscarEnderecoAutomatizado(e.target.value, formItem.setData, '')} placeholder="Digite para auto-preencher" />
                                                            </div>
                                                            <div className="md:col-span-2"><InputLabel value="Endereço / Logradouro" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.endereco} onChange={e => formItem.setData('endereco', e.target.value)} /></div>
                                                            <div><InputLabel value="Número" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero} onChange={e => formItem.setData('numero', e.target.value)} /></div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div><InputLabel value="Bairro" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.bairro} onChange={e => formItem.setData('bairro', e.target.value)} /></div>
                                                            <div><InputLabel value="Cidade" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cidade} onChange={e => formItem.setData('cidade', e.target.value)} /></div>
                                                            <div>
                                                                <InputLabel value="Estado (UF)" />
                                                                <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formItem.data.estado} onChange={e => formItem.setData('estado', e.target.value)}>
                                                                    <option value="">UF</option>
                                                                    {ufsBrasil.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                                                </select>
                                                            </div>
                                                            <div><InputLabel value="Complemento" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.complemento} onChange={e => formItem.setData('complemento', e.target.value)} /></div>
                                                        </div>
                                                        {/* Latitude e Longitude Bloqueadas em ReadOnly */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            <div><InputLabel value="Latitude (Auto)" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 text-gray-500 cursor-not-allowed select-all" value={formItem.data.latitude} /></div>
                                                            <div><InputLabel value="Longitude (Auto)" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 text-gray-500 cursor-not-allowed select-all" value={formItem.data.longitude} /></div>
                                                        </div>
                                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-orange-200">
                                                            <div><InputLabel value="Quartos" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_quartos} onChange={e => formItem.setData('numero_quartos', e.target.value)} /></div>
                                                            <div><InputLabel value="Banheiros" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_banheiros} onChange={e => formItem.setData('numero_banheiros', e.target.value)} /></div>
                                                            <div><InputLabel value="Suítes" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_suites} onChange={e => formItem.setData('numero_suites', e.target.value)} /></div>
                                                            <div><InputLabel value="Vagas Garagem" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_vagas} onChange={e => formItem.setData('numero_vagas', e.target.value)} /></div>
                                                            <div><InputLabel value="Total Cômodos" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_comodos} onChange={e => formItem.setData('numero_comodos', e.target.value)} /></div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div><InputLabel value="Capacidade (Pessoas)" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.capacidade_pessoas} onChange={e => formItem.setData('capacidade_pessoas', e.target.value)} /></div>
                                                            <div><InputLabel value="Área Total (m²)" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.area_total} onChange={e => formItem.setData('area_total', e.target.value)} /></div>
                                                            <div><InputLabel value="Área Construída (m²)" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.area_construida} onChange={e => formItem.setData('area_construida', e.target.value)} /></div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* CONDICIONAL: VEÍCULOS COM VALIDAÇÕES APLICADAS */}
                                                {esVeiculo && (
                                                    <div className="p-6 bg-blue-50/40 border border-blue-100 rounded-3xl space-y-4 animate-in fade-in duration-300">
                                                        <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Especificações de Frota</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div><InputLabel value="Placa *" /><TextInput maxLength="7" className="w-full mt-1 uppercase focus:border-[#FF5A00]" value={formItem.data.placa} onChange={e => formItem.setData('placa', e.target.value.toUpperCase())} /></div>
                                                            <div><InputLabel value="Renavam" /><TextInput maxLength="11" className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.renavam} onChange={e => formItem.setData('renavam', e.target.value.replace(/\D/g, ''))} /></div>
                                                            <div><InputLabel value="Chassis" /><TextInput maxLength="17" className="w-full mt-1 uppercase focus:border-[#FF5A00]" value={formItem.data.chassis} onChange={e => formItem.setData('chassis', e.target.value.toUpperCase())} /></div>
                                                            <div><InputLabel value="Quilometragem (KM)" /><TextInput type="number" min="0" onKeyDown={blockInvalidNumberChars} className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.quilometragem} onChange={e => formItem.setData('quilometragem', e.target.value)} /></div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div>
                                                                <InputLabel value="Ano de Fabricação" />
                                                                <select className="mt-1 w-full py-3 border-gray-300 rounded-xl font-medium text-sm text-gray-700 focus:border-[#FF5A00]" value={formItem.data.ano} onChange={e => formItem.setData('ano', e.target.value)}>
                                                                    <option value="">Selecione o ano...</option>
                                                                    {anosDisponiveis.map(ano => <option key={ano} value={ano}>{ano}</option>)}
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <InputLabel value="Combustível" />
                                                                <select className="mt-1 w-full py-3 border-gray-300 rounded-xl font-medium text-sm text-gray-700 focus:border-[#FF5A00]" value={formItem.data.combustivel} onChange={e => formItem.setData('combustivel', e.target.value)}>
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
                                                                <select className="mt-1 w-full py-3 border-gray-300 rounded-xl font-medium text-sm text-gray-700 focus:border-[#FF5A00]" value={formItem.data.cambio} onChange={e => formItem.setData('cambio', e.target.value)}>
                                                                    <option value="Manual">Manual</option>
                                                                    <option value="Automático">Automático</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                            <div><InputLabel value="Cilindradas" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cilindrada} onChange={e => formItem.setData('cilindrada', e.target.value)} /></div>
                                                            <div><InputLabel value="Potência (CV)" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.potencia} onChange={e => formItem.setData('potencia', e.target.value)} /></div>
                                                            <label className="flex items-center gap-2 font-bold text-xs text-gray-700 mt-6"><input type="checkbox" checked={formItem.data.possui_seguro} onChange={e => formItem.setData('possui_seguro', e.target.checked)} className="rounded border-gray-300 text-[#FF5A00] focus:ring-[#FF5A00]" /> Possui Seguro Ativo</label>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* CONDICIONAL: EQUIPAMENTO */}
                                                {esEquipamento && (
                                                    <div className="p-6 bg-purple-50/30 border border-purple-100 rounded-3xl space-y-5 animate-in fade-in duration-300">
                                                        <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider">Ficha Logística do Equipamento</h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div><InputLabel value="Fabricante" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.fabricante} onChange={e => formItem.setData('fabricante', e.target.value)} /></div>
                                                            <div><InputLabel value="Nº de Série" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_serie} onChange={e => formItem.setData('numero_serie', e.target.value)} /></div>
                                                            <div><InputLabel value="Patrimônio" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.patrimonio} onChange={e => formItem.setData('patrimonio', e.target.value)} /></div>
                                                            <div><InputLabel value="Voltagem" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.voltagem} onChange={e => formItem.setData('voltagem', e.target.value)} placeholder="Ex: 110v, 220v, Bivolt" /></div>
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                            <div><InputLabel value="Potência Logística" /><TextInput className="w-full mt-1" value={formItem.data.potencia_equipamento} onChange={e => formItem.setData('potencia_equipamento', e.target.value)} /></div>
                                                            <div><InputLabel value="Peso" /><TextInput className="w-full mt-1" value={formItem.data.peso} onChange={e => formItem.setData('peso', e.target.value)} /></div>
                                                            <div><InputLabel value="Dimensões" /><TextInput className="w-full mt-1" value={formItem.data.dimensoes} onChange={e => formItem.setData('dimensoes', e.target.value)} /></div>
                                                            <div><InputLabel value="Tempo de Garantia" /><TextInput className="w-full mt-1" value={formItem.data.garantia} onChange={e => formItem.setData('garantia', e.target.value)} /></div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 👉 ENDEREÇOS LOGÍSTICOS ADICIONAIS: SÓ APARECE SE NÃO FOR IMÓVEL/LUGAR */}
                                                {!esImovel && (
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
                                                        {/* LOCAL DE RETIRADA */}
                                                        <div className="p-6 bg-gray-50 border border-gray-200 rounded-3xl space-y-4 shadow-sm">
                                                            <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                                                <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" /> Endereço de Retirada Opcional
                                                            </h4>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                <div className="sm:col-span-1"><InputLabel value="CEP" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cep_retirada} onChange={e => formItem.setData('cep_retirada', e.target.value)} onBlur={(e) => buscarEnderecoAutomatizado(e.target.value, formItem.setData, '_retirada')} /></div>
                                                                <div className="sm:col-span-2"><InputLabel value="Rua de Retirada" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.rua_retirada} onChange={e => formItem.setData('rua_retirada', e.target.value)} /></div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                <div><InputLabel value="Número" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_retirada} onChange={e => formItem.setData('numero_retirada', e.target.value)} /></div>
                                                                <div className="sm:col-span-2"><InputLabel value="Complemento" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.complemento_retirada} onChange={e => formItem.setData('complemento_retirada', e.target.value)} /></div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                <div><InputLabel value="Bairro" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.bairro_retirada} onChange={e => formItem.setData('bairro_retirada', e.target.value)} /></div>
                                                                <div><InputLabel value="Cidade" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cidade_retirada} onChange={e => formItem.setData('cidade_retirada', e.target.value)} /></div>
                                                                <div>
                                                                    <InputLabel value="UF" />
                                                                    <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formItem.data.estado_retirada} onChange={e => formItem.setData('estado_retirada', e.target.value)}>
                                                                        <option value="">UF</option>
                                                                        {ufsBrasil.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                <div><InputLabel value="Latitude (Auto)" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 font-mono text-xs text-gray-500 cursor-not-allowed" value={formItem.data.latitude_retirada} /></div>
                                                                <div><InputLabel value="Longitude (Auto)" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 font-mono text-xs text-gray-500 cursor-not-allowed" value={formItem.data.longitude_retirada} /></div>
                                                            </div>
                                                        </div>

                                                        {/* LOCAL DE ENTREGA */}
                                                        <div className="p-6 bg-gray-50 border border-gray-200 rounded-3xl space-y-4 shadow-sm">
                                                            <h4 className="text-sm font-black text-gray-800 uppercase tracking-wider flex items-center gap-2">
                                                                <TruckIcon className="w-4 h-4 text-gray-400" /> Endereço de Entrega Opcional
                                                            </h4>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                <div className="sm:col-span-1"><InputLabel value="CEP" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cep_entrega} onChange={e => formItem.setData('cep_entrega', e.target.value)} onBlur={(e) => buscarEnderecoAutomatizado(e.target.value, formItem.setData, '_entrega')} /></div>
                                                                <div className="sm:col-span-2"><InputLabel value="Rua de Entrega" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.rua_entrega} onChange={e => formItem.setData('rua_entrega', e.target.value)} /></div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                <div><InputLabel value="Número" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.numero_entrega} onChange={e => formItem.setData('numero_entrega', e.target.value)} /></div>
                                                                <div className="sm:col-span-2"><InputLabel value="Complemento" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.complemento_entrega} onChange={e => formItem.setData('complemento_entrega', e.target.value)} /></div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                                <div><InputLabel value="Bairro" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.bairro_entrega} onChange={e => formItem.setData('bairro_entrega', e.target.value)} /></div>
                                                                <div><InputLabel value="Cidade" /><TextInput className="w-full mt-1 focus:border-[#FF5A00]" value={formItem.data.cidade_entrega} onChange={e => formItem.setData('cidade_entrega', e.target.value)} /></div>
                                                                <div>
                                                                    <InputLabel value="UF" />
                                                                    <select className="mt-1 w-full border-gray-300 rounded-lg shadow-sm focus:border-[#FF5A00]" value={formItem.data.estado_entrega} onChange={e => formItem.setData('estado_entrega', e.target.value)}>
                                                                        <option value="">UF</option>
                                                                        {ufsBrasil.map(uf => <option key={uf} value={uf}>{uf}</option>)}
                                                                    </select>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                <div><InputLabel value="Latitude (Auto)" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 font-mono text-xs text-gray-500 cursor-not-allowed" value={formItem.data.latitude_entrega} /></div>
                                                                <div><InputLabel value="Longitude (Auto)" /><TextInput type="text" readOnly className="w-full mt-1 bg-gray-100 font-mono text-xs text-gray-500 cursor-not-allowed" value={formItem.data.longitude_entrega} /></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* PROFISSIONAIS RESPONSÁVEIS */}
                                                <div className="border-t border-gray-100 pt-6">
                                                    <InputLabel value="Vincular Operadores / Profissionais Responsáveis" />
                                                    <p className="text-xs text-gray-500 mb-4 mt-1">Selecione quais colaboradores gerenciam ou entregam este item.</p>
                                                    <div className="flex gap-4 overflow-x-auto pb-2 mt-2">
                                                        {funcionarios.map(func => {
                                                            const isSelected = parseArraySeguro(formItem.data.funcionarios_responsaveis).includes(func.id);
                                                            return (
                                                                <div key={func.id} onClick={() => toggleFuncionarioResponsavel(func.id)} className={`cursor-pointer border rounded-2xl p-4 flex flex-col items-center gap-2 w-28 shrink-0 transition-all ${isSelected ? 'border-[#FF5A00] bg-orange-50 shadow-md scale-105' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                                                                    {func.foto_perfil ? (
                                                                        <img src={func.foto_perfil} className="w-12 h-12 rounded-full object-cover shadow-sm" alt="Perfil" />
                                                                    ) : (
                                                                        <div className="w-12 h-12 rounded-full bg-gray-200 text-gray-500 font-bold flex items-center justify-center text-lg shadow-sm">{func.nome.charAt(0)}</div>
                                                                    )}
                                                                    <span className="text-xs font-bold text-center text-gray-800 line-clamp-1">{func.nome}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div>
                                                    <InputLabel value="Descrição Detalhada do Item" />
                                                    <textarea className="mt-1 w-full border-gray-300 rounded-xl focus:border-[#FF5A00]" rows="3" value={formItem.data.descricao} onChange={e => formItem.setData('descricao', e.target.value)}></textarea>
                                                </div>

                                                {/* VITRINE DE IMAGENS DO ITEM */}
                                                <div className="border-t border-gray-100 pt-6">
                                                    <InputLabel value="Fotos da Vitrine de Locação" />
                                                    <div className="flex flex-wrap gap-4 mt-4">
                                                        {[0, 1, 2, 3, 4].map((index) => {
                                                            const arquivo = quadradosFotosItem[index];
                                                            const previewUrl = arquivo ? URL.createObjectURL(arquivo) : null;
                                                            return (
                                                                <div key={index} className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0">
                                                                    {arquivo ? (
                                                                        <>
                                                                            <img src={previewUrl} alt="Preview" className={`w-full h-full object-cover rounded-xl border ${index === 0 ? 'border-[#FF5A00]' : 'border-gray-200'} shadow-sm`} />
                                                                            {index === 0 && <div className="absolute bottom-0 left-0 w-full bg-[#FF5A00]/90 text-white text-[9px] font-bold text-center py-1 rounded-b-xl uppercase tracking-widest backdrop-blur-sm">Capa</div>}
                                                                            <button type="button" onClick={() => removerFotoItemQuadrado(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow-md"><XMarkIcon className="w-4 h-4"/></button>
                                                                        </>
                                                                    ) : (
                                                                        <label className={`cursor-pointer w-full h-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl bg-gray-50/50 hover:bg-gray-100 transition-colors ${index === 0 ? 'border-orange-200 hover:border-orange-400' : 'border-gray-200'}`}>
                                                                            <span className="text-xl font-light text-gray-400">+</span>
                                                                            <span className="text-[10px] font-bold mt-1 text-gray-400">Foto {index + 1}</span>
                                                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFotoItemQuadrado(index, e.target.files[0])} />
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* 👉 BOTÃO VERDE APRIMORADO E REATIVO */}
                                                <div className="flex justify-end pt-4 gap-4 border-t border-gray-100">
                                                    {isEditingItem && <button type="button" onClick={cancelarEdicaoItem} className="text-sm font-bold text-gray-500 hover:text-gray-900 transition">Cancelar</button>}
                                                    <button type="submit" disabled={formItem.processing} className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition transform active:scale-95 disabled:opacity-50">
                                                        {isEditingItem ? 'Atualizar Locação' : 'Salvar Item de Locação'}
                                                    </button>
                                                </div>
                                            </form>
                                        </div>

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
                                                                <span className="text-[10px] font-black bg-orange-50 text-[#FF5A00] px-2 py-0.5 rounded uppercase tracking-wider border border-orange-100">{item.categoria.replace(/_/g, ' ')}</span>
                                                                <h4 className="font-bold text-gray-900 text-lg mt-1">{item.nome}</h4>
                                                                <p className="text-xs font-semibold text-gray-400 mt-0.5">
                                                                    {item.modelo ? `${item.marca || ''} ${item.modelo}` : 'Sob demanda'} • Qtd Disponível: {item.quantidade}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-4 sm:mt-0">
                                                                <button onClick={() => visualizarItem(item)} className="text-xs font-bold text-[#FF5A00] hover:text-[#C74B27] bg-orange-50 border border-orange-100 px-4 py-2 rounded-lg transition">Ver Detalhes</button>
                                                                <button onClick={() => editarItem(item)} className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-lg transition">Editar</button>
                                                                <button onClick={() => deletarItem(item.id)} className="text-xs font-bold text-red-600 bg-red-50 border border-red-100 px-4 py-2 rounded-lg transition">Remover</button>
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
                                    </>
                                )}
                            </div>
                        )}

                        {/* ABA 5: FINANCEIRO */}
                        {activeTab === 'financeiro' && (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className="bg-white dark:bg-gray-800 p-6 sm:p-10 rounded-[2.5rem] shadow-sm border border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-3 mb-6">
                                        <CurrencyDollarIcon className="w-6 h-6 text-gray-700 dark:text-white" />
                                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recebimentos e Integração</h3>
                                    </div>
                                    <div className="p-4 mb-6 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl">
                                        <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">Como receber os meus pagamentos?</h4>
                                        <p className="text-sm text-blue-700 dark:text-blue-400">
                                            Para receber pagamentos online diretamente na sua conta, você precisa de uma conta no <strong>Mercado Pago</strong>. 
                                            Copie o seu "Access Token" (Token de Acesso de Produção) no painel de desenvolvedor do Mercado Pago e cole abaixo. 
                                            A plataforma retém automaticamente a taxa de serviço e o restante entra direto na sua conta, disponível na hora!
                                        </p>
                                    </div>
                                    <form onSubmit={submitDetalhes} className="space-y-6">
                                        <div>
                                            <InputLabel value="Access Token do Mercado Pago (Produção) *" />
                                            <TextInput 
                                                type="password" 
                                                className="mt-1 w-full font-mono text-sm" 
                                                value={formDetalhes.data.token_mercadopago} 
                                                onChange={e => formDetalhes.setData('token_mercadopago', e.target.value)} 
                                                placeholder="APP_USR-123456789..." 
                                            />
                                            <InputError message={formDetalhes.errors.token_mercadopago} />
                                            <p className="text-xs text-gray-500 mt-2">Mantenha este token em segredo. Ele é a chave para o seu dinheiro.</p>
                                        </div>
                                        <div className="flex justify-end pt-4">
                                            <PrimaryButton className="px-8 py-3 bg-[#FF5A00] rounded-xl shadow-lg" disabled={formDetalhes.processing}>
                                                Salvar Token Financeiro
                                            </PrimaryButton>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                    </main>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
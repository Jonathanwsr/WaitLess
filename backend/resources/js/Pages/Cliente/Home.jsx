import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styled, { createGlobalStyle, css } from 'styled-components';
import { useForm } from '@inertiajs/react'; // Importado para lidar com o formulário de pesquisa

import { IoCutOutline } from 'react-icons/io5';
import { 
  FiSearch, FiShoppingCart, FiMapPin, FiClock, 
  FiStar, FiUsers, FiBell, FiThumbsUp, FiTool, FiLoader,
  FiChevronLeft, FiChevronRight, FiMap, FiCornerDownLeft,
  FiTrash2 // Adicionado ícone de lixeira
} from 'react-icons/fi';
import { 
  FaSprayCan, FaTooth, FaBriefcaseMedical, 
  FaBalanceScale, FaCalculator, FaDumbbell, FaPaw 
} from 'react-icons/fa';
import { MdBrush } from 'react-icons/md';

// --- ESTILOS GLOBAIS (DESIGN SYSTEM) ---
const GlobalStyle = createGlobalStyle`
  body {
    margin: 0;
    padding: 0;
    font-family: 'Inter', sans-serif;
    background-color: #FBF9F9; 
    color: #333;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
`;

const colors = {
  primary: '#E04F36', 
  primaryLight: '#FFF0ED', 
  secondary: '#111827', 
  accent: '#FBBF24', 
  gray: '#6B7280', 
  lightGray: '#F3F4F6', 
  white: '#FFFFFF',
  border: '#E5E7EB',
  error: '#DC2626', // Nova cor para erros
};

const media = {
  tablet: (...args) => css`@media (max-width: 768px) { ${css(...args)}; }`,
  desktop: (...args) => css`@media (max-width: 1024px) { ${css(...args)}; }`,
};

// --- COMPONENTES STYLED (LAYOUT E UI) ---

const MainContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 3rem;

  ${media.tablet`
    padding: 1rem;
    gap: 2rem;
  `}
`;

// HERO SECTION
const HeroSection = styled.header`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3rem;
  align-items: center;

  ${media.tablet`
    grid-template-columns: 1fr;
    text-align: center;
  `}
`;

const HeroText = styled.div`
  h1 {
    font-size: 3.2rem;
    font-weight: 800;
    line-height: 1.1;
    margin-bottom: 1rem;
    color: ${colors.secondary};
  }
  h1 span {
    color: ${colors.primary};
  }
  p {
    font-size: 1.1rem;
    color: ${colors.gray};
    line-height: 1.6;
    margin-bottom: 2rem;
  }
`;

// Barra de pesquisa agora é um formulário para submissão
const SearchBarForm = styled.form`
  display: flex;
  background-color: ${colors.white};
  border: 1px solid ${colors.border};
  border-radius: 50px;
  padding: 0.4rem;
  margin-bottom: 1rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);

  ${media.tablet`
    flex-direction: column;
    border-radius: 15px;
    padding: 0.8rem;
    gap: 0.8rem;
  `}
`;

const SearchInput = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 1rem;
  gap: 0.8rem;

  input {
    border: none;
    background: transparent;
    width: 100%;
    font-size: 1rem;
    color: ${colors.secondary};
    &:focus { outline: none; }
    &::placeholder { color: #9CA3AF; }
  }
  svg { color: #9CA3AF; font-size: 1.2rem; }
`;

const SearchButton = styled.button`
  background-color: ${colors.primary};
  color: ${colors.white};
  border: none;
  padding: 0.8rem 2.5rem;
  border-radius: 50px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { opacity: 0.9; }
  ${media.tablet`width: 100%; justify-content: center;`}
`;

const SearchSuggestions = styled.div`
  font-size: 0.85rem;
  color: ${colors.gray};
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;

  span { font-weight: 500; }
  a {
    background-color: ${colors.lightGray};
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    cursor: pointer;
    text-decoration: none;
    color: ${colors.secondary};
    transition: background 0.2s;
    &:hover { background-color: #E5E7EB; }
  }
  ${media.tablet`justify-content: center;`}
`;

const HeroImageArea = styled.div`
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  height: 400px;
  background-color: ${colors.lightGray};
  display: flex;
  justify-content: center;
  align-items: center;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  ${media.tablet`height: 300px;`}
`;

const FloatingWidget = styled.div`
  position: absolute;
  background-color: ${colors.white};
  padding: 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  .icon { font-size: 1.8rem; color: ${colors.primary}; }
  .text {
    font-size: 0.85rem;
    color: ${colors.gray};
    line-height: 1.2;
    strong { font-size: 1.1rem; font-weight: 700; color: ${colors.secondary}; }
  }
`;

// CATEGORIES SECTION
const CategorySection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h2 { font-size: 1.4rem; font-weight: 700; margin: 0; color: ${colors.secondary}; }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 1.5rem;

    a { font-size: 0.9rem; color: ${colors.primary}; text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; }
  }
`;

const CarouselNav = styled.div`
  display: flex;
  gap: 0.6rem;

  button {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid ${colors.border};
    background-color: ${colors.white};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${colors.gray};
    font-size: 1.2rem;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    transition: all 0.2s;

    &:hover {
      border-color: ${colors.gray};
      color: ${colors.secondary};
    }
  }

  ${media.tablet`display: none;`}
`;

const CategoryList = styled.div`
  display: flex;
  gap: 1.2rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scroll-behavior: smooth; 
  scrollbar-width: none; 
  &::-webkit-scrollbar { display: none; }
`;

const CategoryItem = styled.div`
  flex: 0 0 110px;
  height: 110px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  border-radius: 16px;
  cursor: pointer;
  background-color: ${colors.white};
  border: 1px solid ${colors.border};
  transition: all 0.2s;

  &:hover {
    border-color: ${colors.primary};
    box-shadow: 0 4px 6px -1px rgba(224, 79, 54, 0.1);
  }

  .icon-holder { font-size: 1.8rem; color: #9CA3AF; }
  p { font-size: 0.85rem; font-weight: 600; margin: 0; color: ${colors.secondary}; text-align: center; }
`;

// ESTABELECIMENTOS SECTION
const EstablishmentsSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const LocationSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem; // Aumentado para acomodar o botão de lixeira
  font-size: 0.9rem;
  color: ${colors.gray};
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  border-radius: 8px;
  transition: background 0.2s;

  &:hover { background-color: ${colors.lightGray}; }
  svg { color: ${colors.primary}; }
  
  .address-text {
    flex: 1;
    border-bottom: 1px dashed ${colors.border};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .clear-location {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.3rem;
    border-radius: 5px;
    color: ${colors.gray};
    transition: all 0.2s;
    &:hover { background-color: rgba(220, 38, 38, 0.1); color: ${colors.error}; }
    svg { color: inherit; font-size: 1rem; }
  }
`;

// Container do novo bloco de endereço elaborado
const LocationBlockContainer = styled.div`
  background-color: ${colors.white};
  border: 1px solid ${colors.border};
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  width: 100%;
`;

const LocationHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: ${colors.secondary};
  font-weight: 600;
  font-size: 1.1rem;
  svg { color: ${colors.primary}; font-size: 1.3rem; }
`;

const LocationFormFields = styled.form`
  display: grid;
  grid-template-columns: 2fr 1fr; /* Rua maior, Número menor */
  gap: 1rem;

  ${media.tablet`grid-template-columns: 1fr;`} /* Empilha em telas pequenas */

  .full-width { grid-column: span 2; ${media.tablet`grid-column: span 1;`} }

  label { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.85rem; color: ${colors.gray}; }

  input {
    border: 1px solid ${colors.border};
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s;
    &:focus { border-color: ${colors.primary}; }
    &::placeholder { color: #9CA3AF; }
    
    &.error {
      border-color: ${colors.error};
      &:focus { border-color: ${colors.error}; box-shadow: 0 0 0 1px ${colors.error}; }
    }
  }
  
  .error-message {
    color: ${colors.error};
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
`;

const LocationActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.8rem;
  margin-top: 0.5rem;

  button {
    padding: 0.6rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-save {
    background-color: ${colors.primary};
    color: ${colors.white};
    border: none;
    &:hover { opacity: 0.9; }
    &:disabled { background-color: #D1D5DB; cursor: not-allowed; }
  }

  .btn-cancel {
    background-color: transparent;
    color: ${colors.gray};
    border: 1px solid ${colors.border};
    &:hover { background-color: ${colors.lightGray}; color: ${colors.secondary}; }
  }
`;

const StoreList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.5rem;
`;

const StoreCard = styled.div`
  background-color: ${colors.white};
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid ${colors.border};
  display: flex;
  flex-direction: column;
`;

const StoreCardImage = styled.div`
  position: relative;
  height: 160px;
  background-color: ${colors.lightGray};
  img { width: 100%; height: 100%; object-fit: cover; }
`;

const CategoryBadge = styled.div`
  position: absolute;
  bottom: -15px;
  left: 15px;
  width: 32px;
  height: 32px;
  background-color: ${colors.secondary};
  color: ${colors.white};
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  border: 2px solid ${colors.white};
`;

const CartButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.4);
  color: ${colors.white};
  border: none;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: all 0.2s;

  &:hover { background-color: ${colors.primary}; }
`;

const StoreInfo = styled.div`
  padding: 1.5rem 1.2rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  flex: 1;

  h3 { font-size: 1.1rem; font-weight: 700; margin: 0; color: ${colors.secondary}; }

  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.85rem;
    color: ${colors.gray};
    
    .rating {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      color: ${colors.secondary};
      font-weight: 600;
      svg { color: ${colors.accent}; }
      span { color: ${colors.gray}; font-weight: 400; }
    }
    .distance { display: flex; align-items: center; gap: 0.2rem; }
  }
`;

const QueueBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background-color: ${colors.primaryLight};
  color: ${colors.primary};
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  width: fit-content;
`;

const FullButton = styled.button`
  background-color: ${colors.primary};
  color: ${colors.white};
  border: none;
  padding: 0.8rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.95rem;
  cursor: pointer;
  width: 100%;
  margin-top: auto;
  transition: opacity 0.2s;

  &:hover { opacity: 0.9; }
`;

const EmptyStateContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background-color: ${colors.white};
  border-radius: 16px;
  border: 1px dashed ${colors.border};
  text-align: center;
  grid-column: 1 / -1;

  .spinner {
    animation: spin 1s linear infinite;
    font-size: 2rem;
    color: ${colors.primary};
    margin-bottom: 1rem;
  }
  @keyframes spin { 100% { transform: rotate(360deg); } }

  svg { font-size: 3rem; color: #D1D5DB; margin-bottom: 1rem; }
  h3 { color: ${colors.secondary}; margin: 0 0 0.5rem 0; font-size: 1.2rem; }
  p { color: ${colors.gray}; margin: 0; font-size: 0.95rem; }
`;

// BOTTOM FEATURES
const FeaturesGrid = styled.section`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1.2rem;

  ${media.desktop`grid-template-columns: repeat(3, 1fr);`}
  ${media.tablet`grid-template-columns: 1fr;`}
`;

const FeatureCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.8rem;
  padding: 1.5rem;
  background-color: ${colors.white};
  border-radius: 16px;
  border: 1px solid ${colors.border};

  .icon-holder {
    color: ${colors.primary};
    font-size: 1.5rem;
    background-color: ${colors.primaryLight};
    padding: 0.6rem;
    border-radius: 10px;
  }
  h4 { font-size: 0.95rem; font-weight: 700; margin: 0; color: ${colors.secondary}; }
  p { font-size: 0.85rem; color: ${colors.gray}; margin: 0; line-height: 1.4; }
`;

const PremiumCard = styled.div`
  background: linear-gradient(135deg, #E04F36 0%, #B91C1C 100%);
  color: ${colors.white};
  padding: 1.5rem;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  position: relative;
  overflow: hidden;

  h3 { font-size: 1.2rem; font-weight: 800; margin: 0 0 0.5rem 0; }
  p { font-size: 0.85rem; margin: 0 0 1.5rem 0; opacity: 0.9; position: relative; z-index: 2; }
  
  button {
    background-color: ${colors.white};
    color: #B91C1C;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 50px;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    z-index: 2;
  }

  &::after {
    content: '👑';
    position: absolute;
    bottom: -15px;
    right: -10px;
    font-size: 6rem;
    opacity: 0.15;
    z-index: 1;
  }
`;

// --- DADOS ESTÁTICOS ---
const staticCategories = [
  { icon: <IoCutOutline />, name: 'Barbeiro' },
  { icon: <FaSprayCan />, name: 'Salão de Beleza' },
  { icon: <MdBrush />, name: 'Manicure' },
  { icon: <FaTooth />, name: 'Dentista' },
  { icon: <FaBriefcaseMedical />, name: 'Fisioterapia' },
  { icon: <FiTool />, name: 'Mecânico' },
  { icon: <FaPaw />, name: 'Pet Shop' },
  { icon: <FaBalanceScale />, name: 'Advogado' },
  { icon: <FaCalculator />, name: 'Contador' },
  { icon: <FaDumbbell />, name: 'Academia' },
];

const staticFeatures = [
  { icon: <FiUsers />, title: "Fila virtual", desc: "Entre na fila de onde estiver e evite filas físicas." },
  { icon: <FiClock />, title: "Acompanhamento em tempo real", desc: "Veja sua posição e tempo estimado de espera." },
  { icon: <FiBell />, title: "Notificações", desc: "Receba alertas quando estiver próximo do seu atendimento." },
  { icon: <FiThumbsUp />, title: "Avaliações reais", desc: "Veja avaliações de outros clientes e faça a melhor escolha." },
];

const getCategoryIcon = (tipo) => {
  switch (tipo?.toLowerCase()) {
    case 'barbearia': return <IoCutOutline />;
    case 'salão': return <FaSprayCan />;
    case 'manicure': return <MdBrush />;
    case 'dentista': return <FaTooth />;
    case 'mecânica': return <FiTool />;
    case 'petshop': return <FaPaw />;
    default: return <FiStar />; 
  }
};

// --- CHAVES DO LOCAL STORAGE ---
const LOCAL_STORAGE_KEYS = {
  FORMATTED_ADDRESS: 'waitless_formatted_address',
  ADDRESS_DATA: 'waitless_address_data',
  COORDS: 'waitless_coords'
};

// --- COMPONENTE PRINCIPAL (HOME.JSX) ---
export default function Home() {
  const [stores, setStores] = useState([]); 
  const [isLoading, setIsLoading] = useState(false); 
  const [statusMessage, setStatusMessage] = useState('Buscando localização...'); 
  
  // 1. Estados para a Inserção Manual de Endereço (agora um objeto)
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [addressData, setAddressData] = useState({
    logradouro: '',
    numero: '',
    bairro: '',
    cidadeUf: ''
  });
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [validationErrors, setValidationErrors] = useState({}); // Novo estado para erros de validação

  // 2. Referência para o Carrossel de Categorias
  const categoryCarouselRef = useRef(null);

  // 3. Gerenciamento do formulário de pesquisa principal com useForm
  const searchForm = useForm({
    query: ''
  });

  // Função genérica para buscar lojas próximas baseada em coordenadas ou endereço
  const fetchNearbyStores = async (params) => {
    setIsLoading(true);
    try {
      const response = await axios.get('/estabelecimentos/proximos', { params: { ...params, radius: 15 } });
      setStores(response.data);
    } catch (error) {
      console.error("Erro ao buscar estabelecimentos:", error);
      // Aqui você poderia tratar o erro de forma mais granular
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 4. Carregamento da localização do Local Storage na montagem do componente
    const storedFormattedAddress = localStorage.getItem(LOCAL_STORAGE_KEYS.FORMATTED_ADDRESS);
    const storedAddressData = localStorage.getItem(LOCAL_STORAGE_KEYS.ADDRESS_DATA);
    const storedCoords = localStorage.getItem(LOCAL_STORAGE_KEYS.COORDS);

    if (storedCoords) {
      const { lat, lng } = JSON.parse(storedCoords);
      setStatusMessage(storedFormattedAddress);
      fetchNearbyStores({ lat, lng });
    } else if (storedAddressData) {
      const parsedAddressData = JSON.parse(storedAddressData);
      setStatusMessage(storedFormattedAddress);
      setAddressData(parsedAddressData);
      fetchNearbyStores(parsedAddressData); // Assume que o backend consegue lidar com o objeto de endereço
    } else {
      obterLocalizacaoEBuscarDados();
    }
  }, []);

  const obterLocalizacaoEBuscarDados = () => {
    setIsLoading(true);
    // Limpa mensagens de erro de validação e estado de edição se houver
    setValidationErrors({});
    setIsEditingLocation(false);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setStatusMessage("Localização obtida. Buscando...");
          
          await fetchNearbyStores({ lat: latitude, lng: longitude });
          
          // Salva no Local Storage
          const displayAddress = "São Paulo, SP (Obtido via GPS)";
          setStatusMessage(displayAddress);
          localStorage.setItem(LOCAL_STORAGE_KEYS.FORMATTED_ADDRESS, displayAddress);
          localStorage.setItem(LOCAL_STORAGE_KEYS.COORDS, JSON.stringify({ lat: latitude, lng: longitude }));
          localStorage.removeItem(LOCAL_STORAGE_KEYS.ADDRESS_DATA); // Remove dados de endereço manual se houver
        },
        (error) => {
          console.error("Geolocalização negada ou falhou:", error);
          // Permissão negada ou erro -> Mostra texto sugestivo para digitar endereço
          setStatusMessage("Não foi possível obter sua localização. Clique para informar endereço.");
          setIsLoading(false);
        }
      );
    } else {
      setStatusMessage("GPS não suportado. Clique para informar endereço.");
      setIsLoading(false);
    }
  };

  // 5. Função para limpar a localização salva e reiniciar busca via GPS
  const handleClearLocation = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.FORMATTED_ADDRESS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ADDRESS_DATA);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.COORDS);
    setAddressData({ logradouro: '', numero: '', bairro: '', cidadeUf: '' }); // Limpa campos de endereço
    setStores([]); // Limpa a lista de lojas
    obterLocalizacaoEBuscarDados(); // Reinicia a busca
  };

  // Função para lidar com a pesquisa principal e redirecionar
  const handleMainSearch = (e) => {
    e.preventDefault();
    if (!searchForm.data.query.trim()) return;

    // Redireciona para a rota 'cliente.explorar' passando o termo pesquisado como query parameter
    // URL final ficará algo como: /explorar?query=termo-pesquisado
    searchForm.get(route('cliente.explorar'));
  };

  // Atualiza o estado do endereço ao digitar nos campos
  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    // Sanitização básica na entrada: remove caracteres especiais desnecessários de acordo com o campo
    let sanitizedValue = value;
    if (name === 'numero') {
      // Para o número, permite apenas números, espaço, barra, e as letras "s", "n", "N", "º"
      sanitizedValue = value.replace(/[^0-9\s/s/nNºs/n]/g, '');
    }
    
    // Limita o tamanho dos campos para segurança
    const maxLengths = { logradouro: 255, numero: 20, bairro: 100, cidadeUf: 100 };
    if (sanitizedValue.length > (maxLengths[name] || 255)) return;

    setAddressData(prevState => ({
      ...prevState,
      [name]: sanitizedValue
    }));
    
    // Limpa erro de validação do campo ao digitar
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // 6. Função para validar o endereço antes de salvar
  const validateAddress = () => {
    const errors = {};
    if (!addressData.logradouro.trim()) {
      errors.logradouro = "Por favor, preencha a Rua/Avenida.";
    } else if (addressData.logradouro.length < 5) {
      errors.logradouro = "O endereço deve ter pelo menos 5 caracteres.";
    }

    if (!addressData.numero.trim()) {
      errors.numero = "Por favor, preencha o Número.";
    } else {
      const numeroRegex = /^[0-9\s/s/nNºs/n]+$/;
      if (!numeroRegex.test(addressData.numero)) {
        errors.numero = "Formato de número inválido.";
      }
    }

    // Outras validações opcionais para bairro e cidadeUf
    // Ex: cidadeUf deve conter a barra e ter um tamanho mínimo

    return errors;
  };

  // Função disparada ao submeter o formulário de endereço manual (POST)
  const handleSaveLocation = async (e) => {
    e.preventDefault();
    setValidationErrors({}); // Limpa erros anteriores
    
    // Validação avançada antes de salvar
    const errors = validateAddress();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSavingLocation(true);
    
    // Sanitização e formatação dos dados antes de enviar
    const sanitizedAddressData = {
      logradouro: addressData.logradouro.trim(),
      numero: addressData.numero.trim(),
      bairro: addressData.bairro.trim(),
      cidadeUf: addressData.cidadeUf.trim()
    };
    
    try {
      // 🚨 IMPORTANTE: Verifique se essa rota POST está criada no seu arquivo api.php 🚨
      // Ela deve receber os dados do endereço e atualizar o usuário autenticado.
      await axios.post('/api/user/update-address', sanitizedAddressData);
      
      // Busca lojas próximas baseada no novo endereço
      await fetchNearbyStores(sanitizedAddressData);
      
      // Monta uma string amigável para exibir na UI
      const displayAddress = `${sanitizedAddressData.logradouro}, ${sanitizedAddressData.numero}${sanitizedAddressData.bairro ? ` - ${sanitizedAddressData.bairro}` : ''}`;
      
      // Sucesso! Atualiza a UI e fecha o formulário
      setStatusMessage(displayAddress);
      setIsEditingLocation(false);
      // Limpa os campos após salvar
      setAddressData({ logradouro: '', numero: '', bairro: '', cidadeUf: '' });
      
      // 7. Salva no Local Storage para lembrar o usuário
      localStorage.setItem(LOCAL_STORAGE_KEYS.FORMATTED_ADDRESS, displayAddress);
      localStorage.setItem(LOCAL_STORAGE_KEYS.ADDRESS_DATA, JSON.stringify(sanitizedAddressData));
      localStorage.removeItem(LOCAL_STORAGE_KEYS.COORDS); // Remove coordenadas de GPS se houver
    } catch (error) {
      console.error("Erro ao salvar endereço:", error);
      // Tratamento de erro granular
      if (error.response && error.response.status === 422) {
        setValidationErrors(error.response.data.errors);
      } else {
        alert("Não foi possível salvar o endereço. Tente novamente mais tarde.");
      }
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Função para rolar o Carrossel
  const handleScrollCarousel = (direction) => {
    if (categoryCarouselRef.current) {
      const scrollAmount = 300; // Quantidade de pixels a rolar
      categoryCarouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth' 
      });
    }
  };

  return (
    <AuthenticatedLayout>
      <GlobalStyle />
      <MainContainer>
        
        {/* HERO SECTION */}
        <HeroSection>
          <HeroText>
            <h1>Encontre atendimento <br/><span>sem filas e sem complicação</span></h1>
            <p>Entre na fila virtual ou agende seu horário com praticidade e acompanhe tudo em tempo real.</p>
            
            {/* Barra de pesquisa agora é um formulário Inertia para redirecionamento */}
            <SearchBarForm onSubmit={handleMainSearch}>
              <SearchInput>
                <FiSearch />
                <input 
                  type="text" 
                  placeholder="Buscar serviços (ex: barbeiro, dentista...) ou estabelecimentos" 
                  value={searchForm.data.query}
                  onChange={(e) => searchForm.setData('query', e.target.value)}
                />
              </SearchInput>
              <SearchButton type="submit">
                <FiMap />
                Buscar
              </SearchButton>
            </SearchBarForm>
            
            <SearchSuggestions>
              <span>Mais buscados:</span>
              <a href="#">Barbeiro</a>
              <a href="#">Dentista</a>
              <a href="#">Salão de Beleza</a>
              <a href="#">Mecânico</a>
            </SearchSuggestions>
          </HeroText>

          <HeroImageArea>
            <img 
              src="/images/Home.png"
              alt="Propaganda Waitless" 
            />
            <FloatingWidget style={{ top: '30px', right: '-20px' }}>
              <FiClock className="icon" style={{color: colors.primary}} />
              <div className="text">
                <strong>12 min</strong> <br /> TEMPO MÉDIO DE ESPERA
              </div>
            </FloatingWidget>
            <FloatingWidget style={{ bottom: '30px', left: '-20px' }}>
              <div className="icon" style={{color: '#10B981'}}>📈</div>
              <div className="text">
                <strong>+2.500</strong> <br /> Profissionais ativos
              </div>
            </FloatingWidget>
          </HeroImageArea>
        </HeroSection>

        {/* CATEGORIAS POPULARES (COM CARROSSEL) */}
        <CategorySection>
          <SectionHeader>
            <h2>Categorias populares</h2>
            <div className="header-actions">
              <a href="#">Ver todas <FiChevronRight /></a>
              {/* Botões do Carrossel */}
              <CarouselNav>
                <button onClick={() => handleScrollCarousel('left')} title="Anterior">
                  <FiChevronLeft />
                </button>
                <button onClick={() => handleScrollCarousel('right')} title="Próximo">
                  <FiChevronRight />
                </button>
              </CarouselNav>
            </div>
          </SectionHeader>

          <CategoryList ref={categoryCarouselRef}>
            {staticCategories.map((cat, index) => (
              <CategoryItem key={index}>
                <div className="icon-holder">{cat.icon}</div>
                <p>{cat.name}</p>
              </CategoryItem>
            ))}
          </CategoryList>
        </CategorySection>

        {/* ESTABELECIMENTOS PRÓXIMOS */}
        <EstablishmentsSection>
          <SectionHeader>
            <h2>Estabelecimentos próximos</h2>
            
            {/* TEXTO CLICÁVEL OU NOVO BLOCO DE ENDEREÇO ELABORADO */}
            {!isEditingLocation && (
              <LocationSelector onClick={() => setIsEditingLocation(true)} title="Clique para alterar seu endereço">
                <FiMapPin />
                <span className="address-text">{statusMessage}</span>
                {/* Botão para limpar localização salva e buscar via GPS */}
                <button className="clear-location" onClick={(e) => { e.stopPropagation(); handleClearLocation(); }} title="Limpar localização salva e buscar via GPS">
                  <FiTrash2 />
                </button>
              </LocationSelector>
            )}

          </SectionHeader>

          {/* --- NOVO BLOCO DE ENDEREÇO ELABORADO --- */}
          {isEditingLocation && (
            <LocationBlockContainer>
              <LocationHeader>
                <FiMapPin />
                Preencha seu endereço completo
              </LocationHeader>
              
              <LocationFormFields onSubmit={handleSaveLocation}>
                <label className="full-width">
                  Rua/Avenida *
                  <input 
                    type="text" 
                    name="logradouro" 
                    placeholder="Nome da rua ou avenida"
                    value={addressData.logradouro}
                    onChange={handleAddressInputChange}
                    required
                    autoFocus
                    className={validationErrors.logradouro ? 'error' : ''}
                  />
                  {validationErrors.logradouro && <div className="error-message">{validationErrors.logradouro}</div>}
                </label>
                
                <label>
                  Número *
                  <input 
                    type="text" 
                    name="numero" 
                    placeholder="Ex: 123, S/N"
                    value={addressData.numero}
                    onChange={handleAddressInputChange}
                    required
                    className={validationErrors.numero ? 'error' : ''}
                  />
                  {validationErrors.numero && <div className="error-message">{validationErrors.numero}</div>}
                </label>
                
                <label>
                  Bairro
                  <input 
                    type="text" 
                    name="bairro" 
                    placeholder="Nome do bairro"
                    value={addressData.bairro}
                    onChange={handleAddressInputChange}
                    className={validationErrors.bairro ? 'error' : ''}
                  />
                  {validationErrors.bairro && <div className="error-message">{validationErrors.bairro}</div>}
                </label>
                
                <label className="full-width">
                  Cidade/UF
                  <input 
                    type="text" 
                    name="cidadeUf" 
                    placeholder="Ex: São Paulo / SP"
                    value={addressData.cidadeUf}
                    onChange={handleAddressInputChange}
                    className={validationErrors.cidadeUf ? 'error' : ''}
                  />
                  {validationErrors.cidadeUf && <div className="error-message">{validationErrors.cidadeUf}</div>}
                </label>

                <LocationActions className="full-width">
                  <button type="button" className="btn-cancel" onClick={() => setIsEditingLocation(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="btn-save" disabled={isSavingLocation}>
                    {isSavingLocation ? (
                      <><FiLoader className="spinner" style={{marginRight: '0.5rem'}} /> Salvando...</>
                    ) : (
                      <><FiCornerDownLeft style={{marginRight: '0.5rem'}} /> Salvar Endereço</>
                    )}
                  </button>
                </LocationActions>
              </LocationFormFields>
            </LocationBlockContainer>
          )}
          
          <StoreList>
            {isLoading ? (
              <EmptyStateContainer>
                <FiLoader className="spinner" />
                <h3>Buscando estabelecimentos...</h3>
                <p>Encontrando os melhores serviços perto de você.</p>
              </EmptyStateContainer>
            ) : stores.length > 0 ? (
              stores.map(store => (
                <StoreCard key={store.id}>
                  <StoreCardImage>
                    <img src={store.foto_perfil || 'https://via.placeholder.com/400x200?text=Sem+Imagem'} alt={store.nome} />
                    <CategoryBadge>{getCategoryIcon(store.tipo)}</CategoryBadge>
                    <CartButton><FiShoppingCart /></CartButton>
                  </StoreCardImage>
                  <StoreInfo>
                    <h3>{store.nome}</h3>
                    <div className="meta">
                      <div className="rating">
                        <FiStar style={{fill: colors.accent}} /> {parseFloat(store.avaliacao_media || 5.0).toFixed(1)}
                      </div>
                      <div className="distance">
                        <FiMapPin /> {parseFloat(store.distance).toFixed(1)} km
                      </div>
                    </div>
                    <QueueBadge>
                      <FiUsers /> Fila: {store.fila_atual || 0} pessoas
                    </QueueBadge>
                    <FullButton>Entrar na fila</FullButton>
                  </StoreInfo>
                </StoreCard>
              ))
            ) : (
              <EmptyStateContainer>
                <FiSearch />
                <h3>Nenhum dado encontrado</h3>
                <p>Busque serviços ou altere seu endereço para buscar novamente.</p>
              </EmptyStateContainer>
            )}
          </StoreList>
        </EstablishmentsSection>

        {/* BOTTOM FEATURES & PREMIUM */}
        <FeaturesGrid>
          {staticFeatures.map((feat, index) => (
            <FeatureCard key={index}>
              <div className="icon-holder">{feat.icon}</div>
              <h4>{feat.title}</h4>
              <p>{feat.desc}</p>
            </FeatureCard>
          ))}
          
          <PremiumCard>
            <div>
              <h3>Waitless Premium</h3>
              <p>Mais benefícios, prioridade na fila e muito mais!</p>
            </div>
            <button>Conhecer planos</button>
          </PremiumCard>
        </FeaturesGrid>

      </MainContainer>
    </AuthenticatedLayout>
  );
}
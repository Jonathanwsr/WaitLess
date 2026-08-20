import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import styled, { createGlobalStyle, css } from 'styled-components';
import { useForm, router } from '@inertiajs/react';

import { IoCutOutline } from 'react-icons/io5';
import { 
  FiSearch, FiShoppingCart, FiMapPin, FiClock, 
  FiStar, FiUsers, FiBell, FiThumbsUp, FiTool, FiLoader,
  FiChevronLeft, FiChevronRight, FiMap, FiCornerDownLeft,
  FiTrash2 
} from 'react-icons/fi';
import { 
  FaSprayCan, FaTooth, FaBriefcaseMedical, 
  FaBalanceScale, FaCalculator, FaDumbbell, FaPaw,
  FaCar, FaHome 
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
  error: '#DC2626', 
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

const HeroBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background-color: ${colors.primaryLight};
  color: ${colors.primary};
  padding: 0.4rem 1rem;
  border-radius: 50px;
  font-size: 0.85rem;
  font-weight: 700;
  margin-bottom: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const HeroBenefits = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;

  li {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1rem;
    color: ${colors.secondary};
    font-weight: 500;
    
    ${media.tablet`
      justify-content: center;
    `}

    svg {
      color: #10B981;
      font-size: 1.2rem;
    }
  }
`;

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
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
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

// --- SEÇÃO: CARROSEL DE SERVIÇOS COM FOTOS ---
const ServicesSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-bottom: 2rem;
`;

const ServicesCarousel = styled.div`
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  padding-bottom: 1rem;
  scroll-behavior: smooth; 
  scrollbar-width: none; 
  &::-webkit-scrollbar { display: none; }
`;

const ServiceCard = styled.div`
  flex: 0 0 320px;
  background-color: ${colors.white};
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid ${colors.border};
  display: flex;
  flex-direction: column;
  cursor: pointer; 
  transition: all 0.2s ease-in-out;

  &:hover {
    border-color: #2563EB;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-3px);
  }

  ${media.tablet`
    flex: 0 0 280px;
  `}
`;

const ServiceImage = styled.div`
  height: 180px;
  background-color: ${colors.lightGray};
  position: relative;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const ServiceIconBadge = styled.div`
  position: absolute;
  bottom: -16px;
  left: 1.5rem;
  width: 32px;
  height: 32px;
  background-color: #2563EB; 
  color: ${colors.white};
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
`;

const ServiceContent = styled.div`
  padding: 2.5rem 1.5rem 1.5rem;
  
  h3 {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
    color: ${colors.secondary};
  }
  
  p {
    font-size: 0.85rem;
    color: ${colors.gray};
    margin: 0;
    line-height: 1.5;
  }
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
  gap: 0.6rem; 
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
  grid-template-columns: 2fr 1fr;
  gap: 1rem;

  ${media.tablet`grid-template-columns: 1fr;`}

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

// --- ESTILOS DOS CARDS DE ESTABELECIMENTOS ---
const StoresGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 1rem;
`;

const StoreCard = styled.div`
  background-color: ${colors.white};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: ${colors.primary};
    box-shadow: 0 4px 12px rgba(224, 79, 54, 0.1);
    transform: translateY(-3px);
  }
`;

const StoreImage = styled.div`
  height: 160px;
  background-color: ${colors.lightGray};
  width: 100%;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const StoreInfo = styled.div`
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;

  .title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    
    h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: ${colors.secondary};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rating {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.85rem;
      font-weight: 600;
      color: ${colors.secondary};
      background-color: #FEF3C7;
      padding: 0.2rem 0.5rem;
      border-radius: 6px;
      
      svg { color: #F59E0B; }
    }
  }

  /* NOVA CLASSE DE ENDEREÇO */
  .address {
    font-size: 0.8rem;
    color: ${colors.gray};
    display: flex;
    align-items: center;
    gap: 0.4rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    svg { flex-shrink: 0; color: #9CA3AF; }
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
    color: ${colors.gray};
    margin-top: 0.3rem;

    .category {
      background-color: ${colors.lightGray};
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-weight: 500;
    }

    .distance {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      color: ${colors.primary};
      font-weight: 600;
    }
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  background-color: ${colors.white};
  border: 1px dashed ${colors.border};
  border-radius: 12px;
  color: ${colors.gray};

  svg {
    font-size: 2.5rem;
    color: #9CA3AF;
    margin-bottom: 1rem;
  }
  
  h4 {
    margin: 0 0 0.5rem 0;
    color: ${colors.secondary};
    font-size: 1.1rem;
  }
`;

const LoadingState = styled(EmptyState)`
  svg {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    100% { transform: rotate(360deg); }
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

// --- DADOS: CARDS DE SERVIÇOS E ALUGUÉIS ---
const serviceCardsData = [
  { id: 1, title: 'Saúde & Clínicas', desc: 'Agende consultas médicas, exames e procedimentos.', icon: <FaBriefcaseMedical />, category: 'saude', image: '/images/saude.png' },
  { id: 2, title: 'Beleza & Estética', desc: 'Marque horários em salões de beleza, barbearias e clínicas.', icon: <IoCutOutline />, category: 'beleza', image: '/images/Beleza.png' },
  { id: 3, title: 'Hospedagem', desc: 'Reserve quartos em hotéis, pousadas e acomodações.', icon: <FiMapPin />, category: 'hospedagem', image: '/images/Hospedagem.png' },
  { id: 4, title: 'Turismo', desc: 'Planeje passeios, tours e experiências turísticas.', icon: <FiMap />, category: 'turismo', image: '/images/Turismo (2).png' },
  { id: 5, title: 'Automotivo', desc: 'Agende manutenções, revisões e serviços automotivos.', icon: <FiTool />, category: 'automotivo', image: '/images/Automotivo (2).png' },
  { id: 6, title: 'Montagem de Móveis', desc: 'Agende profissionais para montagem e instalação.', icon: <FiTool />, category: 'montagem', image: '/images/Montagem (2).png' },
  { id: 7, title: 'Jardinagem & Paisagismo', desc: 'Reserve serviços de jardinagem, paisagismo e manutenção.', icon: <FiStar />, category: 'jardinagem', image: '/images/Jardinagem (2).png' },
  { id: 8, title: 'Pedreiros & Construção', desc: 'Contrate pedreiros e profissionais de construção.', icon: <FiUsers />, category: 'construcao', image: '/images/Predeiro (2).png' },
  { id: 9, title: 'Limpeza de piscinas', desc: 'Especialistas em limpeza de piscinas.', icon: <FiStar />, category: 'piscinas', image: '/images/Piscinas.png' },
  { id: 10, title: 'Aluguel de Carros', desc: 'Encontre o veículo ideal para sua viagem ou dia a dia.', icon: <FaCar />, category: 'aluguel-carros', image: '/images/carro.jpg' },
  { id: 11, title: 'Aluguel de Casas', desc: 'Descubra casas, apartamentos e chácaras para aluguel.', icon: <FaHome />, category: 'aluguel-casas', image: '/images/casas.jpg' },
  { id: 12, title: 'Locação de Equipamentos', desc: 'Alugue ferramentas e equipamentos rapidamente.', icon: <FiTool />, category: 'aluguel-equipamentos', image: '/images/Montagem (2).png' },
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
  const [statusMessage, setStatusMessage] = useState('Autorize sua localização no navegador para buscar os melhores locais...'); 
  
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [addressData, setAddressData] = useState({
    logradouro: '',
    numero: '',
    bairro: '',
    cidadeUf: ''
  });
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [validationErrors, setValidationErrors] = useState({}); 

  const categoryCarouselRef = useRef(null);
  const servicesCarouselRef = useRef(null);

  const searchForm = useForm({
    query: ''
  });

  const fetchNearbyStores = async (params) => {
    setIsLoading(true);
    try {
      const response = await axios.get('/api/nearby', { params: { ...params, radius: 15 } });
      setStores(response.data);
    } catch (error) {
      console.error("Erro ao buscar estabelecimentos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
      fetchNearbyStores(parsedAddressData); 
    } else {
      obterLocalizacaoEBuscarDados();
    }
  }, []);

  useEffect(() => {
    const autoScrollCategories = setInterval(() => {
      if (categoryCarouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = categoryCarouselRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          categoryCarouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          categoryCarouselRef.current.scrollBy({ left: 150, behavior: 'smooth' });
        }
      }
    }, 3000);

    const autoScrollServices = setInterval(() => {
      if (servicesCarouselRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = servicesCarouselRef.current;
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          servicesCarouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
          servicesCarouselRef.current.scrollBy({ left: 340, behavior: 'smooth' });
        }
      }
    }, 4000); 

    return () => {
      clearInterval(autoScrollCategories);
      clearInterval(autoScrollServices);
    };
  }, []);

  const obterLocalizacaoEBuscarDados = () => {
    setIsLoading(true);
    setValidationErrors({});
    setIsEditingLocation(false);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setStatusMessage("Localização obtida. Buscando...");
          
          await fetchNearbyStores({ lat: latitude, lng: longitude });
          
          const displayAddress = "Localização obtida via GPS";
          setStatusMessage(displayAddress);
          localStorage.setItem(LOCAL_STORAGE_KEYS.FORMATTED_ADDRESS, displayAddress);
          localStorage.setItem(LOCAL_STORAGE_KEYS.COORDS, JSON.stringify({ lat: latitude, lng: longitude }));
          localStorage.removeItem(LOCAL_STORAGE_KEYS.ADDRESS_DATA); 
        },
        (error) => {
          console.error("Geolocalização negada ou falhou:", error);
          setStatusMessage("Não foi possível obter sua localização. Clique aqui para informar seu endereço.");
          setIsLoading(false);
        }
      );
    } else {
      setStatusMessage("GPS não suportado. Clique aqui para informar seu endereço.");
      setIsLoading(false);
    }
  };

  const handleClearLocation = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.FORMATTED_ADDRESS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.ADDRESS_DATA);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.COORDS);
    setAddressData({ logradouro: '', numero: '', bairro: '', cidadeUf: '' }); 
    setStores([]); 
    setStatusMessage('Autorize sua localização no navegador...');
    obterLocalizacaoEBuscarDados(); 
  };

  const handleMainSearch = (e) => {
    e.preventDefault();
    if (!searchForm.data.query.trim()) return;
    searchForm.get(route('cliente.explorar'));
  };

  const handleAddressInputChange = (e) => {
    const { name, value } = e.target;
    let sanitizedValue = value;
    if (name === 'numero') {
      sanitizedValue = value.replace(/[^0-9\s/s/nNºs/n]/g, '');
    }
    
    const maxLengths = { logradouro: 255, numero: 20, bairro: 100, cidadeUf: 100 };
    if (sanitizedValue.length > (maxLengths[name] || 255)) return;

    setAddressData(prevState => ({
      ...prevState,
      [name]: sanitizedValue
    }));
    
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: null }));
    }
  };

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

    return errors;
  };

  const handleSaveLocation = async (e) => {
    e.preventDefault();
    setValidationErrors({}); 
    
    const errors = validateAddress();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSavingLocation(true);
    
    const sanitizedAddressData = {
      logradouro: addressData.logradouro.trim(),
      numero: addressData.numero.trim(),
      bairro: addressData.bairro.trim(),
      cidadeUf: addressData.cidadeUf.trim()
    };
    
    try {
      await axios.post('/api/user/update-address', sanitizedAddressData);
      await fetchNearbyStores(sanitizedAddressData);
      
      const displayAddress = `${sanitizedAddressData.logradouro}, ${sanitizedAddressData.numero}${sanitizedAddressData.bairro ? ` - ${sanitizedAddressData.bairro}` : ''}`;
      
      setStatusMessage(displayAddress);
      setIsEditingLocation(false);
      setAddressData({ logradouro: '', numero: '', bairro: '', cidadeUf: '' });
      
      localStorage.setItem(LOCAL_STORAGE_KEYS.FORMATTED_ADDRESS, displayAddress);
      localStorage.setItem(LOCAL_STORAGE_KEYS.ADDRESS_DATA, JSON.stringify(sanitizedAddressData));
      localStorage.removeItem(LOCAL_STORAGE_KEYS.COORDS); 
    } catch (error) {
      console.error("Erro ao salvar endereço:", error);
      if (error.response && error.response.status === 422) {
        setValidationErrors(error.response.data.errors);
      } else {
        alert("Não foi possível salvar o endereço. Tente novamente mais tarde.");
      }
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleScrollCarousel = (direction) => {
    if (categoryCarouselRef.current) {
      const scrollAmount = 300; 
      categoryCarouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth' 
      });
    }
  };

  const handleScrollServices = (direction) => {
    if (servicesCarouselRef.current) {
      const scrollAmount = 340;
      servicesCarouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const handleCardClick = (category) => {
    searchForm.setData('query', category);
    searchForm.get(route('cliente.explorar'));
  };

  return (
    <AuthenticatedLayout>
      <GlobalStyle />
      <MainContainer>
        
        {/* HERO SECTION */}
        <HeroSection>
          <HeroText>
            <HeroBadge>✨ O seu tempo é precioso</HeroBadge>
            <h1>Encontre o que procura <br/><span>mais rápido e fácil</span></h1>
            <p>
              Descubra os melhores estabelecimentos e serviços ao seu redor. Agende 
              seu horário com praticidade, encontre o que precisa em segundos e 
              aproveite mais o seu dia de onde estiver.
            </p>
            
            <HeroBenefits>
              <li><FiMapPin /> Descubra os melhores profissionais perto de você</li>
              <li><FiClock /> Otimize seu dia e agende com rapidez</li>
              <li><FiBell /> Receba alertas sobre suas reservas e serviços</li>
            </HeroBenefits>
            
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
              <a href="#" onClick={(e) => { e.preventDefault(); handleCardClick('barbearia'); }}>Barbeiro</a>
              <a href="#" onClick={(e) => { e.preventDefault(); handleCardClick('dentista'); }}>Dentista</a>
              <a href="#" onClick={(e) => { e.preventDefault(); handleCardClick('salao'); }}>Salão de Beleza</a>
              <a href="#" onClick={(e) => { e.preventDefault(); handleCardClick('mecanica'); }}>Mecânico</a>
              <a href="#" onClick={(e) => { e.preventDefault(); handleCardClick('aluguel-carros'); }}>Aluguel de Carros</a>
            </SearchSuggestions>
          </HeroText>

          <HeroImageArea>
            <img 
              src="/images/Home.png"
              alt="Propaganda Waitless" 
            />
            <FloatingWidget style={{ top: '30px', right: '-20px' }}>
              <FiMapPin className="icon" style={{color: colors.primary}} />
              <div className="text">
                <strong>Perto de você</strong> <br /> BUSCA INTELIGENTE
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

        {/* CATEGORIAS POPULARES */}
        <CategorySection>
          <SectionHeader>
            <h2>Categorias populares</h2>
            <div className="header-actions">
              <a href="#">Ver todas <FiChevronRight /></a>
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

        {/* --- SEÇÃO: CARROSSEL DE SERVIÇOS E LOCAÇÕES --- */}
        <ServicesSection>
          <SectionHeader>
            <h2>Serviços e Locações</h2>
            <div className="header-actions">
              <a href="#">Ver tudo <FiChevronRight /></a>
              <CarouselNav>
                <button onClick={() => handleScrollServices('left')} title="Anterior">
                  <FiChevronLeft />
                </button>
                <button onClick={() => handleScrollServices('right')} title="Próximo">
                  <FiChevronRight />
                </button>
              </CarouselNav>
            </div>
          </SectionHeader>

          <ServicesCarousel ref={servicesCarouselRef}>
            {serviceCardsData.map((card) => (
              <ServiceCard key={card.id} onClick={() => handleCardClick(card.category)}>
                <ServiceImage>
                  <img src={card.image} alt={card.title} />
                  <ServiceIconBadge>
                    {card.icon}
                  </ServiceIconBadge>
                </ServiceImage>
                
                <ServiceContent>
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                </ServiceContent>
              </ServiceCard>
            ))}
          </ServicesCarousel>
        </ServicesSection>

        {/* ESTABELECIMENTOS PRÓXIMOS */}
        <EstablishmentsSection>
          <SectionHeader>
            <h2>Estabelecimentos próximos</h2>
            
            {!isEditingLocation && (
              <LocationSelector onClick={() => setIsEditingLocation(true)} title="Clique para alterar seu endereço">
                <FiMapPin />
                <span className="address-text">{statusMessage}</span>
                <button className="clear-location" onClick={(e) => { e.stopPropagation(); handleClearLocation(); }} title="Limpar localização salva e buscar via GPS">
                  <FiTrash2 />
                </button>
              </LocationSelector>
            )}
          </SectionHeader>

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
                
                <div style={{gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem'}}>
                    <SearchButton type="submit" disabled={isSavingLocation}>
                        {isSavingLocation ? 'Buscando...' : 'Salvar e Buscar'}
                    </SearchButton>
                </div>
              </LocationFormFields>
            </LocationBlockContainer>
          )}

          {!isEditingLocation && (
            <>
              {isLoading ? (
                <LoadingState>
                  <FiLoader />
                  <h4>Buscando as melhores opções...</h4>
                  <p>Calculando distâncias na sua região.</p>
                </LoadingState>
              ) : stores.length > 0 ? (
                <StoresGrid>
                  {stores.map((store) => (
                    <StoreCard 
                       key={store.id} 
                       onClick={() => router.visit(`/estabelecimentos/${store.id}/loja`)}
                    >
                      <StoreImage>
                        <img 
                          src={store.foto_perfil ? `/storage/${store.foto_perfil}` : '/images/default-store.png'} 
                          alt={store.nome} 
                          onError={(e) => {e.target.src = '/images/default-store.png'}}
                        />
                      </StoreImage>
                      
                      <StoreInfo>
                        <div className="title-row">
                          <h3>{store.nome}</h3>
                          <span className="rating">
                            <FiStar fill="#FBBF24" color="#FBBF24"/> 
                            {store.avaliacao_media > 0 ? store.avaliacao_media : 'Novo'}
                          </span>
                        </div>
                        
                        <div 
                          className="address" 
                          title={`${store.rua || ''}, ${store.numero || 'S/N'} ${store.complemento ? '('+store.complemento+')' : ''} - ${store.bairro || ''} | CEP: ${store.cep || ''}`}
                        >
                          <FiMapPin /> 
                          {store.rua 
                            ? `${store.rua}, ${store.numero || 'S/N'} ${store.complemento ? '- ' + store.complemento : ''}` 
                            : 'Endereço não informado'
                          }
                        </div>
                        
                        <div className="meta-row">
                          <span className="category">{store.ramo_atuacao || 'Serviços'}</span>
                          <span className="distance">
                            {parseFloat(store.distancia).toFixed(1)} km
                          </span>
                        </div>
                      </StoreInfo>
                    </StoreCard>
                  ))}
                </StoresGrid>
              ) : (
                <EmptyState>
                  <FiMap />
                  <h4>Poxa, não encontramos nada tão perto.</h4>
                  <p>Não há estabelecimentos cadastrados num raio de 15km da sua localização atual.</p>
                </EmptyState>
              )}
            </>
          )}
        </EstablishmentsSection>

      </MainContainer>
    </AuthenticatedLayout>
  );
}
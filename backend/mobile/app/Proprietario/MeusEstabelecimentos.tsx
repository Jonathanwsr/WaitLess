import React, { useState } from 'react';
import { 
    View, Text, TextInput, TouchableOpacity, FlatList, 
    Modal, StyleSheet, SafeAreaView, Image, ScrollView 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// 1. Criamos as tipagens para o TypeScript parar de dar erro de "any"
interface Estabelecimento {
    id: string | number;
    nome?: string;
    rua?: string;
    numero?: string;
    ativo?: boolean;
    foto_perfil?: string;
    faturamento_hoje?: string | number;
    clientes_aguardando?: number;
    aguardando?: number;
    funcionarios_ativos?: number;
}

interface Metricas {
    ativos: number;
    faturamento: string;
    crescimento_faturamento: string;
    aguardando: number;
    funcionarios_ativos: number;
}

interface MeusEstabelecimentosProps {
    route?: {
        params?: {
            estabelecimentos?: Estabelecimento[];
            metricas?: Metricas | null;
        }
    };
}

// 2. Aplicamos a tipagem no componente principal
export default function MeusEstabelecimentos({ route }: MeusEstabelecimentosProps) {
    const navigation = useNavigation<any>(); // <any> resolve erros no navigation.navigate
    
    const { estabelecimentos = [], metricas = null } = route?.params || {};

    const [busca, setBusca] = useState('');
    const [statusAtivo, setStatusAtivo] = useState('Todos');
    
    // 3. Avisamos que a lojaSelecionada é do tipo Estabelecimento ou nula
    const [lojaSelecionada, setLojaSelecionada] = useState<Estabelecimento | null>(null);
    const [modalResumoAberto, setModalResumoAberto] = useState(false);
    const [modalOpcoesAberto, setModalOpcoesAberto] = useState(false);

    // 4. Tipamos a 'loja' dentro do map/filter
    const lojasFiltradas = estabelecimentos.filter((loja: Estabelecimento) => {
        const termo = busca.toLowerCase();
        const nomeMatch = loja?.nome ? loja.nome.toLowerCase().includes(termo) : false;
        const enderecoMatch = loja?.rua ? loja.rua.toLowerCase().includes(termo) : false;
        const passouNaBusca = nomeMatch || enderecoMatch;

        let passouNoStatus = true;
        const statusLoja = loja?.ativo !== false ? 'Ativo' : 'Inativo'; 
        
        if (statusAtivo === 'Ativos') passouNoStatus = statusLoja === 'Ativo';
        if (statusAtivo === 'Inativos') passouNoStatus = statusLoja === 'Inativo';

        return passouNaBusca && passouNoStatus;
    });

    const stats = metricas || {
        ativos: 0, faturamento: '0,00', crescimento_faturamento: '0%', aguardando: 0, funcionarios_ativos: 0
    };

    const isStateVazio = estabelecimentos.length === 0;

    // 5. Tipamos o 'item' do FlatList
    const renderLoja = ({ item }: { item: Estabelecimento }) => (
        <View style={styles.cardLoja}>
            <View style={styles.cardHeader}>
                <View style={styles.lojaInfo}>
                    {item.foto_perfil ? (
                        <Image source={{ uri: item.foto_perfil }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>{item.nome ? item.nome.charAt(0).toUpperCase() : 'E'}</Text>
                        </View>
                    )}
                    <View style={styles.textInfo}>
                        <Text style={styles.lojaNome}>{item.nome}</Text>
                        <Text style={styles.lojaEndereco}>{item.rua}, {item.numero || 'S/N'}</Text>
                    </View>
                </View>
                <View style={[styles.badge, item.ativo !== false ? styles.badgeAtivo : styles.badgeInativo]}>
                    <Text style={[styles.badgeText, item.ativo !== false ? styles.badgeTextAtivo : styles.badgeTextInativo]}>
                        {item.ativo !== false ? 'ATIVO' : 'INATIVO'}
                    </Text>
                </View>
            </View>

            <View style={styles.cardStats}>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Faturamento</Text>
                    <Text style={styles.statValue}>R$ {item.faturamento_hoje || '0,00'}</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Aguardando</Text>
                    <Text style={styles.statValue}>{item.clientes_aguardando || item.aguardando || 0}</Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Funcionários</Text>
                    <Text style={styles.statValue}>{item.funcionarios_ativos || 0}</Text>
                </View>
            </View>

            <View style={styles.cardActions}>
                <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => { setLojaSelecionada(item); setModalResumoAberto(true); }}
                >
                    <Feather name="eye" size={20} color="#666" />
                    <Text style={styles.actionText}>Resumo</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => { setLojaSelecionada(item); setModalOpcoesAberto(true); }}
                >
                    <Feather name="more-horizontal" size={20} color="#666" />
                    <Text style={styles.actionText}>Opções</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <FlatList
                data={lojasFiltradas}
                // 6. Tipamos o item aqui também
                keyExtractor={(item: Estabelecimento) => item.id.toString()}
                ListHeaderComponent={
                    <View style={styles.headerContainer}>
                        <Text style={styles.title}>Meus Estabelecimentos</Text>
                        <Text style={styles.subtitle}>Acompanhe o desempenho em tempo real.</Text>

                        <TouchableOpacity 
                            style={styles.btnNovo} 
                            onPress={() => navigation.navigate('CriarEstabelecimento')}
                        >
                            <Feather name="plus" size={20} color="#FFF" />
                            <Text style={styles.btnNovoText}>Novo estabelecimento</Text>
                        </TouchableOpacity>

                        {/* Métricas */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricasScroll}>
                            <View style={styles.metricaCard}>
                                <View style={[styles.iconWrap, { backgroundColor: '#FFF1EB' }]}>
                                    <Feather name="activity" size={20} color="#FF7A00" />
                                </View>
                                <Text style={styles.metricaLabel}>ATIVOS</Text>
                                <Text style={styles.metricaValor}>{stats.ativos}</Text>
                            </View>
                            <View style={styles.metricaCard}>
                                <View style={[styles.iconWrap, { backgroundColor: '#ECFDF5' }]}>
                                    <Feather name="dollar-sign" size={20} color="#10B981" />
                                </View>
                                <Text style={styles.metricaLabel}>FATURAMENTO</Text>
                                <Text style={styles.metricaValor}>R$ {stats.faturamento}</Text>
                            </View>
                            <View style={styles.metricaCard}>
                                <View style={[styles.iconWrap, { backgroundColor: '#FEF2F2' }]}>
                                    <Feather name="users" size={20} color="#EF4444" />
                                </View>
                                <Text style={styles.metricaLabel}>AGUARDANDO</Text>
                                <Text style={styles.metricaValor}>{stats.aguardando}</Text>
                            </View>
                        </ScrollView>

                        {/* Filtros */}
                        {!isStateVazio && (
                            <View style={styles.filtros}>
                                <View style={styles.inputBuscaContainer}>
                                    <Feather name="search" size={20} color="#999" />
                                    <TextInput 
                                        style={styles.inputBusca}
                                        placeholder="Buscar..."
                                        value={busca}
                                        onChangeText={setBusca}
                                    />
                                </View>
                                <TouchableOpacity 
                                    style={styles.btnFiltro}
                                    onPress={() => setStatusAtivo(statusAtivo === 'Todos' ? 'Ativos' : statusAtivo === 'Ativos' ? 'Inativos' : 'Todos')}
                                >
                                    <Text style={styles.btnFiltroText}>{statusAtivo}</Text>
                                    <Feather name="filter" size={16} color="#666" />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                }
                renderItem={renderLoja}
                ListEmptyComponent={
                    isStateVazio ? (
                        <View style={styles.emptyState}>
                            <Feather name="inbox" size={48} color="#CCC" />
                            <Text style={styles.emptyTitle}>Nenhum estabelecimento</Text>
                            <Text style={styles.emptyText}>Crie seu primeiro estabelecimento para começar.</Text>
                        </View>
                    ) : (
                        <Text style={styles.emptyText}>Nenhum resultado para "{busca}"</Text>
                    )
                }
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            />

            {/* Modal de Resumo (O Olho) */}
            <Modal visible={modalResumoAberto} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setModalResumoAberto(false)}>
                            <Feather name="x" size={24} color="#333" />
                        </TouchableOpacity>
                        
                        <Text style={styles.modalTitle}>{lojaSelecionada?.nome}</Text>
                        <Text style={styles.modalSubtitle}>Visão Geral</Text>

                        <View style={styles.modalBoxGreen}>
                            <Text style={styles.modalBoxLabelGreen}>Faturamento hoje</Text>
                            <Text style={styles.modalBoxValueGreen}>R$ {lojaSelecionada?.faturamento_hoje || '0,00'}</Text>
                        </View>

                        <View style={styles.modalBox}>
                            <Text style={styles.modalBoxLabel}>Endereço</Text>
                            <Text style={styles.modalBoxValue}>{lojaSelecionada?.rua}, {lojaSelecionada?.numero}</Text>
                        </View>

                        <View style={styles.modalBoxDark}>
                            <Text style={styles.modalBoxLabelDark}>Funcionários Ativos</Text>
                            <Text style={styles.modalBoxValueDark}>{lojaSelecionada?.funcionarios_ativos || 0}</Text>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal de Opções (Três pontinhos no mobile viram um Bottom Sheet) */}
            <Modal visible={modalOpcoesAberto} transparent animationType="slide">
                <View style={styles.bottomSheetOverlay}>
                    <TouchableOpacity style={{flex: 1}} onPress={() => setModalOpcoesAberto(false)} />
                    <View style={styles.bottomSheetContent}>
                        <Text style={styles.sheetTitle}>Opções para {lojaSelecionada?.nome}</Text>
                        
                        <TouchableOpacity 
                            style={styles.sheetItem}
                            onPress={() => {
                                setModalOpcoesAberto(false);
                                navigation.navigate('DetalhesEstabelecimento', { id: lojaSelecionada?.id });
                            }}
                        >
                            <Feather name="log-in" size={20} color="#333" />
                            <Text style={styles.sheetItemText}>Entrar no Estabelecimento</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.sheetItem}
                            onPress={() => {
                                setModalOpcoesAberto(false);
                                navigation.navigate('ConfiguracoesEstabelecimento', { id: lojaSelecionada?.id });
                            }}
                        >
                            <Feather name="settings" size={20} color="#333" />
                            <Text style={styles.sheetItemText}>Configurações</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FBF9F9' },
    headerContainer: { marginBottom: 16 },
    title: { fontSize: 28, fontWeight: 'bold', color: '#111', marginTop: 20 },
    subtitle: { fontSize: 14, color: '#666', marginTop: 4, marginBottom: 16 },
    btnNovo: { backgroundColor: '#10B981', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, marginBottom: 20 },
    btnNovoText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
    
    metricasScroll: { flexDirection: 'row', marginBottom: 20 },
    metricaCard: { backgroundColor: '#FFF', padding: 16, borderRadius: 16, width: 140, marginRight: 12, borderWidth: 1, borderColor: '#EEE' },
    iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    metricaLabel: { fontSize: 10, fontWeight: 'bold', color: '#888', marginBottom: 4 },
    metricaValor: { fontSize: 18, fontWeight: 'bold', color: '#111' },

    filtros: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    inputBuscaContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', borderRadius: 10, paddingHorizontal: 12 },
    inputBusca: { flex: 1, paddingVertical: 12, paddingLeft: 8 },
    btnFiltro: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EEE', borderRadius: 10, paddingHorizontal: 16, gap: 8 },
    btnFiltroText: { fontSize: 14, color: '#666' },

    cardLoja: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#EEE' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    lojaInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    avatar: { width: 48, height: 48, borderRadius: 12, marginRight: 12 },
    avatarPlaceholder: { width: 48, height: 48, borderRadius: 12, marginRight: 12, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#FFF', fontWeight: 'bold', fontSize: 20 },
    lojaNome: { fontSize: 16, fontWeight: 'bold', color: '#111' },
    lojaEndereco: { fontSize: 12, color: '#666', marginTop: 2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeAtivo: { backgroundColor: '#DCFCE7' },
    badgeInativo: { backgroundColor: '#FEE2E2' },
    badgeText: { fontSize: 10, fontWeight: 'bold' },
    badgeTextAtivo: { color: '#166534' },
    badgeTextInativo: { color: '#991B1B' },

    cardStats: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 16 },
    statItem: { alignItems: 'center' },
    statLabel: { fontSize: 11, color: '#666', marginBottom: 4 },
    statValue: { fontSize: 14, fontWeight: 'bold', color: '#111' },

    cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 12, justifyContent: 'space-around' },
    actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionText: { fontSize: 14, color: '#666', fontWeight: '500' },

    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 12 },
    emptyText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8 },

    /* Modais */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, width: '100%', position: 'relative' },
    closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10 },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#111' },
    modalSubtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
    
    modalBoxGreen: { backgroundColor: '#ECFDF5', padding: 16, borderRadius: 12, marginBottom: 12 },
    modalBoxLabelGreen: { color: '#065F46', fontSize: 12, fontWeight: 'bold' },
    modalBoxValueGreen: { color: '#047857', fontSize: 24, fontWeight: 'bold' },
    
    modalBox: { backgroundColor: '#F3F4F6', padding: 16, borderRadius: 12, marginBottom: 12 },
    modalBoxLabel: { color: '#6B7280', fontSize: 12, fontWeight: 'bold' },
    modalBoxValue: { color: '#111', fontSize: 16, fontWeight: 'bold' },

    modalBoxDark: { backgroundColor: '#111', padding: 16, borderRadius: 12 },
    modalBoxLabelDark: { color: '#9CA3AF', fontSize: 12, fontWeight: 'bold' },
    modalBoxValueDark: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },

    /* Bottom Sheet */
    bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    bottomSheetContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    sheetTitle: { fontSize: 16, fontWeight: 'bold', color: '#666', marginBottom: 16, textAlign: 'center' },
    sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EEE', gap: 12 },
    sheetItemText: { fontSize: 16, fontWeight: '500', color: '#333' }
});
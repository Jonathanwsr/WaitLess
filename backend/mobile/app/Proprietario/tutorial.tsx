import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { O } from '../../constants/OwnerTheme';
import { OwnerScreen, Card, Segmentado, api } from '../../components/owner/ui';
import { useCarga } from '../../components/owner/useCarga';
import { TUTORIAIS, FluxoTutorial } from '../../components/owner/tutorialData';
import { alertar } from '../../services/alertar';

interface Progresso {
  estabelecimentos: { id: number; nome: string }[];
  onboarding?: { locais: number; servicos: number; reservas: number };
}

export default function TutorialSocio() {
  const router = useRouter();
  const { fluxo } = useLocalSearchParams<{ fluxo?: string }>();
  const inicial = TUTORIAIS.some((t) => t.id === fluxo) ? (fluxo as FluxoTutorial) : 'local';
  const [ativo, setAtivo] = useState<FluxoTutorial>(inicial);
  const [aberto, setAberto] = useState(0);

  const { dados } = useCarga<Progresso>(() => api('/proprietario/dashboard'));
  const locais = dados?.estabelecimentos || [];
  const feito = {
    local: (dados?.onboarding?.locais || 0) > 0,
    servico: (dados?.onboarding?.servicos || 0) > 0,
    reserva: (dados?.onboarding?.reservas || 0) > 0,
  };

  const tutorial = TUTORIAIS.find((t) => t.id === ativo)!;

  const trocar = (id: string) => {
    setAtivo(id as FluxoTutorial);
    setAberto(0);
  };

  const abrirTela = () => {
    if (ativo === 'local') {
      router.push('/Proprietario/CriarEstabelecimento' as never);
    } else if (ativo === 'reserva') {
      router.push('/Proprietario/LocacoesAvulsas' as never);
    } else if (locais.length === 0) {
      alertar('Crie um local primeiro', 'Todo serviço pertence a um local. Vamos começar pelo tutorial de local.', [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Ver tutorial', onPress: () => trocar('local') },
      ]);
    } else if (locais.length === 1) {
      router.push(`/Proprietario/ConfiguracoesMobile?id=${locais[0].id}&nome=${encodeURIComponent(locais[0].nome)}&aba=servicos` as never);
    } else {
      router.push('/Proprietario/MeusEstabelecimentos' as never);
    }
  };

  return (
    <OwnerScreen titulo="Tutoriais">
      {/* HERO */}
      <View style={s.hero}>
        <Text style={s.heroTitulo}>Comece a vender em 3 passos</Text>
        <Text style={s.heroTexto}>Cadastre seu local, seus serviços e suas reservas. Cada tutorial leva poucos minutos.</Text>
        <View style={s.trilha}>
          {TUTORIAIS.map((t, i) => (
            <React.Fragment key={t.id}>
              <View style={[s.trilhaBolha, feito[t.id] && s.trilhaBolhaOk]}>
                {feito[t.id]
                  ? <Ionicons name="checkmark" size={16} color="#fff" />
                  : <Text style={s.trilhaNum}>{i + 1}</Text>}
              </View>
              {i < TUTORIAIS.length - 1 && <View style={[s.trilhaLinha, feito[t.id] && { backgroundColor: O.success }]} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      <Segmentado
        opcoes={TUTORIAIS.map((t) => ({ id: t.id, rotulo: t.rotulo }))}
        valor={ativo}
        aoMudar={trocar}
      />

      {/* RESUMO DO FLUXO */}
      <Card>
        <View style={s.resumoTopo}>
          <View style={s.resumoIcone}><Ionicons name={tutorial.icone as any} size={22} color={O.accent} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.resumoTitulo}>{tutorial.rotulo === 'Local' ? 'Cadastrar um local' : tutorial.rotulo === 'Serviço' ? 'Cadastrar um serviço' : 'Cadastrar uma reserva'}</Text>
            <Text style={s.resumoTempo}>
              {feito[ativo] ? 'Você já concluiu esta etapa' : `${tutorial.passos.length} passos · cerca de ${tutorial.tempo}`}
            </Text>
          </View>
          {feito[ativo] && <Ionicons name="checkmark-circle" size={24} color={O.success} />}
        </View>
        <Text style={s.resumoTexto}>{tutorial.resumo}</Text>
      </Card>

      {/* PASSOS */}
      {tutorial.passos.map((p, i) => {
        const on = aberto === i;
        return (
          <TouchableOpacity key={p.titulo} activeOpacity={0.9} onPress={() => setAberto(on ? -1 : i)} style={[s.passo, on && s.passoOn]}>
            <View style={s.passoTopo}>
              <View style={[s.passoNum, on && s.passoNumOn]}>
                <Text style={[s.passoNumTxt, on && { color: '#fff' }]}>{i + 1}</Text>
              </View>
              <Text style={s.passoTitulo}>{p.titulo}</Text>
              <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={18} color={O.faint} />
            </View>

            {on && (
              <View style={s.passoCorpo}>
                <Text style={s.passoTexto}>{p.texto}</Text>
                {!!p.campos && (
                  <View style={s.campos}>
                    {p.campos.map((c) => (
                      <View key={c} style={s.campo}><Text style={s.campoTxt}>{c}</Text></View>
                    ))}
                  </View>
                )}
                {!!p.dica && (
                  <View style={s.dica}>
                    <Ionicons name="bulb-outline" size={16} color={O.warning} />
                    <Text style={s.dicaTxt}>{p.dica}</Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity style={s.cta} onPress={abrirTela} activeOpacity={0.85}>
        <Text style={s.ctaTxt}>{feito[ativo] ? 'Cadastrar outro' : tutorial.botao}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </TouchableOpacity>

      {ativo !== 'reserva' && (
        <TouchableOpacity style={s.proximo} onPress={() => trocar(ativo === 'local' ? 'servico' : 'reserva')} activeOpacity={0.7}>
          <Text style={s.proximoTxt}>Próximo tutorial: {ativo === 'local' ? 'serviço' : 'reserva'}</Text>
        </TouchableOpacity>
      )}
    </OwnerScreen>
  );
}

const sombra = { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 } as const;

const s = StyleSheet.create({
  hero: { backgroundColor: O.accent, borderRadius: 26, padding: 22, marginBottom: 16 },
  heroTitulo: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroTexto: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19, marginTop: 6 },
  trilha: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  trilhaBolha: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  trilhaBolhaOk: { backgroundColor: O.success },
  trilhaNum: { color: '#fff', fontWeight: '800', fontSize: 13 },
  trilhaLinha: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', marginHorizontal: 6 },

  resumoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  resumoIcone: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFF1E4', alignItems: 'center', justifyContent: 'center' },
  resumoTitulo: { fontSize: 16, fontWeight: '800', color: O.ink },
  resumoTempo: { fontSize: 12, color: O.muted, marginTop: 2, fontWeight: '500' },
  resumoTexto: { fontSize: 13, color: O.muted, lineHeight: 20, marginTop: 12 },

  passo: { backgroundColor: O.card, borderRadius: 20, padding: 16, marginBottom: 10, borderWidth: 1.5, borderColor: 'transparent', ...sombra },
  passoOn: { borderColor: O.accent },
  passoTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  passoNum: { width: 30, height: 30, borderRadius: 15, backgroundColor: O.soft, alignItems: 'center', justifyContent: 'center' },
  passoNumOn: { backgroundColor: O.accent },
  passoNumTxt: { fontSize: 13, fontWeight: '800', color: O.muted },
  passoTitulo: { flex: 1, fontSize: 15, fontWeight: '700', color: O.ink },
  passoCorpo: { marginTop: 12, paddingLeft: 42 },
  passoTexto: { fontSize: 14, color: O.text, lineHeight: 21 },
  campos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  campo: { backgroundColor: O.soft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  campoTxt: { fontSize: 12, fontWeight: '600', color: O.ink },
  dica: { flexDirection: 'row', gap: 8, backgroundColor: O.warningBg, borderRadius: 14, padding: 12, marginTop: 12 },
  dicaTxt: { flex: 1, fontSize: 12, color: O.warning, lineHeight: 18, fontWeight: '500' },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 27, backgroundColor: O.accent, marginTop: 10 },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  proximo: { alignItems: 'center', paddingVertical: 16 },
  proximoTxt: { color: O.muted, fontWeight: '700', fontSize: 13 },
});

import React from 'react';

/**
 * Rede de segurança pro app inteiro: sem isto, qualquer erro não tratado
 * durante o render de QUALQUER página derruba a árvore React inteira e o
 * usuário vê a tela em branco, sem nenhuma pista do que aconteceu.
 */
export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { temErro: false };
    }

    static getDerivedStateFromError() {
        return { temErro: true };
    }

    componentDidCatch(error, info) {
        console.error('Erro não tratado na aplicação:', error, info);
    }

    render() {
        if (this.state.temErro) {
            return (
                <div style={{
                    minHeight: '100vh', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', padding: 24,
                    fontFamily: 'system-ui, sans-serif', textAlign: 'center', background: '#F9FAFB',
                }}>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
                        Ops, algo deu errado nesta tela
                    </h1>
                    <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, maxWidth: 420 }}>
                        Tente recarregar a página. Se o problema continuar, entre em contato com o suporte.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: '#FF5A00', color: '#fff', fontWeight: 700, fontSize: 14,
                            padding: '12px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
                        }}
                    >
                        Recarregar página
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

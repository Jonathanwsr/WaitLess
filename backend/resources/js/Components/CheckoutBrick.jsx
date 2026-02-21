import React, { useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import axios from 'axios';

// Adicionamos a prop 'onPaymentSuccess' para avisar o pai quando o PIN chegar
export default function CheckoutBrick({ valor, idAgendamento, onPaymentSuccess }) {
    
    useEffect(() => {
        const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY;
        if (publicKey) {
            initMercadoPago(publicKey, { locale: 'pt-BR' }); 
        } else {
            console.error("Chave pública do Mercado Pago não encontrada no .env!");
        }
    }, []);

    const initialization = {
        amount: parseFloat(valor), 
    };

    const customization = {
        paymentMethods: {
            pix: 'all',
            creditCard: 'all',
            debitCard: 'all',
        },
    };

    // ALTERADO: Usando axios para capturar o JSON do Controller
    const onSubmit = async ({ selectedPaymentMethod, formData }) => {
        try {
            const response = await axios.post(route('pagamento.processar'), {
                ...formData,
                agendamento_id: idAgendamento 
            });

            // Se o pagamento for aprovado, chamamos a função que o pai nos deu
            if (response.data.status === 'approved') {
                onPaymentSuccess(response.data.codigo_pin);
            } else {
                // Caso seja 'in_process' ou outro status, você pode tratar aqui
                alert("Pagamento em processamento ou recusado. Status: " + response.data.status);
            }
        } catch (error) {
            console.error("Erro ao processar pagamento no servidor:", error);
            // O Brick mostrará uma mensagem de erro automaticamente se dispararmos o erro
            throw error; 
        }
    };

    const onError = async (error) => {
        console.error("Erro no Brick:", error);
    };

    const onReady = async () => {};

    return (
        <div className="w-full max-w-md mx-auto bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <Payment
                initialization={initialization}
                customization={customization}
                onSubmit={onSubmit}
                onReady={onReady}
                onError={onError}
            />
        </div>
    );
}
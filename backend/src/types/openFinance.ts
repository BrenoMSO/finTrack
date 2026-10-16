export type ConsentStatus = 'AWAITING_AUTHORISATION' | 'AUTHORISED' | 'REJECTED';

export interface OpenFinanceConsent {
    consentId: string;
    permissions: string[];
    status: ConsentStatus;
    createdAt: string;
}

export interface OpenFinanceTransaction {
    transactionId: string;
    completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA' | 'TRANSACAO_PENDENTE';
    creditDebitIndicator: 'CREDITO' | 'DEBITO';
    transactionName: string;
    type: string;
    amount: number;
    transactionCurrency: string;
    transactionDate: string;
}

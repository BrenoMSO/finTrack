import { 
  OpenFinanceConsent, 
  OpenFinanceTransaction 
} from '../types/openFinance.js';
import { LocalTransaction } from '../types/transaction.js';

export class OpenFinanceService {
  // Simula o pedido de consentimento exigido pelas normas do Banco Central / Open Finance
  public static createConsent(): OpenFinanceConsent {
    return {
      consentId: 'urn:banco-exemplo:consent:user-1',
      permissions: [
        'ACCOUNTS_READ',
        'RESOURCES_READ',
        'TRANSACTIONS_READ'
      ],
      status: 'AUTHORISED',
      createdAt: new Date().toISOString()
    };
  }

  // Simula a consulta de transações da conta corrente na instituição financeira conectada
  public static fetchBankTransactions(): OpenFinanceTransaction[] {
    return [
      {
        transactionId: 'of-tx-bank-001',
        completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA',
        creditDebitIndicator: 'CREDITO',
        transactionName: 'Transferência Recebida - Projeto Freelance',
        type: 'PIX',
        amount: 2500.00,
        transactionCurrency: 'BRL',
        transactionDate: new Date().toISOString()
      },
      {
        transactionId: 'of-tx-bank-002',
        completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA',
        creditDebitIndicator: 'DEBITO',
        transactionName: 'Supermercado Central',
        type: 'PIX',
        amount: 320.45,
        transactionCurrency: 'BRL',
        transactionDate: new Date().toISOString()
      },
      {
        transactionId: 'of-tx-bank-003',
        completedAuthorisedPaymentType: 'TRANSACAO_EFETIVADA',
        creditDebitIndicator: 'DEBITO',
        transactionName: 'Assinatura Plataforma de Nuvem',
        type: 'BOLETO',
        amount: 89.90,
        transactionCurrency: 'BRL',
        transactionDate: new Date().toISOString()
      }
    ];
  }

  // Converte (adapta) os dados da API bancária para o modelo do finTrack
  public static mapToLocalTransactions(bankTransactions: OpenFinanceTransaction[]): LocalTransaction[] {
    return bankTransactions.map((tx) => {
      const isCredit = tx.creditDebitIndicator === 'CREDITO';
      
      return {
        id: tx.transactionId,
        description: tx.transactionName,
        amount: tx.amount,
        type: isCredit ? 'income' : 'expense',
        category: tx.type === 'PIX' ? 'Pagamentos Instantâneos' : 'Serviços',
        date: tx.transactionDate.split('T')[0] ?? new Date().toISOString().split('T')[0]!
      };
    });
  }
}
import axios from 'axios';
import dotenv from 'dotenv';
import { 
  OpenFinanceConsent, 
  OpenFinanceTransaction 
} from '../types/openFinance.js';

dotenv.config();

/**
 * Resposta da rota de autenticação da Pluggy (/auth)
 */
interface PluggyAuthResponse {
  apiKey: string;
}

/**
 * Resposta da rota de Connect Token (/connect_token)
 */
export interface PluggyConnectTokenResponse {
  accessToken: string;
}

/**
 * Item de transação retornado pela API real da Pluggy (/transactions)
 */
interface PluggyTransactionItem {
  id: string;
  description: string;
  descriptionRaw?: string | null;
  amount: number;
  date: string;
  type?: 'DEBIT' | 'CREDIT' | string;
  status?: 'POSTED' | 'PENDING' | string;
  currencyCode?: string;
  category?: string;
  paymentData?: {
    paymentMethod?: string;
  } | null;
}

/**
 * Serviço de Integração com o Open Finance via Pluggy API Oficial
 * Responsável pela autenticação segura, geração de Connect Tokens e consumo de transações reais.
 */
export class OpenFinanceService {
  private static readonly PLUGGY_API_URL = process.env.OPEN_FINANCE_API_URL || 'https://api.pluggy.ai';
  
  // Cache em memória da API Key para evitar requisições redundantes a cada chamada
  private static cachedApiKey: string | null = null;
  private static apiKeyExpiresAt: number = 0;

  /**
   * Simula o consentimento do Open Finance conforme especificações do Banco Central
   */
  public static createConsent(): OpenFinanceConsent {
    return {
      consentId: 'urn:pluggy:consent:fintrack-user-1',
      permissions: [
        'ACCOUNTS_READ',
        'RESOURCES_READ',
        'TRANSACTIONS_READ'
      ],
      status: 'AUTHORISED',
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Tarefa 2.1: Autenticação com a Pluggy (getApiKey)
   * Faz um POST para https://api.pluggy.ai/auth enviando o clientId e clientSecret do .env.
   * Armazena em cache e retorna a apiKey válida.
   */
  public static async getApiKey(): Promise<string> {
    // Se a chave em cache ainda estiver válida (margem de segurança de 15 minutos), reutiliza
    if (this.cachedApiKey && Date.now() < this.apiKeyExpiresAt) {
      return this.cachedApiKey;
    }

    const clientId = process.env.OPEN_FINANCE_CLIENT_ID;
    const clientSecret = process.env.OPEN_FINANCE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Credenciais da Pluggy (OPEN_FINANCE_CLIENT_ID ou OPEN_FINANCE_CLIENT_SECRET) não configuradas no arquivo .env.');
    }

    try {
      console.log('🔐 [Pluggy] Autenticando com credenciais da Pluggy em https://api.pluggy.ai/auth...');
      
      const response = await axios.post<PluggyAuthResponse>(
        `${this.PLUGGY_API_URL}/auth`,
        {
          clientId,
          clientSecret
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (!response.data?.apiKey) {
        throw new Error('Resposta de autenticação da Pluggy não continha apiKey.');
      }

      this.cachedApiKey = response.data.apiKey;
      // Define expiração do cache em 100 minutos (o token oficial expira em 120 minutos)
      this.apiKeyExpiresAt = Date.now() + 100 * 60 * 1000;

      console.log('✅ [Pluggy] Autenticação bem-sucedida! API Key gerada e armazenada em cache.');
      return this.cachedApiKey;
    } catch (error: any) {
      console.error('❌ [Pluggy] Falha na autenticação:', error.response?.data || error.message);
      throw new Error(`Falha ao autenticar na Pluggy: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Tarefa 2.2: Geração de Connect Token
   * Utiliza a apiKey para fazer um POST em https://api.pluggy.ai/connect_token.
   * Retorna o accessToken que o frontend utilizará para renderizar o Pluggy Connect Widget.
   */
  public static async createConnectToken(options?: { clientUserId?: string; itemId?: string }): Promise<PluggyConnectTokenResponse> {
    const apiKey = await this.getApiKey();

    try {
      console.log('🎫 [Pluggy] Gerando Connect Token para o widget de conexão bancária...');

      const payload: Record<string, any> = {};
      
      if (options?.itemId) {
        payload.itemId = options.itemId;
      }

      payload.options = {
        clientUserId: options?.clientUserId || 'fintrack-user-local',
        avoidDuplicates: true
      };

      const response = await axios.post<PluggyConnectTokenResponse>(
        `${this.PLUGGY_API_URL}/connect_token`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey
          },
          timeout: 10000
        }
      );

      if (!response.data?.accessToken) {
        throw new Error('Resposta do Connect Token da Pluggy não continha accessToken.');
      }

      console.log('✅ [Pluggy] Connect Token gerado com sucesso!');
      return response.data;
    } catch (error: any) {
      console.error('❌ [Pluggy] Erro ao criar Connect Token:', error.response?.data || error.message);
      throw new Error(`Erro ao gerar Connect Token: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Tarefa 3.1: Consulta Real de Transações Bancárias na Pluggy API
   * Remove completamente qualquer dado estático (Sandbox).
   * Consulta https://api.pluggy.ai/transactions passando o accountId fornecido.
   *
   * @param accountId ID da conta bancária conectada (UUID)
   */
  public static async fetchBankTransactions(accountId?: string): Promise<OpenFinanceTransaction[]> {
    if (!accountId) {
      console.log('ℹ️ [Pluggy] Nenhum accountId fornecido na requisição. Nenhuma transação externa consultada.');
      return [];
    }

    const apiKey = await this.getApiKey();

    try {
      console.log(`🌐 [Pluggy] Buscando transações reais da conta: ${accountId}...`);

      const response = await axios.get<{ results: PluggyTransactionItem[] }>(
        `${this.PLUGGY_API_URL}/transactions`,
        {
          params: {
            accountId,
            pageSize: 500
          },
          headers: {
            'X-API-KEY': apiKey,
            'Accept': 'application/json'
          },
          timeout: 12000
        }
      );

      const items = response.data?.results || [];
      console.log(`✅ [Pluggy] ${items.length} transações reais recuperadas da conta ${accountId}.`);

      return items.map((item) => {
        // Na Pluggy: Valores positivos são créditos (entradas) e negativos são débitos (saídas)
        const isCredit = item.type === 'CREDIT' || item.amount > 0;

        return {
          transactionId: item.id,
          completedAuthorisedPaymentType: item.status === 'POSTED' ? 'TRANSACAO_EFETIVADA' : 'TRANSACAO_PENDENTE',
          creditDebitIndicator: isCredit ? 'CREDITO' : 'DEBITO',
          transactionName: item.description || item.descriptionRaw || 'Transação Pluggy',
          type: item.paymentData?.paymentMethod || (isCredit ? 'PIX' : 'OUTROS'),
          amount: Math.abs(Number(item.amount) || 0),
          transactionCurrency: item.currencyCode || 'BRL',
          transactionDate: item.date ? item.date.split('T')[0]! : new Date().toISOString().split('T')[0]!
        };
      });
    } catch (error: any) {
      console.error(`❌ [Pluggy] Erro ao buscar transações para a conta ${accountId}:`, error.response?.data || error.message);
      throw new Error(`Erro na API da Pluggy ao buscar transações: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Tarefa 3.2: Categorização Inteligente (Smart Categorization)
   * Analisa a descrição da transação e seu tipo para inferir a categoria financeira automaticamente.
   *
   * @param description Descrição textual do lançamento
   * @param type Tipo da transação ('income' | 'expense')
   * @returns Categoria classificada
   */
  public static categorizeSmartly(description: string, type: 'income' | 'expense' | string): string {
    if (!description) {
      return type === 'income' ? 'Salário' : 'Outros';
    }

    const desc = description
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // 1. Alimentação / Food
    if (
      desc.includes('supermercado') ||
      desc.includes('mercado') ||
      desc.includes('ifood') ||
      desc.includes('rappi') ||
      desc.includes('restaurante') ||
      desc.includes('padaria') ||
      desc.includes('hortifruti') ||
      desc.includes('lanche') ||
      desc.includes('mcdonald') ||
      desc.includes('burger') ||
      desc.includes('grocery') ||
      desc.includes('food')
    ) {
      return 'Alimentação';
    }

    // 2. Transporte / Transportation
    if (
      desc.includes('uber') ||
      desc.includes('99') ||
      desc.includes('cabify') ||
      desc.includes('posto') ||
      desc.includes('gasolina') ||
      desc.includes('combustivel') ||
      desc.includes('estacionamento') ||
      desc.includes('pedagio') ||
      desc.includes('onibus') ||
      desc.includes('metro') ||
      desc.includes('transport')
    ) {
      return 'Transporte';
    }

    // 3. Lazer / Entretenimento / Leisure
    if (
      desc.includes('netflix') ||
      desc.includes('spotify') ||
      desc.includes('amazon prime') ||
      desc.includes('disney') ||
      desc.includes('cinema') ||
      desc.includes('steam') ||
      desc.includes('playstation') ||
      desc.includes('xbox') ||
      desc.includes('show') ||
      desc.includes('ingresso') ||
      desc.includes('entretenimento') ||
      desc.includes('lazer')
    ) {
      return 'Entretenimento';
    }

    // 4. Moradia & Contas Fixas
    if (
      desc.includes('aluguel') ||
      desc.includes('condominio') ||
      desc.includes('energia') ||
      desc.includes('luz') ||
      desc.includes('agua') ||
      desc.includes('gas') ||
      desc.includes('internet') ||
      desc.includes('claro') ||
      desc.includes('vivo') ||
      desc.includes('tim') ||
      desc.includes('enel') ||
      desc.includes('sabesp')
    ) {
      return 'Contas';
    }

    // 5. Salário & Entradas Financeiras
    if (
      desc.includes('salario') ||
      desc.includes('pro labore') ||
      desc.includes('freelance') ||
      desc.includes('rendimento') ||
      desc.includes('transferencia recebida') ||
      desc.includes('deposito')
    ) {
      return 'Salário';
    }

    // 6. Serviços & Assinaturas Corporativas
    if (
      desc.includes('nuvem') ||
      desc.includes('aws') ||
      desc.includes('google') ||
      desc.includes('azure') ||
      desc.includes('servico') ||
      desc.includes('boleto')
    ) {
      return 'Serviços';
    }

    return type === 'income' ? 'Salário' : 'Outros';
  }
}

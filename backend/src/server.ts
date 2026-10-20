import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { TransactionModel } from './models/TransactionModel.js';
import { OpenFinanceService } from './services/openFinanceService.js';

// Carrega as variáveis de ambiente (.env)
dotenv.config();

const app = express();

/**
 * 1. Configuração defensiva da Porta
 * Utiliza a porta definida no .env ou recorre ao padrão 3000
 */
const DEFAULT_PORT = 3000;
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

/**
 * 2. Middlewares Globais
 * CORS e parseadores de corpo (JSON e URL-encoded) DEVEM vir obrigatoriamente
 * antes de qualquer declaração de rotas da aplicação.
 */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Middleware para validação do estado da conexão com o banco de dados
 * Garante que requisições que dependem do MongoDB recebam 503 com mensagem amigável
 * em vez de travar a conexão ou derrubar o servidor.
 */
const checkDbConnection = (_req: Request, res: Response, next: () => void) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: 'Banco de dados MongoDB não conectado. Verifique a variável MONGODB_URI no arquivo .env.'
    });
  }
  next();
};

/**
 * GET /api/status (Health-Check)
 * Rota de monitoramento para validar o funcionamento do Express e do MongoDB
 */
app.get('/api/status', (_req: Request, res: Response) => {
  const isConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    status: 'ok',
    response: 'Backend Rodando com Express!',
    database: isConnected ? 'Conectado ao MongoDB' : 'Desconectado (Aguardando MONGODB_URI válida)',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/transactions
 * Retorna as transações cadastradas ordenadas pela mais recente
 */
app.get('/api/transactions', checkDbConnection, async (_req: Request, res: Response) => {
  try {
    const transactions = await TransactionModel.find().sort({ createdAt: -1 });
    return res.status(200).json(transactions);
  } catch (err) {
    console.error('❌ Erro ao buscar transações no MongoDB:', err);
    return res.status(500).json({ error: 'Erro interno ao buscar transações.' });
  }
});

/**
 * POST /api/transactions
 * Cadastra uma transação manual vinda do formulário
 */
app.post('/api/transactions', checkDbConnection, async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Corpo da requisição ausente ou em formato inválido. Envie JSON com cabeçalho Content-Type: application/json.'
      });
    }

    const { description, amount, type, category, date } = req.body;

    if (!description || typeof description !== 'string' || !description.trim()) {
      return res.status(400).json({
        error: 'Descrição é obrigatória e não pode ser vazia.'
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        error: 'Valor deve ser um número maior que zero.'
      });
    }

    if (type !== 'income' && type !== 'expense') {
      return res.status(400).json({
        error: "Tipo inválido. Deve ser 'income' (Receita) ou 'expense' (Despesa)."
      });
    }

    const newTransaction = await TransactionModel.create({
      description: description.trim(),
      amount: numAmount,
      type: type,
      category: category ? String(category).trim() : 'Outros',
      date: date ? String(date).trim() : new Date().toISOString().split('T')[0]!,
      source: 'manual',
    });

    return res.status(201).json(newTransaction);
  } catch (err) {
    console.error('❌ Erro ao salvar transação manual:', err);
    return res.status(500).json({ error: 'Erro interno ao salvar transação.' });
  }
});

/**
 * GET /api/open-finance/token (Tarefa 2.2: Rota de Connect Token)
 * Gera um Connect Token de curta duração (30 min) para inicializar o Pluggy Connect Widget no frontend
 */
app.get('/api/open-finance/token', async (req: Request, res: Response) => {
  try {
    const clientUserId = (req.query.clientUserId as string) || 'fintrack-user-local';
    const itemId = (req.query.itemId as string) || undefined;

    const tokenData = await OpenFinanceService.createConnectToken({ clientUserId, itemId });
    return res.status(200).json(tokenData);
  } catch (err: any) {
    console.error('❌ Erro ao gerar Connect Token na Pluggy:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'Erro ao gerar Connect Token com a Pluggy.',
      detail: err.response?.data || err.message
    });
  }
});

/**
 * POST /api/open-finance/sync (Tarefa 3.2: Sincronização Real de Transações)
 * Sincroniza extrato bancário consumindo a API da Pluggy com inteligência de dados
 * Previne registros duplicados através do índice externalId e aplica categorizeSmartly.
 */
app.post('/api/open-finance/sync', checkDbConnection, async (req: Request, res: Response) => {
  try {
    // Permite que o accountId venha via body ou query string (quando o usuário conectar a conta)
    const accountId = (req.body?.accountId as string) || (req.query?.accountId as string) || undefined;

    // 1. Consulta as transações reais da Pluggy (ou retorna vazio se nenhuma conta foi vinculada)
    const rawBankData = await OpenFinanceService.fetchBankTransactions(accountId);

    let addedCount = 0;

    // 2. Itera sobre cada transação e verifica idempotência (prevenção de duplicatas)
    for (const bankTx of rawBankData) {
      const existing = await TransactionModel.findOne({ externalId: bankTx.transactionId });

      if (!existing) {
        const isCredit = bankTx.creditDebitIndicator === 'CREDITO';
        const type: 'income' | 'expense' = isCredit ? 'income' : 'expense';

        // 3. Aplica categorização inteligente
        const smartCategory = OpenFinanceService.categorizeSmartly(bankTx.transactionName, type);

        await TransactionModel.create({
          externalId: bankTx.transactionId,
          description: bankTx.transactionName,
          amount: bankTx.amount,
          type: type,
          category: smartCategory,
          date: bankTx.transactionDate ? bankTx.transactionDate.split('T')[0]! : new Date().toISOString().split('T')[0]!,
          source: 'open_finance',
        });

        addedCount++;
      }
    }

    // Retorna a lista completa atualizada do banco
    const allTransactions = await TransactionModel.find().sort({ createdAt: -1 });

    return res.status(200).json({
      message: rawBankData.length > 0 
        ? 'Extrato bancário sincronizado com sucesso!' 
        : (accountId 
            ? 'Nenhuma nova transação encontrada para esta conta.' 
            : 'Nenhuma conta bancária fornecida. Conecte uma conta via Pluggy Connect para sincronizar lançamentos reais.'),
      addedTransactions: addedCount,
      transactions: allTransactions
    });
  } catch (err: any) {
    console.error('❌ Erro ao sincronizar Open Finance:', err.response?.data || err.message);
    return res.status(500).json({
      error: 'Erro interno ao sincronizar Open Finance.',
      detail: err.response?.data || err.message
    });
  }
});

/**
 * 3. Inicialização Segura e Não-Bloqueante do Servidor
 */
async function startServer() {
  // Conecta ao MongoDB Atlas
  try {
    await connectDatabase();
  } catch (dbError) {
    console.error('❌ [Database] Erro ao conectar ao banco de dados:', dbError);
  }

  // Inicia o listener HTTP com tratamento defensivo de erro EADDRINUSE
  const server = app.listen(PORT, () => {
    console.log(`🚀 [finTrack] Servidor rodando na porta ${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ [finTrack] A porta ${PORT} já está em uso.`);
      const fallbackPort = PORT + 1;
      console.log(`🔄 [finTrack] Tentando iniciar na porta alternativa ${fallbackPort}...`);
      const fallbackServer = app.listen(fallbackPort, () => {
        console.log(`🚀 [finTrack] Servidor rodando na porta ${fallbackPort}`);
      });
      fallbackServer.on('error', (fbErr) => {
        console.error('❌ [finTrack] Falha fatal ao iniciar na porta alternativa:', fbErr);
      });
    } else {
      console.error('❌ [finTrack] Erro inesperado ao inicializar o servidor:', err);
    }
  });

  // Tratamento de encerramento gracioso (Graceful Shutdown)
  process.on('SIGINT', async () => {
    console.log('\n🛑 Encerrando servidor e conexões com o MongoDB...');
    await disconnectDatabase();
    server.close(() => {
      console.log('👋 Servidor finalizado com sucesso.');
      process.exit(0);
    });
  });
}

startServer();

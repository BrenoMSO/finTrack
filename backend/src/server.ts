import express, { Request, Response } from 'express';
import cors from 'cors';
import { LocalTransaction } from './types/transaction.js';
import { OpenFinanceService } from './services/openFinanceService.js';
import { 
  initDatabase, 
  getTransactions, 
  addTransaction, 
  addTransactionsIfNotExist 
} from './database.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/status', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    response: 'Backend Rodando!'
  });
});

// GET /api/transactions - Retorna todas as transações cadastradas
app.get('/api/transactions', async (_req: Request, res: Response) => {
  try {
    const transactions = await getTransactions();
    return res.status(200).json(transactions);
  } catch (err) {
    console.error('Erro ao buscar transações:', err);
    return res.status(500).json({ error: 'Erro interno ao buscar transações.' });
  }
});

// POST /api/transactions - Cadastra uma nova transação manual
app.post('/api/transactions', async (req: Request, res: Response) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Corpo da requisição ausente ou em formato inválido. Certifique-se de enviar JSON e o cabeçalho Content-Type: application/json.'
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

    const newTransaction: LocalTransaction = {
      id: `manual-${Date.now()}`,
      description: description.trim(),
      amount: numAmount,
      type: type,
      category: category ? String(category).trim() : 'Outros',
      date: date ? String(date).trim() : new Date().toISOString().split('T')[0]!
    };

    const savedTransaction = await addTransaction(newTransaction);
    return res.status(201).json(savedTransaction);
  } catch (err) {
    console.error('Erro ao salvar transação:', err);
    return res.status(500).json({ error: 'Erro interno ao salvar transação.' });
  }
});

// POST /api/open-finance/sync - Sincroniza extrato bancário Open Finance
app.post('/api/open-finance/sync', async (_req: Request, res: Response) => {
  try {
    // 1. Busca os lançamentos da instituição financeira
    const rawBankData = OpenFinanceService.fetchBankTransactions();

    // 2. Transforma para o modelo do finTrack
    const convertedTransactions = OpenFinanceService.mapToLocalTransactions(rawBankData);

    // 3. Adiciona as transações na base evitando duplicidades
    const { addedCount, total } = await addTransactionsIfNotExist(convertedTransactions);

    return res.status(200).json({
      message: 'Extrato bancário sincronizado com sucesso!',
      addedTransactions: addedCount,
      transactions: total
    });
  } catch (err) {
    console.error('Erro ao sincronizar Open Finance:', err);
    return res.status(500).json({ error: 'Erro interno ao sincronizar Open Finance.' });
  }
});

// Inicialização do banco de dados e servidor
initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[finTrack] Servidor ativo em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Falha ao inicializar banco de dados SQLite:', err);
    process.exit(1);
  });
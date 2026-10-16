import express, {Request, Response} from 'express';
import cors from 'cors';
import { LocalTransaction } from './types/transaction.js';
import { OpenFinanceService } from './services/openFinanceService.js';
import { error } from 'node:console';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const transactionsDatabase: LocalTransaction[] = [
  {
    id: 'tx-inicial-1',
    description: 'Saldo Inicial de Demonstração',
    amount: 1000.00,
    type: 'income',
    category: 'Geral',
    date: new Date().toISOString().split('T')[0]!
  }
];

app.get('/api/status', (_req: Request, res: Response) =>{
    res.json({
        status: 'ok',
        response: 'Backend Rodando!'
    });
});

app.get('/api/transactions', (req: Request, res: Response) =>{

  if (!req.body || typeof req.body !== 'object') {
    return res.status(400).json({
      error: 'Corpo da requisição ausente ou em formato inválido. Certifique-se de enviar JSON e o cabeçalho Content-Type: application/json.'
    });
  }


    const { description, amount, type, category, date } = req.body;

    if ( !description || typeof amount !== 'number' || !type) {
        return res.status(400).json({
            error: 'Parâmetros inválidos. É obrigatório informar description, amount e type.'
        });
    }

    const newTransaction: LocalTransaction = {
    id: `manual-${Date.now()}`,
    description: String(description),
    amount: Number(amount),
    type: type === 'income' ? 'income' : 'expense',
    category: category ? String(category) : 'Outros',
    date: date ? String(date) : new Date().toISOString().split('T')[0]!
    };

    transactionsDatabase.unshift(newTransaction);
    return res.status(201).json(newTransaction);

});

app.post('/api/open-finance/sync', (_req: Request, res: Response) => {
  // 1. Busca os lançamentos da instituição financeira
  const rawBankData = OpenFinanceService.fetchBankTransactions();

  // 2. Transforma para o modelo do finTrack
  const convertedTransactions = OpenFinanceService.mapToLocalTransactions(rawBankData);

  // 3. Adiciona as transações na base evitando duplicidades
  convertedTransactions.forEach((bankTx) => {
    const alreadyExists = transactionsDatabase.some((item) => item.id === bankTx.id);
    if (!alreadyExists) {
      transactionsDatabase.unshift(bankTx);
    }
  });

  return res.status(200).json({
    message: 'Extrato bancário sincronizado com sucesso!',
    addedTransactions: convertedTransactions.length,
    transactions: transactionsDatabase
  });
});


app.listen(PORT, () =>{
    console.log(`[finTrack] Servidor ativo na porta http://localhost:${PORT}`);
});
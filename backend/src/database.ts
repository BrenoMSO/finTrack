import sqlite3 from 'sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalTransaction } from './types/transaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../fintrack.db');
const db = new sqlite3.Database(dbPath);

export function run(query: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function all<T = any>(query: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

export function get<T = any>(query: string, params: any[] = []): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row as T | undefined);
    });
  });
}

export async function initDatabase(): Promise<void> {
  await run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      category TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const countRow = await get<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
  if (countRow && countRow.count === 0) {
    await run(
      `INSERT INTO transactions (id, description, amount, type, category, date) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'tx-inicial-1',
        'Saldo Inicial de Demonstração',
        1000.00,
        'income',
        'Geral',
        new Date().toISOString().split('T')[0]!
      ]
    );
  }
}

export async function getTransactions(): Promise<LocalTransaction[]> {
  return all<LocalTransaction>(
    'SELECT id, description, amount, type, category, date FROM transactions ORDER BY created_at DESC, rowid DESC'
  );
}

export async function addTransaction(tx: LocalTransaction): Promise<LocalTransaction> {
  await run(
    'INSERT INTO transactions (id, description, amount, type, category, date) VALUES (?, ?, ?, ?, ?, ?)',
    [tx.id, tx.description, tx.amount, tx.type, tx.category, tx.date]
  );
  return tx;
}

export async function addTransactionsIfNotExist(txs: LocalTransaction[]): Promise<{ addedCount: number; total: LocalTransaction[] }> {
  let addedCount = 0;
  for (const tx of txs) {
    const existing = await get('SELECT id FROM transactions WHERE id = ?', [tx.id]);
    if (!existing) {
      await run(
        'INSERT INTO transactions (id, description, amount, type, category, date) VALUES (?, ?, ?, ?, ?, ?)',
        [tx.id, tx.description, tx.amount, tx.type, tx.category, tx.date]
      );
      addedCount++;
    }
  }
  const total = await getTransactions();
  return { addedCount, total };
}

export { db };

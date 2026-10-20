import { Schema, model, Document } from 'mongoose';

/**
 * Interface que representa os atributos tipados de uma transação no MongoDB
 */
export interface ITransaction extends Document {
  externalId?: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  source: 'manual' | 'open_finance';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Esquema (Schema) Mongoose para a coleção de Transações
 * Configura tipos, validações e regras de negócio para persistência não-relacional
 */
const TransactionSchema = new Schema<ITransaction>(
  {
    /**
     * Identificador externo único fornecido pela instituição financeira (Open Finance).
     * O índice 'sparse: true' garante que documentos sem externalId (ex: transações manuais)
     * não gerem conflito de unicidade (null/undefined), enquanto impede que lançamentos
     * com o mesmo identificador bancário sejam sincronizados em duplicidade.
     */
    externalId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'A descrição da transação é obrigatória.'],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, 'O valor da transação é obrigatório.'],
      min: [0.01, 'O valor deve ser maior que zero.'],
    },
    type: {
      type: String,
      enum: {
        values: ['income', 'expense'],
        message: "O tipo da transação deve ser 'income' (Receita) ou 'expense' (Despesa).",
      },
      required: [true, 'O tipo da transação é obrigatório.'],
    },
    category: {
      type: String,
      default: 'Outros',
      trim: true,
    },
    date: {
      type: String,
      required: [true, 'A data da transação é obrigatória.'],
    },
    source: {
      type: String,
      enum: ['manual', 'open_finance'],
      default: 'manual',
    },
  },
  {
    // Adiciona automaticamente os campos createdAt e updatedAt
    timestamps: true,
    toJSON: {
      /**
       * Transforma o documento ao serializar para JSON:
       * - Converte o '_id' do MongoDB para a chave 'id' esperada pelo frontend.
       * - Remove '_id' e o campo de controle '__v' do Mongoose.
       */
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Modelo Mongoose pronto para operações CRUD no MongoDB Atlas
 */
export const TransactionModel = model<ITransaction>('Transaction', TransactionSchema);

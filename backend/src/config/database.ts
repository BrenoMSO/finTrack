import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

/**
 * Módulo de Conexão com o Banco de Dados (MongoDB Atlas)
 * Isola a responsabilidade de inicialização e controle da conexão de infraestrutura.
 */
export async function connectDatabase(): Promise<typeof mongoose | null> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ [Database] Erro: A variável MONGODB_URI não foi definida no arquivo .env.');
    return null;
  }

  try {
    console.log('🔄 [Database] Estabelecendo conexão com o MongoDB Atlas...');
    
    // Conecta ao MongoDB Atlas definindo tempo limite seguro para evitar travamento em falhas de rede
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true, // Garante que índices únicos e sparse definidos no Schema sejam criados
    });

    console.log('✅ Conectado ao MongoDB Atlas (Connected to MongoDB Atlas)');
    return conn;
  } catch (error) {
    console.error('❌ [Database] Erro ao conectar ao MongoDB Atlas:', error instanceof Error ? error.message : error);
    console.warn('⚠️ [Database] Verifique se a sua connection string no .env é válida e se o seu IP está liberado no Network Access do Atlas.');
    return null;
  }
}

/**
 * Função utilitária para encerrar a conexão com o MongoDB de forma graciosa
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('🔌 [Database] Conexão com MongoDB encerrada com sucesso.');
  } catch (error) {
    console.error('❌ [Database] Erro ao desconectar do MongoDB:', error);
  }
}

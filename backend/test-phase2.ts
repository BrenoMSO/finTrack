import dotenv from 'dotenv';
import { OpenFinanceService } from './src/services/openFinanceService.js';

dotenv.config();

async function runPluggyTests() {
  console.log('🧪 ========================================================');
  console.log('🧪 Bateria de Testes: Integração Real Pluggy & Categorização');
  console.log('🧪 ========================================================\n');

  // --- 1. Categorização Inteligente ---
  console.log('▶️ [1. Teste de Categorização Inteligente (categorizeSmartly)]');
  const testCases = [
    { desc: 'Corrida de Uber para o trabalho', type: 'expense', expected: 'Transporte' },
    { desc: 'Supermercado Central', type: 'expense', expected: 'Alimentação' },
    { desc: 'Assinatura Netflix', type: 'expense', expected: 'Entretenimento' },
    { desc: 'Transferência Recebida - Projeto Freelance', type: 'income', expected: 'Salário' },
    { desc: 'Aluguel do Apartamento', type: 'expense', expected: 'Contas' },
    { desc: 'Posto de Gasolina Shell', type: 'expense', expected: 'Transporte' },
    { desc: 'Ifood Delivery', type: 'expense', expected: 'Alimentação' }
  ];

  for (const tc of testCases) {
    const result = OpenFinanceService.categorizeSmartly(tc.desc, tc.type);
    const pass = result === tc.expected;
    console.log(`   ${pass ? '✅' : '❌'} "${tc.desc}" -> "${result}" (Esperado: "${tc.expected}")`);
    if (!pass) throw new Error(`Falha na categorização inteligente para "${tc.desc}"`);
  }
  console.log('   🎉 Categorização inteligente validada com sucesso!\n');

  // --- 2. Autenticação na Pluggy (getApiKey) ---
  console.log('▶️ [2. Teste de Autenticação na Pluggy (getApiKey)]');
  const apiKey = await OpenFinanceService.getApiKey();
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Falha ao obter API Key da Pluggy.');
  }
  console.log(`   ✅ API Key gerada com sucesso: ${apiKey.substring(0, 15)}...\n`);

  // --- 3. Geração de Connect Token ---
  console.log('▶️ [3. Teste de Geração de Connect Token (createConnectToken)]');
  const tokenData = await OpenFinanceService.createConnectToken({ clientUserId: 'test-qa-user' });
  if (!tokenData?.accessToken) {
    throw new Error('Falha: accessToken ausente na resposta do Connect Token.');
  }
  console.log(`   ✅ Connect Token gerado com sucesso: ${tokenData.accessToken.substring(0, 20)}...\n`);

  // --- 4. Busca de Transações Sem Conta Conectada ---
  console.log('▶️ [4. Teste de Busca Sem accountId]');
  const emptyTxs = await OpenFinanceService.fetchBankTransactions();
  if (!Array.isArray(emptyTxs) || emptyTxs.length !== 0) {
    throw new Error('Sem accountId, a busca de transações reais deve retornar array vazio.');
  }
  console.log('   ✅ Retornou array vazio conforme esperado quando não há accountId vinculado.\n');

  console.log('========================================================');
  console.log('🎉 TODOS OS TESTES DA INTEGRAÇÃO PLUGGY FORAM APROVADOS!');
  console.log('========================================================\n');
}

runPluggyTests().catch(err => {
  console.error('❌ Falha nos testes:', err.message);
  process.exit(1);
});

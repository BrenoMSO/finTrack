const BASE_URL = 'http://localhost:3000/api';

async function testAll() {
    console.log('🧪 Iniciando testes de API contra http://localhost:3000 ...\n');

    // 1. Health check
    const statusRes = await fetch(`${BASE_URL}/status`);
    const statusData = await statusRes.json();
    console.log('✅ [1. Status Check]', statusData);
    if (statusData.status !== 'ok') throw new Error('Status check failed');

    // 2. Initial transactions check
    const initialTxsRes = await fetch(`${BASE_URL}/transactions`);
    const initialTxs = await initialTxsRes.json();
    console.log(`✅ [2. GET /api/transactions] Retornou ${initialTxs.length} transação(ões) inicial(is)`);
    console.log('   Transação inicial:', initialTxs[0]);

    // 3. Teste 1: Validação de Parâmetros (400 Bad Request)
    console.log('\n--- 🧪 TESTE 1: Validação de Parâmetros (400 Bad Request) ---');
    
    // 3.1 Descrição vazia
    const emptyDescRes = await fetch(`${BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: '', amount: 100, type: 'income', category: 'Geral' })
    });
    console.log('• Descrição vazia -> Status:', emptyDescRes.status, await emptyDescRes.json());
    if (emptyDescRes.status !== 400) throw new Error('Falha na validação de descrição vazia');

    // 3.2 Valor zero
    const zeroAmountRes = await fetch(`${BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Teste Zero', amount: 0, type: 'expense', category: 'Geral' })
    });
    console.log('• Valor zero -> Status:', zeroAmountRes.status, await zeroAmountRes.json());
    if (zeroAmountRes.status !== 400) throw new Error('Falha na validação de valor zero');

    // 3.3 Valor negativo
    const negAmountRes = await fetch(`${BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Teste Negativo', amount: -50, type: 'expense', category: 'Geral' })
    });
    console.log('• Valor negativo -> Status:', negAmountRes.status, await negAmountRes.json());
    if (negAmountRes.status !== 400) throw new Error('Falha na validação de valor negativo');

    // 3.4 Tipo inválido
    const invalidTypeRes = await fetch(`${BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: 'Teste Tipo', amount: 100, type: 'invalido', category: 'Geral' })
    });
    console.log('• Tipo inválido -> Status:', invalidTypeRes.status, await invalidTypeRes.json());
    if (invalidTypeRes.status !== 400) throw new Error('Falha na validação de tipo');

    // 4. Teste 2: Criação manual de transações
    console.log('\n--- 🧪 TESTE 2: Criação Manual de Transações ---');
    const createTxRes1 = await fetch(`${BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            description: 'Salário Mensal',
            amount: 5500.00,
            type: 'income',
            category: 'Salário'
        })
    });
    const createdTx1 = await createTxRes1.json();
    console.log('• Criação de Receita (Salário) -> Status:', createTxRes1.status, createdTx1);
    if (createTxRes1.status !== 201) throw new Error('Falha ao criar receita');

    const createTxRes2 = await fetch(`${BASE_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            description: 'Compras de Mercado',
            amount: 450.75,
            type: 'expense',
            category: 'Alimentação'
        })
    });
    const createdTx2 = await createTxRes2.json();
    console.log('• Criação de Despesa (Mercado) -> Status:', createTxRes2.status, createdTx2);
    if (createTxRes2.status !== 201) throw new Error('Falha ao criar despesa');

    // 5. Teste 3: Open Finance Sync & Deduplicação
    console.log('\n--- 🧪 TESTE 3: Sincronização Open Finance e Deduplicação ---');
    const syncRes1 = await fetch(`${BASE_URL}/open-finance/sync`, { method: 'POST' });
    const syncData1 = await syncRes1.json();
    console.log('• Sincronização 1 -> Status:', syncRes1.status, 'Adicionadas:', syncData1.addedTransactions);

    const syncRes2 = await fetch(`${BASE_URL}/open-finance/sync`, { method: 'POST' });
    const syncData2 = await syncRes2.json();
    console.log('• Sincronização 2 (Deduplicação garantida) -> Status:', syncRes2.status, 'Adicionadas:', syncData2.addedTransactions);
    if (syncData2.addedTransactions !== 0) throw new Error('Não deveria duplicar transações existentes!');

    // 6. Listagem final
    const finalTxsRes = await fetch(`${BASE_URL}/transactions`);
    const finalTxs = await finalTxsRes.json();
    console.log(`\n✅ [GET /api/transactions] Total final de transações no banco: ${finalTxs.length}`);
    console.table(finalTxs.map(t => ({ ID: t.id, Descrição: t.description, Tipo: t.type, Valor: t.amount, Categoria: t.category })));

    console.log('\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!\n');
}

testAll().catch(err => {
    console.error('❌ Falha:', err);
    process.exit(1);
});

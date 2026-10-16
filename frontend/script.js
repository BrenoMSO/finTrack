const API_BASE_URL = 'http://localhost:3000/api';

// Elementos do DOM
const form = document.getElementById('despesa-form');
const inputDescricao = document.getElementById('descricao');
const inputValor = document.getElementById('valor');
const selectTipo = document.getElementById('tipo');
const selectCategoria = document.getElementById('categoria');
const btnSyncOpenFinance = document.getElementById('btn-sync-open-finance');

const tabelaCorpo = document.getElementById('tabela-transacoes-corpo');
const totalReceitasEl = document.getElementById('total-receitas');
const totalDespesasEl = document.getElementById('total-despesas');
const saldoTotalEl = document.getElementById('saldo-total');

// Formatação de Moeda em Reais
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Formatação de Data (DD/MM/AAAA)
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('pt-BR');
    }
    return dateStr;
}

// Atualização do Dashboard / Resumo Financeiro (Task 1.3)
function updateDashboard(transactions) {
    let income = 0;
    let expense = 0;

    transactions.forEach(tx => {
        const val = Number(tx.amount) || 0;
        if (tx.type === 'income') {
            income += val;
        } else if (tx.type === 'expense') {
            expense += val;
        }
    });

    const balance = income - expense;

    totalReceitasEl.textContent = formatCurrency(income);
    totalDespesasEl.textContent = formatCurrency(expense);
    saldoTotalEl.textContent = formatCurrency(balance);

    // Ajusta a cor do saldo conforme for positivo ou negativo
    if (balance > 0) {
        saldoTotalEl.style.color = '#059669'; // verde
    } else if (balance < 0) {
        saldoTotalEl.style.color = '#dc2626'; // vermelho
    } else {
        saldoTotalEl.style.color = '#1e293b'; // neutro
    }
}

// Escape simples contra XSS ao renderizar HTML
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Renderização da Tabela de Transações (Task 1.1)
function renderTransactions(transactions) {
    tabelaCorpo.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        const trVazio = document.createElement('tr');
        trVazio.innerHTML = `
            <td colspan="5" class="empty-state">
                Nenhuma transação cadastrada ainda. Adicione uma nova transação ou sincronize com o Open Finance!
            </td>
        `;
        tabelaCorpo.appendChild(trVazio);
        return;
    }

    transactions.forEach(tx => {
        const tr = document.createElement('tr');
        const isIncome = tx.type === 'income';
        const tipoLabel = isIncome ? 'Receita' : 'Despesa';
        const badgeClass = isIncome ? 'badge-income' : 'badge-expense';
        const valorClass = isIncome ? 'valor-income' : 'valor-expense';
        const sinal = isIncome ? '+ ' : '- ';

        tr.innerHTML = `
            <td>${formatDate(tx.date)}</td>
            <td><strong>${escapeHtml(tx.description)}</strong></td>
            <td>${escapeHtml(tx.category || 'Outros')}</td>
            <td><span class="badge ${badgeClass}">${tipoLabel}</span></td>
            <td class="${valorClass}">${sinal}${formatCurrency(tx.amount)}</td>
        `;
        tabelaCorpo.appendChild(tr);
    });
}

// Task 1.1: Busca a lista de transações do backend
async function fetchTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/transactions`);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        const transactions = await response.json();
        renderTransactions(transactions);
        updateDashboard(transactions);
    } catch (err) {
        console.error('Erro ao conectar com o backend:', err);
        alert('Não foi possível conectar ao servidor. Por favor, tente novamente mais tarde.');
    }
}

// Task 1.2: Envio de nova transação via formulário
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const descricao = inputDescricao.value.trim();
    const valor = parseFloat(inputValor.value);
    const tipo = selectTipo.value;
    const categoria = selectCategoria.value;

    // Validação frontend (Test 1)
    if (!descricao) {
        alert('Por favor, informe a descrição da transação.');
        inputDescricao.focus();
        return;
    }

    if (isNaN(valor) || valor <= 0) {
        alert('Por favor, informe um valor maior que zero.');
        inputValor.focus();
        return;
    }

    if (!tipo) {
        alert('Por favor, selecione o tipo de transação (Receita ou Despesa).');
        selectTipo.focus();
        return;
    }

    if (!categoria) {
        alert('Por favor, selecione uma categoria.');
        selectCategoria.focus();
        return;
    }

    const payload = {
        description: descricao,
        amount: valor,
        type: tipo,
        category: categoria,
        date: new Date().toISOString().split('T')[0]
    };

    try {
        const response = await fetch(`${API_BASE_URL}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            alert(errData.error || `Erro ao salvar transação: status ${response.status}`);
            return;
        }

        // Limpa os campos do formulário após sucesso
        form.reset();

        // Atualiza a listagem e o dashboard imediatamente (Test 2)
        await fetchTransactions();
    } catch (err) {
        console.error('Erro de conexão ao enviar transação:', err);
        alert('Não foi possível conectar ao servidor. Por favor, tente novamente mais tarde.');
    }
});

// Task 2.2: Integração com o botão Open Finance
btnSyncOpenFinance.addEventListener('click', async () => {
    const textoOriginal = btnSyncOpenFinance.innerHTML;
    btnSyncOpenFinance.disabled = true;
    btnSyncOpenFinance.innerHTML = '⏳ Sincronizando...';

    try {
        const response = await fetch(`${API_BASE_URL}/open-finance/sync`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }

        const data = await response.json();
        
        // Recarrega a tabela e o resumo financeiro com dados atualizados
        await fetchTransactions();

        if (data.addedTransactions > 0) {
            alert(`Sincronização concluída com sucesso! ${data.addedTransactions} transações foram adicionadas.`);
        } else {
            alert('Extrato bancário já sincronizado. Nenhuma transação duplicada foi adicionada.');
        }
    } catch (err) {
        console.error('Erro na sincronização Open Finance:', err);
        alert('Não foi possível conectar ao servidor. Por favor, tente novamente mais tarde.');
    } finally {
        btnSyncOpenFinance.disabled = false;
        btnSyncOpenFinance.innerHTML = textoOriginal;
    }
});

// Inicialização: carregar transações ao abrir a página
document.addEventListener('DOMContentLoaded', fetchTransactions);

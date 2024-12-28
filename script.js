// Variáveis globais
let transacoes = JSON.parse(localStorage.getItem('transacoes')) || [];
let grafico = null;
let filtroAtual = 'todos';
let configuracoes = JSON.parse(localStorage.getItem('configuracoes')) || {
    metaMensal: 1000,
    limitesCategorias: {}
};

// Inicializa o gráfico
function inicializarGrafico() {
    const ctx = document.getElementById('graficoGastos').getContext('2d');
    grafico = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Gastos por Categoria (R$)',
                data: [],
                backgroundColor: '#3498db',
                borderColor: '#2980b9',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Calcula os totais
function calcularTotais() {
    const totais = transacoes.reduce((acc, trans) => {
        if (trans.tipo === 'receita') {
            acc.receitas += trans.valor;
        } else {
            acc.despesas += trans.valor;
        }
        return acc;
    }, { receitas: 0, despesas: 0 });

    const saldo = totais.receitas - totais.despesas;

    document.getElementById('totalReceitas').textContent = `R$ ${totais.receitas.toFixed(2)}`;
    document.getElementById('totalDespesas').textContent = `R$ ${totais.despesas.toFixed(2)}`;
    document.getElementById('saldoValor').textContent = `R$ ${saldo.toFixed(2)}`;

    const saldoCard = document.getElementById('saldoCard');
    if (saldo < 0) {
        saldoCard.classList.add('negativo');
    } else {
        saldoCard.classList.remove('negativo');
    }
}

// Calcula estatísticas
function calcularEstatisticas() {
    // Média de gastos por dia
    const gastosMes = transacoes
        .filter(t => t.tipo === 'despesa' && t.data > Date.now() - 30 * 24 * 60 * 60 * 1000)
        .reduce((sum, t) => sum + t.valor, 0);
    const mediaGastosDia = gastosMes / 30;
    document.getElementById('mediaGastosDia').textContent = `R$ ${mediaGastosDia.toFixed(2)}`;

    // Maior gasto
    const maiorTransacao = transacoes
        .filter(t => t.tipo === 'despesa')
        .reduce((max, t) => t.valor > max.valor ? t : max, { valor: 0 });
    document.getElementById('maiorGasto').textContent = `R$ ${maiorTransacao.valor.toFixed(2)}`;
    if (maiorTransacao.categoria) {
        document.getElementById('maiorGastoCategoria').textContent = maiorTransacao.categoria;
    }

    // Meta de economia
    const receitasMes = transacoes
        .filter(t => t.tipo === 'receita' && t.data > Date.now() - 30 * 24 * 60 * 60 * 1000)
        .reduce((sum, t) => sum + t.valor, 0);
    const economiaAtual = receitasMes - gastosMes;
    const percentualMeta = (economiaAtual / configuracoes.metaMensal) * 100;
    
    document.getElementById('metaEconomia').textContent = `R$ ${economiaAtual.toFixed(2)}`;
    const metaBarra = document.getElementById('metaBarra');
    metaBarra.style.width = `${Math.min(percentualMeta, 100)}%`;
    metaBarra.classList.toggle('alerta', economiaAtual < 0);
}

// Atualiza o gráfico e o resumo
function atualizarVisualizacoes() {
    const transacoesFiltradas = filtroAtual === 'todos' 
        ? transacoes 
        : transacoes.filter(t => t.tipo === filtroAtual);

    const totalPorCategoria = transacoesFiltradas.reduce((acc, trans) => {
        const valor = trans.tipo === 'despesa' ? -trans.valor : trans.valor;
        acc[trans.categoria] = (acc[trans.categoria] || 0) + valor;
        return acc;
    }, {});

    // Atualiza o gráfico
    grafico.data.labels = Object.keys(totalPorCategoria);
    grafico.data.datasets[0].data = Object.values(totalPorCategoria);
    grafico.update();

    // Atualiza o resumo
    const resumoHTML = Object.entries(totalPorCategoria)
        .map(([categoria, total]) => `
            <div class="resumo-item">
                <span>${categoria}</span>
                <strong>R$ ${Math.abs(total).toFixed(2)}</strong>
            </div>
        `).join('');
    document.getElementById('resumoCategoria').innerHTML = resumoHTML;

    // Atualiza a tabela de histórico
    const historicoHTML = transacoesFiltradas
        .sort((a, b) => b.data - a.data)
        .map(trans => `
            <tr>
                <td>${trans.descricao}</td>
                <td>R$ ${trans.valor.toFixed(2)}</td>
                <td>${trans.categoria}</td>
                <td>${new Date(trans.data).toLocaleDateString()}</td>
                <td>
                    <span class="tipo-transacao ${trans.tipo === 'despesa' ? 'tipo-despesa' : 'tipo-receita'}">
                        ${trans.tipo === 'despesa' ? 'Despesa' : 'Receita'}
                    </span>
                </td>
                <td>
                    <i class="fas fa-trash btn-remover" onclick="removerTransacao(${trans.id})"></i>
                </td>
            </tr>
        `).join('');
    document.getElementById('historicoGastos').innerHTML = historicoHTML;

    // Salva no localStorage
    localStorage.setItem('transacoes', JSON.stringify(transacoes));
    
    // Atualiza os totais
    calcularTotais();
}

// Verifica limites de categoria
function verificarLimites(transacao) {
    if (transacao.tipo === 'despesa') {
        const limite = configuracoes.limitesCategorias[transacao.categoria];
        if (limite) {
            const gastosCategoria = transacoes
                .filter(t => t.tipo === 'despesa' && 
                        t.categoria === transacao.categoria &&
                        t.data > Date.now() - 30 * 24 * 60 * 60 * 1000)
                .reduce((sum, t) => sum + t.valor, 0);
            
            if (gastosCategoria + transacao.valor > limite) {
                return confirm(`Atenção: Essa despesa ultrapassará o limite mensal definido para a categoria ${transacao.categoria}. Deseja continuar?`);
            }
        }
    }
    return true;
}

// Função para remover transação
function removerTransacao(id) {
    if (confirm('Tem certeza que deseja remover esta transação?')) {
        transacoes = transacoes.filter(t => t.id !== id);
        atualizarVisualizacoes();
        calcularEstatisticas();
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o gráfico
    inicializarGrafico();
    
    // Carrega os dados iniciais
    atualizarVisualizacoes();
    calcularEstatisticas();
});

// Formulário de nova transação
document.getElementById('formularioGasto').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const novaTransacao = {
        id: Date.now(),
        descricao: document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        categoria: document.getElementById('categoria').value,
        tipo: document.getElementById('tipo').value,
        data: new Date().getTime()
    };

    if (verificarLimites(novaTransacao)) {
        transacoes.push(novaTransacao);
        atualizarVisualizacoes();
        calcularEstatisticas();
        e.target.reset();
    }
});

// Filtros
document.querySelector('.filtros').addEventListener('click', (e) => {
    if (e.target.classList.contains('filtro-btn')) {
        document.querySelectorAll('.filtro-btn').forEach(btn => btn.classList.remove('ativo'));
        e.target.classList.add('ativo');
        filtroAtual = e.target.dataset.filtro;
        atualizarVisualizacoes();
    }
});

// Modal de Configurações
const btnConfiguracoes = document.querySelector('.btn-configuracoes');
const modal = document.getElementById('modalConfiguracoes');
const btnFechar = document.querySelector('.btn-fechar');

btnConfiguracoes.onclick = () => {
    document.getElementById('metaMensal').value = configuracoes.metaMensal;
    preencherLimitesCategorias();
    modal.style.display = 'flex';
};

btnFechar.onclick = () => {
    modal.style.display = 'none';
};

window.onclick = (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
};

// Funções de configuração
function preencherLimitesCategorias() {
    const categorias = [...new Set(transacoes.map(t => t.categoria))];
    const html = categorias.map(cat => `
        <div class="form-group">
            <label>${cat}</label>
            <input type="number" min="0" step="0.01" 
                   value="${configuracoes.limitesCategorias[cat] || ''}"
                   onchange="atualizarLimiteCategoria('${cat}', this.value)">
        </div>
    `).join('');
    document.getElementById('limitesCategorias').innerHTML = html;
}

function atualizarLimiteCategoria(categoria, valor) {
    configuracoes.limitesCategorias[categoria] = parseFloat(valor) || 0;
    localStorage.setItem('configuracoes', JSON.stringify(configuracoes));
}

// Formulário de configurações
document.getElementById('formConfiguracoes').onsubmit = (e) => {
    e.preventDefault();
    configuracoes.metaMensal = parseFloat(document.getElementById('metaMensal').value) || 0;
    localStorage.setItem('configuracoes', JSON.stringify(configuracoes));
    calcularEstatisticas();
    modal.style.display = 'none';
};
// src/comparisonEngine.js

function runComparison(inventoryItems, reportItems) {
    const resultsContainer = document.getElementById('comparison-results');
    resultsContainer.innerHTML = '<p class="text-center p-4">Processando a comparação...</p>';

    let sessionUnmatched = [...inventoryItems];
    let masterUnmatched = [...reportItems];
    let matches = [];

    // 1. Correspondência exata por Tombo
    sessionUnmatched = sessionUnmatched.filter(sessionItem => {
        if (!sessionItem.tombo || sessionItem.tombo.startsWith('S/T_')) return true;
        const matchIndex = masterUnmatched.findIndex(masterItem => masterItem.tombo === sessionItem.tombo);
        if (matchIndex > -1) {
            const matchedMasterItem = masterUnmatched[matchIndex];
            matches.push({ ...sessionItem, descricaoSistema: matchedMasterItem.descricaoSistema, status: 'ENCONTRADO', matchType: 'Tombo' });
            masterUnmatched.splice(matchIndex, 1);
            return false;
        }
        return true;
    });

    // 2. Correspondência aproximada por Descrição
    sessionUnmatched.forEach(sessionItem => {
         if (masterUnmatched.length > 0) {
            const bestMatch = stringSimilarity.findBestMatch(
                (sessionItem.descricaoInventario || '').toLowerCase(),
                masterUnmatched.map(m => (m.descricaoSistema || '').toLowerCase())
            );
            if (bestMatch.bestMatch.rating > 0.7) {
                const masterItem = masterUnmatched[bestMatch.bestMatchIndex];
                matches.push({ ...sessionItem, status: 'ENCONTRADO (SUGESTÃO)', matchType: 'Descrição Similar', originalMaster: masterItem });
                masterUnmatched.splice(bestMatch.bestMatchIndex, 1);
                const sessionIndex = sessionUnmatched.findIndex(i => i.uuid === sessionItem.uuid);
                if(sessionIndex > -1) sessionUnmatched.splice(sessionIndex, 1);
            }
         }
    });

    const notFound = masterUnmatched.map(item => ({ ...item, status: 'NÃO ENCONTRADO' }));
    const leftovers = sessionUnmatched.map(item => ({ ...item, status: 'SOBRA (NÃO CONSTA NO SISTEMA)' }));

    renderComparisonResults([...matches, ...notFound, ...leftovers]);
}

function renderComparisonResults(results) {
    const container = document.getElementById('comparison-results');
    container.innerHTML = `<h4 class="text-lg font-semibold text-slate-700 border-b pb-2 mb-3">Análise de Itens Encontrados e Faltantes</h4>`;
    if (results.length === 0) {
        container.innerHTML += '<p class="text-center p-4">Nenhum resultado para exibir.</p>';
        return;
    }
    const statusOrder = ['ENCONTRADO', 'ENCONTRADO (SUGESTÃO)', 'NÃO ENCONTRADO', 'SOBRA (NÃO CONSTA NO SISTEMA)'];
    statusOrder.forEach(status => {
        const items = results.filter(r => r.status === status);
        if (items.length > 0) {
            const statusTitle = document.createElement('h5');
            statusTitle.className = 'text-md font-semibold mt-4 mb-2 text-slate-600';
            statusTitle.textContent = `${status} (${items.length})`;
            container.appendChild(statusTitle);
            items.forEach(item => {
                const div = document.createElement('div');
                let colorClass = 'border-slate-300';
                if (status.startsWith('ENCONTRADO')) colorClass = 'border-green-500';
                if (status === 'NÃO ENCONTRADO') colorClass = 'border-red-500';
                if (status.startsWith('SOBRA')) colorClass = 'border-yellow-500';
                div.className = `p-3 border-l-4 ${colorClass} bg-slate-50 mb-2 rounded`;
                let content = `<p class="font-bold">${item.descricaoInventario || item.descricaoSistema}</p><p class="text-sm text-slate-600">Tombo: ${item.tombo}</p>`;
                if (item.status === 'ENCONTRADO (SUGESTÃO)') {
                    content += `<p class="text-xs text-blue-600">Sugestão baseada em: "${item.originalMaster.descricaoSistema}" (Tombo do sistema: ${item.originalMaster.tombo})</p>`;
                }
                div.innerHTML = content;
                container.appendChild(div);
            });
        }
    });
}

// Nova função para a análise de unidade cruzada
function runCrossUnitCheck(inventoryItems, reportItems) {
    const divergentItems = [];
    const reportMap = new Map(reportItems.map(item => [item.tombo, item.unidade]));

    inventoryItems.forEach(invItem => {
        if (invItem.tombo && !invItem.tombo.startsWith('S/T_')) {
            const reportUnit = reportMap.get(invItem.tombo);
            if (reportUnit && reportUnit !== invItem.unidade) {
                divergentItems.push({
                    tombo: invItem.tombo,
                    unidadeRelatorio: reportUnit,
                    unidadeInventario: invItem.unidade
                });
            }
        }
    });
    renderCrossUnitResults(divergentItems);
}

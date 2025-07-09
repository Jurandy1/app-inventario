// src/ui.js

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.add('hidden'));
            tab.classList.add('active');
            document.getElementById(`content-${tab.id.split('-')[1]}`).classList.remove('hidden');
        });
    });
}

function renderFoundItems(items) {
    const listElement = document.getElementById('found-items-list');
    listElement.innerHTML = '';
    if (!items |

| items.length === 0) {
        listElement.innerHTML = '<p class="text-slate-500 text-center p-4">Nenhum item adicionado ainda.</p>';
        return;
    }
    const sortedItems = [...items].sort((a, b) => (b.uuid |

| 0).localeCompare(a.uuid |
| 0));
    sortedItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'p-3 border rounded-md bg-slate-50 text-sm';
        itemDiv.innerHTML = `
            <p class="font-semibold">${item.descricaoInventario}</p>
            <p class="text-slate-600">Tombo: ${item.tombo} | Local: ${item.local}</p>
        `;
        listElement.appendChild(itemDiv);
    });
}

function renderAllLists(datasets) {
    const reportsList = document.getElementById('reports-list');
    const inventoriesList = document.getElementById('inventories-list');
    reportsList.innerHTML = '';
    inventoriesList.innerHTML = '';

    const reports = datasets.filter(ds => ds.type === 'relatorio');
    const inventories = datasets.filter(ds => ds.type === 'inventario');

    if (reports.length === 0) {
        reportsList.innerHTML = '<p class="text-slate-500 text-sm text-center p-2">Nenhum relatório carregado.</p>';
    } else {
        reports.forEach(dataset => addListItem(reportsList, dataset));
    }

    if (inventories.length === 0) {
        inventoriesList.innerHTML = '<p class="text-slate-500 text-sm text-center p-2">Nenhum inventário carregado.</p>';
    } else {
        inventories.forEach(dataset => addListItem(inventoriesList, dataset));
    }

    document.querySelectorAll('.delete-dataset-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const docId = e.target.dataset.id;
            if (confirm('Tem certeza que deseja apagar este conjunto de dados permanentemente?')) {
                await deleteDatasetWithItems('datasets', docId);
            }
        });
    });
}

function addListItem(list, dataset) {
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center p-2 bg-slate-50 rounded';
    li.innerHTML = `
        <div>
            <span class="font-medium">${dataset.name}</span>
            <span class="text-xs text-slate-500 ml-2">(${dataset.itemCount} itens)</span>
        </div>
        <button data-id="${dataset.id}" class="delete-dataset-btn text-red-400 hover:text-red-600 text-lg font-bold">&times;</button>
    `;
    list.appendChild(li);
}

function populateComparisonSelects(datasets) {
    const reportSelect = document.getElementById('select-report');
    const inventorySelect = document.getElementById('select-inventory');
    
    const currentReportVal = reportSelect.value;
    const currentInventoryVal = inventorySelect.value;

    reportSelect.innerHTML = '';
    inventorySelect.innerHTML = '';

    inventorySelect.add(new Option("-- Coleta ao Vivo --", "live_session"));

    const reports = datasets.filter(ds => ds.type === 'relatorio');
    const inventories = datasets.filter(ds => ds.type === 'inventario');

    if (reports.length === 0) {
        reportSelect.add(new Option("Carregue um Relatório...", "", true, true));
        reportSelect.disabled = true;
    } else {
        reportSelect.disabled = false;
        reportSelect.add(new Option("Selecione um Relatório...", ""));
        reports.forEach(ds => reportSelect.add(new Option(ds.name, ds.id)));
    }

    if (inventories.length > 0) {
        inventories.forEach(ds => inventorySelect.add(new Option(ds.name, ds.id)));
    }
    
    reportSelect.value = currentReportVal;
    inventorySelect.value = currentInventoryVal;
}

function renderCrossUnitResults(items) {
    const container = document.getElementById('cross-unit-results-container');
    container.innerHTML = `
        <h4 class="text-lg font-semibold text-amber-700 border-b pb-2 mb-3">Análise de Unidade Cruzada</h4>
    `;
    if (items.length === 0) {
        container.innerHTML += '<p class="text-sm text-slate-600">Nenhuma divergência de unidade encontrada.</p>';
        return;
    }
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-3 border-l-4 border-amber-500 bg-amber-50 mb-2 rounded';
        div.innerHTML = `
            <p class="font-bold">Tombo: ${item.tombo}</p>
            <p class="text-sm">Unidade no Relatório: <span class="font-medium text-red-600">${item.unidadeRelatorio}</span></p>
            <p class="text-sm">Unidade no Inventário: <span class="font-medium text-green-600">${item.unidadeInventario}</span></p>
        `;
        container.appendChild(div);
    });
}

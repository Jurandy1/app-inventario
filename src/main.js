// src/main.js

document.addEventListener('DOMContentLoaded', async () => {
    
    const firebaseConfig = {
      apiKey: "AIzaSyDw03dQOq_9st4qArSkTXNDM74mvq6sEAI",
      authDomain: "painel-inventario-online.firebaseapp.com",
      projectId: "painel-inventario-online",
      storageBucket: "painel-inventario-online.firebasestorage.app",
      messagingSenderId: "822916700228",
      appId: "1:822916700228:web:f28cc2acc96fc3fde90411"
    };

    const DATASETS_COLLECTION = 'datasets';
    const SESSION_COLLECTION = 'sessionInventory';

    let state = {
        datasets: [],
        liveSessionItems: [],
        userId: null,
        unsubscribeLiveSession: null,
        unsubscribeDatasets: null,
    };

    // --- INICIALIZAÇÃO ---
    try {
        const { userId } = await initFirebase(firebaseConfig);
        state.userId = userId;
        document.getElementById('loading-overlay').style.display = 'none';
        document.getElementById('connection-status').textContent = 'Conectado';
        document.getElementById('connection-status').className = 'font-bold text-green-500';
        document.getElementById('user-id').textContent = `ID: ${userId.substring(0, 8)}...`;
        
        initializeListeners();
    } catch (error) {
        console.error("Falha na inicialização:", error);
    }
    
    function initializeListeners() {
        if (state.unsubscribeDatasets) state.unsubscribeDatasets();
        state.unsubscribeDatasets = listenToCollection(DATASETS_COLLECTION, (datasets) => {
            state.datasets = datasets;
            renderAllLists(datasets);
            populateComparisonSelects(datasets);
        });

        if (state.unsubscribeLiveSession) state.unsubscribeLiveSession();
        state.unsubscribeLiveSession = listenToCollection(SESSION_COLLECTION, (items) => {
            state.liveSessionItems = items;
            renderFoundItems(items);
            updateSessionHeader(items);
        });
    }

    // --- CONFIGURAÇÃO DA UI ---
    setupTabs();
    setupForm(handleAddItem, handleClearField);
    setupCsvListener('upload-report-form', 'system-csv-input', 'import-system-status', (data, form) => handleDatasetUpload(data, 'relatorio', form));
    setupCsvListener('upload-inventory-form', 'inventory-csv-input', 'import-inventory-status', (data, form) => handleDatasetUpload(data, 'inventario', form));
    document.getElementById('run-comparison-btn').addEventListener('click', handleRunComparison);
    document.getElementById('clear-session-btn').addEventListener('click', handleClearSession);

    // --- FUNÇÕES DE MANIPULAÇÃO DE DADOS ---

    async function handleAddItem(item, quantity) {
        const unidadeInput = document.getElementById('item-unidade');
        const localInput = document.getElementById('item-local');
        
        const batch = db.batch();
        for (let i = 0; i < quantity; i++) {
            const newItem = { ...item };
            const docId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            newItem.uuid = docId;
            const docRef = db.collection(SESSION_COLLECTION).doc(docId);
            batch.set(docRef, newItem);
        }
        await batch.commit();

        unidadeInput.disabled = true;
        localInput.disabled = true;
        document.getElementById('clear-unidade-btn').classList.remove('hidden');
        document.getElementById('clear-local-btn').classList.remove('hidden');
    }

    function handleClearField(fieldId) {
        const input = document.getElementById(fieldId);
        input.disabled = false;
        input.value = '';
        document.getElementById(`clear-${fieldId.split('-')[1]}-btn`).classList.add('hidden');
        input.focus();
    }

    async function handleDatasetUpload(csvData, type, form) {
        const statusEl = form.querySelector('div[id^="import-"]');
        const nameInputId = type === 'relatorio' ? 'new-report-name' : 'new-inventory-name';
        const name = document.getElementById(nameInputId).value;
        if (!name) {
            alert('Por favor, dê um nome ao arquivo.');
            return;
        }

        const items = csvData.map((row, index) => {
            if (type === 'relatorio') {
                return {
                    unidade: row.UNIDADE,
                    tombo: String(row.TOMBAMENTO || `S/T_REL_${index}`),
                    descricaoSistema: row['Descrição'] || row.Descricao,
                    fonte: 'SISTEMA'
                };
            } else {
                const tombo = row.Tombo || row.tombo;
                return {
                    unidade: row.UNIDADE || row.unidade,
                    local: row.Local || row.local,
                    descricaoInventario: row.Item || row.item,
                    tombo: String(tombo).trim().toUpperCase() === 'S/T' ? `S/T_${Date.now()}` : String(tombo).trim(),
                    estadoConservacao: row['Estado de Conservação'] || row.estado,
                    fonte: 'INVENTARIO'
                };
            }
        });

        const datasetMetadata = {
            name: name,
            type: type,
            itemCount: items.length,
            createdAt: new Date().toISOString(),
        };

        const docId = `${type}_${Date.now()}`;

        try {
            statusEl.textContent = 'Salvando metadados...';
            await saveDocument(DATASETS_COLLECTION, docId, datasetMetadata);

            const batchSize = 400; // Limite do Firestore é 500, usamos 400 por segurança.
            for (let i = 0; i < items.length; i += batchSize) {
                const batchItems = items.slice(i, i + batchSize);
                statusEl.textContent = `Salvando itens ${i + 1} a ${i + batchItems.length}...`;
                await saveItemsToSubcollection(DATASETS_COLLECTION, docId, 'items', batchItems);
            }
            
            statusEl.textContent = 'Upload concluído com sucesso!';
            statusEl.className = 'text-green-600';
            form.reset();
            document.getElementById('tab-comparacao').click();

        } catch (error) {
            console.error("ERRO AO CARREGAR O DATASET:", error);
            statusEl.textContent = 'Erro ao salvar. Verifique o console (F12).';
            statusEl.className = 'text-red-500';
            await deleteDatasetWithItems(DATASETS_COLLECTION, docId);
        }
    }
    
    async function handleRunComparison() {
        const reportId = document.getElementById('select-report').value;
        const inventoryId = document.getElementById('select-inventory').value;

        if (!reportId || !inventoryId) {
            alert('Por favor, selecione um relatório e um inventário para comparar.');
            return;
        }

        document.getElementById('analysis-results-container').classList.add('hidden');
        
        const reportDataset = await getDatasetWithItems(DATASETS_COLLECTION, reportId);
        
        let inventoryDataset;
        if (inventoryId === 'live_session') {
            inventoryDataset = { name: 'Coleta ao Vivo', items: state.liveSessionItems };
        } else {
            inventoryDataset = await getDatasetWithItems(DATASETS_COLLECTION, inventoryId);
        }

        if (!reportDataset || !reportDataset.items || !inventoryDataset || !inventoryDataset.items) {
            alert('Não foi possível carregar os dados completos para a comparação.');
            return;
        }

        document.getElementById('analysis-results-container').classList.remove('hidden');
        runComparison(inventoryDataset.items, reportDataset.items);
        runCrossUnitCheck(inventoryDataset.items, reportDataset.items);
    }

    async function handleClearSession() {
        if (confirm('Tem certeza que deseja apagar TODOS os itens da coleta ao vivo? Esta ação não pode ser desfeita.')) {
            await clearCollection(SESSION_COLLECTION);
        }
    }
    
    function updateSessionHeader(items) {
        const unidadeInput = document.getElementById('item-unidade');
        if (items.length > 0 && !unidadeInput.disabled) {
            const lastUnit = items[items.length - 1].unidade;
            unidadeInput.value = lastUnit;
        }
    }
});

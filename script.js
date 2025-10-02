<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DIRETORIA TÉCNICA DE ALMOXARIFADO E PATRIMÔNIO - SEMCAS</title>
    
    <!-- Scripts e Links -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js" defer></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Estilos -->
    <style>
        :root {
            --primary-blue: #1e40af;
            --secondary-blue: #3b82f6;
            --light-blue: #60a5fa;
            --success: #10b981;
            --warning: #f59e0b;
            --error: #ef4444;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: #f1f5f9;
        }

        .card {
            background: white;
            border-radius: 0.75rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            padding: 1.5rem;
            transition: all 0.3s ease;
        }
        .table button {
            opacity: 0;
            transition: opacity 0.2s ease-in-out;
        }
        .table tr:hover button {
            opacity: 1;
        }
        .alert { padding: 1rem; border-radius: 0.5rem; border: 1px solid; }
        .alert-error { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .badge-green { background: #d1fae5; color: #059669; }
        .badge-blue { background: #dbeafe; color: #2563eb; }
        .badge-yellow { background: #fef3c7; color: #d97706; }
        .badge-red { background: #fee2e2; color: #dc2626; }

        .header-banner {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .nav-btn {
            padding: 0.75rem 1rem;
            border-bottom: 3px solid transparent;
            transition: all 0.2s ease;
            font-weight: 600;
            color: #475569;
            white-space: nowrap;
        }
        .nav-btn:hover { background-color: #f8fafc; }
        .nav-btn.active { color: var(--secondary-blue); border-bottom-color: var(--secondary-blue); }

        .loading-spinner {
            border: 5px solid #e5e7eb;
            border-top: 5px solid var(--secondary-blue);
            border-radius: 50%;
            width: 50px;
            height: 50px;
            animation: spin 1s linear infinite;
            margin: auto;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .fade-in { animation: fadeIn 0.4s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .modal-overlay { transition: opacity 0.3s ease; }
        .modal-container { transition: all 0.3s ease; max-height: 90vh; }
        .chart-container { position: relative; width: 100%; height: 350px; }
    </style>
</head>
<body class="text-slate-700 antialiased">

    <!-- Header -->
    <header class="header-banner sticky top-0 z-50 text-white p-4">
        <div class="container mx-auto flex items-center gap-4">
            <img src="https://www.saoluis.ma.gov.br/img/logo_mobile.png" alt="Logo Prefeitura" class="h-14 bg-white p-1 rounded-md shadow-md">
            <div>
                <h1 class="text-xl md:text-2xl font-bold leading-tight">Diretoria de Almoxarifado e Patrimônio</h1>
                <p class="text-sm opacity-90">SEMCAS - São Luís</p>
            </div>
        </div>
    </header>

    <!-- Sub-Header de Status -->
    <div class="bg-white shadow-sm border-b border-slate-200">
        <div class="container mx-auto px-4 py-3 flex justify-between items-center">
            <h2 class="font-bold text-lg text-slate-800">Sistema de Patrimônio <span class="text-sm font-normal">v.4.0 (Firebase)</span></h2>
            <div id="connectionStatus" class="flex items-center gap-2 font-semibold text-sm"></div>
        </div>
    </div>

    <!-- Navegação por Abas -->
    <nav class="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky z-40 top-[92px] md:top-[88px]">
        <div class="container mx-auto px-4">
            <div class="flex space-x-1 overflow-x-auto">
                <button class="nav-btn" data-tab="patrimonio">💼 Patrimônio</button>
                <button class="nav-btn" data-tab="dashboard">📊 Dashboard</button>
            </div>
        </div>
    </nav>

    <!-- Conteúdo Principal -->
    <main class="container mx-auto p-4 sm:p-6 lg:p-8">
        
        <!-- Dashboard -->
        <div id="content-dashboard" class="hidden fade-in">
            <div id="dashboard-content-area">
                <div class="card text-center"><div class="loading-spinner"></div><p class="mt-4">Carregando dashboard...</p></div>
            </div>
        </div>

        <!-- Patrimônio -->
        <div id="content-patrimonio" class="hidden fade-in">
             <div class="card mb-8">
                <!-- Filtros e Busca -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div><label for="filtro-servico" class="block text-sm font-medium mb-1">Tipo</label><select id="filtro-servico" class="w-full p-2 border rounded-lg"><option value="">TODOS</option><option value="CONSELHO">CONSELHO</option><option value="CRAS">CRAS</option><option value="CREAS">CREAS</option><option value="UNIDADE EXTERNA">UNIDADE EXTERNA</option><option value="CENTRO POP">CENTRO POP</option><option value="ABRIGO">ABRIGO</option><option value="SEDE">SEDE</option></select></div>
                    <div><label for="filtro-unidade" class="block text-sm font-medium mb-1">Unidade</label><select id="filtro-unidade" class="w-full p-2 border rounded-lg"><option value="">TODAS</option></select></div>
                    <div><label for="filtro-estado" class="block text-sm font-medium mb-1">Estado</label><select id="filtro-estado" class="w-full p-2 border rounded-lg"><option value="">TODOS</option><option value="Novo">NOVO</option><option value="Bom">BOM</option><option value="Regular">REGULAR</option><option value="Avariado">AVARIADO</option></select></div>
                    <div><label for="filtro-busca" class="block text-sm font-medium mb-1">Busca Geral</label><input type="text" id="filtro-busca" placeholder="Buscar..." class="w-full p-2 border rounded-lg"></div>
                </div>
            </div>
            <!-- Botões de Ação -->
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Inventário</h2>
                <button id="open-add-modal-btn" class="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>
                    Adicionar Item
                </button>
            </div>
            <main id="main-content-area" class="mt-2"></main>
        </div>
    </main>

    <!-- Modal para Adicionar/Editar Item -->
    <div id="item-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 hidden">
        <div id="modal-overlay" class="absolute inset-0 bg-black/60 opacity-0"></div>
        <div class="modal-container bg-white w-full max-w-2xl rounded-lg shadow-2xl flex flex-col transform scale-95 opacity-0">
            <form id="item-form">
                <input type="hidden" id="itemId">
                <div class="flex items-center justify-between p-4 border-b">
                    <h3 id="modal-title" class="text-xl font-semibold">Adicionar Novo Item</h3>
                    <button type="button" id="close-modal-btn" class="p-2 rounded-full hover:bg-slate-200">&times;</button>
                </div>
                <div class="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto">
                    <div><label for="tombamento" class="block text-sm font-medium mb-1">Tombamento</label><input type="text" id="tombamento" class="w-full p-2 border rounded-lg" placeholder="S/T para sem tombo"></div>
                    <div><label for="tipo" class="block text-sm font-medium mb-1">Tipo</label><select id="tipo" class="w-full p-2 border rounded-lg"><option value="CONSELHO">CONSELHO</option><option value="CRAS">CRAS</option><option value="CREAS">CREAS</option><option value="UNIDADE EXTERNA">UNIDADE EXTERNA</option><option value="CENTRO POP">CENTRO POP</option><option value="ABRIGO">ABRIGO</option><option value="SEDE">SEDE</option><option value="OUTRO">OUTRO</option></select></div>
                    <div class="md:col-span-2"><label for="descricao" class="block text-sm font-medium mb-1">Descrição</label><input type="text" id="descricao" class="w-full p-2 border rounded-lg" required></div>
                    <div><label for="unidade" class="block text-sm font-medium mb-1">Unidade</label><input type="text" id="unidade" class="w-full p-2 border rounded-lg" required></div>
                    <div><label for="localizacao" class="block text-sm font-medium mb-1">Localização na Unidade</label><input type="text" id="localizacao" class="w-full p-2 border rounded-lg"></div>
                    <div><label for="estado" class="block text-sm font-medium mb-1">Estado</label><select id="estado" class="w-full p-2 border rounded-lg"><option value="Novo">Novo</option><option value="Bom">Bom</option><option value="Regular">Regular</option><option value="Avariado">Avariado</option></select></div>
                    <div><label for="fornecedor" class="block text-sm font-medium mb-1">Fornecedor</label><input type="text" id="fornecedor" class="w-full p-2 border rounded-lg"></div>
                    <div class="md:col-span-2"><label for="observacao" class="block text-sm font-medium mb-1">Observação</label><textarea id="observacao" rows="2" class="w-full p-2 border rounded-lg"></textarea></div>
                </div>
                <div class="flex justify-end p-4 border-t bg-slate-50 rounded-b-lg space-x-2">
                    <button type="button" id="cancel-btn" class="px-4 py-2 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300">Cancelar</button>
                    <button type="submit" id="save-btn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Salvar</button>
                </div>
            </form>
        </div>
    </div>


    <script type="module">
        // Importações do Firebase SDK
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setLogLevel } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

        // =================================================================
        // CONFIGURAÇÃO DO FIREBASE
        // =================================================================
        // ATENÇÃO: Substitua o objeto abaixo pela configuração do seu projeto Firebase
        const firebaseConfig = {
            apiKey: "SUA_API_KEY",
            authDomain: "SEU_AUTH_DOMAIN",
            projectId: "SEU_PROJECT_ID",
            storageBucket: "SEU_STORAGE_BUCKET",
            messagingSenderId: "SEU_MESSAGING_SENDER_ID",
            appId: "SEU_APP_ID"
        };

        // Inicializa Firebase
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        setLogLevel('debug'); // Use 'debug' para ver logs detalhados no console

        // =================================================================
        // LÓGICA PRINCIPAL DA APLICAÇÃO
        // =================================================================
        document.addEventListener('DOMContentLoaded', () => {

            let allItems = []; // Armazena todos os itens do Firestore
            let currentPage = 1;
            const itemsPerPage = 25;
            let dashboardChartInstance;

            // --- Seletores de Elementos DOM ---
            const navButtons = document.querySelectorAll('.nav-btn');
            const contentPanes = document.querySelectorAll('main > div[id^="content-"]');
            const connectionStatusEl = document.getElementById('connectionStatus');
            const mainContentAreaEl = document.getElementById('main-content-area');
            
            // Filtros
            const filtroServicoEl = document.getElementById('filtro-servico');
            const filtroUnidadeEl = document.getElementById('filtro-unidade');
            const filtroEstadoEl = document.getElementById('filtro-estado');
            const filtroBuscaEl = document.getElementById('filtro-busca');

            // Modal
            const itemModal = document.getElementById('item-modal');
            const modalOverlay = document.getElementById('modal-overlay');
            const closeModalBtn = document.getElementById('close-modal-btn');
            const openAddModalBtn = document.getElementById('open-add-modal-btn');
            const cancelBtn = document.getElementById('cancel-btn');
            const itemForm = document.getElementById('item-form');
            const modalTitle = document.getElementById('modal-title');
            
            const stateColors = { 'Novo': '#16a34a', 'Bom': '#2563eb', 'Regular': '#facc15', 'Avariado': '#dc2626' };

            // --- FUNÇÕES AUXILIARES ---
            const debounce = (func, delay) => { let t; return function(...a) { clearTimeout(t); t = setTimeout(() => func.apply(this, a), delay); }; };

            // --- LÓGICA DE NAVEGAÇÃO E RENDERIZAÇÃO ---
            function switchTab(tabName) {
                navButtons.forEach(btn => btn.classList.remove('active'));
                document.querySelector(`.nav-btn[data-tab="${tabName}"]`).classList.add('active');
                contentPanes.forEach(pane => pane.classList.add('hidden'));
                document.getElementById(`content-${tabName}`).classList.remove('hidden');

                if (tabName === 'dashboard') renderDashboard();
                if (tabName === 'patrimonio') renderFilteredItems();
            }

            function getFilteredItems() {
                const tipo = filtroServicoEl.value;
                const unidade = filtroUnidadeEl.value;
                const estado = filtroEstadoEl.value;
                const busca = filtroBuscaEl.value.toLowerCase();

                return allItems.filter(item => 
                    (!tipo || item.tipo === tipo) &&
                    (!unidade || item.unidade === unidade) &&
                    (!estado || item.estado === estado) &&
                    (!busca || Object.values(item).some(val => String(val).toLowerCase().includes(busca)))
                );
            }

            function renderFilteredItems() {
                currentPage = 1;
                renderApp();
            }

            function renderApp() {
                const currentFilteredData = getFilteredItems();
                renderTable(currentFilteredData);
            }

            function renderTable(itemsToDisplay) {
                const totalItems = itemsToDisplay.length;
                const totalPages = Math.ceil(totalItems / itemsPerPage);
                const paginatedItems = itemsToDisplay.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

                if (totalItems === 0) {
                     mainContentAreaEl.innerHTML = `<div class="card text-center p-10"><p class="text-slate-500">Nenhum item encontrado para os filtros selecionados.</p></div>`;
                     return;
                }

                mainContentAreaEl.innerHTML = `
                    <div class="card p-0 overflow-x-auto">
                        <table class="table w-full text-sm">
                            <thead>
                                <tr class="bg-slate-50">
                                    <th class="p-4 text-left">Tomb.</th>
                                    <th class="p-4 text-left">Descrição</th>
                                    <th class="p-4 text-left">Unidade</th>
                                    <th class="p-4 text-left">Local</th>
                                    <th class="p-4 text-left">Estado</th>
                                    <th class="p-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody id="inventory-table-body">
                                ${paginatedItems.map(item => `
                                    <tr class="border-b border-slate-200 hover:bg-slate-50">
                                        <td class="p-4 font-mono text-xs">${item.tombamento || 'S/T'}</td>
                                        <td class="p-4 font-medium text-slate-900">${item.descricao}</td>
                                        <td class="p-4">${item.unidade}</td>
                                        <td class="p-4">${item.localizacao || 'N/A'}</td>
                                        <td class="p-4"><span class="badge" style="background-color: ${stateColors[item.estado]}20; color: ${stateColors[item.estado]}">${item.estado}</span></td>
                                        <td class="p-4 text-center">
                                             <button data-action="edit" data-id="${item.id}" class="p-1 text-blue-600 hover:text-blue-800" title="Editar">✏️</button>
                                             <button data-action="delete" data-id="${item.id}" class="p-1 text-red-600 hover:text-red-800" title="Excluir">🗑️</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div id="pagination-controls" class="flex items-center justify-between mt-6">
                        <span class="text-sm text-slate-600">Mostrando ${Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} a ${Math.min(currentPage * itemsPerPage, totalItems)} de ${totalItems}</span>
                        <div class="inline-flex">
                            <button data-page="${currentPage - 1}" class="px-4 py-2 text-sm border rounded-l-lg hover:bg-slate-100 disabled:opacity-50" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
                            <button data-page="${currentPage + 1}" class="px-4 py-2 text-sm border rounded-r-lg hover:bg-slate-100 disabled:opacity-50" ${currentPage === totalPages ? 'disabled' : ''}>Próximo</button>
                        </div>
                    </div>
                `;
            }

            function renderDashboard() {
                const dashboardContentArea = document.getElementById('dashboard-content-area');
                if (allItems.length === 0) {
                     dashboardContentArea.innerHTML = `<div class="card text-center"><p>Nenhum dado para exibir.</p></div>`;
                     return;
                }

                const totalItens = allItems.length;
                const totalUnidades = new Set(allItems.map(i => i.unidade)).size;
                const totalAvariados = allItems.filter(i => i.state === 'Avariado').length;

                dashboardContentArea.innerHTML = `
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        <div class="card text-center"><p class="text-sm text-slate-500 uppercase">Total de Itens</p><p class="text-4xl font-bold text-blue-600 mt-2">${totalItens}</p></div>
                        <div class="card text-center"><p class="text-sm text-slate-500 uppercase">Unidades Mapeadas</p><p class="text-4xl font-bold text-blue-600 mt-2">${totalUnidades}</p></div>
                        <div class="card text-center"><p class="text-sm text-slate-500 uppercase">Itens Avariados</p><p class="text-4xl font-bold text-red-600 mt-2">${totalAvariados}</p></div>
                    </div>
                    <div class="card">
                        <h3 class="text-lg font-semibold text-slate-800 mb-4">Distribuição por Estado</h3>
                        <div class="chart-container" style="height: 400px;"><canvas id="dashboardEstadoChart"></canvas></div>
                    </div>
                `;
                
                if(dashboardChartInstance) dashboardChartInstance.destroy();
                const chartData = ['Novo', 'Bom', 'Regular', 'Avariado'].map(state => allItems.filter(i => i.estado === state).length);
                dashboardChartInstance = new Chart(document.getElementById('dashboardEstadoChart'), { 
                    type: 'doughnut', 
                    data: { 
                        labels: ['Novo', 'Bom', 'Regular', 'Avariado'], 
                        datasets: [{ 
                            data: chartData, 
                            backgroundColor: Object.values(stateColors)
                        }] 
                    }, 
                    options: { responsive: true, maintainAspectRatio: false } 
                });
            }


            // --- LÓGICA DO MODAL (ADICIONAR/EDITAR) ---
            const openModal = (item = null) => {
                itemForm.reset();
                if (item) {
                    modalTitle.textContent = 'Editar Item';
                    document.getElementById('itemId').value = item.id;
                    document.getElementById('tombamento').value = item.tombamento || '';
                    document.getElementById('tipo').value = item.tipo || 'OUTRO';
                    document.getElementById('descricao').value = item.descricao || '';
                    document.getElementById('unidade').value = item.unidade || '';
                    document.getElementById('localizacao').value = item.localizacao || '';
                    document.getElementById('estado').value = item.estado || 'Regular';
                    document.getElementById('fornecedor').value = item.fornecedor || '';
                    document.getElementById('observacao').value = item.observacao || '';
                } else {
                    modalTitle.textContent = 'Adicionar Novo Item';
                    document.getElementById('itemId').value = '';
                }
                itemModal.classList.remove('hidden');
                setTimeout(() => {
                    modalOverlay.classList.remove('opacity-0');
                    itemModal.querySelector('.modal-container').classList.remove('scale-95', 'opacity-0');
                }, 10);
            };

            const closeModal = () => {
                itemModal.querySelector('.modal-container').classList.add('scale-95', 'opacity-0');
                modalOverlay.classList.add('opacity-0');
                setTimeout(() => itemModal.classList.add('hidden'), 300);
            };
            
            async function handleFormSubmit(e) {
                e.preventDefault();
                const id = document.getElementById('itemId').value;
                const itemData = {
                    tombamento: document.getElementById('tombamento').value || 'S/T',
                    tipo: document.getElementById('tipo').value,
                    descricao: document.getElementById('descricao').value,
                    unidade: document.getElementById('unidade').value,
                    localizacao: document.getElementById('localizacao').value,
                    estado: document.getElementById('estado').value,
                    fornecedor: document.getElementById('fornecedor').value,
                    observacao: document.getElementById('observacao').value,
                };
                
                try {
                    if (id) {
                        await updateDoc(doc(db, "patrimonio", id), itemData);
                    } else {
                        await addDoc(collection(db, "patrimonio"), itemData);
                    }
                    closeModal();
                } catch (error) {
                    console.error("Erro ao salvar item: ", error);
                    alert("Ocorreu um erro ao salvar. Verifique o console.");
                }
            }
            
            async function handleDeleteItem(id) {
                if (confirm('Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.')) {
                    try {
                        await deleteDoc(doc(db, "patrimonio", id));
                    } catch (error) {
                         console.error("Erro ao excluir item: ", error);
                        alert("Ocorreu um erro ao excluir. Verifique o console.");
                    }
                }
            }


            // --- EVENT LISTENERS ---
            navButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));
            [filtroServicoEl, filtroUnidadeEl, filtroEstadoEl].forEach(el => el.addEventListener('change', renderFilteredItems));
            filtroBuscaEl.addEventListener('input', debounce(renderFilteredItems, 400));
            
            // Listeners para paginação e ações na tabela
            mainContentAreaEl.addEventListener('click', (e) => {
                // Paginação
                const pageButton = e.target.closest('[data-page]');
                if (pageButton) {
                    currentPage = parseInt(pageButton.dataset.page);
                    renderApp();
                    return;
                }
                
                // Ações de Editar/Excluir
                const actionButton = e.target.closest('[data-action]');
                if (actionButton) {
                    const { action, id } = actionButton.dataset;
                    if (action === 'edit') {
                        const itemToEdit = allItems.find(item => item.id === id);
                        openModal(itemToEdit);
                    } else if (action === 'delete') {
                        handleDeleteItem(id);
                    }
                }
            });


            // Listeners do Modal
            openAddModalBtn.addEventListener('click', () => openModal());
            closeModalBtn.addEventListener('click', closeModal);
            modalOverlay.addEventListener('click', closeModal);
            cancelBtn.addEventListener('click', closeModal);
            itemForm.addEventListener('submit', handleFormSubmit);

            // --- INICIALIZAÇÃO E CONEXÃO COM FIREBASE ---
            connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-yellow-400 rounded-full animate-pulse"></span> <span>Conectando...</span>`;
            
            try {
                const itemsCollection = collection(db, "patrimonio");
                onSnapshot(itemsCollection, (snapshot) => {
                    connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-green-500 rounded-full"></span> <span>Conectado em tempo real</span>`;
                    
                    allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                    // Popula filtro de unidades dinamicamente
                    const unidades = [...new Set(allItems.map(item => item.unidade))].sort();
                    filtroUnidadeEl.innerHTML = '<option value="">TODAS</option>' + unidades.map(u => `<option value="${u}">${u}</option>`).join('');

                    // Re-renderiza a visualização ativa
                    const activeTab = document.querySelector('.nav-btn.active')?.dataset.tab || 'patrimonio';
                    if (activeTab === 'patrimonio') {
                        renderApp();
                    } else if (activeTab === 'dashboard') {
                        renderDashboard();
                    }

                }, (error) => {
                    console.error("Erro ao buscar dados do Firestore: ", error);
                    connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-red-500 rounded-full"></span> <span class="text-red-500">Erro de Conexão</span>`;
                    mainContentAreaEl.innerHTML = `<div class="alert alert-error"><strong>Erro:</strong> Não foi possível carregar os dados. Verifique as regras de segurança do Firestore e a configuração do projeto.</div>`;
                });

            } catch(error) {
                console.error("Erro na configuração do Firebase: ", error);
                connectionStatusEl.innerHTML = `<span class="h-3 w-3 bg-red-500 rounded-full"></span> <span class="text-red-500">Erro de Configuração</span>`;
                mainContentAreaEl.innerHTML = `<div class="alert alert-error"><strong>Erro Crítico:</strong> Verifique se as credenciais do Firebase no arquivo HTML estão corretas.</div>`;
            }

            // Inicia na aba de patrimônio
            switchTab('patrimonio');
        });
    </script>
</body>
</html>

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

        /* Componentes reusáveis */
        .card {
            background: white;
            border-radius: 0.75rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            padding: 1.5rem;
            transition: all 0.3s ease;
        }
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .alert { padding: 1rem; border-radius: 0.5rem; border: 1px solid; }
        .alert-error { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
        .badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
        .badge-green { background: #d1fae5; color: #059669; }
        .badge-blue { background: #dbeafe; color: #2563eb; }
        .badge-yellow { background: #fef3c7; color: #d97706; }
        .badge-red { background: #fee2e2; color: #dc2626; }

        /* Header */
        .header-banner {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        /* Navegação */
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

        /* Animações */
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

        /* Estilos específicos das abas... (mantidos da versão anterior) */
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
            <h2 class="font-bold text-lg text-slate-800">Sistema de Patrimônio <span class="text-sm font-normal">v.4.0 Firebase</span></h2>
            <div class="flex items-center space-x-4 text-sm">
                <div id="connectionStatus" class="flex items-center gap-2 font-semibold"></div>
            </div>
        </div>
    </div>

    <!-- Navegação por Abas -->
    <nav class="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky z-40 top-[92px] md:top-[88px]">
        <div class="container mx-auto px-4">
            <div class="flex space-x-1 overflow-x-auto">
                <button class="nav-btn" data-tab="dashboard">📊 Dashboard</button>
                <button class="nav-btn" data-tab="patrimonio">💼 Patrimônio</button>
                <button class="nav-btn" data-tab="estoque">📦 Estoque</button>
            </div>
        </div>
    </nav>

    <!-- Conteúdo Principal -->
    <main class="container mx-auto p-4 sm:p-6 lg:p-8">
        
        <!-- Dashboard -->
        <div id="content-dashboard" class="hidden fade-in">
            <!-- Conteúdo do Dashboard (mantido) -->
             <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="card text-center"><p class="text-sm text-slate-500 uppercase">Total de Itens</p><p id="kpi-total-itens" class="text-4xl font-bold text-blue-600 mt-2">0</p></div>
                <div class="card text-center"><p class="text-sm text-slate-500 uppercase">Unidades Mapeadas</p><p id="kpi-total-unidades" class="text-4xl font-bold text-blue-600 mt-2">0</p></div>
                <div class="card text-center"><p class="text-sm text-slate-500 uppercase">Itens Avariados</p><p id="kpi-total-avariados" class="text-4xl font-bold text-red-600 mt-2">0</p></div>
                <div class="card text-center"><p class="text-sm text-slate-500 uppercase">Itens Novos</p><p id="kpi-total-novos" class="text-4xl font-bold text-green-600 mt-2">0</p></div>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-2 card"><h3 class="text-lg font-semibold text-slate-800 mb-4">Distribuição por Estado</h3><div class="chart-container" style="height: 400px;"><canvas id="dashboardEstadoChart"></canvas></div></div>
                <div class="card"><h3 class="text-lg font-semibold text-slate-800 mb-4">Distribuição por Tipo</h3><div class="chart-container" style="height: 400px;"><canvas id="dashboardTipoChart"></canvas></div></div>
            </div>
        </div>

        <!-- Patrimônio -->
        <div id="content-patrimonio" class="hidden fade-in">
             <div class="card mb-8">
                <!-- Filtros -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div><label for="filtro-tipo" class="block text-sm font-medium mb-1">Tipo</label><select id="filtro-tipo" class="w-full p-2 border rounded-lg"></select></div>
                    <div><label for="filtro-unidade" class="block text-sm font-medium mb-1">Unidade</label><select id="filtro-unidade" class="w-full p-2 border rounded-lg"></select></div>
                    <div><label for="filtro-estado" class="block text-sm font-medium mb-1">Estado</label><select id="filtro-estado" class="w-full p-2 border rounded-lg"></select></div>
                    <div><label for="filtro-doacao" class="block text-sm font-medium mb-1">Origem</label><select id="filtro-doacao" class="w-full p-2 border rounded-lg"><option value="">TODAS</option><option value="sim">DOAÇÕES</option><option value="nao">PRÓPRIOS</option></select></div>
                </div>
                 <div class="mt-4">
                    <label for="filtro-busca" class="block text-sm font-medium mb-1">Busca Geral</label>
                    <input type="text" id="filtro-busca" placeholder="Buscar por descrição, tombamento, local, etc..." class="w-full p-2 border rounded-lg">
                </div>
            </div>
             <!-- Botões de Ação -->
            <div class="flex justify-between items-center mb-6">
                <button id="add-item-btn" class="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/></svg>
                    Adicionar Novo Item
                </button>
                <button id="export-pdf-btn" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm disabled:opacity-50" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/></svg>
                    Exportar para PDF
                </button>
            </div>
            <main id="main-content-area" class="mt-2"></main>
        </div>

        <!-- Estoque (Pode ser integrado futuramente) -->
        <div id="content-estoque" class="hidden fade-in">
            <div class="card text-center">
                <h2 class="text-xl font-bold">Módulo de Estoque</h2>
                <p class="mt-2 text-slate-600">Este módulo pode ser integrado com o Firebase futuramente.</p>
            </div>
        </div>

    </main>

    <!-- Rodapé -->
    <footer class="text-center mt-12 mb-6 text-sm text-slate-500">
        <p>Painel desenvolvido por: Jurandy | SEMCAS</p>
    </footer>

    <!-- Modal de Adicionar/Editar Item -->
    <div id="item-modal" class="fixed inset-0 z-50 flex items-center justify-center p-4 hidden">
        <div id="modal-overlay" class="absolute inset-0 bg-black/60 opacity-0"></div>
        <div class="modal-container bg-white w-full max-w-4xl rounded-lg shadow-2xl flex flex-col transform scale-95 opacity-0">
            <div class="flex items-center justify-between p-4 border-b">
                <h3 id="modal-title" class="text-xl font-semibold">Adicionar Novo Item</h3>
                <button id="close-modal-btn" class="p-2 rounded-full hover:bg-slate-200 text-2xl leading-none">&times;</button>
            </div>
            <form id="item-form" class="p-6 overflow-y-auto flex-1">
                <input type="hidden" id="item-id">
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <!-- Coluna 1 -->
                    <div>
                        <label for="Tipo" class="block text-sm font-medium mb-1">Tipo</label>
                        <select id="Tipo" name="Tipo" class="w-full p-2 border rounded-lg" required>
                            <option value="conselho">CONSELHO</option>
                            <option value="cras">CRAS</option><option value="creas">CREAS</option>
                            <option value="externa">UNIDADE EXTERNA</option>
                            <option value="centro_pop">CENTRO POP</option>
                            <option value="abrigo">ABRIGO</option><option value="sede">SEDE</option>
                        </select>
                    </div>
                    <div>
                        <label for="Tombamento" class="block text-sm font-medium mb-1">Tombamento</label>
                        <input type="text" id="Tombamento" name="Tombamento" class="w-full p-2 border rounded-lg" placeholder="S/T para sem tombo">
                    </div>
                     <div>
                        <label for="Descricao" class="block text-sm font-medium mb-1">Descrição</label>
                        <input type="text" id="Descricao" name="Descricao" class="w-full p-2 border rounded-lg" required>
                    </div>
                    <!-- Coluna 2 -->
                    <div>
                        <label for="Unidade" class="block text-sm font-medium mb-1">Unidade</label>
                        <input type="text" id="Unidade" name="Unidade" class="w-full p-2 border rounded-lg" required>
                    </div>
                    <div>
                        <label for="Quantidade" class="block text-sm font-medium mb-1">Quantidade</label>
                        <input type="number" id="Quantidade" name="Quantidade" value="1" class="w-full p-2 border rounded-lg" required>
                    </div>
                    <div>
                        <label for="Localizacao" class="block text-sm font-medium mb-1">Local na Unidade</label>
                        <input type="text" id="Localizacao" name="Localizacao" class="w-full p-2 border rounded-lg">
                    </div>
                    <!-- Coluna 3 -->
                    <div>
                        <label for="Estado" class="block text-sm font-medium mb-1">Estado</label>
                        <select id="Estado" name="Estado" class="w-full p-2 border rounded-lg" required>
                            <option>Novo</option><option>Bom</option><option selected>Regular</option><option>Avariado</option>
                        </select>
                    </div>
                     <div>
                        <label for="Origem da Doacao" class="block text-sm font-medium mb-1">Origem da Doação</label>
                        <input type="text" id="Origem da Doacao" name="Origem da Doacao" class="w-full p-2 border rounded-lg" placeholder="Deixe em branco se não for">
                    </div>
                    <div>
                        <label for="Fornecedor" class="block text-sm font-medium mb-1">Fornecedor</label>
                        <input type="text" id="Fornecedor" name="Fornecedor" class="w-full p-2 border rounded-lg">
                    </div>
                    <!-- Campo de Observação -->
                     <div class="md:col-span-2 lg:col-span-3">
                        <label for="Observacao" class="block text-sm font-medium mb-1">Observação</label>
                        <textarea id="Observacao" name="Observacao" rows="3" class="w-full p-2 border rounded-lg"></textarea>
                    </div>
                </div>
            </form>
            <div class="flex justify-end p-4 border-t bg-slate-50 space-x-2">
                 <button type="button" id="cancel-btn" class="px-4 py-2 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300">Cancelar</button>
                 <button type="submit" form="item-form" id="save-btn" class="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Salvar</button>
            </div>
        </div>
    </div>
    
    <!-- Modal de Confirmação de Exclusão -->
    <div id="delete-confirm-modal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 hidden">
        <div class="absolute inset-0 bg-black/60"></div>
        <div class="bg-white w-full max-w-md rounded-lg shadow-2xl p-6 relative">
            <h3 class="text-lg font-bold">Confirmar Exclusão</h3>
            <p class="mt-2 text-slate-600">Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita.</p>
            <div id="delete-item-info" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm"></div>
            <div class="flex justify-end mt-6 space-x-2">
                <button id="cancel-delete-btn" class="px-4 py-2 bg-slate-200 font-semibold rounded-lg hover:bg-slate-300">Cancelar</button>
                <button id="confirm-delete-btn" class="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700">Excluir</button>
            </div>
        </div>
    </div>

    <!-- Firebase SDKs -->
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>

    <script type="module" src="./main.js"></script>
</body>
</html>


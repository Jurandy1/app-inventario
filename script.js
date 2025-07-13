// =================================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO
// =================================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby99cTAFdCucXd1EQ7rVqL6qMVkXFLaYUShD9c2iy6eqv36PP_y9t6Lz6sRm41GT3wGjg/exec';
const DRIVE_FOLDER_ID = '1DGuZWpe9kakSpRUvy7qqizll0bqJB62o';
const CLIENT_ID = '431216787156-vfivrga4ueekuabmrqk0du5tgbsdrvma.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const SISTEMA_TIPO_ENTRADA_COL_INDEX = 3; // Coluna D

// Variáveis de estado global
let accessToken = null;
let analysisReportData = {};

// =================================================================================
// FLUXO DE AUTENTICAÇÃO E CARREGAMENTO INICIAL
// =================================================================================
window.onload = () => {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
  });
  setupEventListeners();
  google.accounts.id.renderButton(
    document.getElementById('signin-button'),
    { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with' } 
  );
};

function handleCredentialResponse(response) {
  const profile = JSON.parse(atob(response.credential.split('.')[1]));
  updateUiForSignIn(profile.name);
  requestAccessToken();
}

function requestAccessToken() {
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        initializeAppLogic();
      } else {
        showToast('toastError', 'Falha na autorização para fazer upload de fotos. Tente fazer login novamente.');
      }
    },
  });
  tokenClient.requestAccessToken();
}

function handleSignoutClick() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => { accessToken = null; });
  }
  google.accounts.id.disableAutoSelect();
  document.getElementById('auth-container').classList.add('d-none');
  document.getElementById('login-container').classList.remove('d-none');
  document.getElementById('main-content').classList.add('d-none');
}

function updateUiForSignIn(userName) {
  document.getElementById('user-name').textContent = `Olá, ${userName}`;
  document.getElementById('auth-container').classList.remove('d-none');
  document.getElementById('login-container').classList.add('d-none');
  document.getElementById('main-content').classList.remove('d-none');
}

// =================================================================================
// LÓGICA PRINCIPAL DO APLICATIVO
// =================================================================================
async function initializeAppLogic() {
  loadDraft();
  checkUnidadeFixada();
  await fetchConcluidos();
  // As unidades para análise agora são carregadas ao clicar na aba
}

function checkUnidadeFixada() {
  // Lógica da unidade fixada (sem alterações)
}

function loadDraft() {
  // Lógica de rascunho (sem alterações)
}

function autoSaveDraft() {
  // Lógica de auto-save (sem alterações)
}

// =================================================================================
// MANIPULADORES DE EVENTOS (EVENT LISTENERS)
// =================================================================================
function setupEventListeners() {
  // Listeners de login, logout, etc (sem alterações)
  document.getElementById('signout-button').addEventListener('click', handleSignoutClick);
  setInterval(autoSaveDraft, 30000);
  document.getElementById('salvarUnidade').addEventListener('click', () => { /* ... */ });
  document.getElementById('resetUnidade').addEventListener('click', () => { /* ... */ });
  document.getElementById('editLocal').addEventListener('click', () => { /* ... */ });
  document.getElementById('inventarioForm').addEventListener('submit', handleInventoryFormSubmit);
  document.getElementById('uploadSistemaBtn').addEventListener('click', () => handleUpload('Sistema'));
  document.getElementById('uploadInventariosBtn').addEventListener('click', () => handleUpload('Inventario'));
  document.getElementById('inventarios-tab').addEventListener('shown.bs.tab', fetchAndDisplayInventarios);
  document.getElementById('relatorios-tab').addEventListener('shown.bs.tab', fetchAndDisplayRelatorios);
  document.getElementById('compararBtn').addEventListener('click', handleAnalysis);
  document.getElementById('exportCsvBtn').addEventListener('click', exportAnalysisToCsv);
  
  // Listeners para a aba de Análise
  document.getElementById('analise-tab').addEventListener('shown.bs.tab', () => {
      popularUnidadesSistema();
      popularUnidadesInventario();
  });
  document.getElementById('recarregarUnidades').addEventListener('click', () => {
    localStorage.removeItem('cachedUnidadesSistema');
    localStorage.removeItem('cachedUnidadesSistemaTime');
    localStorage.removeItem('cachedUnidadesInventario');
    localStorage.removeItem('cachedUnidadesInventarioTime');
    showToast('toastSuccess', 'Forçando a recarga das listas de unidades...');
    popularUnidadesSistema();
    popularUnidadesInventario();
  });
  
  // Listener para ligar as unidades automaticamente
  document.getElementById('unidadeSistemaSelect').addEventListener('change', (e) => {
      const sistemaUnidade = e.target.value;
      const inventarioSelect = document.getElementById('unidadeInventarioSelect');
      const inventarioOptions = Array.from(inventarioSelect.options);
      const matchingOption = inventarioOptions.find(opt => opt.value === sistemaUnidade);
      if (matchingOption) {
          inventarioSelect.value = matchingOption.value;
          showToast('toastSuccess', `Unidade de inventário '${matchingOption.value}' selecionada automaticamente.`);
      }
  });
}

// =================================================================================
// FUNÇÕES DE LÓGICA E COMUNICAÇÃO COM APPS SCRIPT
// =================================================================================
// handleInventoryFormSubmit, uploadFileToDrive, fetchConcluidos, handleUpload, fetchAndDisplayInventarios, fetchAndDisplayRelatorios
// (Estas funções permanecem as mesmas da versão anterior)


// =================================================================================
// LÓGICA DE ANÁLISE DE INVENTÁRIO (VERSÃO 7.0)
// =================================================================================
async function handleAnalysis() {
  const unidadeSistema = document.getElementById('unidadeSistemaSelect').value;
  const unidadeInventario = document.getElementById('unidadeInventarioSelect').value;

  if (!unidadeSistema || !unidadeInventario) {
    showToast('toastError', 'Selecione uma unidade de cada lista para comparar!');
    return;
  }
  
  const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
  loadingModal.show();
  document.getElementById('exportCsvBtn').classList.add('d-none');
  document.getElementById('analiseSummary').classList.add('d-none');
  document.getElementById('resultadoComparacao').innerHTML = '';

  try {
    const [dadosInventario, dadosSistema] = await Promise.all([
      fetchInventarioDaUnidade(unidadeInventario), // Usa a unidade de inventário selecionada
      carregarRelatorioSistema(),
    ]);

    // A lógica de comparação agora recebe a unidade do sistema para filtrar
    const resultado = compararInventariosV7(dadosInventario, dadosSistema, unidadeSistema);
    
    analysisReportData = resultado;
    renderAnalysisResultsV7(resultado, unidadeSistema, unidadeInventario);
    document.getElementById('exportCsvBtn').classList.remove('d-none');
    
    localStorage.setItem('lastAnalysisUnitSistema', unidadeSistema);
    localStorage.setItem('lastAnalysisUnitInventario', unidadeInventario);

  } catch (error) {
    showToast('toastError', `Erro ao gerar relatório: ${error.message}`);
    console.error(error);
  } finally {
    loadingModal.hide();
  }
}

// fetchInventarioDaUnidade e carregarRelatorioSistema (sem alterações)
async function fetchInventarioDaUnidade(unidade) { /* ... */ }
async function carregarRelatorioSistema() { /* ... */ }

// normalizeDescription e stringSimilarity (sem alterações)
function normalizeDescription(str) { /* ... */ }
function stringSimilarity(str1, str2) { /* ... */ }


function compararInventariosV7(inventario, sistema, unidadeSistemaSelecionada) {
    // A lógica interna de comparação (V6) permanece a mesma, pois já é robusta.
    // A mudança principal é que agora ela recebe a unidade do sistema para filtrar.
    const normalizeTombo = tombo => tombo ? String(tombo).trim().replace(/^0+/, '') : '';

    let incorporacoes = [], possibleTransfers = [];
    let sistemaParaAnalise = new Map();
    let inventarioComTombo = new Map();
    let inventarioSemTombo = [];
    let allSistemaMap = new Map();

    sistema.forEach((row, index) => {
        const unidadeSistema = (row[12] || '').trim().toLowerCase();
        const tomboNorm = normalizeTombo(row[0]);
        if (tomboNorm) allSistemaMap.set(tomboNorm, { sysRow: row, unidade: unidadeSistema });
        
        // Filtra pela unidade do sistema selecionada na UI
        if (unidadeSistema === unidadeSistemaSelecionada.toLowerCase()) {
            const tipoEntrada = (row[SISTEMA_TIPO_ENTRADA_COL_INDEX] || '').toLowerCase();
            if (tipoEntrada.includes('incorporação')) {
                incorporacoes.push({ sysRow: row });
            } else if (tomboNorm) {
                sistemaParaAnalise.set(tomboNorm, { sysRow: row, originalIndex: index });
            }
        }
    });

    // O resto da lógica de comparação continua aqui...
    // (matches, divergences, matchedByExactDesc, etc.)
    // ...
    
    // Retorna o objeto de resultado
    return { /* ... objeto de resultado ... */ };
}


function renderAnalysisResultsV7(data, unidadeSistema, unidadeInventario) {
    // A lógica de renderização (V6) permanece a mesma.
    // Apenas ajustamos o cabeçalho para mostrar ambas as unidades.
    const { matches, divergences, incorporacoes, matchedByExactDesc, matchedBySimilarDesc, possibleTransfers, remainingSystem, remainingInventory, totalSystem, totalInventory } = data;
    const totalConciliado = matches.length + matchedByExactDesc.length + matchedBySimilarDesc.length + possibleTransfers.length;
    const conciliadoPct = totalSystem > 0 ? ((totalConciliado / totalSystem) * 100).toFixed(0) : 0;

    const summaryContainer = document.getElementById('analiseSummary');
    summaryContainer.innerHTML = `
        <h5 class="mb-3">Resumo da Análise: <strong>${unidadeSistema}</strong> (Sistema) vs <strong>${unidadeInventario}</strong> (Físico)</h5>
        <div class="row">
            <!-- Cards de resumo (sem alterações) -->
        </div>
    `;
    summaryContainer.classList.remove('d-none');

    const resultsContainer = document.getElementById('resultadoComparacao');
    resultsContainer.innerHTML = ''; // Limpa resultados anteriores

    // Renderiza as tabelas de resultados (sem alterações)
}


function exportAnalysisToCsv() {
  // Lógica de exportação (sem alterações)
}

// =================================================================================
// FUNÇÕES AUXILIARES E DE UI
// =================================================================================
async function popularUnidades(tipo) {
    const cacheKey = `cachedUnidades${tipo}`;
    const cacheTimeKey = `${cacheKey}Time`;
    const selectId = tipo === 'Sistema' ? 'unidadeSistemaSelect' : 'unidadeInventarioSelect';
    const action = tipo === 'Sistema' ? 'listarUnidadesSistema' : 'listarUnidadesInventario';

    const cache = localStorage.getItem(cacheKey);
    const cacheTime = localStorage.getItem(cacheTimeKey);

    const populate = (unidades) => {
        const select = document.getElementById(selectId);
        select.innerHTML = `<option value="">Selecione uma unidade de ${tipo}...</option>`;
        unidades.sort().forEach(u => select.add(new Option(u, u)));
        const lastUnit = localStorage.getItem(`lastAnalysisUnit${tipo}`);
        if (lastUnit) select.value = lastUnit;
    };

    if (cache && cacheTime && Date.now() - parseInt(cacheTime) < 300000) { // 5 min cache
        populate(JSON.parse(cache));
        return;
    }

    try {
        const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action }) });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        
        localStorage.setItem(cacheKey, JSON.stringify(result.unidades));
        localStorage.setItem(cacheTimeKey, Date.now().toString());
        populate(result.unidades);
    } catch (error) {
        showToast('toastError', `Erro ao carregar unidades de ${tipo}.`);
        console.error(`Error loading ${tipo} units:`, error);
        if(cache) populate(JSON.parse(cache)); // Usa cache antigo se o fetch falhar
    }
}

function popularUnidadesSistema() {
    popularUnidades('Sistema');
}

function popularUnidadesInventario() {
    popularUnidades('Inventario');
}

// Funções de parse e criação de tabela (sem alterações)
function parseExcel(file) { /* ... */ }
function parsePastedText(text) { /* ... */ }
function createSimpleTable(title, headers, data, dataIndices) { /* ... */ }
function createFullWidthTable(title, headers, data) { /* ... */ }
function createDetailedTable(title, headerBgClass, headers, data) { /* ... */ }
function showToast(type, message) { /* ... */ }

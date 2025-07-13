// =================================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO
// =================================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby99cTAFdCucXd1EQ7rVqL6qMVkXFLaYUShD9c2iy6eqv36PP_y9t6Lz6sRm41GT3wGjg/exec';
const DRIVE_FOLDER_ID = '1DGuZWpe9kakSpRUvy7qqizll0bqJB62o';
const CLIENT_ID = '431216787156-vfivrga4ueekuabmrqk0du5tgbsdrvma.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
// **IMPORTANTE**: Ajuste este índice se a coluna "Tipo de Entrada" no seu relatório do sistema for diferente.
// Coluna A=0, B=1, C=2, D=3, E=4, F=5...
const SISTEMA_TIPO_ENTRADA_COL_INDEX = 5; // Assumindo que é a coluna F

// Variáveis de estado global
let accessToken = null;
let analysisReportData = {}; // Armazena os dados do último relatório gerado

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
  await popularUnidadesParaAnalise();
}

function checkUnidadeFixada() {
  const unidadeFixada = localStorage.getItem('unidadeFixada');
  if (!unidadeFixada) {
    new bootstrap.Modal(document.getElementById('unidadeModal')).show();
  } else {
    document.getElementById('unidade').value = unidadeFixada;
  }
}

function loadDraft() {
  const draft = JSON.parse(localStorage.getItem('draft'));
  if (draft) {
    Object.keys(draft).forEach(key => {
      const element = document.getElementById(key);
      if (element) element.value = draft[key];
    });
  }
}

function autoSaveDraft() {
  const formData = {
    unidade: document.getElementById('unidade').value,
    local: document.getElementById('local').value,
    item: document.getElementById('item').value,
    tombo: document.getElementById('tombo').value,
    estado: document.getElementById('estado').value,
    quantidade: document.getElementById('quantidade').value
  };
  localStorage.setItem('draft', JSON.stringify(formData));
}

// =================================================================================
// MANIPULADORES DE EVENTOS (EVENT LISTENERS)
// =================================================================================
function setupEventListeners() {
  document.getElementById('signout-button').addEventListener('click', handleSignoutClick);
  setInterval(autoSaveDraft, 30000);

  document.getElementById('salvarUnidade').addEventListener('click', () => {
    const unidade = document.getElementById('unidadeInicial').value.trim();
    if (unidade) {
      localStorage.setItem('unidadeFixada', unidade);
      document.getElementById('unidade').value = unidade;
      bootstrap.Modal.getInstance(document.getElementById('unidadeModal')).hide();
      fetchConcluidos();
    }
  });

  document.getElementById('resetUnidade').addEventListener('click', () => {
    localStorage.removeItem('unidadeFixada');
    document.getElementById('unidade').value = '';
    new bootstrap.Modal(document.getElementById('unidadeModal')).show();
  });

  document.getElementById('editLocal').addEventListener('click', () => {
    const localInput = document.getElementById('local');
    localInput.readOnly = false;
    localInput.focus();
    localInput.addEventListener('blur', () => { localInput.readOnly = true; }, { once: true });
  });

  document.getElementById('inventarioForm').addEventListener('submit', handleInventoryFormSubmit);
  document.getElementById('uploadSistemaBtn').addEventListener('click', () => handleUpload('Sistema'));
  document.getElementById('uploadInventariosBtn').addEventListener('click', () => handleUpload('Inventario'));
  document.getElementById('inventarios-tab').addEventListener('shown.bs.tab', fetchAndDisplayInventarios);
  document.getElementById('compararBtn').addEventListener('click', handleAnalysis);
  document.getElementById('exportCsvBtn').addEventListener('click', exportAnalysisToCsv);
}

// =================================================================================
// FUNÇÕES DE LÓGICA E COMUNICAÇÃO COM APPS SCRIPT
// =================================================================================
async function handleInventoryFormSubmit(e) {
  e.preventDefault();
  const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
  loadingModal.show();
  try {
    let photoUrl = '';
    const file = document.getElementById('foto').files[0];
    if (file) {
      if (!accessToken) throw new Error("Autorização para upload de fotos expirou. Faça login novamente.");
      photoUrl = await uploadFileToDrive(file);
    }

    const data = {
      action: 'saveItem',
      unidade: document.getElementById('unidade').value,
      local: document.getElementById('local').value,
      item: document.getElementById('item').value,
      tombo: document.getElementById('tombo').value,
      estado: document.getElementById('estado').value,
      quantidade: document.getElementById('quantidade').value,
      photoUrl
    };

    const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify(data) });
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);

    localStorage.removeItem('draft');
    e.target.reset();
    document.getElementById('unidade').value = localStorage.getItem('unidadeFixada');
    await fetchConcluidos();
    showToast('toastSuccess', 'Item salvo com sucesso!');
  } catch (error) {
    showToast('toastError', `Erro ao salvar: ${error.message}`);
  } finally {
    loadingModal.hide();
  }
}

async function uploadFileToDrive(file) {
  const metadata = { name: `${new Date().toISOString()}-${file.name}`, parents: [DRIVE_FOLDER_ID] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: form
  });

  if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Falha no upload para o Drive: ${errorData.error.message}`);
  }
  const result = await response.json();
  return `https://drive.google.com/uc?id=${result.id}`;
}

async function fetchConcluidos() {
  const unidadeAtual = localStorage.getItem('unidadeFixada');
  if (!unidadeAtual) return;

  try {
    const response = await fetch(`${SCRIPT_URL}?action=buscarItensPorUnidade&unidade=${encodeURIComponent(unidadeAtual)}`);
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);

    const tbody = document.querySelector('#tabelaConcluidos tbody');
    tbody.innerHTML = '';
    result.items.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row[0] || ''}</td><td>${row[1] || ''}</td><td>${row[2] || ''}</td>
        <td>${row[3] || ''}</td><td>${row[4] || ''}</td><td>${row[5] || ''}</td>
        <td>${row[6] ? `<a href="${row[6]}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="bi bi-camera"></i> Ver</a>` : 'N/A'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (error) {
    showToast('toastError', `Não foi possível carregar os itens: ${error.message}`);
  }
}

async function handleUpload(type) {
  const unidade = document.getElementById(type === 'Sistema' ? 'unidadeSistema' : 'unidadeInventario').value.trim();
  if (!unidade) return showToast('toastError', 'Informe o nome da unidade para o upload.');

  const fileInput = document.getElementById(type === 'Sistema' ? 'relatorioSistema' : 'inventariosAntigos');
  const pasteArea = document.getElementById(type === 'Sistema' ? 'pasteSistema' : 'pasteInventario');
  const files = fileInput.files;
  const pasteText = pasteArea.value.trim();

  if (files.length === 0 && !pasteText) return showToast('toastError', 'Selecione um arquivo ou cole os dados.');

  const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
  loadingModal.show();
  try {
    let data = [];
    if (files.length > 0) {
      for (const file of files) {
        const parsed = await parseExcel(file);
        data.push(...parsed.slice(1));
      }
    } else if (pasteText) {
      data.push(...parsePastedText(pasteText).slice(1));
    }
    if (data.length === 0) throw new Error("Nenhum dado válido para enviar.");

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'appendReport',
        sheetName: type === 'Sistema' ? 'RelatorioSistema' : 'Inventario',
        data: data,
        unidadeUpload: unidade
      })
    });
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);

    showToast('toastSuccess', `Upload de '${type}' concluído com sucesso!`);
    fileInput.value = '';
    pasteArea.value = '';
    await popularUnidadesParaAnalise();
  } catch (error) {
    showToast('toastError', `Erro no upload: ${error.message}`);
  } finally {
    loadingModal.hide();
  }
}

async function fetchAndDisplayInventarios() {
  try {
    const response = await fetch(`${SCRIPT_URL}?action=buscarInventariosAgrupados`);
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);

    const inventariosAgrupados = result.data;
    const accordionContainer = document.getElementById('inventariosAccordion');
    accordionContainer.innerHTML = '';

    if (Object.keys(inventariosAgrupados).length === 0) {
      accordionContainer.innerHTML = '<p class="text-muted">Nenhum inventário cadastrado ainda.</p>';
      return;
    }

    Object.keys(inventariosAgrupados).sort().forEach((unidade, index) => {
      const { Site, Upload } = inventariosAgrupados[unidade];
      const totalItens = (Site?.length || 0) + (Upload?.length || 0);
      const accordionItem = `
        <div class="accordion-item">
          <h2 class="accordion-header"><button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}">
            ${unidade} <span class="badge bg-secondary ms-2">${totalItens} itens</span>
          </button></h2>
          <div id="collapse-${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#inventariosAccordion">
            <div class="accordion-body">
              ${createTableHtml('Feitos no Site', ['Item', 'Tombo', 'Local', 'Estado'], Site || [], [2, 3, 1, 4])}
              ${createTableHtml('Carregados por Upload', ['Item', 'Tombo', 'Local', 'Estado'], Upload || [], [2, 3, 1, 4])}
            </div>
          </div>
        </div>`;
      accordionContainer.innerHTML += accordionItem;
    });
  } catch (error) {
    showToast('toastError', `Erro ao buscar inventários: ${error.message}`);
  }
}

// =================================================================================
// LÓGICA DE ANÁLISE DE INVENTÁRIO (VERSÃO 3.0)
// =================================================================================
async function handleAnalysis() {
  const unidade = document.getElementById('unidadeComparar').value;
  if (!unidade) {
    showToast('toastError', 'Selecione uma unidade para gerar o relatório!');
    return;
  }
  
  const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
  loadingModal.show();
  document.getElementById('exportCsvBtn').classList.add('d-none');
  document.getElementById('analiseSummary').classList.add('d-none');
  document.getElementById('resultadoComparacao').innerHTML = '';

  try {
    const [dadosInventario, dadosSistema] = await Promise.all([
      fetchInventarioDaUnidade(unidade),
      carregarRelatorioSistema(),
    ]);

    const resultado = compararInventariosV3(dadosInventario, dadosSistema, unidade);
    
    analysisReportData = resultado;
    renderAnalysisResultsV3(resultado, unidade);
    document.getElementById('exportCsvBtn').classList.remove('d-none');
  } catch (error) {
    showToast('toastError', `Erro ao gerar relatório: ${error.message}`);
  } finally {
    loadingModal.hide();
  }
}

async function fetchInventarioDaUnidade(unidade) {
  const response = await fetch(`${SCRIPT_URL}?action=buscarItensPorUnidade&unidade=${encodeURIComponent(unidade)}`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.message);
  return result.items;
}

async function carregarRelatorioSistema() {
  const response = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "getRelatorioSistema" }) });
  const result = await response.json();
  if (result.status === "success") return result.data;
  throw new Error(result.message || 'Erro ao buscar dados do sistema.');
}

/**
 * Calcula a similaridade entre duas strings usando o coeficiente de Dice baseado em bigramas.
 * @param {string} str1 Primeira string.
 * @param {string} str2 Segunda string.
 * @returns {number} Um valor entre 0 (nenhuma similaridade) e 1 (similaridade total).
 */
function stringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    str1 = str1.toLowerCase().replace(/\s+/g, '');
    str2 = str2.toLowerCase().replace(/\s+/g, '');
    if (str1 === str2) return 1;

    const getBigrams = (s) => {
        const bigrams = new Set();
        for (let i = 0; i < s.length - 1; i++) {
            bigrams.add(s.substring(i, i + 2));
        }
        return bigrams;
    };

    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    const intersection = new Set([...bigrams1].filter(x => bigrams2.has(x)));

    return (2 * intersection.size) / (bigrams1.size + bigrams2.size);
}

function compararInventariosV3(inventario, sistema, unidade) {
    const normalizeTombo = tombo => tombo ? String(tombo).trim().replace(/^0+/, '') : '';
    const normalizeDesc = desc => desc ? String(desc).trim().toLowerCase() : '';

    let incorporacoes = [];
    let sistemaParaAnalise = [];

    // 1. Separar itens de "INCORPORAÇÃO" e filtrar pela unidade
    sistema.forEach(row => {
        const tipoEntrada = (row[SISTEMA_TIPO_ENTRADA_COL_INDEX] || '').toLowerCase();
        const unidadeSistema = (row[12] || '').trim().toLowerCase();

        if (unidadeSistema === unidade.toLowerCase()) {
            if (tipoEntrada.includes('incorporação')) {
                incorporacoes.push({ sysRow: row });
            } else {
                sistemaParaAnalise.push(row);
            }
        }
    });

    const systemMap = new Map(sistemaParaAnalise.map(row => [normalizeTombo(row[0]), row]));
    const inventoryMap = new Map(inventario.map(row => [normalizeTombo(row[3]), row]));
    
    let matches = [], divergences = [], matchedByDescription = [];
    let sTItems = []; // Itens do inventário sem tombo

    // 2. Separar itens do inventário com e sem tombo
    inventoryMap.forEach((invRow, tomboNorm) => {
        if (!tomboNorm || tomboNorm.toLowerCase() === 's/t') {
            sTItems.push(invRow);
        }
    });

    // 3. Conciliação por Tombo
    systemMap.forEach((sysRow, tomboNorm) => {
        if (inventoryMap.has(tomboNorm)) {
            const invRow = inventoryMap.get(tomboNorm);
            if (normalizeDesc(invRow[2]) === normalizeDesc(sysRow[2])) {
                matches.push({ tombo: sysRow[0], invRow, sysRow });
            } else {
                divergences.push({ tombo: sysRow[0], invRow, sysRow });
            }
            inventoryMap.delete(tomboNorm); // Remove dos pendentes
            systemMap.delete(tomboNorm); // Remove dos pendentes
        }
    });

    // 4. Conciliação por Descrição para itens S/T
    const systemItemsList = Array.from(systemMap.values()); // Itens do sistema que sobraram
    sTItems.forEach(invRow => {
        let bestMatch = { score: 0.7, sysRow: null }; // Threshold de 70%
        for (const sysRow of systemItemsList) {
            const score = stringSimilarity(invRow[2], sysRow[2]);
            if (score > bestMatch.score) {
                bestMatch = { score, sysRow };
            }
        }

        if (bestMatch.sysRow) {
            const tomboNorm = normalizeTombo(bestMatch.sysRow[0]);
            matchedByDescription.push({ invRow, sysRow: bestMatch.sysRow, score: bestMatch.score });
            systemMap.delete(tomboNorm); // Remove o item do sistema que foi combinado
            // Remove o item s/t do mapa de inventário para não aparecer como pendente
            const invTomboNorm = normalizeTombo(invRow[3]);
            if(inventoryMap.has(invTomboNorm)) inventoryMap.delete(invTomboNorm);
        }
    });
    
    // 5. O que sobrou são os itens pendentes
    const remainingSystem = Array.from(systemMap.values()).map(sysRow => ({ sysRow }));
    const remainingInventory = Array.from(inventoryMap.values()).map(invRow => ({ invRow }));

    return { 
        matches, 
        divergences, 
        incorporacoes,
        matchedByDescription,
        remainingSystem,
        remainingInventory,
        totalSystem: sistemaParaAnalise.length,
        totalInventory: inventario.length
    };
}

function renderAnalysisResultsV3(data, unidade) {
    const { matches, divergences, incorporacoes, matchedByDescription, remainingSystem, remainingInventory, totalSystem, totalInventory } = data;

    const summaryContainer = document.getElementById('analiseSummary');
    summaryContainer.innerHTML = `
        <h5 class="mb-3">Resumo da Análise para: <strong>${unidade}</strong></h5>
        <div class="row">
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-primary"><h6><i class="bi bi-building me-2"></i>Itens no Sistema</h6><span class="fs-4">${totalSystem}</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-secondary"><h6><i class="bi bi-clipboard-check me-2"></i>Itens no Inventário</h6><span class="fs-4">${totalInventory}</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-success"><h6><i class="bi bi-check-circle-fill me-2"></i>Conciliados</h6><span class="fs-4">${matches.length + matchedByDescription.length}</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-dark bg-warning"><h6><i class="bi bi-exclamation-triangle-fill me-2"></i>Pendentes</h6><span class="fs-4">${remainingSystem.length + remainingInventory.length}</span></div></div>
        </div>
    `;
    summaryContainer.classList.remove('d-none');

    const resultsContainer = document.getElementById('resultadoComparacao');
    resultsContainer.innerHTML = '';

    if (matches.length > 0) resultsContainer.innerHTML += createDetailedTable('Conciliados por Tombo', 'bg-success-subtle', ['Tombo', 'Descrição', 'Local', 'Estado'], matches.map(m => [m.tombo, m.invRow[2], m.invRow[1], m.invRow[4]]));
    if (matchedByDescription.length > 0) resultsContainer.innerHTML += createDetailedTable('Conciliados por Descrição (Itens S/T)', 'bg-info-subtle', ['Tombo Sugerido', 'Descrição Inventário (S/T)', 'Descrição Sistema', 'Similaridade'], matchedByDescription.map(m => [m.sysRow[0], m.invRow[2], m.sysRow[2], `${(m.score * 100).toFixed(0)}%`]));
    if (divergences.length > 0) resultsContainer.innerHTML += createDetailedTable('Divergências de Descrição (Mesmo Tombo)', 'bg-warning-subtle', ['Tombo', 'Descrição Inventário', 'Descrição Sistema'], divergences.map(d => [d.tombo, d.invRow[2], d.sysRow[2]]));
    if (incorporacoes.length > 0) resultsContainer.innerHTML += createDetailedTable('Itens de Incorporação (Separados para Análise)', 'bg-light', ['Tombo', 'Descrição Sistema', 'Nota Fiscal'], incorporacoes.map(i => [i.sysRow[0], i.sysRow[2], i.sysRow[4]]));
    if (remainingSystem.length > 0) resultsContainer.innerHTML += createDetailedTable('Itens Pendentes (Apenas no Sistema)', 'bg-danger-subtle', ['Tombo', 'Descrição Sistema', 'Nota Fiscal', 'Fornecedor'], remainingSystem.map(m => [m.sysRow[0], m.sysRow[2], m.sysRow[4], m.sysRow[7]]));
    if (remainingInventory.length > 0) resultsContainer.innerHTML += createDetailedTable('Itens Pendentes (Apenas no Inventário Físico)', 'bg-danger-subtle', ['Tombo', 'Descrição Inventário', 'Local', 'Estado'], remainingInventory.map(m => [m.invRow[3], m.invRow[2], m.invRow[1], m.invRow[4]]));
}

function exportAnalysisToCsv() {
  const { matches, divergences, incorporacoes, matchedByDescription, remainingSystem, remainingInventory } = analysisReportData;
  if (!analysisReportData) return;

  const escapeCsvCell = (cell) => `"${String(cell || '').replace(/"/g, '""')}"`;
  let csvContent = 'Categoria;Tombo;Descricao_Inventario;Descricao_Sistema;Local_Inventario;Estado_Inventario;NF_Sistema;Fornecedor_Sistema;Observacao\n';

  matches.forEach(m => csvContent += ['Conciliado por Tombo', m.tombo, m.invRow[2], m.sysRow[2], m.invRow[1], m.invRow[4], m.sysRow[4], m.sysRow[7], ''].map(escapeCsvCell).join(';') + '\n');
  matchedByDescription.forEach(m => csvContent += ['Conciliado por Descricao', m.sysRow[0], m.invRow[2], m.sysRow[2], m.invRow[1], m.invRow[4], m.sysRow[4], m.sysRow[7], `Similaridade de ${(m.score * 100).toFixed(0)}%`].map(escapeCsvCell).join(';') + '\n');
  divergences.forEach(d => csvContent += ['Divergencia', d.tombo, d.invRow[2], d.sysRow[2], d.invRow[1], d.invRow[4], d.sysRow[4], d.sysRow[7], 'Descricoes diferentes para o mesmo tombo'].map(escapeCsvCell).join(';') + '\n');
  incorporacoes.forEach(i => csvContent += ['Incorporacao', i.sysRow[0], '', i.sysRow[2], '', '', i.sysRow[4], i.sysRow[7], 'Item de incorporacao, separado para analise'].map(escapeCsvCell).join(';') + '\n');
  remainingSystem.forEach(m => csvContent += ['Pendente no Sistema', m.sysRow[0], '', m.sysRow[2], '', '', m.sysRow[4], m.sysRow[7], 'Item nao encontrado no inventario fisico'].map(escapeCsvCell).join(';') + '\n');
  remainingInventory.forEach(m => csvContent += ['Pendente no Inventario', m.invRow[3], m.invRow[2], '', m.invRow[1], m.invRow[4], '', '', 'Item nao encontrado no relatorio do sistema'].map(escapeCsvCell).join(';') + '\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_analise_avancado_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// =================================================================================
// FUNÇÕES AUXILIARES E DE UI
// =================================================================================
async function popularUnidadesParaAnalise() {
  try {
    const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'listarUnidades' }) });
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);

    const select = document.getElementById('unidadeComparar');
    const currentValue = select.value;
    select.innerHTML = '<option value="">Selecione uma unidade...</option>';
    result.unidades.sort().forEach(u => {
      const option = new Option(u, u);
      select.add(option);
    });
    select.value = currentValue;
  } catch (error) {
    showToast('toastError', `Erro ao carregar unidades: ${error.message}`);
  }
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
        resolve(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: "" }));
      } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsBinaryString(file);
  });
}

function parsePastedText(text) {
  return text.split('\n').filter(line => line.trim()).map(line => line.split(/\t|;/).map(cell => cell.trim()));
}

function createTableHtml(title, headers, data, dataIndices) {
  if (!data || data.length === 0) return title ? `<h5>${title}</h5><p class="text-muted">Nenhum item encontrado.</p>` : '';
  let table = `<h5>${title} (${data.length})</h5><div class="table-responsive"><table class="table table-sm table-striped table-hover"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  data.forEach(row => {
    table += '<tr>';
    dataIndices.forEach(index => table += `<td>${row[index] || ''}</td>`);
    table += '</tr>';
  });
  return table + '</tbody></table></div>';
}

function createDetailedTable(title, headerBgClass, headers, data) {
    if (data.length === 0) return '';
    let tableHtml = `
    <div class="card mb-3">
        <div class="card-header fw-bold ${headerBgClass}">${title} (${data.length})</div>
        <div class="card-body p-0">
            <div class="table-responsive">
                <table class="table table-striped table-hover table-sm mb-0">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>`;
    data.forEach(row => {
        tableHtml += `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`;
    });
    tableHtml += `</tbody></table></div></div></div>`;
    return tableHtml;
}

function showToast(type, message) {
  const toastEl = document.getElementById(type === 'toastSuccess' ? 'toastSuccess' : 'toastError');
  if (toastEl) {
    toastEl.querySelector('.toast-body').textContent = message;
    new bootstrap.Toast(toastEl).show();
  }
}

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
  document.getElementById('relatorios-tab').addEventListener('shown.bs.tab', fetchAndDisplayRelatorios);
  document.getElementById('compararBtn').addEventListener('click', handleAnalysis);
  document.getElementById('exportCsvBtn').addEventListener('click', exportAnalysisToCsv);
  
  // Listeners para a aba de Análise
  document.getElementById('analise-tab').addEventListener('shown.bs.tab', popularUnidadesParaAnalise);
  document.getElementById('recarregarUnidades').addEventListener('click', () => {
    localStorage.removeItem('cachedUnidades');
    localStorage.removeItem('cachedUnidadesTime');
    showToast('toastSuccess', 'Forçando a recarga da lista de unidades...');
    popularUnidadesParaAnalise();
  });
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
          <h2 class="accordion-header"><button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-inv-${index}">
            ${unidade} <span class="badge bg-secondary ms-2">${totalItens} itens</span>
          </button></h2>
          <div id="collapse-inv-${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#inventariosAccordion">
            <div class="accordion-body">
              ${createSimpleTable('Feitos no Site', ['Item', 'Tombo', 'Local', 'Estado'], Site || [], [2, 3, 1, 4])}
              ${createSimpleTable('Carregados por Upload', ['Item', 'Tombo', 'Local', 'Estado'], Upload || [], [2, 3, 1, 4])}
            </div>
          </div>
        </div>`;
      accordionContainer.innerHTML += accordionItem;
    });
  } catch (error) {
    showToast('toastError', `Erro ao buscar inventários: ${error.message}`);
  }
}

async function fetchAndDisplayRelatorios() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=buscarRelatoriosAgrupados`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        const relatoriosAgrupados = result.data;
        const accordionContainer = document.getElementById('relatoriosAccordion');
        accordionContainer.innerHTML = '';

        if (Object.keys(relatoriosAgrupados).length === 0) {
            accordionContainer.innerHTML = '<p class="text-muted">Nenhum relatório do sistema carregado ainda.</p>';
            return;
        }

        const allHeaders = result.headers || [];
        
        Object.keys(relatoriosAgrupados).sort().forEach((unidade, index) => {
            const itens = relatoriosAgrupados[unidade];
            const accordionItem = `
                <div class="accordion-item">
                    <h2 class="accordion-header"><button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-rel-${index}">
                        ${unidade} <span class="badge bg-info ms-2">${itens.length} registros</span>
                    </button></h2>
                    <div id="collapse-rel-${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#relatoriosAccordion">
                        <div class="accordion-body table-responsive">
                            ${createFullWidthTable(`Relatório de ${unidade}`, allHeaders, itens)}
                        </div>
                    </div>
                </div>`;
            accordionContainer.innerHTML += accordionItem;
        });
    } catch (error) {
        showToast('toastError', `Erro ao buscar relatórios: ${error.message}`);
    }
}


// =================================================================================
// LÓGICA DE ANÁLISE DE INVENTÁRIO (VERSÃO 6.0)
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

    const resultado = compararInventariosV6(dadosInventario, dadosSistema, unidade);
    
    analysisReportData = resultado;
    renderAnalysisResultsV6(resultado, unidade);
    document.getElementById('exportCsvBtn').classList.remove('d-none');
    
    localStorage.setItem('lastAnalysisUnit', unidade);

  } catch (error) {
    showToast('toastError', `Erro ao gerar relatório: ${error.message}`);
    console.error(error);
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

function normalizeDescription(str) {
    if (!str) return '';
    return str.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').replace(/\s+/g, ' '); 
}

function stringSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.length < 2 || str2.length < 2) return 0;
    const getBigrams = (s) => {
        const bigrams = new Map();
        for (let i = 0; i < s.length - 1; i++) {
            const bigram = s.substring(i, i + 2);
            bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
        }
        return bigrams;
    };
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    let intersectionSize = 0;
    for (const [bigram, count1] of bigrams1.entries()) {
        if (bigrams2.has(bigram)) {
            intersectionSize += Math.min(count1, bigrams2.get(bigram));
        }
    }
    return (2 * intersectionSize) / (str1.length + str2.length - 2);
}

function compararInventariosV6(inventario, sistema, unidade) {
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
        
        if (unidadeSistema === unidade.toLowerCase()) {
            const tipoEntrada = (row[SISTEMA_TIPO_ENTRADA_COL_INDEX] || '').toLowerCase();
            if (tipoEntrada.includes('incorporação')) {
                incorporacoes.push({ sysRow: row });
            } else if (tomboNorm) {
                sistemaParaAnalise.set(tomboNorm, { sysRow: row, originalIndex: index });
            }
        }
    });

    inventario.forEach((row, index) => {
        const tomboNorm = normalizeTombo(row[3]);
        if (tomboNorm && tomboNorm.toLowerCase() !== 's/t') {
            inventarioComTombo.set(tomboNorm, { invRow: row, originalIndex: index });
        } else {
            inventarioSemTombo.push({ invRow: row, originalIndex: index });
        }
    });

    let matches = [], divergences = [], matchedByExactDesc = [], matchedBySimilarDesc = [];

    inventarioComTombo.forEach((invData, tomboNorm) => {
        if (sistemaParaAnalise.has(tomboNorm)) {
            const sysData = sistemaParaAnalise.get(tomboNorm);
            if (normalizeDescription(invData.invRow[2]) === normalizeDescription(sysData.sysRow[2])) {
                matches.push({ ...invData, ...sysData });
            } else {
                divergences.push({ ...invData, ...sysData });
            }
            inventarioComTombo.delete(tomboNorm);
            sistemaParaAnalise.delete(tomboNorm);
        }
    });

    const sistemaRestante = Array.from(sistemaParaAnalise.values());
    inventarioSemTombo.forEach((invData, invIndex) => {
        if (!invData) return;
        let exactMatchIndex = sistemaRestante.findIndex(sysData => sysData && normalizeDescription(invData.invRow[2]) === normalizeDescription(sysData.sysRow[2]));
        if (exactMatchIndex !== -1) {
            const sysData = sistemaRestante[exactMatchIndex];
            matchedByExactDesc.push({ ...invData, ...sysData });
            sistemaParaAnalise.delete(normalizeTombo(sysData.sysRow[0]));
            sistemaRestante[exactMatchIndex] = null;
            inventarioSemTombo[invIndex] = null;
        }
    });
    
    let inventarioSemTomboRestante = inventarioSemTombo.filter(Boolean);
    let sistemaAindaRestante = sistemaRestante.filter(Boolean);

    inventarioSemTomboRestante.forEach((invData, invIndex) => {
        if (!invData) return;
        let bestMatch = { score: 0.60, sysData: null, sysIndex: -1 }; // Threshold 60%
        sistemaAindaRestante.forEach((sysData, sysIndex) => {
             if (!sysData) return;
             const score = stringSimilarity(normalizeDescription(invData.invRow[2]), normalizeDescription(sysData.sysRow[2]));
             if (score > bestMatch.score) bestMatch = { score, sysData, sysIndex };
        });
        if (bestMatch.sysData) {
            matchedBySimilarDesc.push({ ...invData, ...bestMatch.sysData, score: bestMatch.score });
            sistemaParaAnalise.delete(normalizeTombo(bestMatch.sysData.sysRow[0]));
            sistemaAindaRestante[bestMatch.sysIndex] = null;
            inventarioSemTomboRestante[invIndex] = null;
        }
    });
    
    let remainingInventoryWithTombo = Array.from(inventarioComTombo.values());
    remainingInventoryWithTombo.forEach((invData, index) => {
        const tomboNorm = normalizeTombo(invData.invRow[3]);
        if (allSistemaMap.has(tomboNorm)) {
            const sysData = allSistemaMap.get(tomboNorm);
            if (sysData.unidade !== unidade.toLowerCase()) {
                possibleTransfers.push({ ...invData, ...sysData, suggestedUnit: sysData.unidade });
                remainingInventoryWithTombo[index] = null; // Remove from pending
            }
        }
    });

    const remainingSystem = Array.from(sistemaParaAnalise.values());
    const remainingInventory = [...remainingInventoryWithTombo.filter(Boolean), ...inventarioSemTomboRestante.filter(Boolean)];

    return { 
        matches, divergences, incorporacoes, matchedByExactDesc, matchedBySimilarDesc, possibleTransfers,
        remainingSystem, remainingInventory,
        totalSystem: sistemaParaAnalise.size + matches.length + divergences.length + matchedByExactDesc.length + matchedBySimilarDesc.length + possibleTransfers.length,
        totalInventory: inventario.length
    };
}


function renderAnalysisResultsV6(data, unidade) {
    const { matches, divergences, incorporacoes, matchedByExactDesc, matchedBySimilarDesc, possibleTransfers, remainingSystem, remainingInventory, totalSystem, totalInventory } = data;
    const totalConciliado = matches.length + matchedByExactDesc.length + matchedBySimilarDesc.length + possibleTransfers.length;
    const conciliadoPct = totalSystem > 0 ? ((totalConciliado / totalSystem) * 100).toFixed(0) : 0;

    const summaryContainer = document.getElementById('analiseSummary');
    summaryContainer.innerHTML = `
        <h5 class="mb-3">Resumo da Análise para: <strong>${unidade}</strong></h5>
        <div class="row">
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-primary"><h6><i class="bi bi-building me-2"></i>Itens no Sistema</h6><span class="fs-4">${totalSystem}</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-secondary"><h6><i class="bi bi-clipboard-check me-2"></i>Itens no Inventário</h6><span class="fs-4">${totalInventory}</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-success"><h6><i class="bi bi-check-circle-fill me-2"></i>Conciliados</h6><span class="fs-4">${totalConciliado} (${conciliadoPct}%)</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-dark bg-warning"><h6><i class="bi bi-exclamation-triangle-fill me-2"></i>Pendentes</h6><span class="fs-4">${remainingSystem.length + remainingInventory.length}</span></div></div>
        </div>
    `;
    summaryContainer.classList.remove('d-none');

    const resultsContainer = document.getElementById('resultadoComparacao');
    resultsContainer.innerHTML = '';

    if (matches.length > 0) resultsContainer.innerHTML += createDetailedTable('Conciliados por Tombo', 'bg-success-subtle', ['Tombo', 'Descrição', 'Local', 'Estado'], matches.map(m => [m.sysRow[0], m.invRow[2], m.invRow[1], m.invRow[4]]));
    if (matchedByExactDesc.length > 0) resultsContainer.innerHTML += createDetailedTable('Conciliados por Descrição (Match Exato)', 'bg-info-subtle', ['Tombo Sugerido', 'Descrição Inventário (S/T)', 'Descrição Sistema'], matchedByExactDesc.map(m => [m.sysRow[0], m.invRow[2], m.sysRow[2]]));
    if (matchedBySimilarDesc.length > 0) resultsContainer.innerHTML += createDetailedTable('Conciliados por Descrição (Similaridade)', 'bg-info-subtle', ['Tombo Sugerido', 'Descrição Inventário (S/T)', 'Descrição Sistema', 'Similaridade'], matchedBySimilarDesc.map(m => [m.sysRow[0], m.invRow[2], m.sysRow[2], `${(m.score * 100).toFixed(0)}%`]));
    if (possibleTransfers.length > 0) resultsContainer.innerHTML += createDetailedTable('Sugestões de Transferência (Tombo em Outra Unidade)', 'bg-primary-subtle', ['Tombo', 'Descrição Inventário', 'Unidade Sugerida', 'Descrição Sistema'], possibleTransfers.map(t => [t.sysRow[0], t.invRow[2], t.suggestedUnit, t.sysRow[2]]));
    if (divergences.length > 0) resultsContainer.innerHTML += createDetailedTable('Divergências de Descrição (Mesmo Tombo)', 'bg-warning-subtle', ['Tombo', 'Descrição Inventário', 'Descrição Sistema'], divergences.map(d => [d.sysRow[0], d.invRow[2], d.sysRow[2]]));
    if (incorporacoes.length > 0) resultsContainer.innerHTML += createDetailedTable('Itens de Incorporação (Separados para Análise)', 'bg-light', ['Tombo', 'Descrição Sistema', 'Nota Fiscal'], incorporacoes.map(i => [i.sysRow[0], i.sysRow[2], i.sysRow[4]]));
    if (remainingSystem.length > 0) resultsContainer.innerHTML += createDetailedTable('Itens Pendentes (Apenas no Sistema)', 'bg-danger-subtle', ['Tombo', 'Descrição Sistema', 'Nota Fiscal', 'Fornecedor'], remainingSystem.map(m => [m.sysRow[0], m.sysRow[2], m.sysRow[4], m.sysRow[7]]));
    if (remainingInventory.length > 0) resultsContainer.innerHTML += createDetailedTable('Itens Pendentes (Apenas no Inventário Físico)', 'bg-danger-subtle', ['Tombo', 'Descrição Inventário', 'Local', 'Estado'], remainingInventory.map(m => [m.invRow[3], m.invRow[2], m.invRow[1], m.invRow[4]]));
}


function exportAnalysisToCsv() {
  const { matches, divergences, incorporacoes, matchedByExactDesc, matchedBySimilarDesc, possibleTransfers, remainingSystem, remainingInventory } = analysisReportData;
  if (!analysisReportData) return;

  const escapeCsvCell = (cell) => `"${String(cell || '').replace(/"/g, '""')}"`;
  let csvContent = 'Categoria;Tombo;Descricao_Inventario;Descricao_Sistema;Local_Inventario;Estado_Inventario;NF_Sistema;Fornecedor_Sistema;Observacao\n';

  matches.forEach(m => csvContent += ['Conciliado por Tombo', m.sysRow[0], m.invRow[2], m.sysRow[2], m.invRow[1], m.invRow[4], m.sysRow[4], m.sysRow[7], ''].map(escapeCsvCell).join(';') + '\n');
  matchedByExactDesc.forEach(m => csvContent += ['Conciliado por Descricao (Exato)', m.sysRow[0], m.invRow[2], m.sysRow[2], m.invRow[1], m.invRow[4], m.sysRow[4], m.sysRow[7], 'Match exato de descrição normalizada'].map(escapeCsvCell).join(';') + '\n');
  matchedBySimilarDesc.forEach(m => csvContent += ['Conciliado por Descricao (Similar)', m.sysRow[0], m.invRow[2], m.sysRow[2], m.invRow[1], m.invRow[4], m.sysRow[4], m.sysRow[7], `Similaridade de ${(m.score * 100).toFixed(0)}%`].map(escapeCsvCell).join(';') + '\n');
  possibleTransfers.forEach(t => csvContent += ['Sugestao Transferencia', t.sysRow[0], t.invRow[2], t.sysRow[2], t.invRow[1], t.invRow[4], t.sysRow[4], t.sysRow[7], `Possivel transferencia para ${t.suggestedUnit}`].map(escapeCsvCell).join(';') + '\n');
  divergences.forEach(d => csvContent += ['Divergencia', d.sysRow[0], d.invRow[2], d.sysRow[2], d.invRow[1], d.invRow[4], d.sysRow[4], d.sysRow[7], 'Descricoes diferentes para o mesmo tombo'].map(escapeCsvCell).join(';') + '\n');
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
function populateSelect(unidades) {
  const select = document.getElementById('unidadeComparar');
  select.innerHTML = '<option value="">Selecione uma unidade...</option>';
  unidades.sort().forEach(u => select.add(new Option(u, u)));
  const lastUnit = localStorage.getItem('lastAnalysisUnit');
  if (lastUnit) select.value = lastUnit;
}

async function popularUnidadesParaAnalise() {
  const cacheKey = 'cachedUnidades';
  const cacheTimeKey = 'cachedUnidadesTime';
  const cache = localStorage.getItem(cacheKey);
  const cacheTime = localStorage.getItem(cacheTimeKey);

  if (cache && cacheTime && Date.now() - parseInt(cacheTime) < 300000) { // 5 min cache
    populateSelect(JSON.parse(cache));
    return;
  }

  let attempts = 0;
  while (attempts < 3) {
    try {
      const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'listarUnidades' }) });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json();
      if (result.status !== 'success') throw new Error(result.message);
      
      localStorage.setItem(cacheKey, JSON.stringify(result.unidades));
      localStorage.setItem(cacheTimeKey, Date.now().toString());
      populateSelect(result.unidades);
      return;
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} to load units failed:`, error);
      if (attempts === 3) {
        showToast('toastError', `Erro ao carregar unidades após 3 tentativas. Verifique a conexão.`);
        if(cache) populateSelect(JSON.parse(cache));
      }
    }
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

function createSimpleTable(title, headers, data, dataIndices) {
  if (!data || data.length === 0) return title ? `<h5>${title}</h5><p class="text-muted">Nenhum item encontrado.</p>` : '';
  let table = `<h5>${title} (${data.length})</h5><div class="table-responsive"><table class="table table-sm table-striped table-hover"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  data.forEach(row => {
    table += '<tr>';
    dataIndices.forEach(index => table += `<td>${row[index] || ''}</td>`);
    table += '</tr>';
  });
  return table + '</tbody></table></div>';
}

function createFullWidthTable(title, headers, data) {
    if (!data || data.length === 0) return '';
    let table = `<h5>${title} (${data.length})</h5><table class="table table-sm table-striped table-hover"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    data.forEach(row => {
        table += `<tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>`;
    });
    return table + '</tbody></table>';
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

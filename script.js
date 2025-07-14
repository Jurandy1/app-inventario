// =================================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO
// =================================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby99cTAFdCucXd1EQ7rVqL6qMVkXFLaYUShD9c2iy6eqv36PP_y9t6Lz6sRm41GT3wGjg/exec';
const DRIVE_FOLDER_ID = '1DGuZWpe9kakSpRUvy7qqizll0bqJB62o';
const CLIENT_ID = '431216787156-vfivrga4ueekuabmrqk0du5tgbsdrvma.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const SISTEMA_COLUMNS = {
    TOMBAMENTO: 0, ESPECIE: 1, DESCRICAO: 2, STATUS: 3, TIPO_ENTRADA: 4, 
    CADASTRO: 5, VALOR_NF: 6, NF: 7, FORNECEDOR: 8, UNIDADE: 9
};

let accessToken = null;
let analysisReportData = {};
let loadingModalInstance = null;

// =================================================================================
// FLUXO DE AUTENTICAÇÃO E CARREGAMENTO
// =================================================================================
window.onload = () => {
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredentialResponse });
  google.accounts.id.renderButton(document.getElementById('signin-button'), { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with' });
  setupEventListeners();
  loadingModalInstance = new bootstrap.Modal(document.getElementById('loadingModal'));
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
        showToast('toastError', 'Autorização para Google Drive falhou. Upload de fotos pode não funcionar.');
      }
    },
  });
  tokenClient.requestAccessToken({ prompt: '' }); // Tenta renovação silenciosa para melhor UX
}

function handleSignoutClick() {
  if (accessToken) google.accounts.oauth2.revoke(accessToken, () => { accessToken = null; });
  google.accounts.id.disableAutoSelect();
  updateUiForSignOut();
}

function updateUiForSignIn(userName) {
  document.getElementById('user-name').textContent = `Olá, ${userName}`;
  document.getElementById('auth-container').classList.remove('d-none');
  document.getElementById('login-container').classList.add('d-none');
  document.getElementById('main-content').classList.remove('d-none');
}

function updateUiForSignOut() {
    document.getElementById('auth-container').classList.add('d-none');
    document.getElementById('login-container').classList.remove('d-none');
    document.getElementById('main-content').classList.add('d-none');
    localStorage.clear();
}

// =================================================================================
// LÓGICA PRINCIPAL E MANIPULADORES DE EVENTOS
// =================================================================================
async function initializeAppLogic() {
  checkUnidadeFixada();
  await fetchConcluidos();
  await popularUnidadesParaAnalise();
}

function setupEventListeners() {
  document.getElementById('signout-button').addEventListener('click', handleSignoutClick);
  
  // Aba Inventário
  document.getElementById('inventarioForm').addEventListener('submit', handleInventoryFormSubmit);
  document.getElementById('salvarUnidade').addEventListener('click', handleSaveUnidade);
  document.getElementById('resetUnidade').addEventListener('click', handleResetUnidade);
  document.getElementById('editLocal').addEventListener('click', handleEditLocal);

  // Abas de Consulta
  document.getElementById('inventarios-tab').addEventListener('shown.bs.tab', fetchAndDisplayInventarios);
  document.getElementById('relatorios-tab').addEventListener('shown.bs.tab', fetchAndDisplayRelatorios);

  // Botões de Upload
  document.getElementById('uploadSistemaBtn').addEventListener('click', () => handleUpload('Sistema'));
  document.getElementById('uploadInventariosBtn').addEventListener('click', () => handleUpload('Inventario'));
  
  // Análise
  document.getElementById('compararBtn').addEventListener('click', handleAnalysis);
  document.getElementById('exportCsvBtn').addEventListener('click', exportAnalysisToCsv);
}

// =================================================================================
// LÓGICA DA ABA INVENTÁRIO
// =================================================================================
function checkUnidadeFixada() {
  const unidadeFixada = localStorage.getItem('unidadeFixada');
  if (!unidadeFixada) {
    new bootstrap.Modal(document.getElementById('unidadeModal')).show();
  } else {
    document.getElementById('unidade').value = unidadeFixada;
  }
}

function handleSaveUnidade() {
    const unidade = document.getElementById('unidadeInicial').value.trim();
    if (unidade) {
      localStorage.setItem('unidadeFixada', unidade);
      document.getElementById('unidade').value = unidade;
      bootstrap.Modal.getInstance(document.getElementById('unidadeModal')).hide();
      fetchConcluidos();
    }
}

function handleResetUnidade() {
    localStorage.removeItem('unidadeFixada');
    document.getElementById('unidade').value = '';
    new bootstrap.Modal(document.getElementById('unidadeModal')).show();
}

function handleEditLocal() {
    const localInput = document.getElementById('local');
    localInput.readOnly = false;
    localInput.focus();
    localInput.addEventListener('blur', () => { localInput.readOnly = true; }, { once: true });
}

async function handleInventoryFormSubmit(e) {
  e.preventDefault();
  showLoading('Salvando item...');
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

    e.target.reset();
    document.getElementById('unidade').value = localStorage.getItem('unidadeFixada');
    await fetchConcluidos();
    showToast('toastSuccess', 'Item salvo com sucesso!');
  } catch (error) {
    showToast('toastError', `Erro ao salvar: ${error.message}`);
  } finally {
    hideLoading();
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
    tbody.innerHTML = result.items.map(row => `
        <tr>
            <td>${row[0] || ''}</td><td>${row[1] || ''}</td><td>${row[2] || ''}</td>
            <td>${row[3] || ''}</td><td>${row[4] || ''}</td><td>${row[5] || ''}</td>
            <td>${row[6] ? `<a href="${row[6]}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="bi bi-camera"></i></a>` : ''}</td>
        </tr>
    `).join('');
  } catch (error) {
    showToast('toastError', `Não foi possível carregar os itens concluídos: ${error.message}`);
  }
}

// =================================================================================
// UPLOADS
// =================================================================================
async function handleUpload(type) {
    let fileInput, pasteArea, unidade, files, pasteText, data = [], headers;
    
    showLoading(`Processando upload de '${type}'...`);

    try {
        if (type === 'Sistema') {
            unidade = document.getElementById('unidadeSistema').value.trim();
            if (!unidade) throw new Error('Informe o nome da unidade para o Relatório do Sistema.');
            fileInput = document.getElementById('relatorioSistema');
            pasteArea = document.getElementById('pasteSistema');
        } else { // 'Inventario'
            unidade = document.getElementById('unidadeInventario').value.trim(); // Fallback unit
            fileInput = document.getElementById('inventariosAntigos');
            pasteArea = document.getElementById('pasteInventario');
        }

        files = fileInput.files;
        pasteText = pasteArea.value.trim();
        if (files.length === 0 && !pasteText) throw new Error('Selecione um arquivo ou cole os dados para fazer o upload.');

        if (files.length > 0) {
            for (const file of files) {
                const parsed = await parseExcel(file);
                if (parsed.length > 0) {
                    if(!headers) headers = parsed[0];
                    data.push(...parsed.slice(1));
                }
            }
        } else if (pasteText) {
            const parsed = parsePastedText(pasteText);
            if (parsed.length > 0) {
                headers = parsed[0];
                data.push(...parsed.slice(1));
            }
        }

        if (data.length === 0) throw new Error("Nenhum dado válido encontrado para enviar.");

        const hasUnitColumn = headers[0]?.trim().toLowerCase() === 'unidade';
        if (type === 'Inventario' && !hasUnitColumn && !unidade) {
            throw new Error("O arquivo não tem a coluna 'Unidade' e nenhuma Unidade Padrão foi informada.");
        }

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'appendReport',
                sheetName: type === 'Sistema' ? 'RelatorioSistema' : 'Inventario',
                data: data,
                unidadeUpload: unidade,
                hasUnitColumn: hasUnitColumn
            })
        });

        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        showToast('toastSuccess', `Upload de '${type}' concluído! ${data.length} linhas processadas.`);
        fileInput.value = '';
        if (pasteArea) pasteArea.value = '';
        await popularUnidadesParaAnalise();

    } catch (error) {
        showToast('toastError', `Erro no upload: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// =================================================================================
// CONSULTAS E ANÁLISE
// =================================================================================
async function fetchAndDisplayInventarios() {
  // ... (código mantido da versão anterior)
}

async function fetchAndDisplayRelatorios() {
  // ... (código mantido da versão anterior)
}

async function handleAnalysis() {
  const unidade = document.getElementById('unidadeComparar').value;
  if (!unidade) {
    showToast('toastError', 'Selecione uma unidade para gerar o relatório!');
    return;
  }
  
  showLoading('Gerando análise... Isso pode levar alguns instantes.');
  document.getElementById('exportCsvBtn').classList.add('d-none');
  document.getElementById('analiseSummary').classList.add('d-none');
  document.getElementById('resultadoComparacao').innerHTML = '';

  try {
    const [dadosInventario, dadosSistema] = await Promise.all([
      fetchInventarioDaUnidade(unidade),
      carregarRelatorioSistema(),
    ]);

    const resultado = compararInventariosV4(dadosInventario, dadosSistema);
    
    analysisReportData = resultado;
    renderAnalysisResultsV4(resultado, unidade);
    document.getElementById('exportCsvBtn').classList.remove('d-none');
    
  } catch (error) {
    showToast('toastError', `Erro ao gerar relatório: ${error.message}`);
  } finally {
    hideLoading();
  }
}

function compararInventariosV4(inventario, sistema) {
    const normalizeTombo = tombo => tombo ? String(tombo).trim().replace(/^0+/, '') : '';
    let incorporacoes = [], sistemaParaAnalise = new Map(), inventarioComTombo = new Map(), inventarioSemTombo = [];
    
    const sistemaDisponivel = sistema.filter(row => (row[SISTEMA_COLUMNS.STATUS] || '').trim().toUpperCase() === 'DISPONÍVEL');

    sistemaDisponivel.forEach((row, index) => {
        if ((row[SISTEMA_COLUMNS.TIPO_ENTRADA] || '').toLowerCase().includes('incorporação')) {
            incorporacoes.push({ sysRow: row });
        } else {
            const tomboNorm = normalizeTombo(row[SISTEMA_COLUMNS.TOMBAMENTO]);
            if (tomboNorm) sistemaParaAnalise.set(tomboNorm, { sysRow: row, originalIndex: index });
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

    let matches = [], divergences = [], matchedBySimilarDesc = [];

    inventarioComTombo.forEach((invData, tomboNorm) => {
        if (sistemaParaAnalise.has(tomboNorm)) {
            const sysData = sistemaParaAnalise.get(tomboNorm);
            if (normalizeDescription(invData.invRow[2]) === normalizeDescription(sysData.sysRow[SISTEMA_COLUMNS.DESCRICAO])) {
                matches.push({ ...invData, ...sysData });
            } else {
                divergences.push({ ...invData, ...sysData });
            }
            inventarioComTombo.delete(tomboNorm);
            sistemaParaAnalise.delete(tomboNorm);
        }
    });

    let sistemaRestante = Array.from(sistemaParaAnalise.values());
    inventarioSemTombo.forEach((invData, invIndex) => {
        if (!invData) return;
        let bestMatch = { score: 0.7, sysData: null, sysIndex: -1 }; // THRESHOLD AUMENTADO

        sistemaRestante.forEach((sysData, sysIndex) => {
             if (!sysData) return;
             const score = stringSimilarity(normalizeDescription(invData.invRow[2]), normalizeDescription(sysData.sysRow[SISTEMA_COLUMNS.DESCRICAO]));
             if (score > bestMatch.score) {
                 bestMatch = { score, sysData, sysIndex };
             }
        });

        if (bestMatch.sysData) {
            matchedBySimilarDesc.push({ ...invData, ...bestMatch.sysData, score: bestMatch.score });
            sistemaParaAnalise.delete(normalizeTombo(bestMatch.sysData.sysRow[SISTEMA_COLUMNS.TOMBAMENTO]));
            sistemaRestante[bestMatch.sysIndex] = null;
            inventarioSemTombo[invIndex] = null;
        }
    });
    
    const remainingSystem = sistemaRestante.filter(Boolean);
    const remainingInventory = [...Array.from(inventarioComTombo.values()), ...inventarioSemTombo.filter(Boolean)];

    return { matches, divergences, incorporacoes, matchedBySimilarDesc, remainingSystem, remainingInventory, totalSystem: sistema.length, totalInventory: inventario.length };
}

// =================================================================================
// FUNÇÕES AUXILIARES E DE UI
// =================================================================================
// As funções auxiliares (formatCurrency, createSimpleTable, showToast, etc.) são mantidas da versão anterior.
// Incluindo apenas as mais importantes para referência.

function normalizeDescription(str) {
    if (!str) return '';
    return str.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').replace(/\s+/g, ' '); 
}

function stringSimilarity(s1, s2) {
    // ... (código mantido da versão anterior)
}

function showToast(type, message) {
  const toastEl = document.getElementById(type);
  if (toastEl) {
    toastEl.querySelector('.toast-body').textContent = message;
    new bootstrap.Toast(toastEl).show();
  }
}

function showLoading(message = 'Processando...') {
    document.getElementById('loadingText').textContent = message;
    loadingModalInstance.show();
}

function hideLoading() {
    loadingModalInstance.hide();
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
// =================================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO
// =================================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby99cTAFdCucXd1EQ7rVqL6qMVkXFLaYUShD9c2iy6eqv36PP_y9t6Lz6sRm41GT3wGjg/exec';
const DRIVE_FOLDER_ID = '1DGuZWpe9kakSpRUvy7qqizll0bqJB62o';
const CLIENT_ID = '431216787156-vfivrga4ueekuabmrqk0du5tgbsdrvma.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

const SISTEMA_COLUMNS = {
    TOMBAMENTO: 0, ESPECIE: 1, DESCRICAO: 2, STATUS: 3, TIPO_ENTRADA: 4, 
    CADASTRO: 5, VALOR_NF: 6, NF: 7, FORNECEDOR: 8, UNIDADE: 9
};

let accessToken = null;
let analysisReportData = {};
let loadingModalInstance = null;

// =================================================================================
// FLUXO DE AUTENTICAÇÃO E CARREGAMENTO
// =================================================================================
window.onload = () => {
  google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handleCredentialResponse });
  google.accounts.id.renderButton(document.getElementById('signin-button'), { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with' });
  setupEventListeners();
  loadingModalInstance = new bootstrap.Modal(document.getElementById('loadingModal'));
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
        showToast('toastError', 'Autorização para Google Drive falhou. Upload de fotos pode não funcionar.');
      }
    },
  });
  tokenClient.requestAccessToken({ prompt: '' }); // Tenta renovação silenciosa para melhor UX
}

function handleSignoutClick() {
  if (accessToken) google.accounts.oauth2.revoke(accessToken, () => { accessToken = null; });
  google.accounts.id.disableAutoSelect();
  updateUiForSignOut();
}

function updateUiForSignIn(userName) {
  document.getElementById('user-name').textContent = `Olá, ${userName}`;
  document.getElementById('auth-container').classList.remove('d-none');
  document.getElementById('login-container').classList.add('d-none');
  document.getElementById('main-content').classList.remove('d-none');
}

function updateUiForSignOut() {
    document.getElementById('auth-container').classList.add('d-none');
    document.getElementById('login-container').classList.remove('d-none');
    document.getElementById('main-content').classList.add('d-none');
    localStorage.clear();
}

// =================================================================================
// LÓGICA PRINCIPAL E MANIPULADORES DE EVENTOS
// =================================================================================
async function initializeAppLogic() {
  checkUnidadeFixada();
  await fetchConcluidos();
  await popularUnidadesParaAnalise();
}

function setupEventListeners() {
  document.getElementById('signout-button').addEventListener('click', handleSignoutClick);
  
  // Aba Inventário
  document.getElementById('inventarioForm').addEventListener('submit', handleInventoryFormSubmit);
  document.getElementById('salvarUnidade').addEventListener('click', handleSaveUnidade);
  document.getElementById('resetUnidade').addEventListener('click', handleResetUnidade);
  document.getElementById('editLocal').addEventListener('click', handleEditLocal);

  // Abas de Consulta
  document.getElementById('inventarios-tab').addEventListener('shown.bs.tab', fetchAndDisplayInventarios);
  document.getElementById('relatorios-tab').addEventListener('shown.bs.tab', fetchAndDisplayRelatorios);

  // Botões de Upload
  document.getElementById('uploadSistemaBtn').addEventListener('click', () => handleUpload('Sistema'));
  document.getElementById('uploadInventariosBtn').addEventListener('click', () => handleUpload('Inventario'));
  
  // Análise
  document.getElementById('compararBtn').addEventListener('click', handleAnalysis);
  document.getElementById('exportCsvBtn').addEventListener('click', exportAnalysisToCsv);
}

// =================================================================================
// LÓGICA DA ABA INVENTÁRIO
// =================================================================================
function checkUnidadeFixada() {
  const unidadeFixada = localStorage.getItem('unidadeFixada');
  if (!unidadeFixada) {
    new bootstrap.Modal(document.getElementById('unidadeModal')).show();
  } else {
    document.getElementById('unidade').value = unidadeFixada;
  }
}

function handleSaveUnidade() {
    const unidade = document.getElementById('unidadeInicial').value.trim();
    if (unidade) {
      localStorage.setItem('unidadeFixada', unidade);
      document.getElementById('unidade').value = unidade;
      bootstrap.Modal.getInstance(document.getElementById('unidadeModal')).hide();
      fetchConcluidos();
    }
}

function handleResetUnidade() {
    localStorage.removeItem('unidadeFixada');
    document.getElementById('unidade').value = '';
    new bootstrap.Modal(document.getElementById('unidadeModal')).show();
}

function handleEditLocal() {
    const localInput = document.getElementById('local');
    localInput.readOnly = false;
    localInput.focus();
    localInput.addEventListener('blur', () => { localInput.readOnly = true; }, { once: true });
}

async function handleInventoryFormSubmit(e) {
  e.preventDefault();
  showLoading('Salvando item...');
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

    e.target.reset();
    document.getElementById('unidade').value = localStorage.getItem('unidadeFixada');
    await fetchConcluidos();
    showToast('toastSuccess', 'Item salvo com sucesso!');
  } catch (error) {
    showToast('toastError', `Erro ao salvar: ${error.message}`);
  } finally {
    hideLoading();
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
    tbody.innerHTML = result.items.map(row => `
        <tr>
            <td>${row[0] || ''}</td><td>${row[1] || ''}</td><td>${row[2] || ''}</td>
            <td>${row[3] || ''}</td><td>${row[4] || ''}</td><td>${row[5] || ''}</td>
            <td>${row[6] ? `<a href="${row[6]}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="bi bi-camera"></i></a>` : ''}</td>
        </tr>
    `).join('');
  } catch (error) {
    showToast('toastError', `Não foi possível carregar os itens concluídos: ${error.message}`);
  }
}

// =================================================================================
// UPLOADS
// =================================================================================
async function handleUpload(type) {
    let fileInput, pasteArea, unidade, files, pasteText, data = [], headers;
    
    showLoading(`Processando upload de '${type}'...`);

    try {
        if (type === 'Sistema') {
            unidade = document.getElementById('unidadeSistema').value.trim();
            if (!unidade) throw new Error('Informe o nome da unidade para o Relatório do Sistema.');
            fileInput = document.getElementById('relatorioSistema');
            pasteArea = document.getElementById('pasteSistema');
        } else { // 'Inventario'
            unidade = document.getElementById('unidadeInventario').value.trim(); // Fallback unit
            fileInput = document.getElementById('inventariosAntigos');
            pasteArea = document.getElementById('pasteInventario');
        }

        files = fileInput.files;
        pasteText = pasteArea.value.trim();
        if (files.length === 0 && !pasteText) throw new Error('Selecione um arquivo ou cole os dados para fazer o upload.');

        if (files.length > 0) {
            for (const file of files) {
                const parsed = await parseExcel(file);
                if (parsed.length > 0) {
                    if(!headers) headers = parsed[0];
                    data.push(...parsed.slice(1));
                }
            }
        } else if (pasteText) {
            const parsed = parsePastedText(pasteText);
            if (parsed.length > 0) {
                headers = parsed[0];
                data.push(...parsed.slice(1));
            }
        }

        if (data.length === 0) throw new Error("Nenhum dado válido encontrado para enviar.");

        const hasUnitColumn = headers[0]?.trim().toLowerCase() === 'unidade';
        if (type === 'Inventario' && !hasUnitColumn && !unidade) {
            throw new Error("O arquivo não tem a coluna 'Unidade' e nenhuma Unidade Padrão foi informada.");
        }

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'appendReport',
                sheetName: type === 'Sistema' ? 'RelatorioSistema' : 'Inventario',
                data: data,
                unidadeUpload: unidade,
                hasUnitColumn: hasUnitColumn
            })
        });

        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        showToast('toastSuccess', `Upload de '${type}' concluído! ${data.length} linhas processadas.`);
        fileInput.value = '';
        if (pasteArea) pasteArea.value = '';
        await popularUnidadesParaAnalise();

    } catch (error) {
        showToast('toastError', `Erro no upload: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// =================================================================================
// CONSULTAS E ANÁLISE
// =================================================================================
async function fetchAndDisplayInventarios() {
  // ... (código mantido da versão anterior)
}

async function fetchAndDisplayRelatorios() {
  // ... (código mantido da versão anterior)
}

async function handleAnalysis() {
  const unidade = document.getElementById('unidadeComparar').value;
  if (!unidade) {
    showToast('toastError', 'Selecione uma unidade para gerar o relatório!');
    return;
  }
  
  showLoading('Gerando análise... Isso pode levar alguns instantes.');
  document.getElementById('exportCsvBtn').classList.add('d-none');
  document.getElementById('analiseSummary').classList.add('d-none');
  document.getElementById('resultadoComparacao').innerHTML = '';

  try {
    const [dadosInventario, dadosSistema] = await Promise.all([
      fetchInventarioDaUnidade(unidade),
      carregarRelatorioSistema(),
    ]);

    const resultado = compararInventariosV4(dadosInventario, dadosSistema);
    
    analysisReportData = resultado;
    renderAnalysisResultsV4(resultado, unidade);
    document.getElementById('exportCsvBtn').classList.remove('d-none');
    
  } catch (error) {
    showToast('toastError', `Erro ao gerar relatório: ${error.message}`);
  } finally {
    hideLoading();
  }
}

function compararInventariosV4(inventario, sistema) {
    const normalizeTombo = tombo => tombo ? String(tombo).trim().replace(/^0+/, '') : '';
    let incorporacoes = [], sistemaParaAnalise = new Map(), inventarioComTombo = new Map(), inventarioSemTombo = [];
    
    const sistemaDisponivel = sistema.filter(row => (row[SISTEMA_COLUMNS.STATUS] || '').trim().toUpperCase() === 'DISPONÍVEL');

    sistemaDisponivel.forEach((row, index) => {
        if ((row[SISTEMA_COLUMNS.TIPO_ENTRADA] || '').toLowerCase().includes('incorporação')) {
            incorporacoes.push({ sysRow: row });
        } else {
            const tomboNorm = normalizeTombo(row[SISTEMA_COLUMNS.TOMBAMENTO]);
            if (tomboNorm) sistemaParaAnalise.set(tomboNorm, { sysRow: row, originalIndex: index });
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

    let matches = [], divergences = [], matchedBySimilarDesc = [];

    inventarioComTombo.forEach((invData, tomboNorm) => {
        if (sistemaParaAnalise.has(tomboNorm)) {
            const sysData = sistemaParaAnalise.get(tomboNorm);
            if (normalizeDescription(invData.invRow[2]) === normalizeDescription(sysData.sysRow[SISTEMA_COLUMNS.DESCRICAO])) {
                matches.push({ ...invData, ...sysData });
            } else {
                divergences.push({ ...invData, ...sysData });
            }
            inventarioComTombo.delete(tomboNorm);
            sistemaParaAnalise.delete(tomboNorm);
        }
    });

    let sistemaRestante = Array.from(sistemaParaAnalise.values());
    inventarioSemTombo.forEach((invData, invIndex) => {
        if (!invData) return;
        let bestMatch = { score: 0.7, sysData: null, sysIndex: -1 }; // THRESHOLD AUMENTADO

        sistemaRestante.forEach((sysData, sysIndex) => {
             if (!sysData) return;
             const score = stringSimilarity(normalizeDescription(invData.invRow[2]), normalizeDescription(sysData.sysRow[SISTEMA_COLUMNS.DESCRICAO]));
             if (score > bestMatch.score) {
                 bestMatch = { score, sysData, sysIndex };
             }
        });

        if (bestMatch.sysData) {
            matchedBySimilarDesc.push({ ...invData, ...bestMatch.sysData, score: bestMatch.score });
            sistemaParaAnalise.delete(normalizeTombo(bestMatch.sysData.sysRow[SISTEMA_COLUMNS.TOMBAMENTO]));
            sistemaRestante[bestMatch.sysIndex] = null;
            inventarioSemTombo[invIndex] = null;
        }
    });
    
    const remainingSystem = sistemaRestante.filter(Boolean);
    const remainingInventory = [...Array.from(inventarioComTombo.values()), ...inventarioSemTombo.filter(Boolean)];

    return { matches, divergences, incorporacoes, matchedBySimilarDesc, remainingSystem, remainingInventory, totalSystem: sistema.length, totalInventory: inventario.length };
}

// =================================================================================
// FUNÇÕES AUXILIARES E DE UI
// =================================================================================
// As funções auxiliares (formatCurrency, createSimpleTable, showToast, etc.) são mantidas da versão anterior.
// Incluindo apenas as mais importantes para referência.

function normalizeDescription(str) {
    if (!str) return '';
    return str.toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').replace(/\s+/g, ' '); 
}

function stringSimilarity(s1, s2) {
    // ... (código mantido da versão anterior)
}

function showToast(type, message) {
  const toastEl = document.getElementById(type);
  if (toastEl) {
    toastEl.querySelector('.toast-body').textContent = message;
    new bootstrap.Toast(toastEl).show();
  }
}

function showLoading(message = 'Processando...') {
    document.getElementById('loadingText').textContent = message;
    loadingModalInstance.show();
}

function hideLoading() {
    loadingModalInstance.hide();
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

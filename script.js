// CONFIGURAÇÃO E INICIALIZAÇÃO
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby99cTAFdCucXd1EQ7rVqL6qMVkXFLaYUShD9c2iy6eqv36PP_y9t6Lz6sRm41GT3wGjg/exec';
const DRIVE_FOLDER_ID = '1DGuZWpe9kakSpRUvy7qqizll0bqJB62o';
const CLIENT_ID = '431216787156-vfivrga4ueekuabmrqk0du5tgbsdrvma.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Mapeamento da estrutura de 9 colunas do Relatório do Sistema
const SISTEMA_COLUMNS = {
    TOMBAMENTO: 0,
    ESPECIE: 1,
    DESCRICAO: 2,
    STATUS: 3,
    TIPO_ENTRADA: 4,
    CADASTRO: 5,
    VALOR_NF: 6,
    NF: 7,
    FORNECEDOR: 8,
    UNIDADE: 9
};


// Variáveis de estado global
let accessToken = null;
let analysisReportData = {};

// FLUXO DE AUTENTICAÇÃO E CARREGAMENTO INICIAL
window.onload = () => {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
  });
  google.accounts.id.disableAutoSelect();
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
}

// LÓGICA PRINCIPAL DO APLICATIVO
async function initializeAppLogic() {
  loadDraft();
  checkUnidadeFixada();
  await fetchConcluidos();
  await popularUnidadesParaAnalise();
  await popularUnidadesSistemaParaAnalise();
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

// MANIPULADORES DE EVENTOS
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
}

// Nova função para popular dropdown de unidades do sistema
async function popularUnidadesSistemaParaAnalise() {
  try {
    const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'listarUnidadesSistema' }) });
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);

    const select = document.getElementById('unidadeSistemaComparar');
    select.innerHTML = '<option value="">Selecione uma unidade...</option>';
    result.unidadesSistema.forEach(u => {
      const option = new Option(u, u);
      select.add(option);
    });
  } catch (error) {
    showToast('toastError', `Erro ao carregar unidades do sistema: ${error.message}`);
  }
}

// FUNÇÕES DE LÓGICA E COMUNICAÇÃO COM APPS SCRIPT
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
  const fileInput = document.getElementById(type === 'Sistema' ? 'relatorioSistema' : 'inventariosAntigos');
  const pasteArea = document.getElementById(type === 'Sistema' ? 'pasteSistema' : 'pasteInventario');
  const files = fileInput.files;
  let pasteText = pasteArea.value.trim();
  // Linha 269: Adicione isso pra debug - se null, loga erro
  const massUploadElement = document.getElementById(type === 'Sistema' ? 'massUploadSistema' : 'massUpload');
  if (!massUploadElement) {
    console.error(`Elemento checkbox '${type === 'Sistema' ? 'massUploadSistema' : 'massUpload'}' não encontrado! Adicione no HTML.`);
    showToast('toastError', 'Erro: Checkbox de carregamento em massa não encontrado. Adicione no HTML e recarregue.');
    return;
  }
  const massUpload = massUploadElement.checked;

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
      pasteText = pasteText.replace(/[\r\n]+/g, '\n').trim(); // Normaliza linhas
      data = pasteText.split('\n').map(line => line.split(/[\t,; ]+/).map(cell => cell.trim()));
    }
    if (data.length === 0) throw new Error("Nenhum dado válido para enviar.");

    if (type === 'Sistema' && !massUpload && data.some(row => row.length >= 10 && row[9] && row[9].trim() !== unidade)) {
      showToast('toastWarning', 'Aviso: Dados parecem ter múltiplas unidades na coluna J. Marque "Carregamento em Massa" para evitar mistura.');
    }

    if (type === 'Inventario') {
      data = data.map(row => {
        if (row.length < 5) throw new Error("Formato inválido: precisa de UNIDADE, ITEM, TOMBO, LOCAL, ESTADO DE CONSERVAÇÃO.");
        const unidadeRow = massUpload ? (row[0] || '') : unidade; // Se mass, usa row[0]; else input
        if (massUpload && !row[0]) throw new Error("Para carregamento em massa, inclua UNIDADE na coluna A.");
        return [unidadeRow, row[1], row[2], row[3], row[4], '1']; // Quantidade default 1
      });
    } else if (type === 'Sistema') {
      if (massUpload) {
        data.forEach(row => {
          if (row.length < 10) throw new Error("Formato inválido para Relatório do Sistema em massa: precisa de 10 colunas incluindo UNIDADE na J.");
        });
      } else {
        data.forEach(row => {
          if (row.length < 9) throw new Error("Formato inválido para Relatório do Sistema: precisa de 9 colunas.");
        });
      }
    }

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'appendReport',
        sheetName: type === 'Sistema' ? 'RelatorioSistema' : 'Inventario',
        data: data,
        unidadeUpload: massUpload ? '' : unidade, // Envia vazio se mass, backend usa per-row
        massUpload: massUpload
      })
    });
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);

    showToast('toastSuccess', `Upload de '${type}' concluído com sucesso!`);
    fileInput.value = '';
    pasteArea.value = '';
    await popularUnidadesParaAnalise();
    await popularUnidadesSistemaParaAnalise(); // Atualiza dropdowns após upload
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

    const allHeaders = ['TOMBAMENTO', 'Espécie', 'Descrição', 'Status', 'Tipo Entrada', 'Cadastro', 'Valor NF', 'NF', 'Nome Fornecedor', 'Unidade']; 
    
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

// LÓGICA DE ANÁLISE DE INVENTÁRIO
async function handleAnalysis() {
  const unidadeInventario = document.getElementById('unidadeComparar').value;
  const unidadeSistema = document.getElementById('unidadeSistemaComparar').value;
  if (!unidadeInventario || !unidadeSistema) {
    showToast('toastError', 'Selecione as unidades para comparar!');
    return;
  }
  
  const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
  loadingModal.show();
  document.getElementById('exportCsvBtn').classList.add('d-none');
  document.getElementById('analiseSummary').classList.add('d-none');
  document.getElementById('resultadoComparacao').innerHTML = '';

  try {
    const [dadosInventario, dadosSistema] = await Promise.all([
      fetchInventarioDaUnidade(unidadeInventario),
      carregarRelatorioSistema(unidadeSistema),
    ]);

    const resultado = compararInventariosV4(dadosInventario, dadosSistema, unidadeInventario);
    
    analysisReportData = resultado;
    renderAnalysisResultsV4(resultado, unidadeInventario);
    document.getElementById('exportCsvBtn').classList.remove('d-none');
    
    localStorage.setItem('lastAnalysisUnit', unidadeInventario);

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

async function carregarRelatorioSistema(unidadeSistema) {
  const response = await fetch(SCRIPT_URL, { method: "POST", body: JSON.stringify({ action: "getRelatorioSistema", unidade: unidadeSistema }) });
  const result = await response.json();
  if (result.status === "success") return result.data;
  throw new Error(result.message || 'Erro ao buscar dados do sistema.');
}

function normalizeDescription(str) {
    if (!str) return '';
    return str
        .toString()
        .trim()
        .toLowerCase()
        .normalize("NFD") 
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^\w\s]/gi, '') 
        .replace(/\s+/g, ' '); 
}

function levenshteinDistance(s1, s2) {
  const matrix = Array.from({ length: s1.length + 1 }, () => Array(s2.length + 1).fill(0));
  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[s1.length][s2.length];
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

    const bigramScore = (2 * intersectionSize) / (str1.length + str2.length - 2);
    const levDist = levenshteinDistance(str1, str2);
    const levScore = 1 - (levDist / Math.max(str1.length, str2.length));
    return (bigramScore + levScore) / 2;
}

function compararInventariosV4(inventario, sistema, unidade) {
    const normalizeTombo = tombo => tombo ? String(tombo).trim().replace(/^0+/, '') : '';

    let incorporacoes = [];
    let sistemaParaAnalise = new Map();
    let inventarioComTombo = new Map();
    let inventarioSemTombo = [];

    const sistemaDisponivel = sistema.filter(row => (row[SISTEMA_COLUMNS.STATUS] || '').trim().toUpperCase() === 'DISPONÍVEL');

    sistemaDisponivel.forEach((row, index) => {
        const tipoEntrada = (row[SISTEMA_COLUMNS.TIPO_ENTRADA] || '').toLowerCase();
        if (tipoEntrada.includes('incorporação')) {
            incorporacoes.push({ sysRow: row });
        } else {
            const tomboNorm = normalizeTombo(row[SISTEMA_COLUMNS.TOMBAMENTO]);
            if (tomboNorm) {
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

    let matches = [], divergences = [], matchedByExactDesc = [], matchedBySimilarDesc = [], needsManualReview = [];

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

    const sistemaRestante = Array.from(sistemaParaAnalise.values());
    inventarioSemTombo.forEach((invData, invIndex) => {
        if (!invData) return;
        
        let exactMatchIndex = sistemaRestante.findIndex(sysData => 
            sysData && normalizeDescription(invData.invRow[2]) === normalizeDescription(sysData.sysRow[SISTEMA_COLUMNS.DESCRICAO]) && normalizeDescription(invData.invRow[2]) === normalizeDescription(sysData.sysRow[SISTEMA_COLUMNS.ESPECIE])
        );

        if (exactMatchIndex !== -1) {
            const sysData = sistemaRestante[exactMatchIndex];
            matchedByExactDesc.push({ ...invData, ...sysData });
            sistemaParaAnalise.delete(normalizeTombo(sysData.sysRow[SISTEMA_COLUMNS.TOMBAMENTO]));
            sistemaRestante[exactMatchIndex] = null;
            inventarioSemTombo[invIndex] = null;
            return;
        }
    });
    
    let inventarioSemTomboRestante = inventarioSemTombo.filter(Boolean);
    let sistemaAindaRestante = sistemaRestante.filter(Boolean);

    inventarioSemTomboRestante.forEach((invData, invIndex) => {
        if (!invData) return;
        let bestMatch = { score: 0.7, sysData: null, sysIndex: -1 }; // Threshold 0.7
        
        sistemaAindaRestante.forEach((sysData, sysIndex) => {
             if (!sysData) return;
             const score = stringSimilarity(normalizeDescription(invData.invRow[2]), normalizeDescription(sysData.sysRow[SISTEMA_COLUMNS.DESCRICAO]));
             const especieScore = stringSimilarity(normalizeDescription(invData.invRow[2]), normalizeDescription(sysData.sysRow[SISTEMA_COLUMNS.ESPECIE]));
             const combinedScore = (score + especieScore) / 2;
             if (combinedScore > bestMatch.score) {
                 bestMatch = { score: combinedScore, sysData, sysIndex };
             }
        });

        if (bestMatch.sysData) {
            if (bestMatch.score >= 0.7) {
                matchedBySimilarDesc.push({ ...invData, ...bestMatch.sysData, score: bestMatch.score });
            } else {
                needsManualReview.push({ ...invData, ...bestMatch.sysData, score: bestMatch.score });
            }
            sistemaParaAnalise.delete(normalizeTombo(bestMatch.sysData.sysRow[SISTEMA_COLUMNS.TOMBAMENTO]));
            sistemaAindaRestante[bestMatch.sysIndex] = null;
            inventarioSemTomboRestante[invIndex] = null;
        }
    });
    
    let remainingSystem = Array.from(sistemaParaAnalise.values());
    const remainingInventory = [...Array.from(inventarioComTombo.values()), ...inventarioSemTomboRestante.filter(Boolean)];

    const currentYear = new Date().getFullYear();
    remainingSystem = remainingSystem.map(item => {
      const cadastroDate = new Date(item.sysRow[SISTEMA_COLUMNS.CADASTRO]);
      item.isNew = !isNaN(cadastroDate.getTime()) && cadastroDate.getFullYear() >= 2023 && cadastroDate.getFullYear() <= currentYear;
      return item;
    });

    return { 
        matches, divergences, incorporacoes, matchedByExactDesc, matchedBySimilarDesc, needsManualReview,
        remainingSystem, remainingInventory,
        totalSystem: sistema.length,
        totalInventory: inventario.length
    };
}

function renderAnalysisResultsV4(data, unidade) {
    const { matches, divergences, incorporacoes, matchedByExactDesc, matchedBySimilarDesc, needsManualReview, remainingSystem, remainingInventory, totalSystem, totalInventory } = data;
    const totalConciliado = matches.length + matchedByExactDesc.length + matchedBySimilarDesc.length;

    const summaryContainer = document.getElementById('analiseSummary');
    summaryContainer.innerHTML = `
        <h5 class="mb-3">Resumo da Análise para o Inventário de: <strong>${unidade}</strong></h5>
        <div class="row">
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-primary"><h6><i class="bi bi-building me-2"></i>Total no Sistema</h6><span class="fs-4">${totalSystem}</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-secondary"><h6><i class="bi bi-clipboard-check me-2"></i>Itens no Inventário</h6><span class="fs-4">${totalInventory}</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-white bg-success"><h6><i class="bi bi-check-circle-fill me-2"></i>Conciliados</h6><span class="fs-4">${totalConciliado}</span></div></div>
            <div class="col-lg-3 col-md-6 mb-3"><div class="card p-3 analysis-summary-card text-dark bg-warning"><h6><i class="bi bi-exclamation-triangle-fill me-2"></i>Pendentes</h6><span class="fs-4">${remainingSystem.length + remainingInventory.length}</span></div></div>
        </div>
    `;
    summaryContainer.classList.remove('d-none');

    const resultsContainer = document.getElementById('resultadoComparacao');
    resultsContainer.innerHTML = '';

    const getSysData = (row) => [formatDate(row[SISTEMA_COLUMNS.CADASTRO]), formatCurrency(row[SISTEMA_COLUMNS.VALOR_NF])];

    if (matches.length > 0) resultsContainer.innerHTML += createDetailedTable('Conciliados por Tombo', 'bg-success-strong', 
        ['Tombo', 'Descrição', 'Local', 'Estado', 'Cadastro', 'Valor NF'], 
        matches.map(m => [m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.invRow[2], m.invRow[1], m.invRow[4], ...getSysData(m.sysRow)])
    );
    if (matchedByExactDesc.length > 0) resultsContainer.innerHTML += createDetailedTable('Conciliados por Descrição (Match Exato)', 'bg-info-strong', 
        ['Tombo Sugerido', 'Descrição Inventário (S/T)', 'Descrição Sistema', 'Espécie', 'Cadastro', 'Valor NF'], 
        matchedByExactDesc.map(m => [m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.invRow[2], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], ...getSysData(m.sysRow)])
    );
    if (matchedBySimilarDesc.length > 0) resultsContainer.innerHTML += createDetailedTable('Conciliados por Descrição (Similaridade)', 'bg-info-strong', 
        ['Tombo Sugerido', 'Descrição Inventário (S/T)', 'Descrição Sistema', 'Espécie', 'Similaridade', 'Cadastro', 'Valor NF'], 
        matchedBySimilarDesc.map(m => [m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.invRow[2], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], `${(m.score * 100).toFixed(0)}%`, ...getSysData(m.sysRow)])
    );
    if (divergences.length > 0) resultsContainer.innerHTML += createDetailedTable('Divergências de Descrição (Mesmo Tombo)', 'bg-warning-strong', 
        ['Tombo', 'Descrição Inventário', 'Descrição Sistema', 'Espécie', 'Cadastro', 'Valor NF'], 
        divergences.map(d => [d.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], d.invRow[2], d.sysRow[SISTEMA_COLUMNS.DESCRICAO], d.sysRow[SISTEMA_COLUMNS.ESPECIE], ...getSysData(d.sysRow)])
    );

    const pendingNew = remainingSystem.filter(m => m.isNew);
    const pendingOld = remainingSystem.filter(m => !m.isNew);

    if (pendingNew.length > 0) resultsContainer.innerHTML += createDetailedTable('Pendentes Novos (Cadastro 2023-2025)', 'bg-warning-strong', 
        ['Tombo', 'Descrição Sistema', 'Espécie', 'NF', 'Fornecedor', 'Cadastro', 'Valor NF'], 
        pendingNew.map(m => [m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], m.sysRow[SISTEMA_COLUMNS.NF], m.sysRow[SISTEMA_COLUMNS.FORNECEDOR], formatDate(m.sysRow[SISTEMA_COLUMNS.CADASTRO]), formatCurrency(m.sysRow[SISTEMA_COLUMNS.VALOR_NF])])
    );
    if (pendingOld.length > 0) resultsContainer.innerHTML += createDetailedTable('Pendentes Antigos (Antes de 2023)', 'bg-danger-strong', 
        ['Tombo', 'Descrição Sistema', 'Espécie', 'NF', 'Fornecedor', 'Cadastro', 'Valor NF'], 
        pendingOld.map(m => [m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], m.sysRow[SISTEMA_COLUMNS.NF], m.sysRow[SISTEMA_COLUMNS.FORNECEDOR], formatDate(m.sysRow[SISTEMA_COLUMNS.CADASTRO]), formatCurrency(m.sysRow[SISTEMA_COLUMNS.VALOR_NF])])
    );

    if (needsManualReview.length > 0) resultsContainer.innerHTML += createDetailedTable('Pendentes para Revisão Manual (Baixa Similaridade)', 'bg-danger-strong', 
        ['Tombo Sugerido', 'Descrição Inventário (S/T)', 'Descrição Sistema', 'Espécie', 'Similaridade', 'Cadastro', 'Valor NF'], 
        needsManualReview.map(m => [m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.invRow[2], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], `${(m.score * 100).toFixed(0)}%`, ...getSysData(m.sysRow)])
    );

    if (remainingInventory.length > 0) resultsContainer.innerHTML += createDetailedTable('Itens Pendentes (Apenas no Inventário Físico)', 'bg-danger-strong', 
        ['Tombo', 'Descrição Inventário', 'Local', 'Estado'], 
        remainingInventory.map(m => [m.invRow[3], m.invRow[2], m.invRow[1], m.invRow[4]])
    );
    if (incorporacoes.length > 0) resultsContainer.innerHTML += createDetailedTable('Itens de Incorporação (Separados para Baixa)', 'bg-light-strong', 
        ['Tombo', 'Descrição Sistema', 'Espécie', 'NF', 'Cadastro', 'Valor NF'], 
        incorporacoes.map(i => [i.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], i.sysRow[SISTEMA_COLUMNS.DESCRICAO], i.sysRow[SISTEMA_COLUMNS.ESPECIE], i.sysRow[SISTEMA_COLUMNS.NF], formatDate(i.sysRow[SISTEMA_COLUMNS.CADASTRO]), formatCurrency(i.sysRow[SISTEMA_COLUMNS.VALOR_NF])])
    );
}

function exportAnalysisToCsv() {
  const { matches, divergences, incorporacoes, matchedByExactDesc, matchedBySimilarDesc, needsManualReview, remainingSystem, remainingInventory } = analysisReportData;
  if (!analysisReportData) return;

  const escapeCsvCell = (cell) => `"${String(cell || '').replace(/"/g, '""')}"`;
  let csvContent = 'Categoria;Tombo;Descricao_Inventario;Descricao_Sistema;Especie;Local_Inventario;Estado_Inventario;NF_Sistema;Fornecedor_Sistema;Cadastro_Sistema;Valor_NF_Sistema;Observacao\n';

  const getSysData = (row) => [row[SISTEMA_COLUMNS.NF], row[SISTEMA_COLUMNS.FORNECEDOR], formatDate(row[SISTEMA_COLUMNS.CADASTRO]), formatCurrency(row[SISTEMA_COLUMNS.VALOR_NF])];

  matches.forEach(m => csvContent += ['Conciliado por Tombo', m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.invRow[2], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], m.invRow[1], m.invRow[4], ...getSysData(m.sysRow), ''].map(escapeCsvCell).join(';') + '\n');
  matchedByExactDesc.forEach(m => csvContent += ['Conciliado por Descricao (Exato)', m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.invRow[2], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], m.invRow[1], m.invRow[4], ...getSysData(m.sysRow), 'Match exato de descrição normalizada'].map(escapeCsvCell).join(';') + '\n');
  matchedBySimilarDesc.forEach(m => csvContent += ['Conciliado por Descricao (Similar)', m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.invRow[2], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], m.invRow[1], m.invRow[4], ...getSysData(m.sysRow), `Similaridade de ${(m.score * 100).toFixed(0)}%`].map(escapeCsvCell).join(';') + '\n');
  divergences.forEach(d => csvContent += ['Divergencia', d.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], d.invRow[2], d.sysRow[SISTEMA_COLUMNS.DESCRICAO], d.sysRow[SISTEMA_COLUMNS.ESPECIE], d.invRow[1], d.invRow[4], ...getSysData(d.sysRow), 'Descricoes diferentes para o mesmo tombo'].map(escapeCsvCell).join(';') + '\n');
  
  remainingSystem.forEach(m => {
    const category = m.isNew ? 'Pendente Novo no Sistema' : 'Pendente Antigo no Sistema';
    csvContent += [category, m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], '', m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], '', '', ...getSysData(m.sysRow), 'Item nao encontrado no inventario fisico'].map(escapeCsvCell).join(';') + '\n';
  });
  
  remainingInventory.forEach(m => csvContent += ['Pendente no Inventario', m.invRow[3], m.invRow[2], '', '', m.invRow[1], m.invRow[4], '', '', '', '', 'Item nao encontrado no relatorio do sistema'].map(escapeCsvCell).join(';') + '\n');
  
  incorporacoes.forEach(i => csvContent += ['Incorporacao (para Baixa)', i.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], '', i.sysRow[SISTEMA_COLUMNS.DESCRICAO], i.sysRow[SISTEMA_COLUMNS.ESPECIE], '', '', ...getSysData(i.sysRow), 'Item de incorporacao, separado para analise'].map(escapeCsvCell).join(';') + '\n');

  needsManualReview.forEach(m => csvContent += ['Pendente Revisao Manual (Baixa Similaridade)', m.sysRow[SISTEMA_COLUMNS.TOMBAMENTO], m.invRow[2], m.sysRow[SISTEMA_COLUMNS.DESCRICAO], m.sysRow[SISTEMA_COLUMNS.ESPECIE], m.invRow[1], m.invRow[4], ...getSysData(m.sysRow), `Similaridade baixa de ${(m.score * 100).toFixed(0)}%`].map(escapeCsvCell).join(';') + '\n');

  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `relatorio_analise_avancado_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// FUNÇÕES AUXILIARES E DE UI
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return dateString;
  }
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number') {
    if (Number.isInteger(value) && value > 10000) {
      value /= 100;
    }
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  if (typeof value === 'string') {
    let sanitizedValue = value.replace(/R\$\s?/, '').trim();
    
    if (/^\d+$/.test(sanitizedValue)) {
      let number = parseInt(sanitizedValue, 10);
      if (number > 10000) {
        number /= 100;
      }
      return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    
    if (sanitizedValue.includes(',')) {
        const numberString = sanitizedValue.replace(/\./g, '').replace(',', '.');
        const number = parseFloat(numberString);
        if (!isNaN(number)) {
            return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    } else {
        const number = parseFloat(sanitizedValue);
        if (!isNaN(number)) {
            return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
    }
  }

  return value;
}


async function popularUnidadesParaAnalise() {
  try {
    const response = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'listarUnidades' }) });
    const result = await response.json();
    if (result.status !== 'success') throw new Error(result.message);

    const select = document.getElementById('unidadeComparar');
    select.innerHTML = '<option value="">Selecione uma unidade...</option>';
    result.unidades.forEach(u => {
      const option = new Option(u, u);
      select.add(option);
    });

    const lastUnit = localStorage.getItem('lastAnalysisUnit');
    if (lastUnit) {
        select.value = lastUnit;
    }

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
  const toastEl = document.getElementById(type);
  if (toastEl) {
    toastEl.querySelector('.toast-body').textContent = message;
    new bootstrap.Toast(toastEl).show();
  }
}

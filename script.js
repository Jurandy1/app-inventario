// =================================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO
// =================================================================================
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby99cTAFdCucXd1EQ7rVqL6qMVkXFLaYUShD9c2iy6eqv36PP_y9t6Lz6sRm41GT3wGjg/exec';
const DRIVE_FOLDER_ID = '1DGuZWpe9kakSpRUvy7qqizll0bqJB62o';
const CLIENT_ID = '431216787156-vfivrga4ueekuabmrqk0du5tgbsdrvma.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

// Variáveis de estado global
let accessToken = null;
let analysisReportData = {};

// =================================================================================
// FLUXO DE AUTENTICAÇÃO (Simplificado)
// =================================================================================
window.onload = () => {
  // Inicializa o cliente do Google Identity Services para login
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
  });
  // Anexa todos os event listeners da UI
  setupEventListeners();
};

// Lida com a resposta do login do Google
function handleCredentialResponse(response) {
  const profile = JSON.parse(atob(response.credential.split('.')[1]));
  updateUiForSignIn(profile.name);
  requestAccessToken();
}

// Solicita o token de acesso OAuth2 APENAS para o Drive
function requestAccessToken() {
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (tokenResponse) => {
      if (tokenResponse && tokenResponse.access_token) {
        accessToken = tokenResponse.access_token;
        initializeAppLogic(); // Inicia o app após obter o token
      } else {
        showToast('toastError', 'Falha na autorização para fazer upload de fotos.');
      }
    },
  });
  tokenClient.requestAccessToken();
}

// Lida com o clique no botão de logout
function handleSignoutClick() {
  if (accessToken) {
    google.accounts.oauth2.revoke(accessToken, () => {
      accessToken = null;
    });
  }
  google.accounts.id.disableAutoSelect();
  // Atualiza a UI para o estado "deslogado"
  document.getElementById('auth-container').style.display = 'none';
  document.getElementById('login-container').style.display = 'block';
  document.getElementById('main-content').style.display = 'none';
}

// Atualiza a UI para o estado "logado"
function updateUiForSignIn(userName) {
  document.getElementById('user-name').textContent = `Olá, ${userName}`;
  document.getElementById('auth-container').style.display = 'block';
  document.getElementById('login-container').style.display = 'none';
  document.getElementById('main-content').style.display = 'block';
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
  document.getElementById('signin-button').addEventListener('click', () => google.accounts.id.prompt());
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

  if (!response.ok) throw new Error('Falha no upload para o Drive.');
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
        <td>${row[6] ? `<a href="${row[6]}" target="_blank" class="btn btn-sm btn-outline-primary">Ver</a>` : 'N/A'}</td>
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

        showToast('toastSuccess', `Upload de '${type}' concluído!`);
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
            accordionContainer.innerHTML = '<p>Nenhum inventário cadastrado ainda.</p>';
            return;
        }

        Object.keys(inventariosAgrupados).sort().forEach((unidade, index) => {
            const { Site, Upload } = inventariosAgrupados[unidade];
            const accordionItem = `
                <div class="accordion-item">
                    <h2 class="accordion-header"><button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}">
                        ${unidade} <span class="badge bg-secondary ms-2">${Site.length + Upload.length} itens</span>
                    </button></h2>
                    <div id="collapse-${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#inventariosAccordion">
                        <div class="accordion-body">
                            ${createTableHtml('Feitos no Site', ['Item', 'Tombo', 'Local', 'Estado'], Site, [2, 3, 1, 4])}
                            ${createTableHtml('Carregados por Upload', ['Item', 'Tombo', 'Local', 'Estado'], Upload, [2, 3, 1, 4])}
                        </div>
                    </div>
                </div>`;
            accordionContainer.innerHTML += accordionItem;
        });
    } catch (error) {
        showToast('toastError', `Erro ao buscar inventários: ${error.message}`);
    }
}

async function handleAnalysis() {
    const unidade = document.getElementById('unidadeComparar').value;
    if (!unidade) return showToast('toastError', 'Selecione uma unidade para gerar o relatório!');
    
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    loadingModal.show();
    document.getElementById('exportCsvBtn').classList.add('d-none');
    try {
        const response = await fetch(`${SCRIPT_URL}?action=gerarRelatorioAnalise&unidade=${encodeURIComponent(unidade)}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        
        analysisReportData = result.report;
        renderAnalysisResults(analysisReportData);
        document.getElementById('exportCsvBtn').classList.remove('d-none');
    } catch (error) {
        showToast('toastError', `Erro ao gerar relatório: ${error.message}`);
    } finally {
        loadingModal.hide();
    }
}

function exportAnalysisToCsv() {
    const { matches, missingPhysical, missingSystem, observations } = analysisReportData;
    if (!matches && !missingPhysical && !missingSystem) return;

    const headers = ['Tipo', 'Tombo', 'Descrição Inventário', 'Descrição Sistema', 'Nota Fiscal', 'Fornecedor', 'Info Completa Sistema', 'Observação'];
    const escapeCsvCell = (cell) => `"${String(cell || '').replace(/"/g, '""')}"`;
    let csvContent = headers.join(';') + '\n';

    matches.forEach(m => csvContent += ['Match', m.tombo, m.descInventory, m.descSystem, m.nf, m.fornecedor, m.fullSystem.join(','), ''].map(escapeCsvCell).join(';') + '\n');
    missingPhysical.forEach(mp => csvContent += ['Faltando no Físico', mp.tombo, '', mp.desc, '', '', mp.fullSystem.join(','), ''].map(escapeCsvCell).join(';') + '\n');
    missingSystem.forEach(ms => csvContent += ['Faltando no Sistema', ms.tombo, ms.desc, '', '', '', '', ''].map(escapeCsvCell).join(';') + '\n');
    observations.forEach(o => csvContent += ['Observação', '', '', '', '', '', '', o].map(escapeCsvCell).join(';') + '\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_analise_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// =================================================================================
// FUNÇÕES AUXILIARES E DE UI
// =================================================================================
async function popularUnidadesParaAnalise() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=buscarTodasUnidades`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        const select = document.getElementById('unidadeComparar');
        select.innerHTML = '<option value="">Selecione uma unidade...</option>';
        result.unidades.sort().forEach(u => {
            select.add(new Option(u, u.toLowerCase()));
        });
    } catch(error) {
        showToast('toastError', `Erro ao carregar unidades: ${error.message}`);
    }
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
        resolve(XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }));
      } catch (error) { reject(error); }
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsBinaryString(file);
  });
}

function parsePastedText(text) {
  return text.split('\n').filter(line => line.trim()).map(line => line.split('\t').map(cell => cell.trim()));
}

function createTableHtml(title, headers, data, dataIndices) {
    if (!data || data.length === 0) return '';
    let table = `<h5>${title} (${data.length})</h5><div class="table-responsive"><table class="table table-sm table-striped table-hover"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    data.forEach(row => {
        table += '<tr>';
        dataIndices.forEach(index => table += `<td>${row[index] || ''}</td>`);
        table += '</tr>';
    });
    return table + '</tbody></table></div>';
}

function renderAnalysisResults({ matches, missingPhysical, missingSystem, observations }) {
    const renderTable = (title, count, bgColor, textColor, headers, data, indices) => `
        <div class="card mb-3">
            <div class="card-header ${bgColor} ${textColor} fw-bold">${title} - ${count}</div>
            <div class="card-body">${createTableHtml('', headers, data, indices)}</div>
        </div>`;
    
    document.getElementById('resultadoComparacao').innerHTML = 
        renderTable('Itens Encontrados (Matches)', matches.length, 'bg-success', 'text-white', ['Tombo', 'Descrição', 'Nota Fiscal'], matches, ['tombo', 'descInventory', 'nf']) +
        renderTable('Itens Faltando no Inventário Físico', missingPhysical.length, 'bg-warning', 'text-dark', ['Tombo', 'Descrição'], missingPhysical, ['tombo', 'desc']) +
        renderTable('Itens Sobrando (Não Constam no Sistema)', missingSystem.length, 'bg-danger', 'text-white', ['Tombo', 'Descrição'], missingSystem, ['tombo', 'desc']);
}

function showToast(id, message) {
  const toastEl = document.getElementById(id);
  if (toastEl) {
    toastEl.querySelector('.toast-body').textContent = message;
    new bootstrap.Toast(toastEl).show();
  }
}

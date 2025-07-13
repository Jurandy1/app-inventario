// =================================================================================
// CONFIGURAÇÃO E INICIALIZAÇÃO
// =================================================================================

const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby99cTAFdCucXd1EQ7rVqL6qMVkXFLaYUShD9c2iy6eqv36PP_y9t6Lz6sRm41GT3wGjg/exec';
const SHEET_ID = '1Ye2r43tRukP6i4TMMrBQ-89AMgcweO9VEtv7ooj2cCc';
const DRIVE_FOLDER_ID = '1DGuZWpe9kakSpRUvy7qqizll0bqJB62o';

// Credenciais da API do Google (substitua pelos seus valores)
const API_KEY = 'AIzaSyCDRvL3Jm5QhgvcfExL3Z_ZJR_Xw149hFw';
const CLIENT_ID = '431216787156-vfivrga4ueekuabmrqk0du5tgbsdrvma.apps.googleusercontent.com';
const DISCOVERY_DOCS = [
  'https://sheets.googleapis.com/$discovery/rest?version=v4',
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';

// Elementos da UI
const signinButton = document.getElementById('signin-button');
const signoutButton = document.getElementById('signout-button');
const authContainer = document.getElementById('auth-container');
const loginContainer = document.getElementById('login-container');
const mainContent = document.getElementById('main-content');
const userNameSpan = document.getElementById('user-name');

// Variáveis de estado global
let gapiInited = false;
let gapiClientInited = false;
let analysisReportData = {}; // Armazena os dados da análise para exportação

// Carregar a biblioteca do Google
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

// Inicializar o cliente da API
function initClient() {
  gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  }).then(() => {
    gapiClientInited = true;
    // Escuta por mudanças no status de login
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
    // Lida com o status de login inicial
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
  }).catch(err => console.error('Error initializing GAPI client:', err));
}

// Atualiza a UI com base no status de login
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authContainer.style.display = 'block';
    loginContainer.style.display = 'none';
    mainContent.style.display = 'block';
    const profile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();
    userNameSpan.textContent = `Olá, ${profile.getName()}`;
    initializeApp(); // Inicia as funções principais do app
  } else {
    authContainer.style.display = 'none';
    loginContainer.style.display = 'block';
    mainContent.style.display = 'none';
    userNameSpan.textContent = '';
  }
}

// Funções de login/logout
function handleAuthClick() {
  gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
  gapi.auth2.getAuthInstance().signOut();
}

// =================================================================================
// FUNÇÕES PRINCIPAIS DO APLICATIVO
// =================================================================================

// Função chamada após o login bem-sucedido
async function initializeApp() {
  loadDraft();
  checkUnidadeFixada();
  await fetchConcluidos();
  await popularUnidadesParaAnalise();
}

// Verifica se a unidade de trabalho está definida no localStorage
function checkUnidadeFixada() {
    const unidadeFixada = localStorage.getItem('unidadeFixada');
    if (!unidadeFixada) {
        new bootstrap.Modal(document.getElementById('unidadeModal')).show();
    } else {
        document.getElementById('unidade').value = unidadeFixada;
    }
}

// Carrega o rascunho salvo
function loadDraft() {
    const draft = JSON.parse(localStorage.getItem('draft'));
    if (draft) {
        document.getElementById('unidade').value = draft.unidade || '';
        document.getElementById('local').value = draft.local || '';
        document.getElementById('item').value = draft.item || '';
        document.getElementById('tombo').value = draft.tombo || '';
        document.getElementById('estado').value = draft.estado || '';
        document.getElementById('quantidade').value = draft.quantidade || '1';
    }
}

// Salva o rascunho do formulário periodicamente
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

window.onload = handleClientLoad;
signinButton.addEventListener('click', handleAuthClick);
signoutButton.addEventListener('click', handleSignoutClick);
setInterval(autoSaveDraft, 30000); // Salva rascunho a cada 30s

// Salvar unidade inicial
document.getElementById('salvarUnidade').addEventListener('click', () => {
  const unidade = document.getElementById('unidadeInicial').value.trim();
  if (unidade) {
    localStorage.setItem('unidadeFixada', unidade);
    document.getElementById('unidade').value = unidade;
    bootstrap.Modal.getInstance(document.getElementById('unidadeModal')).hide();
    fetchConcluidos(); // Recarrega itens para a nova unidade
  }
});

// Resetar unidade
document.getElementById('resetUnidade').addEventListener('click', () => {
  localStorage.removeItem('unidadeFixada');
  document.getElementById('unidade').value = '';
  new bootstrap.Modal(document.getElementById('unidadeModal')).show();
});

// Permitir edição do campo 'local'
document.getElementById('editLocal').addEventListener('click', () => {
  const localInput = document.getElementById('local');
  localInput.readOnly = false;
  localInput.focus();
  localInput.addEventListener('blur', () => {
    localInput.readOnly = true;
  }, { once: true });
});

// Envio do formulário de inventário
document.getElementById('inventarioForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
  loadingModal.show();

  try {
    const file = document.getElementById('foto').files[0];
    let photoUrl = '';

    if (file) {
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

    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    if (!response.ok) throw new Error('Falha na comunicação com o servidor.');

    localStorage.removeItem('draft');
    e.target.reset();
    document.getElementById('unidade').value = localStorage.getItem('unidadeFixada'); // Restaura a unidade fixada
    await fetchConcluidos();
    showToast('toastSuccess', 'Item salvo com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar item:', error);
    showToast('toastError', `Erro ao salvar: ${error.message}`);
  } finally {
    loadingModal.hide();
  }
});


// Uploads de relatórios (Sistema e Inventários Antigos)
document.getElementById('uploadSistemaBtn').addEventListener('click', () => handleUpload('Sistema'));
document.getElementById('uploadInventariosBtn').addEventListener('click', () => handleUpload('Inventario'));

// Aba de Inventários (Acordeão)
document.getElementById('inventarios-tab').addEventListener('shown.bs.tab', fetchAndDisplayInventarios);

// Análise de Inventário
document.getElementById('compararBtn').addEventListener('click', handleAnalysis);

// Exportar para CSV
document.getElementById('exportCsvBtn').addEventListener('click', exportAnalysisToCsv);


// =================================================================================
// FUNÇÕES DE LÓGICA E COMUNICAÇÃO COM APIS
// =================================================================================

// Upload de arquivo para o Google Drive
async function uploadFileToDrive(file) {
    const metadata = {
        name: `${new Date().toISOString()}-${file.name}`,
        parents: [DRIVE_FOLDER_ID]
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const accessToken = gapi.auth.getToken().access_token;
    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: form
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Erro no upload para o Drive: ${error.error.message}`);
    }

    const result = await response.json();
    return `https://drive.google.com/uc?id=${result.id}`;
}

// Busca itens concluídos da unidade atual
async function fetchConcluidos() {
  const unidadeAtual = localStorage.getItem('unidadeFixada');
  if (!unidadeAtual) return;

  try {
    const response = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Inventario!A:G' // Unidade, Local, Item, Tombo, Estado, Quantidade, Foto
    });
    const rows = response.result.values || [];
    const tbody = document.querySelector('#tabelaConcluidos tbody');
    tbody.innerHTML = '';
    
    rows.slice(1) // Pula o cabeçalho
        .filter(row => row[0] === unidadeAtual) // Filtra pela unidade atual
        .forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row[0] || ''}</td>
                <td>${row[1] || ''}</td>
                <td>${row[2] || ''}</td>
                <td>${row[3] || ''}</td>
                <td>${row[4] || ''}</td>
                <td>${row[5] || ''}</td>
                <td>${row[6] ? `<a href="${row[6]}" target="_blank" class="btn btn-sm btn-outline-primary">Ver</a>` : 'N/A'}</td>
            `;
            tbody.appendChild(tr);
    });
  } catch(error) {
    console.error('Erro ao buscar itens concluídos:', error);
    showToast('toastError', 'Não foi possível carregar os itens.');
  }
}

// Lida com os uploads de planilhas
async function handleUpload(type) {
    const unidade = document.getElementById(type === 'Sistema' ? 'unidadeSistema' : 'unidadeInventario').value.trim();
    if (!unidade) return showToast('toastError', 'Por favor, informe o nome da unidade para o upload.');

    const fileInput = document.getElementById(type === 'Sistema' ? 'relatorioSistema' : 'inventariosAntigos');
    const pasteArea = document.getElementById(type === 'Sistema' ? 'pasteSistema' : 'pasteInventario');
    
    const files = fileInput.files;
    const pasteText = pasteArea.value.trim();

    if (files.length === 0 && !pasteText) return showToast('toastError', 'Selecione um arquivo ou cole os dados na área de texto.');

    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    loadingModal.show();
    
    // Timeout para evitar que o modal fique aberto indefinidamente
    const timeoutId = setTimeout(() => {
        loadingModal.hide();
        showToast('toastError', 'Tempo esgotado. A operação demorou demais. Verifique sua conexão ou o tamanho do arquivo.');
    }, 60000); // 60 segundos

    try {
        let data = [];
        if (files.length > 0) {
            for (const file of files) {
                const parsed = await parseExcel(file);
                data.push(...parsed.slice(1)); // Adiciona dados, ignorando cabeçalho
            }
        } else if (pasteText) {
            const parsed = parsePastedText(pasteText);
            data.push(...parsed.slice(1)); // Adiciona dados, ignorando cabeçalho
        }

        if (data.length === 0) throw new Error("Nenhum dado válido para enviar.");

        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'appendReport',
                sheetName: type === 'Sistema' ? 'RelatorioSistema' : 'Inventario',
                data: data,
                unidadeUpload: unidade
            })
        });

        showToast('toastSuccess', `Upload de '${type}' concluído com sucesso!`);
        fileInput.value = ''; // Limpa o input de arquivo
        pasteArea.value = ''; // Limpa a área de texto
        await popularUnidadesParaAnalise(); // Atualiza a lista de unidades para análise

    } catch (error) {
        console.error(`Erro no upload de ${type}:`, error);
        showToast('toastError', `Erro no upload: ${error.message}`);
    } finally {
        clearTimeout(timeoutId);
        loadingModal.hide();
    }
}

// Busca e exibe os inventários na aba "Inventários" em formato acordeão
async function fetchAndDisplayInventarios() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Inventario!A:J' // Unidade, Local, Item, Tombo, Estado, Qtd, Foto, Timestamp, Fonte, UnidadeUpload
        });
        const rows = response.result.values ? response.result.values.slice(1) : [];
        
        const inventariosAgrupados = rows.reduce((acc, row) => {
            const unidade = (row[0] || row[9] || 'Sem Unidade').trim(); // Usa Unidade ou UnidadeUpload
            const fonte = row[8] || 'N/A'; // Site ou Upload
            
            if (!acc[unidade]) {
                acc[unidade] = { Site: [], Upload: [] };
            }
            if (acc[unidade][fonte]) {
                acc[unidade][fonte].push(row);
            }
            return acc;
        }, {});

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
                    <h2 class="accordion-header" id="heading-${index}">
                        <button class="accordion-button ${index === 0 ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${index}">
                            ${unidade} <span class="badge bg-secondary ms-2">${Site.length + Upload.length} itens</span>
                        </button>
                    </h2>
                    <div id="collapse-${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" data-bs-parent="#inventariosAccordion">
                        <div class="accordion-body">
                            ${createTableHtml('Feitos no Site', ['Item', 'Tombo', 'Local', 'Estado'], Site, [2, 3, 1, 4])}
                            ${createTableHtml('Carregados por Upload', ['Item', 'Tombo', 'Local', 'Estado'], Upload, [2, 3, 1, 4])}
                        </div>
                    </div>
                </div>
            `;
            accordionContainer.innerHTML += accordionItem;
        });

    } catch (error) {
        console.error('Erro ao buscar inventários:', error);
        showToast('toastError', 'Não foi possível carregar a lista de inventários.');
    }
}

// Lida com a lógica de análise e comparação
async function handleAnalysis() {
    const unidade = document.getElementById('unidadeComparar').value;
    if (!unidade) return showToast('toastError', 'Selecione uma unidade para gerar o relatório!');
    
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    loadingModal.show();
    document.getElementById('exportCsvBtn').classList.add('d-none'); // Esconde o botão de exportar

    try {
        const systemResponse = gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'RelatorioSistema!A:M' });
        const inventoryResponse = gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Inventario!A:J' });
        
        const [systemResult, inventoryResult] = await Promise.all([systemResponse, inventoryResponse]);
        
        const systemData = systemResult.result.values ? systemResult.result.values.slice(1) : [];
        const inventoryData = inventoryResult.result.values ? inventoryResult.result.values.slice(1) : [];

        const normalizeTombo = tombo => tombo ? String(tombo).trim().replace(/^0+/, '') : '';

        const systemFilteredByUnidade = systemData.filter(row => (row[12] || '').trim().toLowerCase() === unidade.toLowerCase());
        const inventoryFilteredByUnidade = inventoryData.filter(row => (row[0] || row[9] || '').trim().toLowerCase() === unidade.toLowerCase());

        const systemMap = new Map(systemFilteredByUnidade.map(row => [normalizeTombo(row[0]), row]));
        const inventoryMap = new Map(inventoryFilteredByUnidade.map(row => [normalizeTombo(row[3]), row]));

        let matches = [];
        let missingPhysical = [];
        let missingSystem = [];
        let observations = [];

        systemMap.forEach((sysRow, tomboNorm) => {
            if (inventoryMap.has(tomboNorm)) {
                const invRow = inventoryMap.get(tomboNorm);
                matches.push({ tombo: sysRow[0], descInventory: invRow[2], descSystem: sysRow[2], nf: sysRow[4], fornecedor: sysRow[7], fullSystem: sysRow });
            } else {
                missingPhysical.push({ tombo: sysRow[0], desc: sysRow[2], fullSystem: sysRow });
            }
        });

        inventoryMap.forEach((invRow, tomboNorm) => {
            if (!systemMap.has(tomboNorm)) {
                missingSystem.push({ tombo: invRow[3], desc: invRow[2] });
            }
        });
        
        // Salva os dados para exportação
        analysisReportData = { matches, missingPhysical, missingSystem, observations };

        // Renderiza o resultado na tela
        renderAnalysisResults(analysisReportData);
        
        document.getElementById('exportCsvBtn').classList.remove('d-none');

    } catch (error) {
        console.error('Erro na análise:', error);
        showToast('toastError', `Erro ao gerar relatório: ${error.message}`);
    } finally {
        loadingModal.hide();
    }
}


// Exporta os dados da análise para um arquivo CSV
function exportAnalysisToCsv() {
    const { matches, missingPhysical, missingSystem, observations } = analysisReportData;
    if (!matches && !missingPhysical && !missingSystem) {
        showToast('toastError', 'Não há dados de análise para exportar.');
        return;
    }

    const headers = ['Tipo', 'Tombo', 'Descrição Inventário', 'Descrição Sistema', 'Nota Fiscal', 'Fornecedor', 'Info Completa Sistema', 'Observação'];
    let csvContent = headers.join(';') + '\n';

    const escapeCsvCell = (cell) => `"${String(cell || '').replace(/"/g, '""')}"`;

    matches.forEach(m => {
        const row = ['Match', m.tombo, m.descInventory, m.descSystem, m.nf, m.fornecedor, m.fullSystem.map(escapeCsvCell).join(','), ''];
        csvContent += row.map(escapeCsvCell).join(';') + '\n';
    });
    missingPhysical.forEach(mp => {
        const row = ['Faltando no Físico', mp.tombo, '', mp.desc, '', '', mp.fullSystem.map(escapeCsvCell).join(','), ''];
        csvContent += row.map(escapeCsvCell).join(';') + '\n';
    });
    missingSystem.forEach(ms => {
        const row = ['Faltando no Sistema', ms.tombo, ms.desc, '', '', '', '', ''];
        csvContent += row.map(escapeCsvCell).join(';') + '\n';
    });
    observations.forEach(o => {
        const row = ['Observação', '', '', '', '', '', '', o];
        csvContent += row.map(escapeCsvCell).join(';') + '\n';
    });

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel compatibility
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio_analise_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}


// =================================================================================
// FUNÇÕES AUXILIARES E DE UI
// =================================================================================

// Popula o dropdown de unidades para a aba de Análise
async function popularUnidadesParaAnalise() {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Inventario!J:J' // Coluna UnidadeUpload
        });
        const rows = response.result.values || [];
        const unidades = [...new Set(rows.slice(1).flat().map(u => u.trim()).filter(Boolean))];
        
        const select = document.getElementById('unidadeComparar');
        select.innerHTML = '<option value="">Selecione uma unidade...</option>';
        unidades.sort().forEach(u => {
            const option = document.createElement('option');
            option.value = u.toLowerCase();
            option.textContent = u;
            select.add(option);
        });
    } catch(error) {
        console.error("Erro ao popular unidades para análise:", error);
    }
}

// Parseia dados de planilhas (XLSX, CSV)
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        resolve(sheet);
      } catch (error) {
        reject(new Error(`Erro ao ler o arquivo: ${error.message}`));
      }
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsBinaryString(file);
  });
}

// Parseia texto copiado e colado
function parsePastedText(text) {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => line.split('\t').map(cell => cell.trim())); // Assume tab-separated
}

// Cria uma tabela HTML a partir de dados
function createTableHtml(title, headers, data, dataIndices) {
    if (!data || data.length === 0) return '';
    let table = `<h5>${title} (${data.length})</h5><div class="table-responsive"><table class="table table-sm table-striped table-hover"><thead><tr>`;
    headers.forEach(h => table += `<th>${h}</th>`);
    table += '</tr></thead><tbody>';
    data.forEach(row => {
        table += '<tr>';
        dataIndices.forEach(index => table += `<td>${row[index] || ''}</td>`);
        table += '</tr>';
    });
    table += '</tbody></table></div>';
    return table;
}

// Renderiza os resultados da análise na UI
function renderAnalysisResults({ matches, missingPhysical, missingSystem, observations }) {
    const resultadoDiv = document.getElementById('resultadoComparacao');
    resultadoDiv.innerHTML = `
      <div class="card mb-3">
        <div class="card-header bg-success text-white fw-bold">Itens Encontrados (Matches) - ${matches.length}</div>
        <div class="card-body">${createTableHtml('', ['Tombo', 'Descrição', 'Nota Fiscal'], matches, ['tombo', 'descInventory', 'nf'])}</div>
      </div>
      <div class="card mb-3">
        <div class="card-header bg-warning text-dark fw-bold">Itens Faltando no Inventário Físico - ${missingPhysical.length}</div>
        <div class="card-body">${createTableHtml('', ['Tombo', 'Descrição'], missingPhysical, ['tombo', 'desc'])}</div>
      </div>
      <div class="card mb-3">
        <div class="card-header bg-danger text-white fw-bold">Itens Sobrando (Não Constam no Sistema) - ${missingSystem.length}</div>
        <div class="card-body">${createTableHtml('', ['Tombo', 'Descrição'], missingSystem, ['tombo', 'desc'])}</div>
      </div>
      ${observations.length > 0 ? `
      <div class="card">
        <div class="card-header bg-info text-white fw-bold">Observações - ${observations.length}</div>
        <div class="card-body"><ul class="list-group list-group-flush">${observations.map(o => `<li class="list-group-item">${o}</li>`).join('')}</ul></div>
      </div>` : ''}
    `;
}

// Mostra uma notificação (toast)
function showToast(id, message) {
  const toastEl = document.getElementById(id);
  if (toastEl) {
    toastEl.querySelector('.toast-body').textContent = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
  }
}

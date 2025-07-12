const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby99cTAFdCucXd1EQ7rVqL6qMVkXFLaYUShD9c2iy6eqv36PP_y9t6Lz6sRm41GT3wGjg/exec';
const SHEET_ID = '1Ye2r43tRukP6i4TMMrBQ-89AMgcweO9VEtv7ooj2cCc';

// Inicializar Google API
gapi.load('client:auth2', () => {
  gapi.client.init({
    apiKey: 'AIzaSyCDRvL3Jm5QhgvcfExL3Z_ZJR_Xw149hFw',
    clientId: '431216787156-vfivrga4ueekuabmrqk0du5tgbsdrvma.apps.googleusercontent.com',
    discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4', 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive'
  }).then(() => {
    gapi.auth2.getAuthInstance().signIn().then(() => console.log('Logado no Google'));
  });
});

// Auto-save de rascunho
function autoSave() {
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
setInterval(autoSave, 30000);

// Carregar ao iniciar
window.onload = async () => {
  const draft = JSON.parse(localStorage.getItem('draft'));
  if (draft) {
    document.getElementById('unidade').value = draft.unidade;
    document.getElementById('local').value = draft.local;
    document.getElementById('item').value = draft.item;
    document.getElementById('tombo').value = draft.tombo;
    document.getElementById('estado').value = draft.estado;
    document.getElementById('quantidade').value = draft.quantidade;
  }
  const unidadeFixada = localStorage.getItem('unidadeFixada');
  if (!unidadeFixada) {
    new bootstrap.Modal(document.getElementById('unidadeModal')).show();
  } else {
    document.getElementById('unidade').value = unidadeFixada;
  }
  await fetchConcluidos();
  await popularUnidades();
};

// Salvar unidade inicial
document.getElementById('salvarUnidade').addEventListener('click', () => {
  const unidade = document.getElementById('unidadeInicial').value.trim();
  if (unidade) {
    localStorage.setItem('unidadeFixada', unidade);
    document.getElementById('unidade').value = unidade;
    bootstrap.Modal.getInstance(document.getElementById('unidadeModal')).hide();
  }
});

// Resetar unidade
document.getElementById('resetUnidade').addEventListener('click', () => {
  localStorage.removeItem('unidadeFixada');
  document.getElementById('unidade').value = '';
  new bootstrap.Modal(document.getElementById('unidadeModal')).show();
});

// Editar local
document.getElementById('editLocal').addEventListener('click', () => {
  const localInput = document.getElementById('local');
  localInput.readOnly = false;
  localInput.focus();
  localInput.addEventListener('blur', () => {
    localInput.readOnly = true;
  }, { once: true });
});

// Enviar formulário de inventário
document.getElementById('inventarioForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loading = new bootstrap.Modal(document.getElementById('loadingModal'));
  loading.show();
  try {
    const file = document.getElementById('foto').files[0];
    let photoUrl = '';
    if (file) {
      const blob = await file.arrayBuffer();
      const metadata = { name: file.name, parents: ['1DGuZWpe9kakSpRUvy7qqizll0bqJB62o'] };
      const accessToken = gapi.auth.getToken().access_token;
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + accessToken },
        body: createMultipartBody(metadata, blob, file.type)
      });
      const result = await response.json();
      photoUrl = `https://drive.google.com/uc?id=${result.id}`;
    }

    const data = {
      unidade: document.getElementById('unidade').value,
      local: document.getElementById('local').value,
      item: document.getElementById('item').value,
      tombo: document.getElementById('tombo').value,
      estado: document.getElementById('estado').value,
      quantidade: document.getElementById('quantidade').value,
      photoUrl
    };

    await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    localStorage.removeItem('draft');
    e.target.reset();
    await fetchConcluidos();
    showToast('toastSuccess', 'Item salvo com sucesso!');
  } catch (error) {
    showToast('toastError', 'Erro ao salvar: ' + error.message);
  } finally {
    loading.hide();
  }
});

// Função auxiliar para upload de foto
function createMultipartBody(metadata, fileData, mimeType) {
  const boundary = '-------' + Math.random().toString(36).substring(2);
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelim = "\r\n--" + boundary + "--";
  const body = delimiter +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + mimeType + '\r\n' +
    'Content-Transfer-Encoding: base64\r\n' +
    '\r\n' +
    btoa(String.fromCharCode(...new Uint8Array(fileData))) +
    closeDelim;
  return new Blob([body], { type: 'multipart/related; boundary="' + boundary + '"' });
}

// Buscar itens concluídos
async function fetchConcluidos() {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Inventario!A:H'
  });
  const rows = response.result.values || [];
  const tbody = document.querySelector('#tabelaConcluidos tbody');
  tbody.innerHTML = '';
  rows.slice(1).forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row[0] || ''}</td><td>${row[1] || ''}</td><td>${row[2] || ''}</td><td>${row[3] || ''}</td><td>${row[4] || ''}</td><td>${row[5] || ''}</td><td><a href="${row[6] || ''}" target="_blank">Ver</a></td>`;
    tbody.appendChild(tr);
  });
}

// Popular unidades para análise
async function popularUnidades() {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Inventario!A:A'
  });
  const rows = response.result.values || [];
  const unidades = [...new Set(rows.slice(1).map(row => row[0].trim()))];
  const select = document.getElementById('unidadeComparar');
  select.innerHTML = '<option value="">Selecione...</option>';
  unidades.forEach(u => {
    if (u) {
      const option = document.createElement('option');
      option.value = u.toLowerCase();
      option.text = u;
      select.add(option);
    }
  });
}

// Upload relatório do sistema
document.getElementById('uploadSistemaBtn').addEventListener('click', async () => {
  const unidade = document.getElementById('unidadeSistema').value.trim();
  if (!unidade) return showToast('toastError', 'Informe a unidade!');
  const file = document.getElementById('relatorioSistema').files[0];
  const paste = document.getElementById('pasteSistema').value.trim();
  if (!file && !paste) return showToast('toastError', 'Selecione arquivo ou cole texto!');
  const loading = new bootstrap.Modal(document.getElementById('loadingModal'));
  loading.show();
  const timeoutId = setTimeout(() => {
    loading.hide();
    showToast('toastError', 'Tempo esgotado: Tente novamente com um arquivo menor.');
  }, 30000); // Timeout de 30 segundos
  try {
    let data;
    if (file) {
      data = await parseExcel(file);
    } else if (paste) {
      data = parsePaste(paste);
    }
    if (data[0].length < 11) throw new Error('Formato inválido! Espere colunas A:K.');
    await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'appendReport', sheetName: 'RelatorioSistema', data, unidadeUpload: unidade })
    });
    clearTimeout(timeoutId);
    showToast('toastSuccess', 'Upload do relatório concluído com sucesso!');
  } catch (error) {
    clearTimeout(timeoutId);
    showToast('toastError', 'Erro no upload: ' + error.message);
  } finally {
    loading.hide();
  }
});

// Upload inventários anteriores
document.getElementById('uploadInventariosBtn').addEventListener('click', async () => {
  const unidade = document.getElementById('unidadeInventario').value.trim();
  if (!unidade) return showToast('toastError', 'Informe a unidade!');
  const files = document.getElementById('inventariosAntigos').files;
  const paste = document.getElementById('pasteInventario').value.trim();
  if (files.length === 0 && !paste) return showToast('toastError', 'Selecione arquivos ou cole texto!');
  const loading = new bootstrap.Modal(document.getElementById('loadingModal'));
  loading.show();
  const timeoutId = setTimeout(() => {
    loading.hide();
    showToast('toastError', 'Tempo esgotado: Tente novamente com um arquivo menor.');
  }, 30000); // Timeout de 30 segundos
  try {
    let allData = [];
    if (files.length > 0) {
      for (let file of files) {
        const parsed = await parseExcel(file);
        if (parsed[0].length < 4) throw new Error('Formato inválido! Espere colunas A:D.');
        allData = allData.concat(parsed);
      }
    } else if (paste) {
      const parsed = parsePaste(paste);
      if (parsed[0].length < 4) throw new Error('Formato inválido! Espere colunas A:D.');
      allData = parsed;
    }
    await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'appendReport', sheetName: 'Inventario', data: allData, unidadeUpload: unidade })
    });
    clearTimeout(timeoutId);
    showToast('toastSuccess', 'Uploads de inventários concluídos com sucesso!');
    await popularUnidades();
  } catch (error) {
    clearTimeout(timeoutId);
    showToast('toastError', 'Erro no upload: ' + error.message);
  } finally {
    loading.hide();
  }
});

// Função para parsear texto colado
function parsePaste(text) {
  const lines = text.split('\n').filter(line => line.trim());
  return lines.map(line => line.split(/\t|,/).map(cell => cell.trim()));
}

// Fetch inventários diferenciados (atualizado para accordion com + por unidade)
async function fetchInventarios() {
  const response = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Inventario!A:J'
  });
  const rows = response.result.values || [];
  const siteData = {};
  const uploadData = {};
  rows.slice(1).forEach(row => {
    const unidade = row[0] || row[9];
    const itemHtml = `<tr><td>${unidade}</td><td>${row[2]}</td><td>${row[3]}</td><td>${row[4]}</td></tr>`;
    if (row[8] === 'Site') {
      if (!siteData[unidade]) siteData[unidade] = [];
      siteData[unidade].push(itemHtml);
    } else if (row[8] === 'Upload') {
      if (!uploadData[unidade]) uploadData[unidade] = [];
      uploadData[unidade].push(itemHtml);
    }
  });

  const siteContainer = document.getElementById('tabelaSite');
  siteContainer.innerHTML = '<h3>Feitos no Site</h3><div class="accordion" id="siteAccordion"></div>';
  Object.keys(siteData).forEach((unidade, index) => {
    const accordionItem = `
      <div class="accordion-item">
        <h2 class="accordion-header" id="siteHeading${index}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#siteCollapse${index}">
            ${unidade}
          </button>
        </h2>
        <div id="siteCollapse${index}" class="accordion-collapse collapse" data-bs-parent="#siteAccordion">
          <div class="accordion-body">
            <table class="table table-striped"><thead><tr><th>Unidade</th><th>Item</th><th>Tombo</th><th>Estado</th></tr></thead><tbody>${siteData[unidade].join('')}</tbody></table>
          </div>
        </div>
      </div>
    `;
    siteContainer.querySelector('#siteAccordion').innerHTML += accordionItem;
  });

  const uploadContainer = document.getElementById('tabelaUpload');
  uploadContainer.innerHTML = '<h3>Carregados por Upload</h3><div class="accordion" id="uploadAccordion"></div>';
  Object.keys(uploadData).forEach((unidade, index) => {
    const accordionItem = `
      <div class="accordion-item">
        <h2 class="accordion-header" id="uploadHeading${index}">
          <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#uploadCollapse${index}">
            ${unidade}
          </button>
        </h2>
        <div id="uploadCollapse${index}" class="accordion-collapse collapse" data-bs-parent="#uploadAccordion">
          <div class="accordion-body">
            <table class="table table-striped"><thead><tr><th>Unidade</th><th>Item</th><th>Tombo</th><th>Estado</th></tr></thead><tbody>${uploadData[unidade].join('')}</tbody></table>
          </div>
        </div>
      </div>
    `;
    uploadContainer.querySelector('#uploadAccordion').innerHTML += accordionItem;
  });
}

document.getElementById('inventarios-tab').addEventListener('shown.bs.tab', fetchInventarios);

// Lógica de análise (atualizada para mais profissional, com colunas separadas)
document.getElementById('compararBtn').addEventListener('click', async () => {
  const unidade = document.getElementById('unidadeComparar').value;
  if (!unidade) return showToast('toastError', 'Selecione uma unidade!');
  const loading = new bootstrap.Modal(document.getElementById('loadingModal'));
  loading.show();
  const timeoutId = setTimeout(() => {
    loading.hide();
    showToast('toastError', 'Tempo esgotado na análise: Tente novamente.');
  }, 60000); // Timeout de 60 segundos para análise
  try {
    const systemResponse = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'RelatorioSistema!A:M'
    });
    const systemData = systemResponse.result.values || [];
    const inventoryResponse = await gapi.client.sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Inventario!A:J'
    });
    const inventoryData = inventoryResponse.result.values || [];
    const inventoryFiltered = inventoryData.filter(row => (row[0] || row[9])?.toLowerCase() === unidade);

    const normalizeTombo = tombo => tombo ? parseInt(tombo.replace(/^0+/, ''), 10).toString() : '';

    const systemMap = new Map(systemData.slice(1).map(row => [normalizeTombo(row[0]), row]));
    const inventoryMap = new Map(inventoryFiltered.map(row => [normalizeTombo(row[3]), row]));

    let matches = [];
    let missingPhysical = [];
    let missingSystem = [];
    let observations = [];

    systemMap.forEach((sysRow, tomboNorm) => {
      if (inventoryMap.has(tomboNorm)) {
        const invRow = inventoryMap.get(tomboNorm);
        matches.push({ tombo: tomboNorm, descInventory: invRow[2], descSystem: sysRow[2], cadastro: sysRow[1], tipoEntrada: sysRow[3], nf: sysRow[4], ativo: sysRow[5], subStatus: sysRow[6], fornecedor: sysRow[7], dataMovimento: sysRow[8], valorNF: sysRow[9], status: sysRow[10] });
      } else {
        missingPhysical.push({ tombo: tomboNorm, desc: sysRow[2], cadastro: sysRow[1], tipoEntrada: sysRow[3], nf: sysRow[4], ativo: sysRow[5], subStatus: sysRow[6], fornecedor: sysRow[7], dataMovimento: sysRow[8], valorNF: sysRow[9], status: sysRow[10] });
        const other = systemData.slice(1).find(r => normalizeTombo(r[0]) === tomboNorm && (r[0] || r[12])?.toLowerCase() !== unidade);
        if (other) {
          observations.push(`Tombo ${tomboNorm} encontrado em outra unidade: ${other[0] || other[12]}. Sugestão: Transferir para ${unidade}.`);
        }
      }
    });

    inventoryMap.forEach((invRow, tomboNorm) => {
      if (!systemMap.has(tomboNorm)) {
        missingSystem.push({ tombo: tomboNorm, desc: invRow[2] });
        const other = inventoryData.slice(1).find(r => normalizeTombo(r[3]) === tomboNorm && (r[0] || r[9])?.toLowerCase() !== unidade);
        if (other) {
          observations.push(`Tombo ${tomboNorm} no inventário, mas em outra unidade: ${other[0] || other[9]}. Sugestão: Transferir para ${unidade}.`);
        }
      }
    });

    const resultado = document.getElementById('resultadoComparacao');
    resultado.innerHTML = `
      <div class="card mb-3">
        <div class="card-header bg-primary text-white">Tombamentos Iguais (Matches)</div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead class="table-dark">
                <tr><th>Tombo</th><th>Desc. Inventário</th><th>Desc. Sistema</th><th>Cadastro</th><th>Tipo Entrada</th><th>NF</th><th>Ativo</th><th>SubStatus</th><th>Fornecedor</th><th>Data Movimento</th><th>Valor NF</th><th>Status</th></tr>
              </thead>
              <tbody>${matches.map(m => `<tr><td>${m.tombo}</td><td>${m.descInventory}</td><td>${m.descSystem}</td><td>${m.cadastro}</td><td>${m.tipoEntrada}</td><td>${m.nf}</td><td>${m.ativo}</td><td>${m.subStatus}</td><td>${m.fornecedor}</td><td>${m.dataMovimento}</td><td>${m.valorNF}</td><td>${m.status}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-header bg-warning text-dark">Faltando no Físico</div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead class="table-dark">
                <tr><th>Tombo</th><th>Desc. Sistema</th><th>Cadastro</th><th>Tipo Entrada</th><th>NF</th><th>Ativo</th><th>SubStatus</th><th>Fornecedor</th><th>Data Movimento</th><th>Valor NF</th><th>Status</th></tr>
              </thead>
              <tbody>${missingPhysical.map(mp => `<tr><td>${mp.tombo}</td><td>${mp.desc}</td><td>${mp.cadastro}</td><td>${mp.tipoEntrada}</td><td>${mp.nf}</td><td>${mp.ativo}</td><td>${mp.subStatus}</td><td>${mp.fornecedor}</td><td>${mp.dataMovimento}</td><td>${mp.valorNF}</td><td>${mp.status}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card mb-3">
        <div class="card-header bg-danger text-white">Faltando no Sistema</div>
        <div class="card-body">
          <div class="table-responsive">
            <table class="table table-striped table-hover">
              <thead class="table-dark">
                <tr><th>Tombo</th><th>Desc. Inventário</th></tr>
              </thead>
              <tbody>${missingSystem.map(ms => `<tr><td>${ms.tombo}</td><td>${ms.desc}</td></tr>`).join('')}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header bg-info text-white">Observações (Tombos em Outras Unidades)</div>
        <div class="card-body">
          <ul class="list-group list-group-flush">${observations.map(o => `<li class="list-group-item">${o}</li>`).join('')}</ul>
        </div>
      </div>
    `;
    document.getElementById('exportCsv').classList.remove('d-none');
  } catch (error) {
    showToast('toastError', 'Erro na análise: ' + error.message);
  } finally {
    clearTimeout(timeoutId);
    loading.hide();
  }
});

// Exportar CSV (atualizado para incluir colunas separadas)
document.getElementById('exportCsv').addEventListener('click', () => {
  let csv = 'Tipo;Tombo;Desc Inventario;Desc Sistema;Cadastro;Tipo Entrada;NF;Ativo;SubStatus;Fornecedor;Data Movimento;Valor NF;Status;Observacao\n';
  matches.forEach(m => csv += `Match;${m.tombo};${m.descInventory};${m.descSystem};${m.cadastro};${m.tipoEntrada};${m.nf};${m.ativo};${m.subStatus};${m.fornecedor};${m.dataMovimento};${m.valorNF};${m.status};\n`);
  missingPhysical.forEach(mp => csv += `MissingPhysical;${mp.tombo};;${mp.desc};${mp.cadastro};${mp.tipoEntrada};${mp.nf};${mp.ativo};${mp.subStatus};${mp.fornecedor};${mp.dataMovimento};${mp.valorNF};${mp.status};\n`);
  missingSystem.forEach(ms => csv += `MissingSystem;${ms.tombo};${ms.desc};;;;;;;;;;;\n`);
  observations.forEach(o => csv += `Observation;;;;;;;;;;;;;${o}\n`);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio_analise.csv';
  a.click();
});

// Parsear Excel (atualizado para pular cabeçalho no RelatorioSistema)
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        // Pula cabeçalho se presente para RelatorioSistema
        const headers = sheet[0];
        if (Array.isArray(headers) && headers.includes('Tombamento')) {
          resolve(sheet.slice(1));
        } else {
          resolve(sheet);
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsBinaryString(file);
  });
}

// Mostrar toast
function showToast(id, message) {
  const toastEl = document.getElementById(id);
  toastEl.querySelector('.toast-body').textContent = message;
  const toast = new bootstrap.Toast(toastEl, { delay: 5000 });
  toast.show();
}

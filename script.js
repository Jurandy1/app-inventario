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

// ... (o resto do código permanece o mesmo, exceto as partes atualizadas abaixo)

// Upload inventários anteriores (atualizado para mapear colunas: Unidade (field), Local (D), Item (B), Tombo (C), Estado (E), Quantidade=1)
document.getElementById('uploadInventariosBtn').addEventListener('click', async () => {
  const unidade = document.getElementById('unidadeInventario').value.trim();
  if (!unidade) return showToast('toastError', 'Informe a unidade!');
  const files = document.getElementById('inventariosAntigos').files;
  const paste = document.getElementById('pasteInventario').value.trim();
  if (files.length === 0 && !paste) return showToast('toastError', 'Selecione arquivos ou cole texto!');
  const loading = new bootstrap.Modal(document.getElementById('loadingModal'));
  loading.show();
  try {
    let allData = [];
    let parsed;
    if (files.length > 0) {
      for (let file of files) {
        parsed = await parseExcel(file);
        parsed.forEach(row => {
          if (row.length >= 5) { // Verifica 5 colunas
            const newRow = [unidade, row[3] || '', row[1] || '', row[2] || '', row[4] || '', 1]; // A: unidade field, B: Local (D), C: Item (B), D: Tombo (C), E: Estado (E), F: 1
            allData.push(newRow);
          }
        });
      }
    } else if (paste) {
      parsed = parsePaste(paste);
      parsed.forEach(row => {
        if (row.length >= 5) {
          const newRow = [unidade, row[3] || '', row[1] || '', row[2] || '', row[4] || '', 1];
          allData.push(newRow);
        }
      });
    }
    if (allData.length === 0) throw new Error('Nenhum dado válido encontrado!');
    await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'appendReport', sheetName: 'Inventario', data: allData, unidadeUpload: unidade })
    });
    showToast('toastSuccess', 'Uploads de inventários concluídos com sucesso!');
    await popularUnidades();
  } catch (error) {
    showToast('toastError', 'Erro no upload: ' + error.message);
  } finally {
    loading.hide();
  }
});

// Função parseExcel (atualizado para pular cabeçalho se presente)
function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0]; // Ignora abas extras
        const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        // Pula cabeçalho se a primeira linha contém palavras como 'Unidade', 'Item', etc.
        const headers = sheet[0];
        if (Array.isArray(headers) && (headers.includes('Unidade') || headers.includes('Item') || headers.includes('Tombamento'))) {
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

// ... (o resto do script.js permanece o mesmo, incluindo análise e outros)


// Mostrar toast
function showToast(id, message) {
  const toastEl = document.getElementById(id);
  toastEl.querySelector('.toast-body').textContent = message;
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

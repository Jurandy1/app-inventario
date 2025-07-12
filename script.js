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

// O resto do código é o mesmo (autoSave, onload, salvarUnidade, resetUnidade, editLocal, submit form, createMultipartBody, fetchConcluidos, popularUnidades, uploadBtns, parsePaste, fetchInventarios, análise, exportCsv, parseExcel, showToast). Para brevidade, não repeti, mas use o completo dos responses anteriores.

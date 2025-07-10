// ATENÇÃO: O SEU LINK PESSOAL JÁ ESTÁ INSERIDO ABAIXO.
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyMMSsjXRQuPkDHFlKcbA_2WjLCCGq4_wkocqfheGYs7q0DO6IQv-8cL8iRCoU8W2l8/exec';

async function apiCall(request) {
    if (!SCRIPT_URL.startsWith('https://')) {
        Notiflix.Notify.failure('ERRO GRAVE: A URL do Google Apps Script parece inválida.');
        throw new Error('URL do Script inválida.');
    }

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            cache: 'no-cache',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(request),
            redirect: 'follow',
        });
        if (!res.ok) throw new Error(`Erro na API: ${res.statusText}`);
        return await res.json();
    } catch (error) {
        console.error("Falha na chamada da API:", error);
        Notiflix.Notify.failure(`Erro de comunicação com a nuvem: ${error.message}`);
        throw error;
    }
}

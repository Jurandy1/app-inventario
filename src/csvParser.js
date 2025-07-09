// src/csvParser.js

function setupCsvListener(formId, inputId, statusId, onDataParsed) {
    const form = document.getElementById(formId);
    const fileInput = document.getElementById(inputId);
    const statusEl = document.getElementById(statusId);

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (fileInput.files.length === 0) {
            statusEl.textContent = 'Por favor, selecione um arquivo CSV.';
            statusEl.className = 'text-red-500';
            return;
        }

        const file = fileInput.files;
        statusEl.textContent = 'Lendo arquivo...';
        statusEl.className = 'text-blue-500';

        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                // Passa os dados e o próprio formulário para a função de callback
                onDataParsed(results.data, form);
            },
            error: (error) => {
                console.error('Erro ao analisar o CSV:', error);
                statusEl.textContent = `Erro ao processar: ${error.message}`;
                statusEl.className = 'text-red-500';
            }
        });
    });
}

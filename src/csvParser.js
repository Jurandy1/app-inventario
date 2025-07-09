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

        const file = fileInput.files[0];
        statusEl.textContent = 'Processando arquivo...';
        statusEl.className = 'text-blue-500';

        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                onDataParsed(results.data);
                statusEl.textContent = `Sucesso! ${results.data.length} registros importados.`;
                statusEl.className = 'text-green-600';
                fileInput.value = '';
                form.reset();
            },
            error: (error) => {
                console.error('Erro ao analisar o CSV:', error);
                statusEl.textContent = `Erro ao processar: ${error.message}`;
                statusEl.className = 'text-red-500';
            }
        });
    });
}

function parseCsvFile(file, expectedHeaders, callback) {
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: header => header.trim().replace(/\s+/g, ''), // Limpa e remove espaços dos cabeçalhos
        complete: (results) => {
            const actualHeaders = results.meta.fields.map(h => h.trim());
            const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h.replace(/\s+/g, '')));
            
            if (missingHeaders.length > 0) {
                 callback({ error: `Cabeçalhos faltando no CSV: ${missingHeaders.join(', ')}` });
                 return;
            }
            callback({ data: results.data });
        },
        error: (error) => callback({ error: error.message })
    });
}

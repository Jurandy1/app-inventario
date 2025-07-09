// src/formHandler.js

function setupForm(onAddItem, onClearField) {
    const form = document.getElementById('add-item-form');
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const unidadeInput = document.getElementById('item-unidade');
        const tomboInput = document.getElementById('item-tombo');
        const quantidadeInput = document.getElementById('item-quantidade');

        const newItem = {
            unidade: unidadeInput.value.trim(),
            local: document.getElementById('item-local').value.trim(),
            descricaoInventario: document.getElementById('item-descricao').value.trim(),
            tombo: String(tomboInput.value).trim().toUpperCase() === 'S/T' ? `S/T_${Date.now()}` : String(tomboInput.value).trim(),
            estadoConservacao: document.getElementById('item-estado').value,
            fonte: 'INVENTARIO' 
        };
        
        onAddItem(newItem, parseInt(quantidadeInput.value, 10));
        
        // Limpa apenas os campos do item, mantém unidade e local
        document.getElementById('item-descricao').value = '';
        document.getElementById('item-tombo').value = '';
        quantidadeInput.value = '1';
        document.getElementById('item-descricao').focus();
    });

    // Listeners para os botões de limpar
    document.getElementById('clear-unidade-btn').addEventListener('click', () => onClearField('item-unidade'));
    document.getElementById('clear-local-btn').addEventListener('click', () => onClearField('item-local'));
}

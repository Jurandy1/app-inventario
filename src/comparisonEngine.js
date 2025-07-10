function compareReports(systemReport, inventory) {
    const found = [];
    const missingInInventory = [...systemReport];
    const missingInReport = [];

    inventory.forEach(invItem => {
        const invTombo = String(invItem.Tombo).trim();
        const matchIndex = missingInInventory.findIndex(sysItem => String(sysItem.TOMBAMENTO).trim() === invTombo);

        if (matchIndex > -1) {
            const match = missingInInventory[matchIndex];
            found.push({ ...invItem, ...match }); // Combina dados do inventário e do sistema
            missingInInventory.splice(matchIndex, 1); // Remove da lista de faltantes
        } else {
            missingInReport.push(invItem); // Sobra no inventário
        }
    });

    return { found, missingInInventory, missingInReport };
}

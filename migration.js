// ====================================================================================
// SCRIPT DE MIGRAÇÃO DE DADOS DE CSV PARA FIRESTORE (EXECUTAR UMA ÚNICA VEZ)
// ====================================================================================
//
// COMO USAR:
// 1. Instale o Node.js no seu computador (https://nodejs.org/).
// 2. Salve este arquivo como 'migration.js' em uma pasta no seu computador.
// 3. Na mesma pasta, crie um arquivo chamado 'package.json' com o seguinte conteúdo:
//    {
//      "type": "module",
//      "dependencies": {
//        "firebase": "^10.12.2",
//        "csv-parser": "^3.0.0"
//      }
//    }
// 4. Abra o terminal (ou prompt de comando) NESSA PASTA e execute o comando: npm install
// 5. PREPARE SEU ARQUIVO CSV:
//    - Abra sua planilha original.
//    - **PASSO MAIS IMPORTANTE**: "Exploda" os itens. Se uma linha tem "Cadeira" com quantidade 5,
//      você precisa criar 5 linhas separadas para "Cadeira", cada uma com quantidade 1.
//      Você pode fazer isso manualmente ou usando fórmulas da planilha.
//    - Salve essa nova planilha como um arquivo CSV (ex: 'dados_para_migrar.csv') na mesma pasta do script.
//    - **Verifique se os nomes das colunas no CSV correspondem exatamente aos `headers` no código abaixo.**
// 6. ATUALIZE A CONFIGURAÇÃO DO FIREBASE abaixo com as suas credenciais.
// 7. No terminal, execute o script com o comando: node migration.js
//
// O script irá ler cada linha do CSV e criar um novo documento na coleção 'patrimonio' do seu Firestore.
// ====================================================================================

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, writeBatch } from 'firebase/firestore';
import fs from 'fs';
import csv from 'csv-parser';

// ***************************************************************
// 1. COLE AQUI A CONFIGURAÇÃO DO SEU PROJETO FIREBASE
// ***************************************************************
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_AUTH_DOMAIN",
    projectId: "SEU_PROJECT_ID",
    storageBucket: "SEU_STORAGE_BUCKET",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID"
};

// ***************************************************************
// 2. NOME DO SEU ARQUIVO CSV
// ***************************************************************
const CSV_FILE_PATH = './dados_para_migrar.csv'; // Ex: 'meus_dados.csv'

// ***************************************************************
// 3. MAPEAMENTO DAS COLUNAS (AJUSTE CONFORME SEU CSV)
// O nome à esquerda é o campo no Firestore.
// O nome à direita (string) é o nome EXATO da coluna no seu arquivo CSV.
// ***************************************************************
const columnMapping = {
    tombamento: 'Tombamento',
    tipo: 'Tipo',
    descricao: 'Descrição',
    unidade: 'Unidade',
    localizacao: 'Localização',
    estado: 'Estado',
    fornecedor: 'Fornecedor',
    observacao: 'Observação'
};


// --- LÓGICA DO SCRIPT (NÃO PRECISA ALTERAR DAQUI PARA BAIXO) ---

console.log("Iniciando script de migração...");

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const itemsCollection = collection(db, 'patrimonio');

const itemsToUpload = [];

fs.createReadStream(CSV_FILE_PATH)
  .pipe(csv())
  .on('data', (row) => {
    // Transforma a linha do CSV em um objeto para o Firestore
    const firestoreItem = {};
    for (const firestoreField in columnMapping) {
        const csvHeader = columnMapping[firestoreField];
        // Garante que o campo só é adicionado se existir no CSV e não for vazio
        if (row[csvHeader] && row[csvHeader].trim() !== '') {
            firestoreItem[firestoreField] = row[csvHeader].trim();
        }
    }

    // Adiciona valores padrão se algum campo essencial estiver faltando
    if (!firestoreItem.estado) firestoreItem.estado = 'Regular';
    
    // Adiciona à lista de itens para upload, apenas se tiver uma descrição
    if (firestoreItem.descricao) {
        itemsToUpload.push(firestoreItem);
    }
  })
  .on('end', async () => {
    console.log(`Leitura do CSV concluída. ${itemsToUpload.length} itens prontos para upload.`);

    if (itemsToUpload.length === 0) {
        console.log("Nenhum item para enviar. Verifique seu arquivo CSV e o mapeamento de colunas.");
        return;
    }

    // O Firestore permite 'writes' em lote de até 500 documentos. 
    // Vamos dividir o upload em pedaços para segurança.
    const batchSize = 400;
    let totalUploaded = 0;

    for (let i = 0; i < itemsToUpload.length; i += batchSize) {
        const chunk = itemsToUpload.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach((item) => {
            const docRef = collection(db, 'patrimonio');
            batch.set(doc(docRef), item);
        });
        
        try {
            await batch.commit();
            totalUploaded += chunk.length;
            console.log(`Lote ${Math.floor(i / batchSize) + 1} enviado com sucesso! ${totalUploaded} de ${itemsToUpload.length} itens enviados.`);
        } catch (error) {
            console.error(`Erro ao enviar o lote ${Math.floor(i / batchSize) + 1}:`, error);
            console.log("A migração foi interrompida devido a um erro.");
            return;
        }
    }
    
    console.log("\n==============================================");
    console.log("🎉 Migração concluída com sucesso! 🎉");
    console.log(`${totalUploaded} itens foram adicionados à sua coleção 'patrimonio' no Firestore.`);
    console.log("==============================================");
    process.exit(0);
  })
  .on('error', (error) => {
      console.error("Ocorreu um erro ao ler o arquivo CSV:", error.message);
      console.log("Verifique se o caminho do arquivo está correto e se o arquivo não está corrompido.");
  });

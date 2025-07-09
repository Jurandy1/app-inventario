// src/firebaseService.js

let db;
let auth;

function initFirebase(config) {
    return new Promise((resolve, reject) => {
        try {
            firebase.initializeApp(config);
            db = firebase.firestore();
            auth = firebase.auth();
            
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    // Usuário já está logado
                    resolve({ db, auth, userId: user.uid });
                } else {
                    // Tenta fazer login anônimo
                    try {
                        const userCredential = await auth.signInAnonymously();
                        console.log("Login anônimo bem-sucedido:", userCredential.user.uid);
                        resolve({ db, auth, userId: userCredential.user.uid });
                    } catch (error) {
                        console.error("Erro no login anônimo:", error);
                        reject(error);
                    }
                }
            });
        } catch (error) {
            console.error("Erro ao inicializar o Firebase:", error);
            reject(error);
        }
    });
}

// Salva toda a coleção de uma vez (sobrescreve)
async function saveCollection(collectionName, dataArray, idField) {
    if (!db) throw new Error("Firestore não inicializado.");
    const batch = db.batch();
    
    // Primeiro, você pode querer deletar os documentos antigos se for uma substituição completa.
    // Para simplificar, vamos usar set() que sobrescreve ou cria.
    
    dataArray.forEach(item => {
        const docId = item[idField].toString().replace(/\//g, '_'); // Garante que o ID do documento é válido
        if(docId){
             const docRef = db.collection(collectionName).doc(docId);
             batch.set(docRef, item);
        }
    });
    
    return batch.commit();
}

// Adiciona ou atualiza um único documento
async function saveDocument(collectionName, docId, data) {
    if (!db) throw new Error("Firestore não inicializado.");
    const docRef = db.collection(collectionName).doc(docId);
    return docRef.set(data, { merge: true }); // Merge true para não sobrescrever campos não mencionados
}

// Escuta por mudanças em tempo real em uma coleção
function listenToCollection(collectionName, callback) {
    if (!db) throw new Error("Firestore não inicializado.");
    
    return db.collection(collectionName).onSnapshot(snapshot => {
        const items = [];
        snapshot.forEach(doc => {
            items.push(doc.data());
        });
        callback(items);
    }, error => {
        console.error(`Erro ao escutar a coleção ${collectionName}:`, error);
    });
}

// Busca todos os documentos de uma coleção uma única vez
async function getCollection(collectionName) {
    if (!db) throw new Error("Firestore não inicializado.");
    const snapshot = await db.collection(collectionName).get();
    const items = [];
    snapshot.forEach(doc => {
        items.push(doc.data());
    });
    return items;
}

// Deleta todos os documentos de uma coleção
async function clearCollection(collectionName) {
    if (!db) throw new Error("Firestore não inicializado.");
    const snapshot = await db.collection(collectionName).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    return batch.commit();
}
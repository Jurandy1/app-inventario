// src/firebaseService.js

let db;
let auth;

function initFirebase(config) {
    if (!config || !config.apiKey || config.apiKey.includes("COLE_SUA_API_KEY_AQUI")) {
        return Promise.reject("Configuração do Firebase inválida.");
    }
    return new Promise((resolve, reject) => {
        try {
            firebase.initializeApp(config);
            db = firebase.firestore();
            auth = firebase.auth();
            auth.onAuthStateChanged(async (user) => {
                if (user) {
                    resolve({ db, auth, userId: user.uid });
                } else {
                    try {
                        const userCredential = await auth.signInAnonymously();
                        resolve({ db, auth, userId: userCredential.user.uid });
                    } catch (error) {
                        reject(error);
                    }
                }
            });
        } catch (error) {
            reject(error);
        }
    });
}

// Função genérica para salvar/atualizar um documento
async function saveDocument(collectionName, docId, data) {
    if (!db) throw new Error("Firestore não inicializado.");
    return db.collection(collectionName).doc(docId).set(data);
}

// Salva uma lista de itens em uma subcoleção usando batch write
async function saveItemsToSubcollection(parentCollection, parentDocId, subcollectionName, items) {
    if (!db) throw new Error("Firestore não inicializado.");
    const batch = db.batch();
    const subcollectionRef = db.collection(parentCollection).doc(parentDocId).collection(subcollectionName);
    
    items.forEach((item, index) => {
        // IDs de documentos não podem conter certos caracteres como '/'
        const cleanTombo = (item.tombo || '').toString().replace(/[\.\#\$\[\]\*\/]/g, '_');
        const itemId = cleanTombo && !cleanTombo.startsWith('S/T_') ? cleanTombo : `${Date.now()}_${index}`;
        const docRef = subcollectionRef.doc(itemId);
        batch.set(docRef, item);
    });

    return batch.commit();
}

// Pega um documento de metadados e todos os itens da sua subcoleção 'items'
async function getDatasetWithItems(collectionName, docId) {
    if (!db) throw new Error("Firestore não inicializado.");
    
    const docRef = db.collection(collectionName).doc(docId);
    const doc = await docRef.get();
    
    if (!doc.exists) return null;
    
    const dataset = { id: doc.id, ...doc.data() };
    
    const itemsSnapshot = await docRef.collection('items').get();
    dataset.items = itemsSnapshot.docs.map(itemDoc => itemDoc.data());
    
    return dataset;
}

// Deleta um documento e sua subcoleção 'items'
async function deleteDatasetWithItems(collectionName, docId) {
    if (!db) throw new Error("Firestore não inicializado.");
    const docRef = db.collection(collectionName).doc(docId);

    const itemsSnapshot = await docRef.collection('items').get();
    if (!itemsSnapshot.empty) {
        const batch = db.batch();
        itemsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
    }

    return docRef.delete();
}

// Escuta por mudanças em uma coleção (para metadados)
function listenToCollection(collectionName, callback) {
    if (!db) throw new Error("Firestore não inicializado.");
    return db.collection(collectionName).orderBy("createdAt", "desc").onSnapshot(snapshot => {
        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });
        callback(items);
    }, error => {
        console.error(`Erro ao escutar a coleção ${collectionName}:`, error);
    });
}

// Limpa todos os documentos de uma coleção (usado para a sessão ao vivo)
async function clearCollection(collectionName) {
    if (!db) throw new Error("Firestore não inicializado.");
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    return batch.commit();
}

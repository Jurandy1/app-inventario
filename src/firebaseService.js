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

// Salva um documento inteiro (usado para datasets)
async function saveDocument(collectionName, docId, data) {
    if (!db) throw new Error("Firestore não inicializado.");
    const docRef = db.collection(collectionName).doc(docId);
    return docRef.set(data);
}

// Pega um único documento por ID
async function getDocument(collectionName, docId) {
    if (!db) throw new Error("Firestore não inicializado.");
    const docRef = db.collection(collectionName).doc(docId);
    const doc = await docRef.get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// Deleta um documento
async function deleteDocument(collectionName, docId) {
    if (!db) throw new Error("Firestore não inicializado.");
    return db.collection(collectionName).doc(docId).delete();
}

// Escuta por mudanças em uma coleção inteira
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

// Limpa todos os documentos de uma coleção
async function clearCollection(collectionName) {
    if (!db) throw new Error("Firestore não inicializado.");
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    return batch.commit();
}

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

async function saveDocument(collectionName, docId, data) {
    if (!db) throw new Error("Firestore não inicializado.");
    return db.collection(collectionName).doc(docId).set(data);
}

async function saveItemsToSubcollection(parentCollection, parentDocId, subcollectionName, items) {
    if (!db) throw new Error("Firestore não inicializado.");
    const batchSize = 400;
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = db.batch();
        const batchItems = items.slice(i, i + batchSize);
        batchItems.forEach((item, index) => {
            const cleanTombo = (item.tombo || '').toString().replace(/[\.\#\$\[\]\*\/]/g, '_');
            const itemId = cleanTombo && !cleanTombo.startsWith('S/T_') ? cleanTombo : `${Date.now()}_${i + index}`;
            const docRef = db.collection(parentCollection).doc(parentDocId).collection(subcollectionName).doc(itemId);
            batch.set(docRef, item);
        });
        await batch.commit();
    }
}

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

async function clearCollection(collectionName) {
    if (!db) throw new Error("Firestore não inicializado.");
    const snapshot = await db.collection(collectionName).get();
    if (snapshot.empty) return;
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    return batch.commit();
}

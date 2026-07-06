// ===========================================
// GESTION DES ANOMALIES PERSISTANTES
// ===========================================
import {db} from './firebase.js';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// =============================================
// CRÉER UNE ANOMALIE PERSISTANTE
// Appellé quand un agent signale une anomalie
// dans le check-up
// =============================================
export async function creerAnomalies(checkupId, vehiculeId, vehiculeNom, immatriculation, resultats, agentMail) {
    const anomalieACreer = Object.entries(resultats)
    .filter(([, data]) => data.statut === 'anomalie');

    for (const [point, data] of anomalieACreer) {
        // Vérifie si une anomalie en_attente existe déjà pour ce point
        const existing = await getAnomalieActive(vehiculeId, point);
        if (existing) continue; // Ne pas créer de doublon

        await addDoc(collection(db, 'anomalies'), {
            checkupId,
            vehiculeId,
            vehiculeNom,
            immatriculation,
            point,
            description:    data.detail || '',
            photoUrl:       data.photoUrl || null,
            statut:         'en_attente',
            agentMail,
            dateSignalement: serverTimestamp(),
            dateResolution: null
        });
    }
}


// ============================================
// RÉCUPÉRER LES ANOMALIES ACTIVES D'UN VÉHICULE
// Statuts : en_attente ou marquee_resolue
// ============================================
export async function getAnomaliesVehicule(vehiculeId) {
    const q = query(
        collection(db, 'anomalies'),
        where('vehiculeId', '==', vehiculeId),
        where('statut', 'in', ['en_attente',
            'pris_en_compte',
            'astech_demande',
            'marquee_resolue',
            're_signalee'
        ])
    );
    const snapshot = await getDocs(q)
    const anomalies = [];
    snapshot.forEach(d => anomalies.push({ id: d.id, ...d.data() }));
    return anomalies
}

// ============================================
// RÉCUPÉRER LES ANOMALIES ACTIVES D'UN VÉHICULE
// Statuts : en_attente ou marquee_resolue
// ============================================
export async function getAnomalieActive(vehiculeId, point) {
    const q = query(
        collection(db, 'anomalies'),
        where('vehiculeId', '==', vehiculeId),
        where('point', '==', point),
        where('statut', 'in', [
            'en_attente',
            'pris_en_compte',
            'astech_demande',
            'marquee_resolue',
            're_signalee'
        ])
    );
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() };
}

// ============================================
// AGENT CONFIRME QUE C'EST TOUJOURS CASSÉ
// ============================================
export async function confirmerAnomaliePresente(anomalieId) {
    await updateDoc(doc(db, 'anomalies', anomalieId), {
        statut: 'en_attente',
        dateSignalement: serverTimestamp()
    });
}

// ============================================
// AGENT CONFIRME QUE C'EST RÉPARÉ
// ============================================

export async function confirmerAnomalieReparee(anomalieId) {
    await updateDoc(doc(db, 'anomalies', anomalieId), {
        statut: 'confirmee_resolue',
        dateResolution: serverTimestamp()
    });
}

// ============================================
// AGENT DIT QUE LA RÉPARATION N'A PAS TENU
// ============================================

export async function infirmerReparation(anomalieId) {
    await updateDoc(doc(db, 'anomalies', anomalieId), {
        statut:         're_signalee',
        dateSignalement: serverTimestamp()
    });
}


// ============================================
// ADMIN MARQUE "PRIS EN COMPTE"
// ============================================

export async function marquerPrisEnCompte(anomalieId) {
    await updateDoc(doc(db, 'anomalies', anomalieId), {
        statut: 'pris_en_compte'
    });
}

// ============================================
// ADMIN MARQUE "DEMANDE ATELIER FAITE"
// ============================================

export async function marquerAstechDemande(anomalieId) {
    await updateDoc(doc(db, 'anomalies', anomalieId), {
        statut: 'astech_demande'
    });
}


// ============================================
// RÉCUPÉRER TOUTES LES ANOMALIES D'UN VÉHICULE
// (pour l'historique maintenance)
// ============================================

export async function getHistoriqueVehicule(vehiculeId) {
    const q = query(
        collection(db, 'anomalies'),
        where('vehiculeId', '==', vehiculeId),
        orderBy('dateSignalement', 'desc')
    );
    const snapshot = await getDocs(q);
    const anomalie = [];
    snapshot.forEach(d => anomalie.push({ id: d.id, ...d.data() }));
    return anomalie;
}
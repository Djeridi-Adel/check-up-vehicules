// src/js/planning-dimanches.js
// Gestion du planning des dimanches travaillés (heures supplémentaires) : CRUD Firestore
// Réservé à l'admin (pas de page agent) — voir admin/planning-dimanches.js pour l'UI.
//
// Par respect de la confidentialité, les agents ne sont identifiés que par leurs
// initiales ou un surnom : aucun nom complet n'est stocké ici.

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "./firebase.js";

const COMPETENCES_COLLECTION = "pd-competences";
const POSTES_COLLECTION = "pd-postes";
const AGENTS_COLLECTION = "pd-agents";
const DIMANCHES_COLLECTION = "pd-dimanches";
const CONFIG_COLLECTION = "pd-config";

export const COMPETENCES_PAR_DEFAUT = [
  { nom: "Chauffeur Balayeuse" },
  { nom: "Chauffeur VL" },
  { nom: "Agent formé WC" }
];

// competenceNom sert uniquement à retrouver l'id de la compétence lors du semis initial
export const POSTES_PAR_DEFAUT = [
  { nom: "Balayeuse", competenceNom: "Chauffeur Balayeuse" },
  { nom: "Frap", competenceNom: "Chauffeur VL" },
  { nom: "WC", competenceNom: "Agent formé WC" },
  { nom: "Accompagnant", competenceNom: null },
  { nom: "Agent manuel", competenceNom: null },
  { nom: "Biflux", competenceNom: "Chauffeur VL" }
];

// ============================================
// COMPÉTENCES
// ============================================
export async function listerCompetences() {
  const q = query(collection(db, COMPETENCES_COLLECTION), orderBy("nom", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function creerCompetence(nom) {
  const docRef = await addDoc(collection(db, COMPETENCES_COLLECTION), { nom });
  return docRef.id;
}

export async function supprimerCompetence(id) {
  await deleteDoc(doc(db, COMPETENCES_COLLECTION, id));
}

// ============================================
// POSTES
// ============================================
export async function listerPostes() {
  const q = query(collection(db, POSTES_COLLECTION), orderBy("nom", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function creerPoste({ nom, competenceId }) {
  const docRef = await addDoc(collection(db, POSTES_COLLECTION), {
    nom,
    competenceId: competenceId || null
  });
  return docRef.id;
}

export async function modifierPoste(id, champs) {
  await updateDoc(doc(db, POSTES_COLLECTION, id), champs);
}

export async function supprimerPoste(id) {
  await deleteDoc(doc(db, POSTES_COLLECTION, id));
}

// ============================================
// AGENTS (identifiés par initiales/surnom uniquement)
// ============================================
export async function listerAgents() {
  const q = query(collection(db, AGENTS_COLLECTION), orderBy("initiales", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function creerAgent(initiales) {
  const docRef = await addDoc(collection(db, AGENTS_COLLECTION), {
    initiales,
    competences: [],
    restrictions: [],
    conges: [],
    samedisTravailles: []
  });
  return docRef.id;
}

export async function modifierAgent(id, champs) {
  await updateDoc(doc(db, AGENTS_COLLECTION, id), champs);
}

export async function supprimerAgent(id) {
  await deleteDoc(doc(db, AGENTS_COLLECTION, id));
}

// ============================================
// DIMANCHES (id du document = date ISO, ex. "2026-09-06")
// ============================================
export async function listerDimanches() {
  const snapshot = await getDocs(collection(db, DIMANCHES_COLLECTION));
  const out = {};
  snapshot.docs.forEach((d) => { out[d.id] = d.data(); });
  return out;
}

export async function assurerDimanche(dateISO) {
  const ref = doc(db, DIMANCHES_COLLECTION, dateISO);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const data = { volontaires: [], affectations: {}, postesDesactives: [] };
    await setDoc(ref, data);
    return data;
  }
  return snap.data();
}

export async function sauvegarderDimanche(dateISO, donnees) {
  await setDoc(doc(db, DIMANCHES_COLLECTION, dateISO), donnees, { merge: true });
}

export async function supprimerDimanche(dateISO) {
  await deleteDoc(doc(db, DIMANCHES_COLLECTION, dateISO));
}

// ============================================
// PÉRIODE (mémorise juste les dernières bornes utilisées)
// ============================================
export async function obtenirPeriode() {
  const snap = await getDoc(doc(db, CONFIG_COLLECTION, "periode"));
  return snap.exists() ? snap.data() : { debut: "", fin: "" };
}

export async function sauvegarderPeriode(debut, fin) {
  await setDoc(doc(db, CONFIG_COLLECTION, "periode"), { debut, fin });
}

// ============================================
// SEMIS DES DONNÉES PAR DÉFAUT (compétences + postes)
// N'écrit que si les collections sont vides, pour ne jamais écraser une config existante.
// ============================================
export async function assurerDonneesParDefaut() {
  let competences = await listerCompetences();
  if (competences.length === 0) {
    for (const c of COMPETENCES_PAR_DEFAUT) await creerCompetence(c.nom);
    competences = await listerCompetences();
  }

  const postes = await listerPostes();
  if (postes.length === 0) {
    for (const p of POSTES_PAR_DEFAUT) {
      const comp = competences.find((c) => c.nom === p.competenceNom);
      await creerPoste({ nom: p.nom, competenceId: comp ? comp.id : null });
    }
  }
}
// src/js/sites-sanitaires.js
// Gestion des cellules sanitaires (sites) : CRUD Firestore
// Utilisé par admin/sites-sanitaires.js (gestion) et sanitaires-controle.html (sélection agent)

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "./firebase.js";

const SITES_COLLECTION = "sanitaires";

/**
 * Crée une nouvelle cellule sanitaire
 * @param {Object} site { nom, adresse, notes }
 */
export async function creerSite(site) {
  const docRef = await addDoc(collection(db, SITES_COLLECTION), {
    ...site,
    actif: true,
    dateAjout: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Met à jour une cellule sanitaire existante
 */
export async function modifierSite(siteId, champsMisAJour) {
  const siteRef = doc(db, SITES_COLLECTION, siteId);
  await updateDoc(siteRef, champsMisAJour);
}

/**
 * Supprime une cellule sanitaire
 */
export async function supprimerSite(siteId) {
  await deleteDoc(doc(db, SITES_COLLECTION, siteId));
}

/**
 * Récupère toutes les cellules, triées par nom
 */
export async function listerSites() {
  const q = query(collection(db, SITES_COLLECTION), orderBy("nom", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Récupère uniquement les cellules actives (pour le sélecteur agent)
 */
export async function listerSitesActifs() {
  const sites = await listerSites();
  return sites.filter((s) => s.actif !== false);
}
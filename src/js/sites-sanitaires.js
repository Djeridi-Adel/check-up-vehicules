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
 * Checklist par défaut proposée à la création d'une nouvelle cellule.
 * Entièrement modifiable ensuite (ajout/suppression de points) depuis l'admin.
 */
export const CHECKLIST_PAR_DEFAUT = [
  { id: "papier-toilette", label: "Papier toilette", type: "consommable" },
  { id: "savon-mains", label: "Savon mains", type: "consommable" },
  { id: "produit-nettoyant-sol", label: "Produit nettoyant sol", type: "consommable" },
  { id: "nettoyage-sol", label: "Nettoyage / désinfection sol", type: "tache" },
  { id: "nettoyage-sanitaires", label: "Nettoyage sanitaires (WC/urinoirs)", type: "tache" },
  { id: "nettoyage-miroir", label: "Nettoyage miroir", type: "tache" },
  { id: "vidage-poubelle", label: "Vidage poubelle(s)", type: "tache" },
  { id: "distributeurs-fonctionnels", label: "Distributeurs fonctionnels", type: "tache" }
];

/**
 * Crée une nouvelle cellule sanitaire
 * @param {Object} site { nom, adresse, notes, checklist }
 */
export async function creerSite(site) {
  const docRef = await addDoc(collection(db, SITES_COLLECTION), {
    ...site,
    checklist: site.checklist || CHECKLIST_PAR_DEFAUT,
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
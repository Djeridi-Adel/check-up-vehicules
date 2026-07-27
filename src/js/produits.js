// src/js/produits.js
// Module partagé pour la gestion des fiches produits (fiches techniques + FDS)
// Utilisé par sanitaires-produits-admin.html (CRUD) et sanitaires-fds.html (consultation agent)

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

// --- Configuration Cloudinary (identique au reste du projet) ---
const CLOUDINARY_CLOUD_NAME = "dpyfeif48";
const CLOUDINARY_UPLOAD_PRESET = "ocgjzqqe";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

// --- Listes de référence (menu déroulant / checkboxes) ---
export const NATURES_PRODUIT = [
  "Détergent",
  "Désinfectant",
  "Détartrant",
  "Savon",
  "Dégraissant",
  "Autre"
];

export const EPI_DISPONIBLES = [
  "Gants nitrile",
  "Lunettes de protection",
  "Masque",
  "Tablier",
  "Chaussures de sécurité",
  "Autre"
];

const PRODUITS_COLLECTION = "produits";

/**
 * Upload un fichier (PDF fiche technique ou FDS) vers Cloudinary
 * @param {File} file
 * @returns {Promise<string>} URL sécurisée du fichier hébergé
 */
export async function uploadFichierProduit(file) {
  if (!file) return null;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error("Échec de l'upload vers Cloudinary");
  }

  const data = await response.json();
  return data.secure_url;
}

/**
 * Crée une nouvelle fiche produit
 * @param {Object} produit { nom, nature, epiRecommandes: string[], ficheTechniqueUrl, fdsUrl }
 */
export async function creerProduit(produit) {
  const docRef = await addDoc(collection(db, PRODUITS_COLLECTION), {
    ...produit,
    dateAjout: serverTimestamp(),
    dateMiseAJour: serverTimestamp()
  });
  return docRef.id;
}

/**
 * Met à jour une fiche produit existante
 */
export async function modifierProduit(produitId, champsMisAJour) {
  const produitRef = doc(db, PRODUITS_COLLECTION, produitId);
  await updateDoc(produitRef, {
    ...champsMisAJour,
    dateMiseAJour: serverTimestamp()
  });
}

/**
 * Supprime une fiche produit
 * (Note : ne supprime pas automatiquement les fichiers sur Cloudinary)
 */
export async function supprimerProduit(produitId) {
  await deleteDoc(doc(db, PRODUITS_COLLECTION, produitId));
}

/**
 * Récupère tous les produits, triés par nom
 */
export async function listerProduits() {
  const q = query(collection(db, PRODUITS_COLLECTION), orderBy("nom", "asc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
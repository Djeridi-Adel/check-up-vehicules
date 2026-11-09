// src/js/parc.js
// Parc global de véhicules + suivi des pannes, réparations et jours d'immobilisation.
// Les mêmes fonctions serviront aux cellules sanitaires (collection "sanitaires").

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { db } from "./firebase.js";

export const COLLECTIONS = { vehicule: "parc", cellule: "sanitaires" };
const INTERVENTIONS = "interventions";
const VEHICULES_CHECKUP = "vehicules";

// ============================================
// DATES
// ============================================
export function aujourdhuiISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Nombre de jours entre deux dates, début et fin inclus
export function joursEntre(debutISO, finISO) {
  return Math.round((parseISO(finISO) - parseISO(debutISO)) / 86400000) + 1;
}

// ============================================
// OBJETS (véhicules du parc / cellules)
// ============================================
export async function listerObjets(type) {
  const snapshot = await getDocs(collection(db, COLLECTIONS[type]));
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
}

export async function obtenirObjet(type, id) {
  const snap = await getDoc(doc(db, COLLECTIONS[type], id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function creerVehicule({ nom, immatriculation, type, vehiculeCheckupId }) {
  const ref = await addDoc(collection(db, COLLECTIONS.vehicule), {
    nom,
    immatriculation: immatriculation || "",
    type: type || "",
    vehiculeCheckupId: vehiculeCheckupId || null,
    disponible: true,
    immobilisations: [],
    dateAjout: serverTimestamp()
  });
  return ref.id;
}

export async function modifierObjet(type, id, champs) {
  await updateDoc(doc(db, COLLECTIONS[type], id), champs);
}

// Supprime l'objet et toutes ses pannes/réparations
export async function supprimerObjet(type, id) {
  const interventions = await listerInterventions(id);
  for (const i of interventions) {
    await deleteDoc(doc(db, INTERVENTIONS, i.id));
  }
  await deleteDoc(doc(db, COLLECTIONS[type], id));
}

// Reprend les véhicules du check-up qui ne sont pas encore dans le parc
export async function importerDepuisCheckup() {
  const [checkup, parc] = await Promise.all([
    getDocs(collection(db, VEHICULES_CHECKUP)),
    listerObjets("vehicule")
  ]);
  const dejaLies = new Set(parc.map((p) => p.vehiculeCheckupId).filter(Boolean));
  let compteur = 0;

  for (const d of checkup.docs) {
    if (dejaLies.has(d.id)) continue;
    const v = d.data();
    const dispo = v.disponible !== false;
    await addDoc(collection(db, COLLECTIONS.vehicule), {
      nom: v.nom || "",
      immatriculation: v.immatriculation || "",
      type: v.type || "",
      vehiculeCheckupId: d.id,
      disponible: dispo,
      immobilisations: dispo ? [] : [{ debut: aujourdhuiISO(), fin: null }],
      dateAjout: serverTimestamp()
    });
    compteur++;
  }
  return compteur;
}

// ============================================
// DISPONIBILITÉ ET IMMOBILISATION
// immobilisations = [{ debut: "2026-10-29", fin: "2026-11-03" | null }]
// fin = null → l'objet est encore immobilisé
// ============================================
export function estDisponible(objet) {
  return objet.disponible !== false;
}

export function immobilisationEnCours(objet) {
  const p = (objet.immobilisations || []).find((p) => !p.fin);
  return p ? p.debut : null;
}

// Total de jours d'immobilisation (sur une année donnée si "annee" est renseignée)
export function joursImmobilises(objet, annee = null) {
  const aujourdhui = aujourdhuiISO();
  let total = 0;

  (objet.immobilisations || []).forEach((p) => {
    let debut = p.debut;
    let fin = p.fin || aujourdhui;
    if (annee) {
      if (debut < `${annee}-01-01`) debut = `${annee}-01-01`;
      if (fin > `${annee}-12-31`) fin = `${annee}-12-31`;
    }
    if (debut <= fin) total += joursEntre(debut, fin);
  });

  return total;
}

// Passe un objet en disponible / indisponible et tient à jour les périodes
export async function basculerDisponibilite(type, objet, disponible, dateISO = aujourdhuiISO()) {
  const periodes = (objet.immobilisations || []).map((p) => ({ ...p }));

  if (!disponible) {
    if (!periodes.some((p) => !p.fin)) periodes.push({ debut: dateISO, fin: null });
  } else {
    const ouverte = periodes.find((p) => !p.fin);
    if (ouverte) ouverte.fin = dateISO;
  }

  await updateDoc(doc(db, COLLECTIONS[type], objet.id), {
    disponible,
    immobilisations: periodes
  });

  // Synchronise avec le véhicule du check-up (grisé côté agent)
  if (type === "vehicule" && objet.vehiculeCheckupId) {
    try {
      await updateDoc(doc(db, VEHICULES_CHECKUP, objet.vehiculeCheckupId), { disponible });
    } catch (e) {
      console.warn("Synchronisation avec le véhicule du check-up impossible :", e);
    }
  }

  return periodes;
}

// ============================================
// PANNES ET RÉPARATIONS
// nature : "panne" | "reparation"
// ============================================
export async function ajouterIntervention({ type, objetId, nature, date, description }) {
  const ref = await addDoc(collection(db, INTERVENTIONS), {
    typeObjet: type,
    objetId,
    nature,
    date,
    description: description || "",
    dateCreation: serverTimestamp()
  });
  return ref.id;
}

export async function listerInterventions(objetId) {
  const q = query(collection(db, INTERVENTIONS), where("objetId", "==", objetId));
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function listerToutesInterventions() {
  const snapshot = await getDocs(collection(db, INTERVENTIONS));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function supprimerIntervention(id) {
  await deleteDoc(doc(db, INTERVENTIONS, id));
}

// Marque une panne comme réparée à une date donnée
export async function marquerReparee(id, dateReparation, noteReparation = "") {
  await updateDoc(doc(db, INTERVENTIONS, id), {
    reparee: true,
    dateReparation,
    noteReparation
  });
}

// Annule la réparation (la panne redevient "en cours")
export async function rouvrirPanne(id) {
  await updateDoc(doc(db, INTERVENTIONS, id), {
    reparee: false,
    dateReparation: null,
    noteReparation: ""
  });
}
// src/js/admin/tableau-parc.js
// Onglet "Parc & cellules" du tableau de bord : véhicules et cellules côte à côte.

import {
  listerObjets,
  basculerDisponibilite,
  estDisponible,
  immobilisationEnCours,
  joursImmobilises,
  aujourdhuiISO
} from "../parc.js";

const CONFIG = {
  vehicule: {
    titre: "🚛 Véhicules",
    dispo: "✅ Disponible",
    indispo: "🔧 Indisponible",
    unite: "disponibles",
    vide: "Aucun véhicule. Ajoutez-en depuis « Parc global ».",
    fiche: "admin-parc-fiche.html?type=vehicule&id=",
    confIndispo: (nom) => `Mettre "${nom}" en indisponible à partir d'aujourd'hui ?`,
    confDispo: (nom) => `Remettre "${nom}" en service aujourd'hui ?`
  },
  cellule: {
    titre: "🚻 Cellules sanitaires",
    dispo: "✅ Ouverte",
    indispo: "🔒 Fermée",
    unite: "ouvertes",
    vide: "Aucune cellule enregistrée.",
    fiche: "admin-parc-fiche.html?type=cellule&id=",
    confIndispo: (nom) => `Fermer "${nom}" à partir d'aujourd'hui ?\nElle disparaîtra de la liste des agents.`,
    confDispo: (nom) => `Rouvrir "${nom}" aujourd'hui ?`
  }
};

let objets         = { vehicule: [], cellule: [] };
let colonneActive  = "vehicule"; // utilisé uniquement sur mobile

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ============================================
// CHARGEMENT
// ============================================
export async function chargerTableauParc() {
  const conteneur = document.getElementById("tp-app");
  if (!conteneur) return;

  conteneur.innerHTML = '<p class="loading">Chargement...</p>';
  try {
    const [vehicules, cellules] = await Promise.all([
      listerObjets("vehicule"),
      listerObjets("cellule")
    ]);
    objets = { vehicule: vehicules, cellule: cellules };
    rendre();
  } catch (e) {
    console.error(e);
    conteneur.innerHTML = '<p class="loading">Erreur de chargement.</p>';
  }
}

// ============================================
// AFFICHAGE
// ============================================
function rendre() {
  const conteneur = document.getElementById("tp-app");
  conteneur.innerHTML = "";

  // Sous-onglets (visibles uniquement sur mobile)
  const onglets = document.createElement("div");
  onglets.className = "tp-mobile-tabs";
  ["vehicule", "cellule"].forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tp-mobile-tab" + (colonneActive === t ? " active" : "");
    b.textContent = CONFIG[t].titre;
    b.addEventListener("click", () => { colonneActive = t; rendre(); });
    onglets.appendChild(b);
  });
  conteneur.appendChild(onglets);

  const grille = document.createElement("div");
  grille.className = "tp-grille";
  grille.appendChild(rendreColonne("vehicule"));
  grille.appendChild(rendreColonne("cellule"));
  conteneur.appendChild(grille);
}

function rendreColonne(type) {
  const cfg   = CONFIG[type];
  const annee = new Date().getFullYear();

  // Indisponibles en premier, puis ordre alphabétique
  const liste = [...objets[type]].sort((a, b) =>
    (estDisponible(a) - estDisponible(b)) || (a.nom || "").localeCompare(b.nom || "")
  );
  const nbDispo = liste.filter(estDisponible).length;

  const col = document.createElement("div");
  col.className = "tp-colonne" + (colonneActive === type ? " active" : "");
  col.innerHTML = `
    <div class="tp-colonne-head">
      <h2>${cfg.titre}</h2>
      <span class="tp-compteur">${nbDispo}/${liste.length} ${cfg.unite}</span>
    </div>
  `;

  if (liste.length === 0) {
    col.insertAdjacentHTML("beforeend", `<p class="tp-vide">${cfg.vide}</p>`);
    return col;
  }

  liste.forEach((o) => {
    const dispo   = estDisponible(o);
    const enCours = immobilisationEnCours(o);
    const jours   = joursImmobilises(o, annee);
    const sousTitre = o.immatriculation || o.adresse || "";

    const row = document.createElement("div");
    row.className = "tp-row" + (dispo ? "" : " indispo");
    row.innerHTML = `
      <a class="tp-row-info" href="${cfg.fiche}${o.id}">
        <strong>${esc(o.nom)}</strong>
        ${sousTitre ? `<span>${esc(sousTitre)}</span>` : ""}
        <span class="tp-jours">${jours} j en ${annee}${enCours ? " · depuis le " + fmtDate(enCours) : ""}</span>
      </a>
      <button type="button" class="btn-toggle-dispo ${dispo ? "btn-toggle-dispo-on" : "btn-toggle-dispo-off"}">
        ${dispo ? cfg.dispo : cfg.indispo}
      </button>
    `;

    row.querySelector("button").addEventListener("click", () => basculerRapide(type, o));
    col.appendChild(row);
  });

  return col;
}

// ============================================
// BASCULE RAPIDE (date du jour)
// ============================================
async function basculerRapide(type, o) {
  const cfg        = CONFIG[type];
  const dispo      = estDisponible(o);
  const aujourdhui = aujourdhuiISO();
  const periodes   = o.immobilisations || [];

  if (dispo) {
    const derniereFin = periodes.filter((p) => p.fin).map((p) => p.fin).sort().pop();
    if (derniereFin && aujourdhui <= derniereFin) {
      alert(`Déjà remis en service le ${fmtDate(derniereFin)}. Pour changer son statut à une date postérieure, ouvrez sa fiche.`);
      return;
    }
  } else {
    const debut = immobilisationEnCours(o);
    if (debut && aujourdhui < debut) {
      alert(`L'immobilisation commence le ${fmtDate(debut)}. Ouvrez la fiche pour choisir une date.`);
      return;
    }
  }

  if (!confirm(dispo ? cfg.confIndispo(o.nom) : cfg.confDispo(o.nom))) return;

  try {
    o.immobilisations = await basculerDisponibilite(type, o, !dispo, aujourdhui);
    o.disponible = !dispo;
    if (type === "cellule") o.actif = !dispo;
    rendre();
  } catch (e) {
    console.error(e);
    alert("Erreur lors de la mise à jour.");
  }
}
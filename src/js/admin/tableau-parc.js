import {
  listerObjets,
  basculerDisponibilite,
  modifierVehicule,
  supprimerObjet,
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
    vide: "Aucun véhicule. Ajoutez-en un ci-dessus.",
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

const SANS_FAMILLE = "__sans_famille__";

let objets        = { vehicule: [], cellule: [] };
let colonneActive = "vehicule"; // utilisé uniquement sur mobile
// Filtres de la colonne véhicules, conservés d'un affichage à l'autre
let filtres       = { famille: "", statut: "", recherche: "" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ============================================
// FILTRES
// ============================================
function familleDe(o) {
  return (o.type || "").trim();
}

function famillesDisponibles() {
  const noms = new Set(objets.vehicule.map(familleDe).filter(Boolean));
  return [...noms].sort((a, b) => a.localeCompare(b));
}

function filtresActifs() {
  return Boolean(filtres.famille || filtres.statut || filtres.recherche.trim());
}

function filtrerVehicules() {
  const recherche = filtres.recherche.trim().toLowerCase();

  return objets.vehicule.filter((o) => {
    if (filtres.famille === SANS_FAMILLE) {
      if (familleDe(o)) return false;
    } else if (filtres.famille && familleDe(o) !== filtres.famille) {
      return false;
    }

    const dispo = estDisponible(o);
    if (filtres.statut === "dispo" && !dispo) return false;
    if (filtres.statut === "indispo" && dispo) return false;

    if (recherche) {
      const texte = `${o.nom || ""} ${o.immatriculation || ""}`.toLowerCase();
      if (!texte.includes(recherche)) return false;
    }
    return true;
  });
}

function creerBarreFiltres(col) {
  const familles = famillesDisponibles();

  // Si la famille choisie n'existe plus (véhicule supprimé), on réinitialise
  if (filtres.famille && filtres.famille !== SANS_FAMILLE && !familles.includes(filtres.famille)) {
    filtres.famille = "";
  }
  const aDesSansFamille = objets.vehicule.some((o) => !familleDe(o));

  const barre = document.createElement("div");
  barre.className = "tp-filtres";
  barre.innerHTML = `
    <select class="tp-filtre-famille">
      <option value="">Toutes les familles</option>
      ${familles.map((f) => `<option value="${esc(f)}"${filtres.famille === f ? " selected" : ""}>${esc(f)}</option>`).join("")}
      ${aDesSansFamille ? `<option value="${SANS_FAMILLE}"${filtres.famille === SANS_FAMILLE ? " selected" : ""}>Sans famille</option>` : ""}
    </select>
    <select class="tp-filtre-statut">
      <option value="">Tous les statuts</option>
      <option value="dispo"${filtres.statut === "dispo" ? " selected" : ""}>✅ Disponibles</option>
      <option value="indispo"${filtres.statut === "indispo" ? " selected" : ""}>🔧 Indisponibles</option>
    </select>
    <input type="search" class="tp-filtre-recherche" placeholder="Rechercher un nom ou une immatriculation" value="${esc(filtres.recherche)}">
    <button type="button" class="tp-filtre-reset">✕ Réinitialiser les filtres</button>
  `;

  const famille   = barre.querySelector(".tp-filtre-famille");
  const statut    = barre.querySelector(".tp-filtre-statut");
  const recherche = barre.querySelector(".tp-filtre-recherche");
  const reset     = barre.querySelector(".tp-filtre-reset");

  // On ne redessine que la liste (pas la barre) pour ne pas perdre le focus pendant la saisie
  const appliquer = () => {
    remplirListe("vehicule", col);
    reset.hidden = !filtresActifs();
  };

  famille.addEventListener("change", () => { filtres.famille = famille.value; appliquer(); });
  statut.addEventListener("change", () => { filtres.statut = statut.value; appliquer(); });
  recherche.addEventListener("input", () => { filtres.recherche = recherche.value; appliquer(); });
  reset.addEventListener("click", () => {
    filtres = { famille: "", statut: "", recherche: "" };
    famille.value = "";
    statut.value = "";
    recherche.value = "";
    appliquer();
  });

  reset.hidden = !filtresActifs();
  return barre;
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

  // Suggestions de familles pour le champ Type en mode modification
  const suggestions = document.createElement("datalist");
  suggestions.id = "tp-familles";
  suggestions.innerHTML = famillesDisponibles()
    .map((f) => `<option value="${esc(f)}"></option>`)
    .join("");
  conteneur.appendChild(suggestions);

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
  const cfg = CONFIG[type];

  const col = document.createElement("div");
  col.className = "tp-colonne" + (colonneActive === type ? " active" : "");
  col.innerHTML = `
    <div class="tp-colonne-head">
      <h2>${cfg.titre}</h2>
      <span class="tp-compteur"></span>
    </div>
  `;

  if (type === "vehicule") col.appendChild(creerBarreFiltres(col));

  const liste = document.createElement("div");
  liste.className = "tp-liste";
  col.appendChild(liste);

  remplirListe(type, col);
  return col;
}

// Remplit (ou met à jour) la liste et le compteur d'une colonne
function remplirListe(type, col) {
  const cfg      = CONFIG[type];
  const annee    = new Date().getFullYear();
  const total    = objets[type];
  const visibles = type === "vehicule" ? filtrerVehicules() : total;

  // Indisponibles en premier, puis ordre alphabétique
  const tries = [...visibles].sort((a, b) =>
    (estDisponible(a) - estDisponible(b)) || (a.nom || "").localeCompare(b.nom || "")
  );
  const nbDispo = tries.filter(estDisponible).length;

  col.querySelector(".tp-compteur").textContent =
    `${nbDispo}/${tries.length} ${cfg.unite}` +
    (tries.length !== total.length ? ` · ${tries.length} sur ${total.length}` : "");

  const liste = col.querySelector(".tp-liste");
  liste.innerHTML = "";

  if (tries.length === 0) {
    const message = total.length === 0 ? cfg.vide : "Aucun véhicule ne correspond aux filtres.";
    liste.innerHTML = `<p class="tp-vide">${message}</p>`;
    return;
  }

  tries.forEach((o) => liste.appendChild(creerLigne(type, o, annee)));
}

function creerLigne(type, o, annee) {
  const cfg     = CONFIG[type];
  const dispo   = estDisponible(o);
  const enCours = immobilisationEnCours(o);
  const jours   = joursImmobilises(o, annee);
  const sousTitre = type === "vehicule"
    ? [o.immatriculation, familleDe(o)].filter(Boolean).join(" — ")
    : (o.adresse || "");

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

  row.querySelector(".btn-toggle-dispo").addEventListener("click", () => basculerRapide(type, o));

    if (type === "vehicule") {
    const modifier = document.createElement("button");
    modifier.type = "button";
    modifier.className = "btn-edit";
    modifier.title = "Modifier";
    modifier.textContent = "✏️";
    modifier.addEventListener("click", () => ouvrirEdition(row, o));
    row.appendChild(modifier);

    const suppr = document.createElement("button");
    suppr.type = "button";
    suppr.className = "btn-delete";
    suppr.title = "Supprimer";
    suppr.textContent = "🗑️";
    suppr.addEventListener("click", async () => {
      if (!confirm(`Supprimer "${o.nom}" et tout son historique de pannes ? Cette action est irréversible.`)) return;
      try {
        await supprimerObjet("vehicule", o.id);
        objets.vehicule = objets.vehicule.filter((x) => x.id !== o.id);
        rendre();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
      }
    });
    row.appendChild(suppr);
  }

  return row;
}


// ============================================
// MODIFICATION D'UN VÉHICULE (formulaire dans la ligne)
// ============================================
function ouvrirEdition(row, o) {
  row.classList.add("edition");
  row.innerHTML = `
    <div class="tp-edit-form">
      <label class="fiche-field">Nom
        <input type="text" class="tp-edit-nom" value="${esc(o.nom)}">
      </label>
      <label class="fiche-field">Immatriculation / n° d'inventaire
        <input type="text" class="tp-edit-immat" value="${esc(o.immatriculation)}">
      </label>
      <label class="fiche-field">Type (famille)
        <input type="text" class="tp-edit-type" list="tp-familles" value="${esc(o.type)}">
      </label>
      <div class="tp-edit-actions">
        <button type="button" class="btn-ajouter tp-edit-valider">Enregistrer</button>
        <button type="button" class="btn-secondary tp-edit-annuler">Annuler</button>
      </div>
    </div>
  `;

  const inputNom   = row.querySelector(".tp-edit-nom");
  const inputImmat = row.querySelector(".tp-edit-immat");
  const inputType  = row.querySelector(".tp-edit-type");
  const btnValider = row.querySelector(".tp-edit-valider");

  async function enregistrer() {
    const nom             = inputNom.value.trim();
    const immatriculation = inputImmat.value.trim();
    const famille         = inputType.value.trim();

    if (!nom) {
      alert("Le nom est obligatoire.");
      return;
    }

    btnValider.disabled = true;
    try {
      const synchro = await modifierVehicule(o, { nom, immatriculation, type: famille });
      o.nom = nom;
      o.immatriculation = immatriculation;
      o.type = famille;

      if (synchro === false) {
        alert("Modifié dans le parc, mais la synchronisation avec le véhicule du check-up a échoué. Les agents verront encore l'ancien nom : réessayez.");
      }
      rendre();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement.");
      btnValider.disabled = false;
    }
  }

  btnValider.addEventListener("click", enregistrer);
  row.querySelector(".tp-edit-annuler").addEventListener("click", () => rendre());

  // Entrée = enregistrer, Échap = annuler
  row.querySelectorAll("input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") enregistrer();
      if (e.key === "Escape") rendre();
    });
  });

  inputNom.focus();
  inputNom.select();
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
import { auth } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  obtenirObjet,
  modifierObjet,
  basculerDisponibilite,
  estDisponible,
  immobilisationEnCours,
  joursImmobilises,
  joursEntre,
  aujourdhuiISO,
  ajouterIntervention,
  listerInterventions,
  supprimerIntervention,
  marquerReparee,
  rouvrirPanne
} from "../parc.js";

const params = new URLSearchParams(window.location.search);
const type   = params.get("type");
const id     = params.get("id");

const LIBELLES = {
  vehicule: {
    dispo: "Disponible",
    indispo: "Indisponible",
    actionIndispo: "🔧 Mettre en indisponible",
    actionDispo: "✅ Remettre en service",
    retour: "admin-parc.html",
    retourLabel: "← Parc global"
  },
  cellule: {
    dispo: "Ouverte",
    indispo: "Fermée",
    actionIndispo: "🔒 Fermer la cellule",
    actionDispo: "✅ Rouvrir la cellule",
    retour: "admin.html",
    retourLabel: "← Tableau de bord"
  }
};

let objet         = null;
let interventions = [];
let initialise    = false;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function pluriel(n, mot) {
  return `${n} ${mot}${n > 1 ? "s" : ""}`;
}

// ============================================
// RÉSUMÉ + BOUTON DISPONIBLE / INDISPONIBLE
// ============================================
function rendreResume() {
  const L       = LIBELLES[type];
  const dispo   = estDisponible(objet);
  const enCours = immobilisationEnCours(objet);
  const annee   = new Date().getFullYear();

  const joursAnnee = joursImmobilises(objet, annee);
  const joursTotal = joursImmobilises(objet);
  const pannes     = interventions.filter((i) => i.nature === "panne" && i.date.startsWith(String(annee))).length;
    const repars = interventions.filter((i) =>
    (i.nature === "reparation" && i.date.startsWith(String(annee))) ||
    (i.nature === "panne" && i.reparee && (i.dateReparation || "").startsWith(String(annee)))
    ).length;
  const sousTitre  = objet.immatriculation || objet.adresse || "";

  const el = document.getElementById("fiche-resume");
  el.innerHTML = `
    <div class="fiche-resume-head">
      <div>
        <h2>${esc(objet.nom)}</h2>
        <p class="parc-card-jours">${esc(sousTitre)}${objet.type ? " — " + esc(objet.type) : ""}</p>
      </div>
      <span class="fiche-statut ${dispo ? "ok" : "ko"}">${dispo ? L.dispo : L.indispo}</span>
    </div>

    <div class="fiche-stats">
      <div class="fiche-stat"><span class="fiche-stat-n">${joursAnnee}</span><span>${joursAnnee > 1 ? "jours" : "jour"} en ${annee}</span></div>
      <div class="fiche-stat"><span class="fiche-stat-n">${joursTotal}</span><span>${joursTotal > 1 ? "jours" : "jour"} au total</span></div>
      <div class="fiche-stat"><span class="fiche-stat-n">${pannes}</span><span>${pannes > 1 ? "pannes" : "panne"} en ${annee}</span></div>
      <div class="fiche-stat"><span class="fiche-stat-n">${repars}</span><span>${repars > 1 ? "réparations" : "réparation"} en ${annee}</span></div>
    </div>

    ${enCours ? `<p class="parc-card-jours">Immobilisé depuis le ${fmtDate(enCours)}, ${pluriel(joursEntre(enCours, aujourdhuiISO()), "jour")} jusqu'à aujourd'hui.</p>` : ""}

    <div class="fiche-toggle-row">
      <label class="fiche-field">Date du changement
        <input type="date" id="fiche-toggle-date" value="${aujourdhuiISO()}">
      </label>
      <button type="button" id="fiche-toggle" class="btn-toggle-dispo ${dispo ? "btn-toggle-dispo-off" : "btn-toggle-dispo-on"}">
        ${dispo ? L.actionIndispo : L.actionDispo}
      </button>
    </div>
  `;

  document.getElementById("fiche-toggle").addEventListener("click", basculer);
}

async function basculer(e) {
  const btn  = e.currentTarget;
  const date = document.getElementById("fiche-toggle-date").value;
  if (!date) {
    alert("Indiquez la date du changement.");
    return;
  }

  const dispo   = estDisponible(objet);
  const periodes = objet.immobilisations || [];

  if (dispo) {
    // Passage en indisponible : la date doit suivre la dernière remise en service
    const derniereFin = periodes.filter((p) => p.fin).map((p) => p.fin).sort().pop();
    if (derniereFin && date <= derniereFin) {
      alert(`La date doit être postérieure à la dernière remise en service (${fmtDate(derniereFin)}).`);
      return;
    }
  } else {
    // Remise en service : la date ne peut pas précéder le début de l'immobilisation
    const debut = immobilisationEnCours(objet);
    if (debut && date < debut) {
      alert(`La date ne peut pas précéder le début de l'immobilisation (${fmtDate(debut)}).`);
      return;
    }
  }

  btn.disabled = true;
  try {
    objet.immobilisations = await basculerDisponibilite(type, objet, !dispo, date);
    objet.disponible = !dispo;
    rendreTout();
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la mise à jour.");
    btn.disabled = false;
  }
}

// ============================================
// PÉRIODES D'IMMOBILISATION
// ============================================
function rendrePeriodes() {
  const el = document.getElementById("fiche-periodes");
  const periodes = objet.immobilisations || [];

  if (periodes.length === 0) {
    el.innerHTML = '<p class="fiche-vide">Aucune immobilisation enregistrée.</p>';
    return;
  }

  el.innerHTML = "";
  [...periodes]
    .sort((a, b) => b.debut.localeCompare(a.debut))
    .forEach((p) => {
      const jours = joursEntre(p.debut, p.fin || aujourdhuiISO());
      const row = document.createElement("div");
      row.className = "fiche-row";
      row.innerHTML = `
        <div class="fiche-row-main">
          <strong>${fmtDate(p.debut)} → ${p.fin ? fmtDate(p.fin) : "en cours"}</strong>
          <span class="fiche-row-sub">${pluriel(jours, "jour")}</span>
        </div>
        ${p.fin ? '<button type="button" class="btn-suppr-card" title="Supprimer cette période">🗑️</button>' : ""}
      `;

      const btnSuppr = row.querySelector(".btn-suppr-card");
      if (btnSuppr) {
        btnSuppr.addEventListener("click", async () => {
          if (!confirm("Supprimer cette période d'immobilisation ? Les jours seront retirés du compteur.")) return;
          try {
            const restantes = (objet.immobilisations || []).filter((x) => x !== p);
            await modifierObjet(type, id, { immobilisations: restantes });
            objet.immobilisations = restantes;
            rendreTout();
          } catch (err) {
            console.error(err);
            alert("Erreur lors de la suppression.");
          }
        });
      }

      el.appendChild(row);
    });
}

// ============================================
// HISTORIQUE DES PANNES ET RÉPARATIONS
// ============================================
function rendreHistorique() {
  const el = document.getElementById("fiche-historique");

  if (interventions.length === 0) {
    el.innerHTML = '<p class="fiche-vide">Aucune panne ni réparation enregistrée.</p>';
    return;
  }

  el.innerHTML = "";
  interventions.forEach((i) => {
    const estPanne = i.nature === "panne";
    const reparee  = estPanne && i.reparee;
    const enCours  = estPanne && !i.reparee;

    let badge;
    if (enCours)      badge = '<span class="fiche-badge panne">🔴 Panne en cours</span>';
    else if (reparee) badge = '<span class="fiche-badge reparation">✅ Panne réparée</span>';
    else              badge = '<span class="fiche-badge reparation">🛠️ Réparation</span>';

    let detailReparation = "";
    if (reparee) {
      const delai = joursEntre(i.date, i.dateReparation) - 1;
      detailReparation = `
        <p class="fiche-reparation-info">
          🛠️ Réparée le ${fmtDate(i.dateReparation)}
          (${delai === 0 ? "le jour même" : pluriel(delai, "jour") + " après la panne"})
          ${i.noteReparation ? " — " + esc(i.noteReparation) : ""}
        </p>`;
    }

    const row = document.createElement("div");
    row.className = "fiche-row " + (enCours ? "panne" : "reparation");
    row.innerHTML = `
      <div class="fiche-row-main">
        <div>
          ${badge}
          <span class="fiche-row-sub">${fmtDate(i.date)}</span>
        </div>
        <p>${esc(i.description)}</p>
        ${detailReparation}
      </div>
      <div class="fiche-row-actions">
        ${enCours ? '<button type="button" class="btn-reparee">✅ Marquer réparée</button>' : ""}
        ${reparee ? '<button type="button" class="btn-rouvrir">↩️ Rouvrir</button>' : ""}
        <button type="button" class="btn-suppr-card" title="Supprimer">🗑️</button>
      </div>
      ${enCours ? `
        <div class="fiche-reparer-form">
          <label class="fiche-field">Date de réparation
            <input type="date" class="fiche-rep-date" value="${aujourdhuiISO()}" min="${i.date}" max="${aujourdhuiISO()}">
          </label>
          <input type="text" class="fiche-rep-note" placeholder="Réparation effectuée (optionnel)">
          <button type="button" class="btn-ajouter fiche-rep-valider">Valider</button>
          <button type="button" class="btn-secondary fiche-rep-annuler">Annuler</button>
        </div>` : ""}
    `;

    // Marquer comme réparée
    const btnReparee = row.querySelector(".btn-reparee");
    if (btnReparee) {
      const form = row.querySelector(".fiche-reparer-form");

      btnReparee.addEventListener("click", () => form.classList.toggle("visible"));
      row.querySelector(".fiche-rep-annuler").addEventListener("click", () => form.classList.remove("visible"));

      row.querySelector(".fiche-rep-valider").addEventListener("click", async (e) => {
        const btn  = e.currentTarget;
        const date = row.querySelector(".fiche-rep-date").value;
        const note = row.querySelector(".fiche-rep-note").value.trim();

        if (!date) {
          alert("Indiquez la date de réparation.");
          return;
        }
        if (date < i.date) {
          alert(`La date ne peut pas précéder celle de la panne (${fmtDate(i.date)}).`);
          return;
        }
        if (date > aujourdhuiISO()) {
          alert("La date de réparation ne peut pas être dans le futur.");
          return;
        }

        btn.disabled = true;
        try {
          await marquerReparee(i.id, date, note);
          i.reparee         = true;
          i.dateReparation  = date;
          i.noteReparation  = note;
        } catch (err) {
        console.error(err);
        alert("Erreur lors de l'enregistrement.");
        btn.disabled = false;
        return;          
      }

      await proposerRemiseEnService(date);
      rendreTout();

    // Rouvrir une panne
    const btnRouvrir = row.querySelector(".btn-rouvrir");
    if (btnRouvrir) {
      btnRouvrir.addEventListener("click", async () => {
        if (!confirm("Rouvrir cette panne ? La date de réparation sera effacée.")) return;
        try {
          await rouvrirPanne(i.id);
          i.reparee        = false;
          i.dateReparation = null;
          i.noteReparation = "";
          rendreTout();
        } catch (err) {
          console.error(err);
          alert("Erreur lors de la mise à jour.");
        }
      });
    }

    // Supprimer l'entrée
    row.querySelector(".btn-suppr-card").addEventListener("click", async () => {
      if (!confirm("Supprimer cette entrée ?")) return;
      try {
        await supprimerIntervention(i.id);
        interventions = interventions.filter((x) => x.id !== i.id);
        rendreTout();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
      }
    });

    el.appendChild(row);
  });
}

// Après une réparation : propose de remettre l'objet en service à la même date
async function proposerRemiseEnService(date) {
  if (estDisponible(objet)) return;

  const debut = immobilisationEnCours(objet);
  if (!debut || date < debut) return;

  const autres = interventions.filter((x) => x.nature === "panne" && !x.reparee).length;
  const action = type === "cellule" ? "Rouvrir" : "Remettre en service";

  let message = `${action} "${objet.nom}" au ${fmtDate(date)} ?`;
  if (autres > 0) {
    message += `\n\nAttention : il reste ${autres > 1 ? autres + " autres pannes" : "1 autre panne"} en cours.`;
  }

  if (!confirm(message)) return;
  
  try {
    objet.immobilisation = await basculerDisponibilite(tyoe, objet, true, date);
    objet.disponible = true;
  } catch (err) {
    console.error(err);
    alert("La panne est bien marquée réparée, mais la remise en service a échoué. Utilisez le bouton en haut de la fiche. Si cela ne marche toujours pas, faites un ticket auprès de monsieur Djeridi");
  }
}

function rendreTout() {
  rendreResume();
  rendreHistorique();
  rendrePeriodes();
}

// ============================================
// INITIALISATION
// ============================================
async function initialiser() {
  if (initialise) return;
  initialise = true;

  const chargement = document.getElementById("fiche-loading");

  if (!Object.keys(LIBELLES).includes(type) || !id) {
    chargement.textContent = "Lien invalide.";
    return;
  }

  try {
    objet = await obtenirObjet(type, id);
    if (!objet) {
      chargement.textContent = "Introuvable (il a peut-être été supprimé).";
      return;
    }
    interventions = await listerInterventions(id);
  } catch (e) {
    console.error(e);
    chargement.textContent = "Erreur de chargement.";
    return;
  }

  const L = LIBELLES[type];
  document.getElementById("fiche-titre").textContent = objet.nom;
  const retour = document.getElementById("fiche-retour");
  retour.href = L.retour;
  retour.textContent = L.retourLabel;
  document.getElementById("fiche-date").value = aujourdhuiISO();

  document.getElementById("fiche-ajouter").addEventListener("click", async (e) => {
    const btn         = e.currentTarget;
    const nature      = document.getElementById("fiche-nature").value;
    const date        = document.getElementById("fiche-date").value;
    const description = document.getElementById("fiche-description").value.trim();

    if (!date || !description) {
      alert("Indiquez la date et une description.");
      return;
    }

    btn.disabled = true;
    try {
      const newId = await ajouterIntervention({ type, objetId: id, nature, date, description });
      interventions.push({ id: newId, typeObjet: type, objetId: id, nature, date, description });
      interventions.sort((a, b) => b.date.localeCompare(a.date));
      document.getElementById("fiche-description").value = "";
      rendreTout();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout.");
    } finally {
      btn.disabled = false;
    }
  });

  chargement.classList.add("hidden");
  document.getElementById("fiche-app").classList.remove("hidden");
  rendreTout();
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "admin.html";
    return;
  }
  initialiser();
});
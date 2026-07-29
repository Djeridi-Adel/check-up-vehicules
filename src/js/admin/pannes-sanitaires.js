// src/js/admin/pannes-sanitaires.js

import { db } from "../firebase.js";
import {
  collection,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let pannesListe = [];
let filtreStatut = "";
let filtreSitePanne = null;

const LABELS_STATUT = {
  signale: { texte: "🔴 Signalée", classe: "statut-signale" },
  en_cours: { texte: "🟠 En cours", classe: "statut-en-cours" },
  resolu: { texte: "🟢 Résolue", classe: "statut-resolu" }
};

function getElements() {
  return {
    liste: document.getElementById("pannes-liste"),
    filtreStatutBtns: document.querySelectorAll(".filtre-statut-panne"),
    filtreSiteSelect: document.getElementById("filtre-panne-site")
  };
}

function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return "—";
  return timestamp.toDate().toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function rendreListe() {
  const el = getElements();
  let pannes = pannesListe;
  if (filtreStatut) pannes = pannes.filter((p) => p.statut === filtreStatut);
  if (filtreSitePanne) pannes = pannes.filter((p) => p.siteId === filtreSitePanne);

  if (pannes.length === 0) {
    el.liste.innerHTML = `<p class="loading">Aucune panne trouvée.</p>`;
    return;
  }

  el.liste.innerHTML = pannes.map((p) => {
    const statutInfo = LABELS_STATUT[p.statut] || LABELS_STATUT.signale;

    let actions = "";
    if (p.statut === "signale") {
      actions = `<button type="button" class="btn-panne-action" data-action="en_cours" data-id="${p.id}">Prendre en charge</button>`;
    } else if (p.statut === "en_cours") {
      actions = `
        <textarea class="panne-intervention-input" id="intervention-${p.id}" placeholder="Détail de l'intervention (optionnel)">${p.interventionDetails || ""}</textarea>
        <button type="button" class="btn-panne-action btn-panne-resoudre" data-action="resolu" data-id="${p.id}">Marquer résolu ✓</button>
      `;
    } else if (p.statut === "resolu") {
      actions = `
        <p class="panne-resolution-info">
          Résolue le ${formatDate(p.dateResolution)}
          ${p.interventionDetails ? `<br>${p.interventionDetails}` : ""}
        </p>
      `;
    }

    return `
      <div class="panne-card">
        <div class="panne-card-header">
          <h3>${p.siteNom}</h3>
          <span class="badge ${statutInfo.classe}">${statutInfo.texte}</span>
        </div>
        <p class="panne-description">${p.description}</p>
        ${p.photoUrl ? `<a href="${p.photoUrl}" target="_blank" class="panne-photo-link">📷 Voir la photo</a>` : ""}
        <p class="panne-meta">Signalée le ${formatDate(p.dateSignalement)} par ${p.agentMail || "agent inconnu"}</p>
        <div class="panne-actions">${actions}</div>
        <button type="button" class="btn-supprimer-panne" data-id="${p.id}">🗑 Supprimer</button>
      </div>
    `;
  }).join("");

  el.liste.querySelectorAll(".btn-panne-action").forEach((btn) => {
    btn.addEventListener("click", () => changerStatutPanne(btn.dataset.id, btn.dataset.action));
  });
  el.liste.querySelectorAll(".btn-supprimer-panne").forEach((btn) => {
    btn.addEventListener("click", () => confirmerSuppressionPanne(btn.dataset.id));
  });
}

async function changerStatutPanne(panneId, nouveauStatut) {
  try {
    const donnees = { statut: nouveauStatut };
    if (nouveauStatut === "resolu") {
      const textarea = document.getElementById(`intervention-${panneId}`);
      donnees.interventionDetails = textarea ? textarea.value.trim() : "";
      donnees.dateResolution = serverTimestamp();
    }
    await updateDoc(doc(db, "pannes", panneId), donnees);
    await chargerPannesAdmin();
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la mise à jour.");
  }
}

async function confirmerSuppressionPanne(panneId) {
  if (!confirm("Supprimer définitivement cette panne ?")) return;
  try {
    await deleteDoc(doc(db, "pannes", panneId));
    pannesListe = pannesListe.filter((p) => p.id !== panneId);
    rendreListe();
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la suppression.");
  }
}

function initFiltres() {
  const el = getElements();

  el.filtreStatutBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      el.filtreStatutBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filtreStatut = btn.dataset.statut;
      rendreListe();
    });
  });

  const sitesUniques = [...new Map(
    pannesListe.map((p) => [p.siteId, p.siteNom])
  ).entries()];
  el.filtreSiteSelect.innerHTML = `<option value="">Toutes les cellules</option>` +
    sitesUniques.map(([id, nom]) => `<option value="${id}">${nom}</option>`).join("");

  el.filtreSiteSelect.addEventListener("change", () => {
    filtreSitePanne = el.filtreSiteSelect.value || null;
    rendreListe();
  });
}

export async function chargerPannesAdmin() {
  const el = getElements();
  el.liste.innerHTML = `<p class="loading">Chargement des pannes...</p>`;
  try {
    const q = query(collection(db, "pannes"), orderBy("dateSignalement", "desc"));
    const snapshot = await getDocs(q);
    pannesListe = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    initFiltres();
    rendreListe();
  } catch (err) {
    console.error(err);
    el.liste.innerHTML = `<p class="loading">Erreur de chargement.</p>`;
  }
}
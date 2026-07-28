// src/js/admin/controles-sanitaires.js

import { db } from "../firebase.js";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let controlesListe = null;
let filtreSite = null;

function getElements() {
  return {
    liste: document.getElementById("controles-liste"),
    filtreSiteSelect: document.getElementById("filtre-controle-site")
  };
}

function formatDate(timestamp) {
  if (!timestamp || !timestamp.toDate) return "—";
  return timestamp.toDate().toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });
}

function compterAlertes(resultats) {
  return Object.values(resultats || {}).filter(
    (r) => r.statut === "anomalie" || r.statut === "manquant"
  ).length;
}

function rendreListe() {
  const el = getElements();
  const controles = filtreSite
    ? controlesListe.filter((c) => c.siteId === filtreSite)
    : controlesListe;

  if (controles.length === 0) {
    el.liste.innerHTML = `<p class="loading">Aucun contrôle enregistré.</p>`;
    return;
  }

  el.liste.innerHTML = controles.map((c) => {
    const nbAlertes = compterAlertes(c.resultats);
    const detailPoints = Object.values(c.resultats || {}).map((r) => {
      let badge = "";
      if (r.statut === "ok" || r.statut === "suffisant") badge = `<span class="badge badge-actif">${r.label}</span>`;
      else if (r.statut === "recharge") badge = `<span class="badge" style="background:#fff3e0;color:#e65100;">${r.label} — rechargé</span>`;
      else badge = `<span class="badge badge-inactif">${r.label} — ${r.statut === "manquant" ? "manquant" : "anomalie"}</span>`;
      return badge;
    }).join(" ");

    return `
      <div class="controle-card">
        <div class="controle-card-header">
          <h3>${c.siteNom}</h3>
          <span class="badge ${nbAlertes > 0 ? "badge-inactif" : "badge-actif"}">
            ${nbAlertes > 0 ? `⚠️ ${nbAlertes} point(s) à traiter` : "✅ RAS"}
          </span>
        </div>
        <p class="controle-meta">${formatDate(c.date)} — ${c.agentMail || "agent inconnu"}</p>
        <div class="controle-photos">
          ${c.photoAvantUrl ? `<a href="${c.photoAvantUrl}" target="_blank">📷 Avant</a>` : ""}
          ${c.photoApresUrl ? `<a href="${c.photoApresUrl}" target="_blank">📷 Après</a>` : ""}
        </div>
        <div class="controle-points">${detailPoints}</div>
      </div>
    `;
  }).join("");
}

async function chargerFiltreSites() {
  const el = getElements();
  const sitesUniques = [...new Map(
    controlesListe.map((c) => [c.siteId, c.siteNom])
  ).entries()];

  el.filtreSiteSelect.innerHTML = `<option value="">Toutes les cellules</option>` +
    sitesUniques.map(([id, nom]) => `<option value="${id}">${nom}</option>`).join("");

  el.filtreSiteSelect.addEventListener("change", () => {
    filtreSite = el.filtreSiteSelect.value || null;
    rendreListe();
  });
}

export async function chargerControlesAdmin() {
  const el = getElements();
  el.liste.innerHTML = `<p class="loading">Chargement des contrôles...</p>`;
  try {
    const q = query(collection(db, "controles"), orderBy("date", "desc"));
    const snapshot = await getDocs(q);
    controlesListe = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    await chargerFiltreSites();
    rendreListe();
  } catch (err) {
    console.error(err);
    el.liste.innerHTML = `<p class="loading">Erreur de chargement.</p>`;
  }
}
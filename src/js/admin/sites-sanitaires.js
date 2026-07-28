// src/js/admin/sites-sanitaires.js
// Gestion de l'onglet "Sites sanitaires" dans le dashboard admin

import {
  creerSite,
  modifierSite,
  supprimerSite,
  listerSites
} from "../sites-sanitaires.js";

let elements = null;

function getElements() {
  return {
    form: document.getElementById("siteForm"),
    siteIdInput: document.getElementById("siteId"),
    nomInput: document.getElementById("siteNom"),
    adresseInput: document.getElementById("siteAdresse"),
    notesInput: document.getElementById("siteNotes"),
    actifInput: document.getElementById("siteActif"),
    submitBtn: document.getElementById("siteSubmitBtn"),
    cancelEditBtn: document.getElementById("siteCancelEditBtn"),
    statusMsg: document.getElementById("siteStatusMsg"),
    tableBody: document.getElementById("sitesTableBody")
  };
}

function afficherStatus(message, type) {
  elements.statusMsg.textContent = message;
  elements.statusMsg.className = type;
}

function resetForm() {
  const el = elements;
  el.form.reset();
  el.siteIdInput.value = "";
  el.actifInput.checked = true;
  el.submitBtn.textContent = "Ajouter la cellule";
  el.cancelEditBtn.style.display = "none";
  afficherStatus("", "");
}

function remplirFormulairePourEdition(site) {
  const el = elements;
  el.siteIdInput.value = site.id;
  el.nomInput.value = site.nom;
  el.adresseInput.value = site.adresse || "";
  el.notesInput.value = site.notes || "";
  el.actifInput.checked = site.actif !== false;
  el.submitBtn.textContent = "Enregistrer les modifications";
  el.cancelEditBtn.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function confirmerSuppression(site) {
  if (!confirm(`Supprimer définitivement la cellule "${site.nom}" ?`)) return;
  try {
    await supprimerSite(site.id);
    afficherStatus("Cellule supprimée.", "success");
    chargerSitesAdmin();
  } catch (err) {
    console.error(err);
    afficherStatus("Erreur lors de la suppression.", "error");
  }
}

function rendreTableau(sites) {
  const tableBody = elements.tableBody;
  if (sites.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4">Aucune cellule enregistrée.</td></tr>`;
    return;
  }
  tableBody.innerHTML = "";
  sites.forEach((s) => {
    const tr = document.createElement("tr");
    const statutBadge = s.actif !== false
      ? `<span class="badge badge-actif">Active</span>`
      : `<span class="badge badge-inactif">Inactive</span>`;
    tr.innerHTML = `
      <td>${s.nom}</td>
      <td>${s.adresse || "—"}</td>
      <td>${statutBadge}</td>
      <td class="actions">
        <button type="button" data-action="edit" data-id="${s.id}">Modifier</button>
        <button type="button" data-action="delete" data-id="${s.id}" style="background:#c62828;">Suppr.</button>
      </td>
    `;
    tableBody.appendChild(tr);
    tr.querySelector('[data-action="edit"]').addEventListener("click", () => remplirFormulairePourEdition(s));
    tr.querySelector('[data-action="delete"]').addEventListener("click", () => confirmerSuppression(s));
  });
}

export async function chargerSitesAdmin() {
  if (!elements) elements = getElements();
  elements.tableBody.innerHTML = `<tr><td colspan="4"><p class="loading">Chargement...</p></td></tr>`;
  try {
    const sites = await listerSites();
    rendreTableau(sites);
  } catch (err) {
    console.error(err);
    elements.tableBody.innerHTML = `<tr><td colspan="4">Erreur de chargement.</td></tr>`;
  }
}

export function initSitesAdmin() {
  elements = getElements();
  const el = elements;

  el.cancelEditBtn.addEventListener("click", resetForm);

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.submitBtn.disabled = true;
    afficherStatus("Enregistrement en cours...", "");

    try {
      const siteId = el.siteIdInput.value;
      const donnees = {
        nom: el.nomInput.value.trim(),
        adresse: el.adresseInput.value.trim(),
        notes: el.notesInput.value.trim(),
        actif: el.actifInput.checked
      };

      if (siteId) {
        await modifierSite(siteId, donnees);
        afficherStatus("Cellule mise à jour avec succès.", "success");
      } else {
        await creerSite(donnees);
        afficherStatus("Cellule ajoutée avec succès.", "success");
      }

      resetForm();
      chargerSitesAdmin();
    } catch (err) {
      console.error(err);
      afficherStatus("Erreur : " + err.message, "error");
    } finally {
      el.submitBtn.disabled = false;
    }
  });
}
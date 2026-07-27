// src/js/admin/produits.js
// Gestion de l'onglet "Produits" dans le dashboard admin
// Suit le même pattern que admin/maintenance.js et admin/flotte.js

import {
  NATURES_PRODUIT,
  EPI_DISPONIBLES,
  uploadFichierProduit,
  creerProduit,
  modifierProduit,
  supprimerProduit,
  listerProduits
} from "../produits.js";

let elements = null;

function getElements() {
  return {
    form: document.getElementById("produitForm"),
    nomInput: document.getElementById("nom"),
    natureSelect: document.getElementById("nature"),
    epiGrid: document.getElementById("epiGrid"),
    ficheTechniqueInput: document.getElementById("ficheTechnique"),
    fdsInput: document.getElementById("fds"),
    ficheTechniqueActuelle: document.getElementById("ficheTechniqueActuelle"),
    fdsActuelle: document.getElementById("fdsActuelle"),
    produitIdInput: document.getElementById("produitId"),
    submitBtn: document.getElementById("submitBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    statusMsg: document.getElementById("statusMsg"),
    tableBody: document.getElementById("produitsTableBody")
  };
}

function getEpiSelectionnes() {
  return Array.from(document.querySelectorAll(".epi-checkbox:checked")).map(
    (cb) => cb.value
  );
}

function setEpiSelectionnes(epiList = []) {
  document.querySelectorAll(".epi-checkbox").forEach((cb) => {
    cb.checked = epiList.includes(cb.value);
  });
}

function resetForm() {
  const el = elements;
  el.form.reset();
  el.produitIdInput.value = "";
  setEpiSelectionnes([]);
  el.ficheTechniqueActuelle.textContent = "";
  el.fdsActuelle.textContent = "";
  el.submitBtn.textContent = "Ajouter le produit";
  el.cancelEditBtn.style.display = "none";
  afficherStatus("", "");
}

function afficherStatus(message, type) {
  elements.statusMsg.textContent = message;
  elements.statusMsg.className = type;
}

function remplirFormulairePourEdition(produit) {
  const el = elements;
  el.produitIdInput.value = produit.id;
  el.nomInput.value = produit.nom;
  el.natureSelect.value = produit.nature;
  setEpiSelectionnes(produit.epiRecommandes || []);
  el.ficheTechniqueActuelle.innerHTML = produit.ficheTechniqueUrl
    ? `Fichier actuel : <a class="file-link" href="${produit.ficheTechniqueUrl}" target="_blank">voir</a> (laisser vide pour conserver)`
    : "";
  el.fdsActuelle.innerHTML = produit.fdsUrl
    ? `Fichier actuel : <a class="file-link" href="${produit.fdsUrl}" target="_blank">voir</a> (laisser vide pour conserver)`
    : "";
  el.submitBtn.textContent = "Enregistrer les modifications";
  el.cancelEditBtn.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function confirmerSuppression(produit) {
  if (!confirm(`Supprimer définitivement "${produit.nom}" ?`)) return;
  try {
    await supprimerProduit(produit.id);
    afficherStatus("Produit supprimé.", "success");
    chargerProduitsAdmin();
  } catch (err) {
    console.error(err);
    afficherStatus("Erreur lors de la suppression.", "error");
  }
}

function rendreTableau(produits) {
  const tableBody = elements.tableBody;
  if (produits.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5">Aucun produit enregistré.</td></tr>`;
    return;
  }
  tableBody.innerHTML = "";
  produits.forEach((p) => {
    const tr = document.createElement("tr");
    const epiBadges = (p.epiRecommandes || [])
      .map((e) => `<span class="badge">${e}</span>`)
      .join(" ");
    tr.innerHTML = `
      <td>${p.nom}</td>
      <td>${p.nature}</td>
      <td>${epiBadges}</td>
      <td>
        ${p.ficheTechniqueUrl ? `<a class="file-link" href="${p.ficheTechniqueUrl}" target="_blank">Fiche technique</a><br>` : ""}
        ${p.fdsUrl ? `<a class="file-link" href="${p.fdsUrl}" target="_blank">FDS</a>` : ""}
      </td>
      <td class="actions">
        <button type="button" data-action="edit" data-id="${p.id}">Modifier</button>
        <button type="button" data-action="delete" data-id="${p.id}" style="background:#c62828;">Suppr.</button>
      </td>
    `;
    tableBody.appendChild(tr);
    tr.querySelector('[data-action="edit"]').addEventListener("click", () => remplirFormulairePourEdition(p));
    tr.querySelector('[data-action="delete"]').addEventListener("click", () => confirmerSuppression(p));
  });
}

/**
 * Charge et affiche la liste des produits.
 * Appelée à chaque ouverture de l'onglet "Produits".
 */
export async function chargerProduitsAdmin() {
  if (!elements) elements = getElements();
  elements.tableBody.innerHTML = `<tr><td colspan="5"><p class="loading">Chargement...</p></td></tr>`;
  try {
    const produits = await listerProduits();
    rendreTableau(produits);
  } catch (err) {
    console.error(err);
    elements.tableBody.innerHTML = `<tr><td colspan="5">Erreur de chargement.</td></tr>`;
  }
}

/**
 * Initialise le formulaire (menus déroulants, checkboxes, listeners).
 * À appeler une seule fois au démarrage du dashboard, comme initMaintenanceRetour().
 */
export function initProduitsAdmin() {
  elements = getElements();
  const el = elements;

  NATURES_PRODUIT.forEach((nature) => {
    const opt = document.createElement("option");
    opt.value = nature;
    opt.textContent = nature;
    el.natureSelect.appendChild(opt);
  });

  EPI_DISPONIBLES.forEach((epi) => {
    const wrapper = document.createElement("label");
    wrapper.className = "epi-item";
    wrapper.style.fontWeight = "normal";
    wrapper.innerHTML = `
      <input type="checkbox" value="${epi}" class="epi-checkbox">
      <span>${epi}</span>
    `;
    el.epiGrid.appendChild(wrapper);
  });

  el.cancelEditBtn.addEventListener("click", resetForm);

  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.submitBtn.disabled = true;
    afficherStatus("Enregistrement en cours...", "");

    try {
      const produitId = el.produitIdInput.value;
      const nom = el.nomInput.value.trim();
      const nature = el.natureSelect.value;
      const epiRecommandes = getEpiSelectionnes();

      const ficheTechniqueFile = el.ficheTechniqueInput.files[0];
      const fdsFile = el.fdsInput.files[0];

      let ficheTechniqueUrl;
      let fdsUrl;

      if (ficheTechniqueFile) {
        afficherStatus("Upload de la fiche technique...", "");
        ficheTechniqueUrl = await uploadFichierProduit(ficheTechniqueFile);
      }
      if (fdsFile) {
        afficherStatus("Upload de la FDS...", "");
        fdsUrl = await uploadFichierProduit(fdsFile);
      }

      const donnees = { nom, nature, epiRecommandes };
      if (ficheTechniqueUrl) donnees.ficheTechniqueUrl = ficheTechniqueUrl;
      if (fdsUrl) donnees.fdsUrl = fdsUrl;

      if (produitId) {
        await modifierProduit(produitId, donnees);
        afficherStatus("Produit mis à jour avec succès.", "success");
      } else {
        await creerProduit(donnees);
        afficherStatus("Produit ajouté avec succès.", "success");
      }

      resetForm();
      chargerProduitsAdmin();
    } catch (err) {
      console.error(err);
      afficherStatus("Erreur : " + err.message, "error");
    } finally {
      el.submitBtn.disabled = false;
    }
  });
}
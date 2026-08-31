import { NATURES_PRODUIT, listerProduits } from "./produits.js";

const searchInput  = document.getElementById("searchInput");
const natureFilter = document.getElementById("natureFilter");
const produitsList = document.getElementById("produitsList");
const loadingState = document.getElementById("loadingState");
const emptyState   = document.getElementById("emptyState");

let tousLesProduits = [];

// ============================================
// REMPLISSAGE DU FILTRE NATURE
// ============================================
NATURES_PRODUIT.forEach((nature) => {
  const opt       = document.createElement("option");
  opt.value       = nature;
  opt.textContent = nature;
  natureFilter.appendChild(opt);
});

// ============================================
// AFFICHAGE DES PRODUITS
// ============================================
function afficherProduits(produits) {
  produitsList.innerHTML = "";

  if (produits.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  emptyState.style.display = "none";

  produits.forEach((p) => {
    const card      = document.createElement("div");
    card.className  = "produit-card";

    const epiHtml = (p.epiRecommandes || [])
      .map((e) => `<span class="epi-badge">⚠️ ${e}</span>`)
      .join("");

    card.innerHTML = `
      <div class="produit-nom">${p.nom}</div>
      <div class="produit-nature">${p.nature}</div>
      <div class="epi-list">${epiHtml}</div>
      <div class="file-buttons">
        <a href="${p.ficheTechniqueUrl || "#"}" target="_blank"
           class="${p.ficheTechniqueUrl ? "" : "disabled"}">
          📄 Fiche technique
        </a>
        <a href="${p.fdsUrl || "#"}" target="_blank"
           class="${p.fdsUrl ? "" : "disabled"}">
          🧪 FDS
        </a>
      </div>
    `;

    produitsList.appendChild(card);
  });
}

// ============================================
// FILTRAGE
// ============================================
function filtrerEtAfficher() {
  const recherche = searchInput.value.trim().toLowerCase();
  const nature    = natureFilter.value;

  const filtres = tousLesProduits.filter((p) => {
    const matchNom    = p.nom.toLowerCase().includes(recherche);
    const matchNature = !nature || p.nature === nature;
    return matchNom && matchNature;
  });

  afficherProduits(filtres);
}

searchInput.addEventListener("input", filtrerEtAfficher);
natureFilter.addEventListener("change", filtrerEtAfficher);

// ============================================
// INITIALISATION
// ============================================
async function init() {
  try {
    tousLesProduits            = await listerProduits();
    loadingState.style.display = "none";
    afficherProduits(tousLesProduits);
  } catch (err) {
    console.error(err);
    loadingState.textContent = "Erreur de chargement des produits.";
  }
}

init();
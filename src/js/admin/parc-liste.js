import { auth } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  listerObjets,
  creerVehicule,
  supprimerObjet,
  importerDepuisCheckup,
  basculerDisponibilite,
  estDisponible,
  joursImmobilises,
  immobilisationEnCours
} from "../parc.js";

let vehicules = [];
let initialise = false;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function fmtDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ============================================
// CHARGEMENT ET AFFICHAGE
// ============================================
async function charger() {
  const liste = document.getElementById("parc-liste");
  liste.innerHTML = '<p class="loading">Chargement...</p>';
  try {
    vehicules = await listerObjets("vehicule");
    afficher();
  } catch (e) {
    console.error(e);
    liste.innerHTML = '<p class="loading">Erreur de chargement.</p>';
  }
}

function afficher() {
  const liste = document.getElementById("parc-liste");

  if (vehicules.length === 0) {
    liste.innerHTML = '<p class="loading">Aucun véhicule. Ajoutez-en un ou importez ceux du check-up.</p>';
    return;
  }

  const annee = new Date().getFullYear();
  liste.innerHTML = "";

  vehicules.forEach((v) => {
    const dispo   = estDisponible(v);
    const enCours = immobilisationEnCours(v);
    const jours   = joursImmobilises(v, annee);

    const card = document.createElement("div");
    card.className = "parc-card" + (dispo ? "" : " indispo");
    card.innerHTML = `
      <div class="parc-card-info">
        <h3>${esc(v.nom)} ${dispo ? "" : '<span class="badge-indispo">🔧 Indisponible</span>'}</h3>
        <p>${esc(v.immatriculation) || "—"}${v.type ? " — " + esc(v.type) : ""}</p>
        <p class="parc-card-jours">
          ${enCours ? `Immobilisé depuis le ${fmtDate(enCours)} · ` : ""}${jours} j d'immobilisation en ${annee}
        </p>
      </div>
      <div class="parc-card-actions">
        <button type="button" class="btn-toggle-dispo ${dispo ? "btn-toggle-dispo-on" : "btn-toggle-dispo-off"}">
          ${dispo ? "✅ Disponible" : "🔧 Indisponible"}
        </button>
        <button type="button" class="btn-delete" title="Supprimer">🗑️</button>
      </div>
    `;

    // Clic sur la card → fiche du véhicule (étape suivante)
    card.addEventListener("click", () => {
      window.location.href = `admin-parc-fiche.html?type=vehicule&id=${v.id}`;
    });

    card.querySelector(".btn-toggle-dispo").addEventListener("click", async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        v.immobilisations = await basculerDisponibilite("vehicule", v, !dispo);
        v.disponible = !dispo;
        afficher();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la mise à jour.");
        btn.disabled = false;
      }
    });

    card.querySelector(".btn-delete").addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!confirm(`Supprimer "${v.nom}" et tout son historique de pannes ? Cette action est irréversible.`)) return;
      try {
        await supprimerObjet("vehicule", v.id);
        vehicules = vehicules.filter((x) => x.id !== v.id);
        afficher();
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la suppression.");
      }
    });

    liste.appendChild(card);
  });
}

// ============================================
// INITIALISATION
// ============================================
function initialiser() {
  if (initialise) return;
  initialise = true;

  const inputNom   = document.getElementById("parc-nom");
  const inputImmat = document.getElementById("parc-immat");
  const inputType  = document.getElementById("parc-type");
  const btnAjouter = document.getElementById("parc-ajouter");
  const btnImport  = document.getElementById("parc-importer");

  btnAjouter.addEventListener("click", async () => {
    const nom = inputNom.value.trim();
    if (!nom) {
      alert("Le nom du véhicule est obligatoire.");
      return;
    }
    btnAjouter.disabled = true;
    try {
      await creerVehicule({
        nom,
        immatriculation: inputImmat.value.trim(),
        type: inputType.value.trim()
      });
      inputNom.value = inputImmat.value = inputType.value = "";
      await charger();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'ajout.");
    } finally {
      btnAjouter.disabled = false;
    }
  });

  btnImport.addEventListener("click", async () => {
    btnImport.disabled = true;
    try {
      const n = await importerDepuisCheckup();
      alert(n > 0
        ? `${n} véhicule(s) importé(s).`
        : "Rien à importer : tous les véhicules du check-up sont déjà dans le parc.");
      await charger();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'import.");
    } finally {
      btnImport.disabled = false;
    }
  });

  charger();
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "admin.html";
    return;
  }
  document.getElementById("parc-loading").classList.add("hidden");
  document.getElementById("parc-app").classList.remove("hidden");
  initialiser();
});
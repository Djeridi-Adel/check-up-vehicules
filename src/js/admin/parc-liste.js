import { auth } from "../firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { creerVehicule, importerDepuisCheckup } from "../parc.js";
import { chargerTableauParc } from "./tableau-parc.js";

let initialise = false;

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
      await chargerTableauParc();
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
      await chargerTableauParc();
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'import.");
    } finally {
      btnImport.disabled = false;
    }
  });

  chargerTableauParc();
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
// ============================================
// IMPORTS
// ============================================
import { db } from './firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
// RÉFÉRENCES DOM
// On récupère les éléments HTML une seule fois
// ============================================
const stepVehicule     = document.getElementById('step-vehicule');
const stepCheckup      = document.getElementById('step-checkup');
const stepConfirmation = document.getElementById('step-confirmation');
const listeVehicules   = document.getElementById('liste-vehicules');
const titreVehicule    = document.getElementById('titre-vehicule');
const formCheckup      = document.getElementById('form-checkup');
const btnRetour        = document.getElementById('btn-retour');
const btnSubmit        = document.getElementById('btn-submit');
const btnNouveau       = document.getElementById('btn-nouveau');
const recapVehicule    = document.getElementById('recap-vehicule');
const recapHeure       = document.getElementById('recap-heure');

// ============================================
// STATE
// On garde en mémoire le véhicule sélectionné
// ============================================
let vehiculeSelectionne = null;

// ============================================
// NAVIGATION ENTRE ÉTAPES
// ============================================
function showStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  step.classList.add('active');
  window.scrollTo(0, 0);
}

// ============================================
// CHARGEMENT DES VÉHICULES DEPUIS FIREBASE
// ============================================
async function chargerVehicules() {
  try {
    const snapshot = await getDocs(collection(db, 'vehicules'));

    if (snapshot.empty) {
      listeVehicules.innerHTML = `
        <p class="loading">Aucun véhicule configuré.<br>
        Contacte l'administrateur.</p>
      `;
      return;
    }

    listeVehicules.innerHTML = '';

    snapshot.forEach(doc => {
      const v = doc.data();
      const card = document.createElement('div');
      card.className = 'vehicule-card';
      card.innerHTML = `
        <div class="vehicule-icon">${v.icone || '🚗'}</div>
        <div class="vehicule-info">
          <h3>${v.nom}</h3>
          <p>${v.immatriculation} — ${v.type}</p>
        </div>
      `;
      card.addEventListener('click', () => selectionnerVehicule(doc.id, v));
      listeVehicules.appendChild(card);
    });

  } catch (error) {
    listeVehicules.innerHTML = `
      <p class="loading">Erreur de chargement.<br>Vérifie ta connexion.</p>
    `;
    console.error('Erreur chargement véhicules :', error);
  }
}

// ============================================
// SÉLECTION D'UN VÉHICULE → GÉNÉRATION DU FORMULAIRE
// ============================================
function selectionnerVehicule(id, vehicule) {
  vehiculeSelectionne = { id, ...vehicule };
  titreVehicule.textContent = vehicule.nom;
  genererFormulaire(vehicule.checkpoints);
  showStep(stepCheckup);
}

// ============================================
// GÉNÉRATION DYNAMIQUE DU FORMULAIRE
// checkpoints = { "Moteur": ["Niveaux huile", "Liquide refroidissement"], ... }
// ============================================
function genererFormulaire(checkpoints) {
  formCheckup.innerHTML = '';

  Object.entries(checkpoints).forEach(([categorie, points]) => {
    const group = document.createElement('div');
    group.className = 'checkpoint-group';

    group.innerHTML = `
      <div class="checkpoint-group-title">${categorie}</div>
    `;

    points.forEach(point => {
      const item = document.createElement('div');
      item.className = 'checkpoint-item-wrapper';
      item.innerHTML = `
        <div class="checkpoint-item">
          <span class="checkpoint-label">${point}</span>
          <div class="toggle-group">
            <button type="button" class="toggle-btn ok" data-point="${point}">OK</button>
            <button type="button" class="toggle-btn anomalie" data-point="${point}">⚠️</button>
          </div>
        </div>
        <div class="anomalie-detail" id="detail-${point.replace(/\s+/g, '-')}">
          <textarea placeholder="Décris l'anomalie..."></textarea>
        </div>
      `;

      // Gestion des toggles OK / Anomalie
      const btnOk      = item.querySelector('.toggle-btn.ok');
      const btnAnomalie = item.querySelector('.toggle-btn.anomalie');
      const detail     = item.querySelector('.anomalie-detail');

      btnOk.addEventListener('click', () => {
        btnOk.classList.add('selected');
        btnAnomalie.classList.remove('selected');
        detail.classList.remove('visible');
      });

      btnAnomalie.addEventListener('click', () => {
        btnAnomalie.classList.add('selected');
        btnOk.classList.remove('selected');
        detail.classList.add('visible');
      });

      group.appendChild(item);
    });

    formCheckup.appendChild(group);
  });
}

// ============================================
// SOUMISSION DU FORMULAIRE
// ============================================
btnSubmit.addEventListener('click', async () => {
  const resultats = {};
  let tousRemplis = true;

  // On parcourt tous les points de contrôle
  document.querySelectorAll('.checkpoint-item-wrapper').forEach(wrapper => {
    const point      = wrapper.querySelector('.toggle-btn.ok').dataset.point;
    const okSelected = wrapper.querySelector('.toggle-btn.ok').classList.contains('selected');
    const anSelected = wrapper.querySelector('.toggle-btn.anomalie').classList.contains('selected');

    if (!okSelected && !anSelected) {
      tousRemplis = false;
      wrapper.style.background = '#fff3f3';
      return;
    }

    const detail = wrapper.querySelector('.anomalie-detail textarea');
    resultats[point] = {
      statut: okSelected ? 'ok' : 'anomalie',
      detail: anSelected ? detail.value : ''
    };
  });

  if (!tousRemplis) {
    alert('Tous les points doivent être vérifiés avant d\'envoyer.');
    return;
  }

  // Désactive le bouton pendant l'envoi
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Envoi en cours...';

  try {
    await addDoc(collection(db, 'checkups'), {
      vehiculeId:    vehiculeSelectionne.id,
      vehiculeNom:   vehiculeSelectionne.nom,
      immatriculation: vehiculeSelectionne.immatriculation,
      resultats,
      date:          serverTimestamp(),
      agent:         navigator.userAgent // temporaire, on ajoutera le nom agent plus tard
    });

    // Confirmation
    recapVehicule.textContent = `Véhicule : ${vehiculeSelectionne.nom} — ${vehiculeSelectionne.immatriculation}`;
    recapHeure.textContent    = `Heure : ${new Date().toLocaleTimeString('fr-FR')}`;
    showStep(stepConfirmation);

  } catch (error) {
    alert('Erreur lors de l\'envoi. Vérifie ta connexion.');
    console.error('Erreur envoi checkup :', error);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Envoyer le check-up';
  }
});

// ============================================
// BOUTONS DE NAVIGATION
// ============================================
btnRetour.addEventListener('click', () => showStep(stepVehicule));
btnNouveau.addEventListener('click', () => {
  vehiculeSelectionne = null;
  formCheckup.innerHTML = '';
  showStep(stepVehicule);
});

// ============================================
// INITIALISATION
// ============================================
chargerVehicules();
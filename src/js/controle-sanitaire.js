// src/js/controle-sanitaire.js

import { db } from './firebase.js';
import { listerSitesActifs } from './sites-sanitaires.js';
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
// CONFIGURATION CLOUDINARY
// ============================================
const CLOUDINARY_CONFIG = {
  cloudName: "dpyfeif48",
  uploadPreset: "ocgjzqqe"
};

// ============================================
// RÉFÉRENCES DOM
// ============================================
const stepSite         = document.getElementById('step-site');
const stepPhotoAvant    = document.getElementById('step-photo-avant');
const stepChecklist     = document.getElementById('step-checklist');
const stepPhotoApres    = document.getElementById('step-photo-apres');
const stepConfirmation  = document.getElementById('step-confirmation');

const listeSites        = document.getElementById('liste-sites');
const checklistListe     = document.getElementById('checklist-liste');
const checklistTitre     = document.getElementById('checklist-titre');
const headerTitle        = document.getElementById('header-title');

const inputPhotoAvant    = document.getElementById('input-photo-avant');
const previewPhotoAvant  = document.getElementById('preview-photo-avant');
const btnPhotoAvantSuivant = document.getElementById('btn-photo-avant-suivant');
const btnPhotoAvantRetour  = document.getElementById('btn-photo-avant-retour');

const inputPhotoApres     = document.getElementById('input-photo-apres');
const previewPhotoApres   = document.getElementById('preview-photo-apres');
const btnEnvoyer          = document.getElementById('btn-envoyer');
const btnPhotoApresRetour = document.getElementById('btn-photo-apres-retour');

const btnChecklistRetour  = document.getElementById('btn-checklist-retour');
const btnChecklistSuivant = document.getElementById('btn-checklist-suivant');

const btnRetour  = document.getElementById('btn-retour');
const btnNouveau = document.getElementById('btn-nouveau');
const recapSite  = document.getElementById('recap-site');
const recapHeure = document.getElementById('recap-heure');

// ============================================
// STATE
// ============================================
const agentMail = localStorage.getItem('agent-mail') || '';
let siteSelectionne = null;
let photoAvantFile = null;
let photoApresFile = null;
let resultats = {}; // { itemId: { label, type, statut, detail, photo } }

// ============================================
// NAVIGATION
// ============================================
function showStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  step.classList.add('active');
  window.scrollTo(0, 0);
}

// ============================================
// CHARGEMENT DES CELLULES
// ============================================
async function chargerSites() {
  try {
    const sites = await listerSitesActifs();

    if (sites.length === 0) {
      listeSites.innerHTML = `<p class="loading">Aucune cellule configurée.<br>Contacte l'administrateur.</p>`;
      return;
    }

    listeSites.innerHTML = '';
    sites.forEach((site) => {
      const card = document.createElement('div');
      card.className = 'vehicule-card';
      card.innerHTML = `
        <div class="vehicule-icon">🚻</div>
        <div class="vehicule-info">
          <h3>${site.nom}</h3>
          <p>${site.adresse || ''}</p>
        </div>
      `;
      card.addEventListener('click', () => selectionnerSite(site));
      listeSites.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    listeSites.innerHTML = `<p class="loading">Erreur de chargement.<br>Vérifie ta connexion.</p>`;
  }
}

function selectionnerSite(site) {
  siteSelectionne = site;
  photoAvantFile = null;
  photoApresFile = null;
  resultats = {};
  previewPhotoAvant.classList.remove('visible');
  previewPhotoApres.classList.remove('visible');
  headerTitle.textContent = site.nom;
  showStep(stepPhotoAvant);
}

// ============================================
// PHOTO AVANT / APRÈS
// ============================================
inputPhotoAvant.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  photoAvantFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    previewPhotoAvant.src = ev.target.result;
    previewPhotoAvant.classList.add('visible');
  };
  reader.readAsDataURL(file);
});

inputPhotoApres.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  photoApresFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    previewPhotoApres.src = ev.target.result;
    previewPhotoApres.classList.add('visible');
  };
  reader.readAsDataURL(file);
});

btnPhotoAvantSuivant.addEventListener('click', () => {
  if (!photoAvantFile) {
    alert('Merci de prendre une photo avant de continuer.');
    return;
  }
  afficherChecklist();
  showStep(stepChecklist);
});

btnPhotoAvantRetour.addEventListener('click', () => {
  showStep(stepSite);
});

// ============================================
// AFFICHAGE DE LA CHECKLIST
// ============================================
function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');
}

function afficherChecklist() {
  checklistTitre.textContent = `Checklist — ${siteSelectionne.nom}`;
  const items = siteSelectionne.checklist || [];

  if (items.length === 0) {
    checklistListe.innerHTML = `<p class="loading">Aucun point de contrôle configuré pour cette cellule.</p>`;
    return;
  }

  checklistListe.innerHTML = items.map((item) => genererItemChecklist(item)).join('');
  attacherEvenementsChecklist(items);
}

function genererItemChecklist(item) {
  const itemId = slugify(item.id || item.label);

  if (item.type === 'consommable') {
    return `
      <div class="checkpoint-item-wrapper" data-item="${itemId}" data-type="consommable">
        <div class="checkpoint-item">
          <span class="checkpoint-label">🧴 ${item.label}</span>
          <div class="toggle-group toggle-group-3">
            <button type="button" class="toggle-btn ok" data-statut="suffisant">Stock OK</button>
            <button type="button" class="toggle-btn recharge" data-statut="recharge">Rechargé</button>
            <button type="button" class="toggle-btn anomalie" data-statut="manquant">Manquant</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="checkpoint-item-wrapper" data-item="${itemId}" data-type="tache">
      <div class="checkpoint-item">
        <span class="checkpoint-label">✅ ${item.label}</span>
        <div class="toggle-group">
          <button type="button" class="toggle-btn ok" data-statut="ok">OK</button>
          <button type="button" class="toggle-btn anomalie" data-statut="anomalie">⚠️</button>
        </div>
      </div>
      <div class="anomalie-detail" id="detail-${itemId}">
        <textarea placeholder="Décris le problème... (optionnel)"></textarea>
        <div class="photo-upload">
          <label class="btn-photo" for="photo-${itemId}">📷 Ajouter une photo</label>
          <input type="file" id="photo-${itemId}" accept="image/*" capture="environment" style="display:none">
          <img class="photo-preview" id="preview-${itemId}" alt="Photo anomalie">
          <button type="button" class="btn-remove-photo" id="remove-${itemId}">✕</button>
        </div>
      </div>
    </div>
  `;
}

function attacherEvenementsChecklist(items) {
  items.forEach((item) => {
    const itemId = slugify(item.id || item.label);
    const wrapper = checklistListe.querySelector(`[data-item="${itemId}"]`);
    const boutons = wrapper.querySelectorAll('.toggle-btn');

    boutons.forEach((btn) => {
      btn.addEventListener('click', () => {
        boutons.forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');

        const statut = btn.dataset.statut;
        resultats[itemId] = resultats[itemId] || { label: item.label, type: item.type };
        resultats[itemId].statut = statut;

        if (item.type === 'tache') {
          const detail = document.getElementById(`detail-${itemId}`);
          if (statut === 'anomalie') {
            detail.classList.add('visible');
          } else {
            detail.classList.remove('visible');
          }
        }
      });
    });

    if (item.type === 'tache') {
      const inputPhoto = document.getElementById(`photo-${itemId}`);
      const preview = document.getElementById(`preview-${itemId}`);
      const btnRemove = document.getElementById(`remove-${itemId}`);
      const textarea = wrapper.querySelector('textarea');

      textarea.addEventListener('input', () => {
        resultats[itemId] = resultats[itemId] || { label: item.label, type: item.type };
        resultats[itemId].detail = textarea.value;
      });

      inputPhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        resultats[itemId] = resultats[itemId] || { label: item.label, type: item.type };
        resultats[itemId].photoFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          preview.src = ev.target.result;
          preview.classList.add('visible');
          btnRemove.classList.add('visible');
        };
        reader.readAsDataURL(file);
      });

      btnRemove.addEventListener('click', () => {
        if (resultats[itemId]) delete resultats[itemId].photoFile;
        inputPhoto.value = '';
        preview.src = '';
        preview.classList.remove('visible');
        btnRemove.classList.remove('visible');
      });
    }
  });
}

btnChecklistSuivant.addEventListener('click', () => {
  const items = siteSelectionne.checklist || [];
  const itemsNonRepondus = items.filter((item) => {
    const itemId = slugify(item.id || item.label);
    return !resultats[itemId] || !resultats[itemId].statut;
  });

  if (itemsNonRepondus.length > 0) {
    alert('Merci de répondre à tous les points de la checklist avant de continuer.');
    return;
  }

  showStep(stepPhotoApres);
});

btnChecklistRetour.addEventListener('click', () => {
  showStep(stepPhotoAvant);
});

btnPhotoApresRetour.addEventListener('click', () => {
  showStep(stepChecklist);
});

// ============================================
// UPLOAD PHOTO VERS CLOUDINARY
// ============================================
async function uploadPhoto(file, dossier, nomFichier) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', dossier);
  formData.append('public_id', nomFichier);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) throw new Error('Échec upload photo');
  const data = await response.json();
  return data.secure_url;
}

// ============================================
// ENVOI DU CONTRÔLE
// ============================================
btnEnvoyer.addEventListener('click', async () => {
  if (!photoApresFile) {
    alert('Merci de prendre une photo avant d\'envoyer le contrôle.');
    return;
  }

  btnEnvoyer.disabled = true;
  btnEnvoyer.textContent = 'Envoi en cours...';

  try {
    const controleId = `${siteSelectionne.id}-${Date.now()}`;
    const dossier = `sanitaires/${controleId}`;

    btnEnvoyer.textContent = 'Upload photo avant...';
    const photoAvantUrl = await uploadPhoto(photoAvantFile, dossier, 'avant');

    btnEnvoyer.textContent = 'Upload photo après...';
    const photoApresUrl = await uploadPhoto(photoApresFile, dossier, 'apres');

    const itemsAvecPhoto = Object.entries(resultats).filter(([, r]) => r.photoFile);
    for (let i = 0; i < itemsAvecPhoto.length; i++) {
      const [itemId, r] = itemsAvecPhoto[i];
      btnEnvoyer.textContent = `Upload photos anomalies (${i + 1}/${itemsAvecPhoto.length})...`;
      r.photoUrl = await uploadPhoto(r.photoFile, dossier, `anomalie-${itemId}`);
      delete r.photoFile;
    }

    await addDoc(collection(db, 'controles'), {
      siteId: siteSelectionne.id,
      siteNom: siteSelectionne.nom,
      agentMail,
      photoAvantUrl,
      photoApresUrl,
      resultats,
      date: serverTimestamp()
    });

    recapSite.textContent = `Cellule : ${siteSelectionne.nom}`;
    recapHeure.textContent = `Heure : ${new Date().toLocaleTimeString('fr-FR')}`;
    headerTitle.textContent = 'Contrôle sanitaire';
    showStep(stepConfirmation);

  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'envoi. Vérifie ta connexion.");
  } finally {
    btnEnvoyer.disabled = false;
    btnEnvoyer.textContent = 'Envoyer le contrôle ✓';
  }
});

// ============================================
// ANNULER / NOUVEAU
// ============================================
btnRetour.addEventListener('click', () => {
  if (confirm('Abandonner ce contrôle ?')) {
    window.location.href = 'sanitaires.html';
  }
});

btnNouveau.addEventListener('click', () => {
  window.location.href = 'sanitaires.html';
});

// ============================================
// INITIALISATION
// ============================================
chargerSites();
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
const CLOUDINARY_CONFIG = {
  cloudName:    "dpyfeif48",
  apiKey:       "236871857242973",
  uploadPreset: "ocgjzqqe"
};
// ============================================
// RÉFÉRENCES DOM
// ============================================
const stepVehicule      = document.getElementById('step-vehicule');
const stepSection       = document.getElementById('step-section');
const stepConfirmation  = document.getElementById('step-confirmation');
const listeVehicules    = document.getElementById('liste-vehicules');
const formSection       = document.getElementById('form-section');
const btnRetour         = document.getElementById('btn-retour');
const btnPrecedent      = document.getElementById('btn-precedent');
const btnSuivant        = document.getElementById('btn-suivant');
const btnNouveau        = document.getElementById('btn-nouveau');
const recapVehicule     = document.getElementById('recap-vehicule');
const recapHeure        = document.getElementById('recap-heure');
const headerTitle       = document.getElementById('header-title');
const progressBar       = document.getElementById('progress-bar');
const progressLabel     = document.getElementById('progress-label');
const progressContainer = document.getElementById('progress-bar-container');
const stepIdentification = document.getElementById('step-identification');
const inputMail          = document.getElementById('input-mail');
const btnIdentifier      = document.getElementById('btn-identifier');
const mailError          = document.getElementById('mail-error');

// ============================================
// STATE
// ============================================
let vehiculeSelectionne = null;
let sections            = [];
let sectionIndex        = 0;
let resultats           = {};
let photos              = {};
let agentMail = localStorage.getItem('agent-mail') || '';

// ============================================
// NAVIGATION
// ============================================
function showStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  step.classList.add('active');
  window.scrollTo(0, 0);
}

function showProgress() {
  progressContainer.classList.remove('hidden');
  btnRetour.classList.remove('hidden');
}

function hideProgress() {
  progressContainer.classList.add('hidden');
  btnRetour.classList.add('hidden');
}

function mettreAJourProgress() {
  const total   = sections.length;
  const current = sectionIndex + 1;
  const pct     = Math.round((current / total) * 100);
  progressBar.style.setProperty('--progress', pct + '%');
  progressLabel.textContent = `${current} / ${total}`;
  headerTitle.textContent   = vehiculeSelectionne.nom;
}


// ============================================
// IDENTIFICATION AGENT
// ============================================
function initialiserIdentification() {
  // Si le mail est déjà mémorisé → on saute l'étape
  if (agentMail) {
    showStep(stepVehicule);
    return;
  }

  showStep(stepIdentification);

  btnIdentifier.addEventListener('click', () => {
    const mail = inputMail.value.trim();

    if (!mail || !mail.includes('@')) {
      mailError.textContent = 'Saisis une adresse mail valide.';
      return;
    }

    // Mémorise sur le téléphone
    localStorage.setItem('agent-mail', mail);
    agentMail = mail;
    mailError.textContent = '';

    chargerVehicules();
    showStep(stepVehicule);
  });

  // Touche Entrée
  inputMail.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnIdentifier.click();
  });
}


// ============================================
// CHARGEMENT DES VÉHICULES
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
      const v    = doc.data();
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
// SÉLECTION D'UN VÉHICULE
// ============================================
function selectionnerVehicule(id, vehicule) {
  vehiculeSelectionne = { id, ...vehicule };
  sections            = Object.keys(vehicule.checkpoints);
  sectionIndex        = 0;
  resultats           = {};
  photos              = {};

  showProgress();
  mettreAJourProgress();
  afficherSection(sectionIndex);
  showStep(stepSection);
}

// ============================================
// AFFICHAGE D'UNE SECTION
// ============================================
function afficherSection(index) {
  const categorie = sections[index];
  const points    = vehiculeSelectionne.checkpoints[categorie];

  mettreAJourProgress();

  btnPrecedent.style.display = index === 0 ? 'none' : 'flex';

  const isLast = index === sections.length - 1;
  btnSuivant.textContent = isLast ? 'Envoyer ✓' : 'Suivant →';

  formSection.innerHTML = `
    <div class="section-title">${categorie}</div>
    <div class="checkpoint-group">
      ${points.map(point => genererCheckpoint(point)).join('')}
    </div>
  `;

  restaurerReponses(points);
  attacherEvenements(points);
}

// ============================================
// GÉNÉRATION D'UN POINT DE CONTRÔLE
// ============================================
function genererCheckpoint(point) {
  const pointId = slugify(point);
  return `
    <div class="checkpoint-item-wrapper" data-point="${point}">
      <div class="checkpoint-item">
        <span class="checkpoint-label">${point}</span>
        <div class="toggle-group">
          <button type="button" class="toggle-btn ok" data-point="${point}">OK</button>
          <button type="button" class="toggle-btn anomalie" data-point="${point}">⚠️</button>
        </div>
      </div>
      <div class="anomalie-detail" id="detail-${pointId}">
        <textarea placeholder="Décris l'anomalie... (optionnel)"></textarea>
        <div class="photo-upload">
          <label class="btn-photo" for="photo-${pointId}">
            📷 Ajouter une photo
          </label>
          <input
            type="file"
            id="photo-${pointId}"
            accept="image/*"
            capture="environment"
            style="display:none"
          >
          <img class="photo-preview" id="preview-${pointId}" alt="Photo anomalie">
          <button type="button" class="btn-remove-photo" id="remove-${pointId}">✕</button>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// ATTACHER LES ÉVÉNEMENTS
// ============================================
function attacherEvenements(points) {
  points.forEach(point => {
    const pointId    = slugify(point);
    const wrapper    = formSection.querySelector(`[data-point="${point}"]`);
    const btnOk      = wrapper.querySelector('.toggle-btn.ok');
    const btnAno     = wrapper.querySelector('.toggle-btn.anomalie');
    const detail     = wrapper.querySelector('.anomalie-detail');
    const inputPhoto = document.getElementById(`photo-${pointId}`);
    const preview    = document.getElementById(`preview-${pointId}`);
    const btnRemove  = document.getElementById(`remove-${pointId}`);

    btnOk.addEventListener('click', () => {
      btnOk.classList.add('selected');
      btnAno.classList.remove('selected');
      detail.classList.remove('visible');
    });

    btnAno.addEventListener('click', () => {
      btnAno.classList.add('selected');
      btnOk.classList.remove('selected');
      detail.classList.add('visible');
    });

    inputPhoto.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      photos[point] = file;
      const reader  = new FileReader();
      reader.onload = (ev) => {
        preview.src = ev.target.result;
        preview.classList.add('visible');
        btnRemove.classList.add('visible');
      };
      reader.readAsDataURL(file);
    });

    btnRemove.addEventListener('click', () => {
      delete photos[point];
      inputPhoto.value = '';
      preview.src      = '';
      preview.classList.remove('visible');
      btnRemove.classList.remove('visible');
    });
  });
}

// ============================================
// RESTAURER LES RÉPONSES
// ============================================
function restaurerReponses(points) {
  points.forEach(point => {
    const pointId = slugify(point);
    const saved   = resultats[point];
    if (!saved) return;

    const wrapper  = formSection.querySelector(`[data-point="${point}"]`);
    const btnOk    = wrapper.querySelector('.toggle-btn.ok');
    const btnAno   = wrapper.querySelector('.toggle-btn.anomalie');
    const detail   = wrapper.querySelector('.anomalie-detail');
    const textarea = wrapper.querySelector('textarea');

    if (saved.statut === 'ok') {
      btnOk.classList.add('selected');
    } else {
      btnAno.classList.add('selected');
      detail.classList.add('visible');
      textarea.value = saved.detail || '';

      if (photos[point]) {
        const preview   = document.getElementById(`preview-${pointId}`);
        const btnRemove = document.getElementById(`remove-${pointId}`);
        const reader    = new FileReader();
        reader.onload   = (ev) => {
          preview.src = ev.target.result;
          preview.classList.add('visible');
          btnRemove.classList.add('visible');
        };
        reader.readAsDataURL(photos[point]);
      }
    }
  });
}

// ============================================
// SAUVEGARDER LA SECTION COURANTE
// ============================================
function sauvegarderSection() {
  const categorie = sections[sectionIndex];
  const points    = vehiculeSelectionne.checkpoints[categorie];
  let tousRemplis = true;

  points.forEach(point => {
    const wrapper = formSection.querySelector(`[data-point="${point}"]`);
    const okSel   = wrapper.querySelector('.toggle-btn.ok').classList.contains('selected');
    const anSel   = wrapper.querySelector('.toggle-btn.anomalie').classList.contains('selected');

    if (!okSel && !anSel) {
      tousRemplis = false;
      wrapper.style.background    = '#fff3f3';
      wrapper.style.borderRadius  = '8px';
      return;
    }

    wrapper.style.background = '';
    const textarea = wrapper.querySelector('textarea');
    resultats[point] = {
      statut: okSel ? 'ok' : 'anomalie',
      detail: anSel ? textarea.value : ''
    };
  });

  return tousRemplis;
}

// ============================================
// UPLOAD PHOTO VERS CLOUDINARY
// ============================================
async function uploadPhoto(file, checkupId, point, categorie) {
  // Nom : vehicule-categorie-point ex: kangoo-01-mecanique-niveau-huile
  const nomPhoto = slugify(
    `${vehiculeSelectionne.id}-${categorie}-${point}`
  );

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', `checkups/${checkupId}`);
  formData.append('public_id', nomPhoto);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) throw new Error('Échec upload photo');

  const data = await response.json();
  return data.secure_url;
}

// ============================================
// BOUTON SUIVANT / ENVOYER
// ============================================
btnSuivant.addEventListener('click', async () => {
  if (!sauvegarderSection()) {
    alert('Tous les points doivent être vérifiés avant de continuer.');
    return;
  }

  const isLast = sectionIndex === sections.length - 1;

  if (!isLast) {
    sectionIndex++;
    afficherSection(sectionIndex);
    return;
  }

  // Dernière section — envoi
  btnSuivant.disabled    = true;
  btnSuivant.textContent = 'Envoi en cours...';

  try {
    // Génère un ID unique pour ce check-up
    const checkupId = `${vehiculeSelectionne.id}-${Date.now()}`;

    // Upload des photos vers Cloudinary
    const photosUrls = {};
    const photoEntries = Object.entries(photos);

    if (photoEntries.length > 0) {
      btnSuivant.textContent = `Upload photos (0/${photoEntries.length})...`;

      for (let i = 0; i < photoEntries.length; i++) {
  const [point, file] = photoEntries[i];
  btnSuivant.textContent = `Upload photos (${i + 1}/${photoEntries.length})...`;
  // On retrouve la catégorie du point
  const categorie = Object.entries(vehiculeSelectionne.checkpoints)
    .find(([cat, points]) => points.includes(point))?.[0] || 'general';
  photosUrls[point] = await uploadPhoto(file, checkupId, point, categorie);
}
    }

    // Intègre les URLs dans les résultats
    Object.entries(photosUrls).forEach(([point, url]) => {
      if (resultats[point]) {
        resultats[point].photoUrl = url;
      }
    });

    // Sauvegarde dans Firestore
    await addDoc(collection(db, 'checkups'), {
      vehiculeId:      vehiculeSelectionne.id,
      vehiculeNom:     vehiculeSelectionne.nom,
      immatriculation: vehiculeSelectionne.immatriculation,
      resultats,
      agentMail,
      date:            serverTimestamp()
    });

    recapVehicule.textContent = `Véhicule : ${vehiculeSelectionne.nom} — ${vehiculeSelectionne.immatriculation}`;
    recapHeure.textContent    = `Heure : ${new Date().toLocaleTimeString('fr-FR')}`;

    hideProgress();
    headerTitle.textContent = 'Check-up véhicule';
    showStep(stepConfirmation);

  } catch (error) {
    alert('Erreur lors de l\'envoi. Vérifie ta connexion.');
    console.error('Erreur envoi :', error);
  } finally {
    btnSuivant.disabled    = false;
    btnSuivant.textContent = 'Envoyer ✓';
  }
});

// ============================================
// BOUTON PRÉCÉDENT
// ============================================
btnPrecedent.addEventListener('click', () => {
  sauvegarderSection();
  sectionIndex--;
  afficherSection(sectionIndex);
});

// ============================================
// BOUTON RETOUR (header)
// ============================================
btnRetour.addEventListener('click', () => {
  if (confirm('Abandonner ce check-up ?')) {
    vehiculeSelectionne = null;
    resultats           = {};
    photos              = {};
    hideProgress();
    headerTitle.textContent = 'Check-up véhicule';
    showStep(stepVehicule);
  }
});

// ============================================
// BOUTON NOUVEAU CHECK-UP
// ============================================
btnNouveau.addEventListener('click', () => {
  vehiculeSelectionne = null;
  resultats           = {};
  photos              = {};
  showStep(stepVehicule);
});

// ============================================
// UTILITAIRES
// ============================================
function slugify(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '');
}

// ============================================
// INITIALISATION
initialiserIdentification();
// ============================================


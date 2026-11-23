// ============================================
// IMPORTS
// ============================================
import { db } from './firebase.js';
import { getAnomaliesVehicule, confirmerAnomaliePresente, confirmerAnomalieReparee, infirmerReparation, creerAnomalies } from './anomalies.js';
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
// CONFIGURATION CLOUDINARY
// ============================================
const CLOUDINARY_CONFIG = {
  cloudName:    "dpyfeif48",
  apiKey:       "236871857242973",
  uploadPreset: "ocgjzqqe"
};
const MAX_PHOTOS = 4; // Photo maximum par point en anomalie

// ============================================
// RÉFÉRENCES DOM
// ============================================
const stepAccueil         = document.getElementById('step-accueil');
const stepVehicule        = document.getElementById('step-vehicule');
const stepSection         = document.getElementById('step-section');
const stepConsignes       = document.getElementById('step-consignes');
const stepConfirmation    = document.getElementById('step-confirmation');
const listeVehicules      = document.getElementById('liste-vehicules');
const formSection         = document.getElementById('form-section');
const btnRetour           = document.getElementById('btn-retour');
const btnPrecedent        = document.getElementById('btn-precedent');
const btnSuivant          = document.getElementById('btn-suivant');
const btnNouveau          = document.getElementById('btn-nouveau');
const btnConsignesRetour  = document.getElementById('btn-consignes-retour');
const btnConsignesValider = document.getElementById('btn-consignes-valider');
const btnCheckup          = document.getElementById('btn-checkup');
const recapVehicule       = document.getElementById('recap-vehicule');
const recapHeure          = document.getElementById('recap-heure');
const headerTitle         = document.getElementById('header-title');
const progressBar         = document.getElementById('progress-bar');
const progressLabel       = document.getElementById('progress-label');
const progressContainer   = document.getElementById('progress-bar-container');

// ============================================
// STATE
// ============================================
let vehiculeSelectionne = null;
let sections            = [];
let sectionIndex        = 0;
let resultats           = {};
let photos              = {};
const agentMail           = sessionStorage.getItem('agent-mail') || '';

// ============================================
// NAVIGATION
// ============================================
function showStep(step) {
  if (!step) return;
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  step.classList.add('active');
  window.scrollTo(0, 0);
}

function showProgress() {
  if (progressContainer) progressContainer.classList.remove('hidden');
  if (btnRetour) btnRetour.textContent = 'X Annuler';
}

function hideProgress() {
  if (progressContainer) progressContainer.classList.add('hidden');
  if (btnRetour) btnRetour.textContent = '';
}

function mettreAJourProgress() {
  if (!progressBar || !progressLabel || !headerTitle) return;
  const total   = sections.length;
  const current = sectionIndex + 1;
  const pct     = Math.round((current / total) * 100);
  progressBar.style.setProperty('--progress', pct + '%');
  progressLabel.textContent = `${current} / ${total}`;
  headerTitle.textContent   = vehiculeSelectionne.nom;
}


// ============================================
// SUPPRESSION DU CHECK-UP ASSOCIÉ
// ============================================
async function supprimerCheckup(checkupId) {
  try {
    await deleteDoc(doc(db, 'checkups', checkupId));
  } catch (error) {
    console.error('Erreur suppression check-up :', error);
  }
}


// ============================================
// CHARGEMENT DES VÉHICULES
// ============================================
async function chargerVehicules() {
  if (!listeVehicules) return;
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
    const estDisponible = v.disponible !== false;
  const card = document.createElement('div');
  card.className = `vehicule-card ${estDisponible ? '' : 'vehicule-card-indispo'}`;
  card.innerHTML = `
    <div class="vehicule-icon">${afficherIcone(v.icone)}</div>
    <div class="vehicule-info">
      <h3>${v.nom}</h3>
      <p>${v.immatriculation} — ${v.type}</p>
      ${estDisponible ? '' : '<p class="indispo-label">🔧 En maintenance</p>'}
    </div>
  `;
  if (estDisponible) {
    card.addEventListener('click', (e) => {
  e.stopPropagation();
  selectionnerVehicule(doc.id, v);
});
  }
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
// POP-UP ANOMALIES PERSISTANTES
// ============================================
async function verifierAnomaliesPersistantes(vehiculeId) {
  const anomalies = await getAnomaliesVehicule(vehiculeId);
  if (anomalies.length === 0) return true;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'popup-overlay';

    // Empêche les clics de bubble depuis la page
    overlay.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    const enAttente = anomalies.filter(a =>
      ['en_attente', 'pris_en_compte', 'astech_demande', 're_signalee'].includes(a.statut)
    );
    const marqueeResolue = anomalies.filter(a => a.statut === 'marquee_resolue');

    let contenu = '';

    if (enAttente.length > 0) {
      contenu += `
        <div class="popup-section">
          <div class="popup-section-title">⚠️ Anomalies en cours</div>
          ${enAttente.map(a => `
            <div class="popup-anomalie" data-id="${a.id}" data-type="en_attente">
              <div class="popup-anomalie-point">🔧 ${a.point}</div>
              ${a.statut === 'pris_en_compte'
                ? '<div class="popup-statut-badge badge-pris-en-compte">👀 Pris en compte par l\'encadrement</div>'
                : ''}
              ${a.statut === 'astech_demande'
                ? '<div class="popup-statut-badge badge-astech">🔧 Demande atelier en cours</div>'
                : ''}
              ${a.description ? `<div class="popup-anomalie-desc">${a.description}</div>` : ''}
              <div class="popup-anomalie-date">Signalée le ${a.dateSignalement?.toDate().toLocaleDateString('fr-FR') || '—'}</div>
              <div class="popup-anomalie-actions">
                <button class="popup-btn popup-btn-danger" data-action="presente" data-id="${a.id}">
                  Toujours présente
                </button>
                <button class="popup-btn popup-btn-success" data-action="reparee" data-id="${a.id}">
                  C'est réparé ✓
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (marqueeResolue.length > 0) {
      contenu += `
        <div class="popup-section">
          <div class="popup-section-title">✅ Réparations à confirmer</div>
          ${marqueeResolue.map(a => `
            <div class="popup-anomalie popup-anomalie-resolue" data-id="${a.id}" data-type="marquee_resolue">
              <div class="popup-anomalie-point">✅ ${a.point}</div>
              <div class="popup-anomalie-desc">L'encadrement indique que c'est réparé. Confirmes-tu ?</div>
              <div class="popup-anomalie-actions">
                <button class="popup-btn popup-btn-success" data-action="confirmer" data-id="${a.id}">
                  Oui, ça fonctionne ✓
                </button>
                <button class="popup-btn popup-btn-danger" data-action="infirmer" data-id="${a.id}">
                  Non, toujours cassé
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="popup">
        <div class="popup-header">
          <h3>État du véhicule</h3>
          <button id="popup-annuler" class="btn-fermer">✕</button>
        </div>
        <div class="popup-body">
          ${contenu}
        </div>
        <div class="popup-footer">
          <button id="popup-continuer" class="btn-primary" disabled>
            Continuer le check-up →
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Bouton annuler - ferme sans enregistrer
    document.getElementById('popup-annuler').addEventListener('click', (e) => {
      e.stopPropagation();
      document.body.removeChild(overlay);
      resolve(false);
    });

    // Gestion des réponses
    const reponses   = new Set();
    const totalItems = anomalies.length;

    overlay.querySelectorAll('.popup-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const action     = btn.dataset.action;
        const anomalieId = btn.dataset.id;

        // Désactive les boutons de cet item
        const itemBtns = btn.closest('.popup-anomalie').querySelectorAll('.popup-btn');
        itemBtns.forEach(b => {
          b.disabled     = true;
          b.style.opacity = '0.5';
        });
        // Reset les styles inline sur tous les boutons
        itemBtns.forEach(b => {
          b.style.cssText = 'opacity: 0.4;';
        });

        // Applique le style sur le bouton cliqué via styles inline directs
        if (action === 'presente' || action === 'infirmer') {
          btn.style.cssText = 'opacity: 1 !important; background: var(--danger) !important; color: white !important; font-weight: 700;';
        } else {
          btn.style.cssText = 'opacity: 1 !important; background: var(--success) !important; color: white !important; font-weight: 700;';
        }

        // Appelle la bonne fonction
        if (action === 'presente')  await confirmerAnomaliePresente(anomalieId);
        if (action === 'reparee') {
          await confirmerAnomalieReparee(anomalieId);
          // Récupère l'anomalie pour avoir le checkupId
          const anomalie = anomalies.find(a => a.id === anomalieId);
          if (anomalie?.checkupId) await supprimerCheckup(anomalie.checkupId);
        }
        if (action === 'confirmer') {
          await confirmerAnomalieReparee(anomalieId);
          const anomalie = anomalies.find(a => a.id === anomalieId);
          if (anomalie?.checkupId) await supprimerCheckup(anomalie.checkupId);
        }
        if (action === 'infirmer')  await infirmerReparation(anomalieId);

        reponses.add(anomalieId);

        // Active "Continuer" quand tout est répondu
        if (reponses.size === totalItems) {
          document.getElementById('popup-continuer').disabled = false;
        }
      });
    });

    document.getElementById('popup-continuer').addEventListener('click', (e) => {
      e.stopPropagation();
      document.body.removeChild(overlay);
      resolve(true);
    });
  });
}

// ============================================
// SÉLECTION D'UN VÉHICULE
// ============================================
async function selectionnerVehicule(id, vehicule) {
  vehiculeSelectionne = { id, ...vehicule };
  sections            = Object.keys(vehicule.checkpoints).sort();
  sectionIndex        = 0;
  resultats           = {};
  photos              = {};

  // Vérifie les anomalies persistantes avant de continuer
  const continuer = await verifierAnomaliesPersistantes(id);
  if (!continuer) return;

  showProgress();
  mettreAJourProgress();
  afficherSection(sectionIndex);
  showStep(stepSection);
}

// ============================================
// AFFICHAGE D'UNE SECTION
// ============================================
function afficherSection(index) {
  if (!formSection) return;
  const categorie = sections[index];
  const points    = vehiculeSelectionne.checkpoints[categorie];

  mettreAJourProgress();

  if (btnPrecedent) btnPrecedent.style.display = index === 0 ? 'none' : 'flex';
  if (btnSuivant)   btnSuivant.textContent = 'Suivant →';

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
          <label class="btn-photo" id="label-${pointId}" for="photo-${pointId}">
            📷 Ajouter une photo
          </label>
          <input
            type="file"
            id="photo-${pointId}"
            accept="image/*"
            capture="environment"
            style="display:none"
          >
          <span class="photo-count" id="count-${pointId}"></span>
        </div>
        <div class="photo-thumbs" id="thumbs-${pointId}"></div>
      </div>
    </div>
  `;
}

// ============================================
// ATTACHER LES ÉVÉNEMENTS
// ============================================
function attacherEvenements(points) {
  points.forEach(point => {
    const wrapper    = formSection.querySelector(`[data-point="${point}"]`);
    const btnOk      = wrapper.querySelector('.toggle-btn.ok');
    const btnAno     = wrapper.querySelector('.toggle-btn.anomalie');
    const detail     = wrapper.querySelector('.anomalie-detail');
    const inputPhoto = document.getElementById(`photo-${slugify(point)}`);

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
      e.target.value = ''; // permet de reprendre une photo juste après
      if (!file) return;

      photos[point] = photos[point] || [];
      if (photos[point].length >= MAX_PHOTOS) {
        alert(`${MAX_PHOTOS} photos maximum par point.`);
        return;
      }
      photos[point].push(file);
      afficherPhotos(point);
    });

    // Réaffiche les photos déjà prises si on revient sur cette section
    afficherPhotos(point);
  });
}

// ============================================
// VIGNETTES DES PHOTOS D'UN POINT
// ============================================
function afficherPhotos(point) {
  const pointId = slugify(point);
  const liste   = photos[point] || [];
  const thumbs  = document.getElementById(`thumbs-${pointId}`);
  const count   = document.getElementById(`count-${pointId}`);
  const label   = document.getElementById(`label-${pointId}`);
  if (!thumbs) return;

  thumbs.innerHTML = '';
  liste.forEach((file, index) => {
    const url  = URL.createObjectURL(file);
    const item = document.createElement('div');
    item.className = 'photo-mini';
    item.innerHTML = `
      <img src="${url}" alt="Photo ${index + 1}">
      <button type="button" class="photo-mini-remove" title="Retirer cette photo">✕</button>
    `;
    item.querySelector('img').onload = () => URL.revokeObjectURL(url);
    item.querySelector('button').addEventListener('click', () => {
      photos[point].splice(index, 1);
      afficherPhotos(point);
    });
    thumbs.appendChild(item);
  });

  count.textContent = liste.length > 0 ? `${liste.length}/${MAX_PHOTOS}` : '';
  label.classList.toggle('complet', liste.length >= MAX_PHOTOS);
  label.textContent = liste.length === 0 ? '📷 Ajouter une photo' : '📷 Ajouter une autre photo';
}

// ============================================
// RESTAURER LES RÉPONSES
// ============================================
function restaurerReponses(points) {
  points.forEach(point => {
    const saved = resultats[point];
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
      tousRemplis                = false;
      wrapper.style.background   = '#fff3f3';
      wrapper.style.borderRadius = '8px';
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
async function uploadPhoto(file, checkupId, point, categorie, indice) {
  const nomPhoto = slugify(
    `${vehiculeSelectionne.id}-${categorie}-${point}-${indice}`
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

// Réduit une photo (1600 px max, JPEG 80 %) pour un envoi plus rapide en 4G.
// En cas de problème ou si le résultat n'est pas plus léger, on garde l'originale.
function compresserImage(file, maxCote = 1600, qualite = 0.8) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio  = Math.min(1, maxCote / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob && blob.size < file.size ? blob : file),
        'image/jpeg',
        qualite
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

// ============================================
// ENVOI DU CHECK-UP
// ============================================
async function envoyerCheckup(btnEnvoi) {
  btnEnvoi.disabled    = true;
  btnEnvoi.textContent = 'Envoi en cours...';

  try {
    const checkupId = `${vehiculeSelectionne.id}-${Date.now()}`;

    // Seules les photos des points encore en anomalie sont envoyées
    const aEnvoyer = Object.entries(photos).filter(([point, liste]) =>
      liste.length > 0 && resultats[point]?.statut === 'anomalie'
    );
    const totalPhotos = aEnvoyer.reduce((n, [, liste]) => n + liste.length, 0);
    let envoyees = 0;

    for (const [point, liste] of aEnvoyer) {
      const categorie = Object.entries(vehiculeSelectionne.checkpoints)
        .find(([cat, pts]) => pts.includes(point))?.[0] || 'general';

      const urls = [];
      for (let n = 0; n < liste.length; n++) {
        envoyees++;
        btnEnvoi.textContent = `Upload photos (${envoyees}/${totalPhotos})...`;
        const fichier = await compresserImage(liste[n]);
        urls.push(await uploadPhoto(fichier, checkupId, point, categorie, n + 1));
      }

      resultats[point].photoUrls = urls;
      resultats[point].photoUrl  = urls[0]; // compatibilité : anomalies, export, anciens écrans
    }

    const checkupRef = await addDoc(collection(db, 'checkups'), {
      vehiculeId:      vehiculeSelectionne.id,
      vehiculeNom:     vehiculeSelectionne.nom,
      immatriculation: vehiculeSelectionne.immatriculation,
      resultats,
      agentMail,
      date:            serverTimestamp()
    });

    // Crée les anomalies persistantes avec l'ID Firestore réel du check-up
    await creerAnomalies(
      checkupRef.id,
      vehiculeSelectionne.id,
      vehiculeSelectionne.nom,
      vehiculeSelectionne.immatriculation,
      resultats,
      agentMail
    );

    if (recapVehicule) recapVehicule.textContent =
      `Véhicule : ${vehiculeSelectionne.nom} — ${vehiculeSelectionne.immatriculation}`;
    if (recapHeure) recapHeure.textContent =
      `Heure : ${new Date().toLocaleTimeString('fr-FR')}`;
    if (headerTitle) headerTitle.textContent = 'Check-up véhicule';
    showStep(stepConfirmation);

  } catch (error) {
    alert('Erreur lors de l\'envoi. Vérifie ta connexion.');
    console.error('Erreur envoi :', error);
  } finally {
    btnEnvoi.disabled    = false;
    btnEnvoi.textContent = 'J\'ai lu et compris ✓';
  }
}

// ============================================
// ÉVÉNEMENTS BOUTONS
// ============================================
if (btnSuivant) {
  btnSuivant.addEventListener('click', () => {
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

    hideProgress();
    if (headerTitle) headerTitle.textContent = 'Consignes de sécurité';
    showStep(stepConsignes);
  });
}

if (btnPrecedent) {
  btnPrecedent.addEventListener('click', () => {
    sauvegarderSection();
    sectionIndex--;
    afficherSection(sectionIndex);
  });
}

if (btnConsignesRetour) {
  btnConsignesRetour.addEventListener('click', () => {
    showProgress();
    if (headerTitle) headerTitle.textContent = vehiculeSelectionne.nom;
    afficherSection(sectionIndex);
    showStep(stepSection);
  });
}

if (btnConsignesValider) {
  btnConsignesValider.addEventListener('click', () => {
    envoyerCheckup(btnConsignesValider);
  });
}

if (btnRetour) {
  btnRetour.addEventListener('click', () => {
    if (confirm('Abandonner ce check-up ?')) {
      vehiculeSelectionne     = null;
      resultats               = {};
      photos                  = {};
      hideProgress();
      if (headerTitle) headerTitle.textContent = 'Check-up véhicule';
      showStep(stepAccueil);
    }
  });
}

if (btnNouveau) {
  btnNouveau.addEventListener('click', () => {
    vehiculeSelectionne = null;
    resultats           = {};
    photos              = {};
    showStep(stepAccueil);
  });
}

if (btnCheckup) {
  btnCheckup.addEventListener('click', () => {
    chargerVehicules();
    showStep(stepVehicule);
  });
}

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

function afficherIcone(icone) {
  if (!icone) return '🚗';
  if (icone.startsWith('http')) {
    return `<img src="${icone}" class="vehicule-icone-img" alt="icône véhicule">`;
  }
  return icone;
}

// ============================================
// INITIALISATION
// ============================================
if (btnRetour) btnRetour.textContent = '';
showStep(stepAccueil);

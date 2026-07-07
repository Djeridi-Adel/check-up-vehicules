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
// CONFIGURATION CLOUDINARY
// ============================================
const CLOUDINARY_CONFIG = {
  cloudName:    "dpyfeif48",
  uploadPreset: "ocgjzqqe"
};

// ============================================
// RÉFÉRENCES DOM
// ============================================
const stepSignalement  = document.getElementById('step-signalement');
const stepConfirmation = document.getElementById('step-confirmation');
const selectVehicule   = document.getElementById('select-vehicule');
const typeIncidentInput = document.getElementById('type-incident');
const groupeLieu       = document.getElementById('groupe-lieu');
const inputLieu        = document.getElementById('input-lieu');
const btnLocalisation  = document.getElementById('btn-localisation');
const inputDescription = document.getElementById('input-description');
const inputPhoto       = document.getElementById('input-photo');
const previewPhoto     = document.getElementById('preview-photo');
const btnRemovePhoto   = document.getElementById('btn-remove-photo');
const btnEnvoyer       = document.getElementById('btn-envoyer');
const signalementError = document.getElementById('signalement-error');
const recapSignalement = document.getElementById('recap-signalement');
const recapHeure       = document.getElementById('recap-heure');

// ============================================
// STATE
// ============================================
const agentMail = localStorage.getItem('agent-mail') || '';
let photoFile   = null;

// ============================================
// NAVIGATION
// ============================================
function showStep(step) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  step.classList.add('active');
  window.scrollTo(0, 0);
}

// ============================================
// CHARGEMENT VÉHICULES
// ============================================
async function chargerVehicules() {
  try {
    const snapshot = await getDocs(collection(db, 'vehicules'));
    selectVehicule.innerHTML = '<option value="">Sélectionne un véhicule</option>';
    snapshot.forEach(doc => {
      const v      = doc.data();
      const estDisponible = v.disponible !== false;
      const option = document.createElement('option');
      option.value = doc.id;
      option.setAttribute('data-nom', v.nom);
      option.setAttribute('data-immat', v.immatriculation);
      option.textContent = estDisponible
      ? `${v.nom} — ${v.immatriculation}`
      : ' 🔧 ${v.nom} - ${v.immatriculation} (En maintenance)';
      if (!estDisponible) option.disabled = true;
      selectVehicule.appendChild(option);
    });
  } catch (error) {
    console.error('Erreur chargement véhicules :', error);
  }
}

// ============================================
// TYPES D'INCIDENT
// ============================================
document.querySelectorAll('.incident-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.incident-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    typeIncidentInput.value = btn.dataset.type;

    // Affiche le lieu uniquement si accident
    groupeLieu.style.display = btn.dataset.type === 'accident' ? 'block' : 'none';
  });
});

// ============================================
// GÉOLOCALISATION
// ============================================
btnLocalisation.addEventListener('click', () => {
  if (!navigator.geolocation) {
    alert('La géolocalisation n\'est pas disponible sur cet appareil.');
    return;
  }

  btnLocalisation.textContent = '📍 Localisation en cours...';
  btnLocalisation.disabled    = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      inputLieu.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      btnLocalisation.textContent = '✓ Position récupérée';
      btnLocalisation.disabled    = false;
    },
    () => {
      alert('Impossible de récupérer ta position. Saisis-la manuellement.');
      btnLocalisation.textContent = '📍 Utiliser ma position GPS';
      btnLocalisation.disabled    = false;
    }
  );
});

// ============================================
// PHOTO
// ============================================
inputPhoto.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  photoFile       = file;
  const reader    = new FileReader();
  reader.onload   = (ev) => {
    previewPhoto.src = ev.target.result;
    previewPhoto.classList.add('visible');
    btnRemovePhoto.classList.add('visible');
  };
  reader.readAsDataURL(file);
});

btnRemovePhoto.addEventListener('click', () => {
  photoFile = null;
  inputPhoto.value = '';
  previewPhoto.src = '';
  previewPhoto.classList.remove('visible');
  btnRemovePhoto.classList.remove('visible');
});

// ============================================
// UPLOAD PHOTO CLOUDINARY
// ============================================
async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('folder', 'signalements');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!response.ok) throw new Error('Échec upload photo');
  const data = await response.json();
  return data.secure_url;
}

// ============================================
// ENVOI DU SIGNALEMENT
// ============================================
btnEnvoyer.addEventListener('click', async () => {
  signalementError.textContent = '';

  // Validation
  const vehiculeId = selectVehicule.value;
  const typeIncident = typeIncidentInput.value;

  if (!vehiculeId) {
    signalementError.textContent = 'Sélectionne un véhicule.';
    return;
  }

  if (!typeIncident) {
    signalementError.textContent = 'Sélectionne un type d\'incident.';
    return;
  }

  if (typeIncident === 'accident' && !inputLieu.value.trim()) {
    signalementError.textContent = 'Indique le lieu de l\'accident.';
    return;
  }

  btnEnvoyer.disabled    = true;
  btnEnvoyer.textContent = 'Envoi en cours...';

  try {
    // Upload photo si présente
    let photoUrl = null;
    if (photoFile) {
      btnEnvoyer.textContent = 'Upload photo...';
      photoUrl = await uploadPhoto(photoFile);
    }

    // Récupère les infos du véhicule sélectionné
    const optionSelected = selectVehicule.options[selectVehicule.selectedIndex];
    const vehiculeNom    = optionSelected.getAttribute('data-nom');
    const immatriculation = optionSelected.getAttribute('data-immat');

    // Enregistre dans Firestore
    await addDoc(collection(db, 'signalements'), {
      type:          'signalement',
      vehiculeId,
      vehiculeNom,
      immatriculation,
      typeIncident,
      lieu:          inputLieu.value.trim() || null,
      description:   inputDescription.value.trim() || null,
      photoUrl,
      agentMail,
      date:          serverTimestamp()
    });

    // Confirmation
    recapSignalement.textContent = `${vehiculeNom} — ${immatriculation} (${typeIncident})`;
    recapHeure.textContent       = `Heure : ${new Date().toLocaleTimeString('fr-FR')}`;
    showStep(stepConfirmation);

  } catch (error) {
    signalementError.textContent = 'Erreur lors de l\'envoi. Vérifie ta connexion.';
    console.error('Erreur envoi signalement :', error);
  } finally {
    btnEnvoyer.disabled    = false;
    btnEnvoyer.textContent = '⚠️ Envoyer le signalement';
  }
});

// ============================================
// INITIALISATION
// ============================================
chargerVehicules();

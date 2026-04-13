import { db } from '../firebase.js';
import {
  collection,
  addDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let vehiculeEnEdition = null;

export const TEMPLATES_CHECKPOINTS = {
  "VL thermique": {
    "Général": ["Documents de bord présents", "Propreté intérieure", "Rétroviseurs réglés"],
    "Mécanique": ["Niveau huile moteur", "Niveau liquide refroidissement", "Niveau lave-glace"],
    "Sécurité": ["Éclairages avant", "Éclairages arrière", "Pneumatiques (état visuel)", "Freins (test à basse vitesse)"]
  },
  "VL électrique": {
    "Général": ["Documents de bord présents", "Propreté intérieure"],
    "Batterie & Charge": ["Niveau de charge batterie", "Connecteur de charge (état)", "Câble de charge présent"],
    "Sécurité": ["Éclairages avant", "Éclairages arrière", "Pneumatiques (état visuel)", "Avertisseur sonore"]
  },
  "Utilitaire": {
    "Général": ["Documents de bord présents", "Propreté intérieure", "Rétroviseurs réglés"],
    "Mécanique": ["Niveau huile moteur", "Niveau liquide refroidissement", "Niveau lave-glace"],
    "Carrosserie & Chargement": ["Portes arrière (fermeture)", "Ridelles (état)", "Sangles d'arrimage présentes", "Plancher (état)"],
    "Sécurité": ["Éclairages avant", "Éclairages arrière", "Gyrophare (si équipé)", "Pneumatiques (état visuel)"]
  },
  "Benne ordures ménagères": {
    "Général": ["Documents de bord présents", "Rétroviseurs grand angle"],
    "Mécanique PL": ["Niveau huile moteur", "Niveau liquide refroidissement", "Pression circuit pneumatique", "Freins (test à basse vitesse)"],
    "Équipement benne": ["Mécanisme compacteur", "Lève-conteneurs (état)", "Hayons (fermeture)", "Signalisation arrière"],
    "Sécurité": ["Éclairages avant", "Éclairages arrière", "Gyrophare", "Pneumatiques (état visuel)", "Marche arrière sonore"]
  },
  "Laveuse/Balayeuse VL": {
    "Général": ["Documents de bord présents", "Rétroviseurs réglés"],
    "Mécanique": ["Niveau huile moteur", "Niveau liquide refroidissement"],
    "Équipement balayage": ["Réservoir eau (niveau)", "Réservoir détergent (niveau)", "Brosses latérales (état)", "Brosse centrale (état)", "Buses (état et orientation)", "Trémie (vidée et propre)"],
    "Sécurité": ["Éclairages avant", "Éclairages arrière", "Gyrophare", "Pneumatiques (état visuel)"]
  },
  "Laveuse/Balayeuse PL": {
    "Général": ["Documents de bord présents", "Rétroviseurs grand angle"],
    "Mécanique PL": ["Niveau huile moteur", "Niveau liquide refroidissement", "Pression circuit pneumatique", "Freins (test à basse vitesse)"],
    "Équipement balayage": ["Réservoir eau (niveau)", "Réservoir détergent (niveau)", "Brosses latérales (état)", "Brosse centrale (état)", "Buses (état et orientation)", "Trémie (vidée et propre)"],
    "Sécurité": ["Éclairages avant", "Éclairages arrière", "Gyrophare", "Pneumatiques (état visuel)", "Marche arrière sonore"]
  },
  "Véhicule spécifique électrique": {
    "Général": ["Documents de bord présents", "Propreté intérieure"],
    "Batterie & Charge": ["Niveau de charge batterie", "Connecteur de charge (état)", "Câble de charge présent"],
    "Équipement spécifique": ["Équipements de bord (état)", "Benne/plateau (si équipé)"],
    "Sécurité": ["Éclairages avant", "Éclairages arrière", "Pneumatiques (état visuel)", "Avertisseur sonore"]
  }
};

export function initModale(tousLesVehicules, onSauvegarde) {
  document.getElementById('btn-ajouter-vehicule')
    .addEventListener('click', () => ouvrirModale(null, tousLesVehicules));
  document.getElementById('modale-fermer')
    .addEventListener('click', fermerModale);
  document.getElementById('btn-annuler')
    .addEventListener('click', fermerModale);
  document.getElementById('v-type')
    .addEventListener('change', (e) => {
      const template = TEMPLATES_CHECKPOINTS[e.target.value];
      if (template) genererEditorCheckpoints(template);
    });
  document.getElementById('btn-ajouter-categorie')
    .addEventListener('click', () => ajouterBlocCategorie());

  initIconePicker();
  initSauvegarder(tousLesVehicules, onSauvegarde);
}

export function ouvrirModale(vehiculeId, tousLesVehicules) {
  vehiculeEnEdition       = vehiculeId;
  const modaleTitre       = document.getElementById('modale-titre');
  modaleTitre.textContent = vehiculeId ? 'Modifier le véhicule' : 'Ajouter un véhicule';

  if (vehiculeId) {
    const v = tousLesVehicules.find(v => v.id === vehiculeId);
    if (v) {
      document.getElementById('v-nom').value   = v.nom;
      document.getElementById('v-immat').value = v.immatriculation;
      document.getElementById('v-type').value  = v.type;
      selectionnerIcone(v.icone || '🚗');
      genererEditorCheckpoints(v.checkpoints);
    }
  } else {
    document.getElementById('v-nom').value   = '';
    document.getElementById('v-immat').value = '';
    document.getElementById('v-type').value  = 'VL thermique';
    selectionnerIcone('🚗');
    genererEditorCheckpoints(TEMPLATES_CHECKPOINTS['VL thermique']);
  }

  document.getElementById('modale-vehicule').classList.remove('hidden');
}

export function fermerModale() {
  document.getElementById('modale-vehicule').classList.add('hidden');
  vehiculeEnEdition = null;
}

function initIconePicker() {
  const btnChoixIcone   = document.getElementById('btn-choix-icone');
  const inputIcone      = document.getElementById('input-icone-upload');
  const btnAppliquerEmoji = document.getElementById('btn-appliquer-emoji');
  const iconeLibreInput = document.getElementById('v-icone-libre');

  if (!btnChoixIcone || !inputIcone) return;

  // Upload image
  btnChoixIcone.addEventListener('click', () => inputIcone.click());

  inputIcone.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    btnChoixIcone.textContent = 'Upload en cours...';
    btnChoixIcone.disabled    = true;

    try {
      const url = await uploadIcone(file);
      document.getElementById('v-icone').value = url;
      document.getElementById('icone-apercu').innerHTML =
        `<img src="${url}" class="icone-upload-preview">`;
      btnChoixIcone.textContent = '✓ Image choisie';
      // Reset le champ emoji
      iconeLibreInput.value = '';
    } catch (error) {
      alert('Erreur upload icône.');
      btnChoixIcone.textContent = '📁 Choisir une image';
      console.error(error);
    } finally {
      btnChoixIcone.disabled = false;
    }
  });

  // Appliquer emoji
  btnAppliquerEmoji.addEventListener('click', () => {
    const val = iconeLibreInput.value.trim();
    if (!val) return;
    document.getElementById('v-icone').value       = val;
    document.getElementById('icone-apercu').innerHTML = val;
    // Reset l'input file
    inputIcone.value              = '';
    btnChoixIcone.textContent     = '📁 Choisir une image';
  });

  // Aperçu en temps réel de l'emoji
  iconeLibreInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    if (val) {
      document.getElementById('icone-apercu').innerHTML = val;
    }
  });
}

async function uploadIcone(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', 'ocgjzqqe');
  formData.append('folder', 'vehicules/icones');

  const response = await fetch(
    'https://api.cloudinary.com/v1_1/dpyfeif48/image/upload',
    { method: 'POST', body: formData }
  );

  if (!response.ok) throw new Error('Échec upload icône');
  const data = await response.json();
  return data.secure_url;
}

export function selectionnerIcone(icone) {
  const iconeHidden = document.getElementById('v-icone');
  const iconeApercu = document.getElementById('icone-apercu');
  if (!iconeHidden || !iconeApercu) return;

  iconeHidden.value = icone;

  if (icone && icone.startsWith('http')) {
    iconeApercu.innerHTML = `<img src="${icone}" class="icone-upload-preview">`;
  } else {
    iconeApercu.innerHTML = icone || '🚗';
  }
}

function genererEditorCheckpoints(checkpoints) {
  const checkpointsEditor = document.getElementById('checkpoints-editor');
  checkpointsEditor.innerHTML = '';
  Object.entries(checkpoints).forEach(([cat, points]) => ajouterBlocCategorie(cat, points));
}

function ajouterBlocCategorie(nomCategorie = '', points = []) {
  const checkpointsEditor = document.getElementById('checkpoints-editor');
  const bloc = document.createElement('div');
  bloc.className = 'categorie-block';
  bloc.innerHTML = `
    <div class="categorie-header">
      <input type="text" placeholder="Nom de la catégorie" value="${nomCategorie}" class="input-categorie">
      <button type="button" class="btn-suppr-cat">✕</button>
    </div>
    <div class="points-list">
      ${points.map(p => creerPointRow(p)).join('')}
    </div>
    <button type="button" class="btn-outline btn-ajouter-point">+ Ajouter un point</button>
  `;

  bloc.querySelector('.btn-suppr-cat').addEventListener('click', () => bloc.remove());
  bloc.querySelector('.btn-ajouter-point').addEventListener('click', () => {
    const liste = bloc.querySelector('.points-list');
    liste.insertAdjacentHTML('beforeend', creerPointRow(''));
    attacherSupprPoint(liste.lastElementChild);
  });

  bloc.querySelectorAll('.point-row').forEach(row => attacherSupprPoint(row));
  checkpointsEditor.appendChild(bloc);
}

function creerPointRow(valeur) {
  return `
    <div class="point-row">
      <input type="text" placeholder="Point de contrôle" value="${valeur}">
      <button type="button" class="btn-suppr-point">✕</button>
    </div>
  `;
}

function attacherSupprPoint(row) {
  row.querySelector('.btn-suppr-point').addEventListener('click', () => row.remove());
}

function initSauvegarder(tousLesVehicules, onSauvegarde) {
  document.getElementById('btn-sauvegarder').addEventListener('click', async () => {
    const nom   = document.getElementById('v-nom').value.trim();
    const immat = document.getElementById('v-immat').value.trim();
    const type  = document.getElementById('v-type').value;
    const icone = document.getElementById('v-icone').value;

    if (!nom || !immat) {
      alert('Le nom et l\'immatriculation sont obligatoires.');
      return;
    }

    const checkpointsEditor = document.getElementById('checkpoints-editor');
    const checkpoints = {};
    checkpointsEditor.querySelectorAll('.categorie-block').forEach(bloc => {
      const cat    = bloc.querySelector('.input-categorie').value.trim();
      const points = [...bloc.querySelectorAll('.point-row input')]
        .map(i => i.value.trim())
        .filter(v => v !== '');
      if (cat && points.length > 0) checkpoints[cat] = points;
    });

    if (Object.keys(checkpoints).length === 0) {
      alert('Ajoute au moins une catégorie avec un point de contrôle.');
      return;
    }

    const btnSauvegarder       = document.getElementById('btn-sauvegarder');
    btnSauvegarder.disabled    = true;
    btnSauvegarder.textContent = 'Sauvegarde...';

    try {
      const data = { nom, immatriculation: immat, type, icone, checkpoints };
      if (vehiculeEnEdition) {
        await updateDoc(doc(db, 'vehicules', vehiculeEnEdition), data);
      } else {
        await addDoc(collection(db, 'vehicules'), data);
      }
      fermerModale();
      onSauvegarde();
    } catch (error) {
      alert('Erreur lors de la sauvegarde.');
      console.error(error);
    } finally {
      btnSauvegarder.disabled    = false;
      btnSauvegarder.textContent = 'Sauvegarder';
    }
  });
}

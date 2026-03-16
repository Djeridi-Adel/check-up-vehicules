// ============================================
// IMPORTS
// ============================================
import { db, auth } from './firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ============================================
// RÉFÉRENCES DOM
// ============================================
const screenLogin       = document.getElementById('screen-login');
const screenDashboard   = document.getElementById('screen-dashboard');
const emailInput        = document.getElementById('email');
const passwordInput     = document.getElementById('password');
const btnLogin          = document.getElementById('btn-login');
const btnLogout         = document.getElementById('btn-logout');
const btnExport         = document.getElementById('btn-export');
const loginError        = document.getElementById('login-error');
const checkupsListe     = document.getElementById('checkups-liste');
const filtreVehicule    = document.getElementById('filtre-vehicule');
const filtreStatut      = document.getElementById('filtre-statut');
const filtreDate        = document.getElementById('filtre-date');
const statToday         = document.getElementById('stat-today');
const statAnomalies     = document.getElementById('stat-anomalies');
const statVehicules     = document.getElementById('stat-vehicules');
const vueCheckups       = document.getElementById('vue-checkups');
const vueFlotte         = document.getElementById('vue-flotte');
const listeFlotte       = document.getElementById('liste-flotte');
const btnAjouterVeh     = document.getElementById('btn-ajouter-vehicule');
const modaleVehicule    = document.getElementById('modale-vehicule');
const modaleTitre       = document.getElementById('modale-titre');
const modaleFermer      = document.getElementById('modale-fermer');
const btnAnnuler        = document.getElementById('btn-annuler');
const btnSauvegarder    = document.getElementById('btn-sauvegarder');
const checkpointsEditor = document.getElementById('checkpoints-editor');
const btnAjouterCat     = document.getElementById('btn-ajouter-categorie');
const iconeLibreInput   = document.getElementById('v-icone-libre');
const iconeApercu       = document.getElementById('icone-apercu');
const iconeHidden       = document.getElementById('v-icone');

// ============================================
// STATE
// ============================================
let tousLesCheckups     = [];
let tousLesVehicules    = [];
let unsubscribeCheckups = null;
let filtreActif         = null;
let vehiculeEnEdition   = null;

// ============================================
// TEMPLATES CHECKPOINTS PAR TYPE
// ============================================
const TEMPLATES_CHECKPOINTS = {
  "VL thermique": {
    "Général": [
      "Documents de bord présents",
      "Propreté intérieure",
      "Rétroviseurs réglés"
    ],
    "Mécanique": [
      "Niveau huile moteur",
      "Niveau liquide refroidissement",
      "Niveau lave-glace"
    ],
    "Sécurité": [
      "Éclairages avant",
      "Éclairages arrière",
      "Pneumatiques (état visuel)",
      "Freins (test à basse vitesse)"
    ]
  },
  "VL électrique": {
    "Général": [
      "Documents de bord présents",
      "Propreté intérieure"
    ],
    "Batterie & Charge": [
      "Niveau de charge batterie",
      "Connecteur de charge (état)",
      "Câble de charge présent"
    ],
    "Sécurité": [
      "Éclairages avant",
      "Éclairages arrière",
      "Pneumatiques (état visuel)",
      "Avertisseur sonore"
    ]
  },
  "Utilitaire": {
    "Général": [
      "Documents de bord présents",
      "Propreté intérieure",
      "Rétroviseurs réglés"
    ],
    "Mécanique": [
      "Niveau huile moteur",
      "Niveau liquide refroidissement",
      "Niveau lave-glace"
    ],
    "Carrosserie & Chargement": [
      "Portes arrière (fermeture)",
      "Ridelles (état)",
      "Sangles d'arrimage présentes",
      "Plancher (état)"
    ],
    "Sécurité": [
      "Éclairages avant",
      "Éclairages arrière",
      "Gyrophare (si équipé)",
      "Pneumatiques (état visuel)"
    ]
  },
  "Benne ordures ménagères": {
    "Général": [
      "Documents de bord présents",
      "Rétroviseurs grand angle"
    ],
    "Mécanique PL": [
      "Niveau huile moteur",
      "Niveau liquide refroidissement",
      "Pression circuit pneumatique",
      "Freins (test à basse vitesse)"
    ],
    "Équipement benne": [
      "Mécanisme compacteur",
      "Lève-conteneurs (état)",
      "Hayons (fermeture)",
      "Signalisation arrière"
    ],
    "Sécurité": [
      "Éclairages avant",
      "Éclairages arrière",
      "Gyrophare",
      "Pneumatiques (état visuel)",
      "Marche arrière sonore"
    ]
  },
  "Laveuse/Balayeuse VL": {
    "Général": [
      "Documents de bord présents",
      "Rétroviseurs réglés"
    ],
    "Mécanique": [
      "Niveau huile moteur",
      "Niveau liquide refroidissement"
    ],
    "Équipement balayage": [
      "Réservoir eau (niveau)",
      "Réservoir détergent (niveau)",
      "Brosses latérales (état)",
      "Brosse centrale (état)",
      "Buses (état et orientation)",
      "Trémie (vidée et propre)"
    ],
    "Sécurité": [
      "Éclairages avant",
      "Éclairages arrière",
      "Gyrophare",
      "Pneumatiques (état visuel)"
    ]
  },
  "Laveuse/Balayeuse PL": {
    "Général": [
      "Documents de bord présents",
      "Rétroviseurs grand angle"
    ],
    "Mécanique PL": [
      "Niveau huile moteur",
      "Niveau liquide refroidissement",
      "Pression circuit pneumatique",
      "Freins (test à basse vitesse)"
    ],
    "Équipement balayage": [
      "Réservoir eau (niveau)",
      "Réservoir détergent (niveau)",
      "Brosses latérales (état)",
      "Brosse centrale (état)",
      "Buses (état et orientation)",
      "Trémie (vidée et propre)"
    ],
    "Sécurité": [
      "Éclairages avant",
      "Éclairages arrière",
      "Gyrophare",
      "Pneumatiques (état visuel)",
      "Marche arrière sonore"
    ]
  },
  "Véhicule spécifique électrique": {
    "Général": [
      "Documents de bord présents",
      "Propreté intérieure"
    ],
    "Batterie & Charge": [
      "Niveau de charge batterie",
      "Connecteur de charge (état)",
      "Câble de charge présent"
    ],
    "Équipement spécifique": [
      "Équipements de bord (état)",
      "Benne/plateau (si équipé)"
    ],
    "Sécurité": [
      "Éclairages avant",
      "Éclairages arrière",
      "Pneumatiques (état visuel)",
      "Avertisseur sonore"
    ]
  }
};

// ============================================
// AUTHENTIFICATION
// ============================================
onAuthStateChanged(auth, (user) => {
  if (user) {
    showScreen(screenDashboard);
    initialiserDashboard();
  } else {
    showScreen(screenLogin);
    if (unsubscribeCheckups) unsubscribeCheckups();
  }
});

btnLogin.addEventListener('click', async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginError.textContent = 'Remplis tous les champs.';
    return;
  }

  btnLogin.disabled    = true;
  btnLogin.textContent = 'Connexion...';
  loginError.textContent = '';

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch {
    loginError.textContent = 'Email ou mot de passe incorrect.';
  } finally {
    btnLogin.disabled    = false;
    btnLogin.textContent = 'Se connecter';
  }
});

btnLogout.addEventListener('click', async () => await signOut(auth));

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') btnLogin.click();
});

// ============================================
// NAVIGATION ÉCRANS ET VUES
// ============================================
function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

function showVue(vue) {
  vueCheckups.classList.add('hidden');
  vueFlotte.classList.add('hidden');
  vue.classList.remove('hidden');
}

// ============================================
// INITIALISATION DU DASHBOARD
// ============================================
async function initialiserDashboard() {
  await chargerVehiculesFiltres();
  ecouterCheckups();
  filtreDate.value = new Date().toISOString().split('T')[0];
}

// ============================================
// STATS CLIQUABLES
// ============================================
document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('click', () => {
    const filtre = card.dataset.filtre;

    if (filtre === 'flotte') {
      document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      filtreActif = 'flotte';
      showVue(vueFlotte);
      chargerFlotte();
      return;
    }

    showVue(vueCheckups);

    if (filtreActif === filtre) {
      filtreActif = null;
      card.classList.remove('active');
    } else {
      filtreActif = filtre;
      document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      filtreVehicule.value = '';
      filtreStatut.value   = '';
      filtreDate.value     = '';
    }

    afficherCheckups();
  });
});

// ============================================
// CHARGEMENT VÉHICULES (filtre + stats)
// ============================================
async function chargerVehiculesFiltres() {
  try {
    const snapshot = await getDocs(collection(db, 'vehicules'));
    tousLesVehicules = [];
    statVehicules.textContent = snapshot.size;

    snapshot.forEach(doc => {
      tousLesVehicules.push({ id: doc.id, ...doc.data() });
      const option       = document.createElement('option');
      option.value       = doc.id;
      option.textContent = doc.data().nom;
      filtreVehicule.appendChild(option);
    });
  } catch (error) {
    console.error('Erreur chargement véhicules :', error);
  }
}

// ============================================
// VUE FLOTTE — chargement et affichage
// ============================================
async function chargerFlotte() {
  listeFlotte.innerHTML = '<p class="loading">Chargement...</p>';

  try {
    const snapshot = await getDocs(collection(db, 'vehicules'));
    tousLesVehicules = [];
    snapshot.forEach(doc => tousLesVehicules.push({ id: doc.id, ...doc.data() }));

    if (tousLesVehicules.length === 0) {
      listeFlotte.innerHTML = '<p class="loading">Aucun véhicule dans la flotte.</p>';
      return;
    }

    listeFlotte.innerHTML = '';

    tousLesVehicules.forEach(v => {
      const card = document.createElement('div');
      card.className = 'flotte-card';
      card.innerHTML = `
        <div class="flotte-card-info">
          <span class="flotte-icone">${v.icone || '🚗'}</span>
          <div>
            <h3>${v.nom}</h3>
            <p>${v.immatriculation} — ${v.type}</p>
          </div>
        </div>
        <div class="flotte-card-actions">
          <button class="btn-edit" data-id="${v.id}">✏️ Modifier</button>
          <button class="btn-delete" data-id="${v.id}">🗑️</button>
        </div>
      `;

      card.querySelector('.btn-edit').addEventListener('click', () => ouvrirModale(v.id));
      card.querySelector('.btn-delete').addEventListener('click', () => supprimerVehicule(v.id, v.nom));

      listeFlotte.appendChild(card);
    });

  } catch (error) {
    console.error('Erreur chargement flotte :', error);
  }
}

// ============================================
// SUPPRESSION VÉHICULE
// ============================================
async function supprimerVehicule(id, nom) {
  if (!confirm(`Supprimer "${nom}" de la flotte ? Cette action est irréversible.`)) return;

  try {
    await deleteDoc(doc(db, 'vehicules', id));
    chargerFlotte();
    statVehicules.textContent = parseInt(statVehicules.textContent) - 1;
  } catch (error) {
    alert('Erreur lors de la suppression.');
    console.error(error);
  }
}

// ============================================
// ICÔNE — picker + champ libre
// ============================================
function selectionnerIcone(icone) {
  document.querySelectorAll('.icone-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.icone === icone);
  });
  iconeHidden.value      = icone;
  iconeApercu.textContent = icone;
  iconeLibreInput.value  = '';
}

document.querySelectorAll('.icone-option').forEach(el => {
  el.addEventListener('click', () => selectionnerIcone(el.dataset.icone));
});

iconeLibreInput.addEventListener('input', (e) => {
  const val = e.target.value.trim();
  if (!val) return;

  document.querySelectorAll('.icone-option').forEach(el => {
    el.classList.remove('selected');
  });

  iconeHidden.value       = val;
  iconeApercu.textContent = val;
});

// ============================================
// MODALE — ouvrir / fermer
// ============================================
function ouvrirModale(vehiculeId = null) {
  vehiculeEnEdition   = vehiculeId;
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

  modaleVehicule.classList.remove('hidden');
}

function fermerModale() {
  modaleVehicule.classList.add('hidden');
  vehiculeEnEdition = null;
}

btnAjouterVeh.addEventListener('click', () => ouvrirModale());
modaleFermer.addEventListener('click', fermerModale);
btnAnnuler.addEventListener('click', fermerModale);

// Pré-remplir checkpoints quand on change le type
document.getElementById('v-type').addEventListener('change', (e) => {
  const template = TEMPLATES_CHECKPOINTS[e.target.value];
  if (template) genererEditorCheckpoints(template);
});

// ============================================
// ÉDITEUR DE CHECKPOINTS
// ============================================
function genererEditorCheckpoints(checkpoints) {
  checkpointsEditor.innerHTML = '';
  Object.entries(checkpoints).forEach(([categorie, points]) => {
    ajouterBlocCategorie(categorie, points);
  });
}

function ajouterBlocCategorie(nomCategorie = '', points = []) {
  const bloc = document.createElement('div');
  bloc.className = 'categorie-block';
  bloc.innerHTML = `
    <div class="categorie-header">
      <input type="text" placeholder="Nom de la catégorie" value="${nomCategorie}" class="input-categorie">
      <button type="button" class="btn-suppr-cat" title="Supprimer cette catégorie">✕</button>
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

btnAjouterCat.addEventListener('click', () => ajouterBlocCategorie());

// ============================================
// SAUVEGARDER UN VÉHICULE
// ============================================
btnSauvegarder.addEventListener('click', async () => {
  const nom   = document.getElementById('v-nom').value.trim();
  const immat = document.getElementById('v-immat').value.trim();
  const type  = document.getElementById('v-type').value;
  const icone = iconeHidden.value;

  if (!nom || !immat) {
    alert('Le nom et l\'immatriculation sont obligatoires.');
    return;
  }

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

  const data = { nom, immatriculation: immat, type, icone, checkpoints };

  btnSauvegarder.disabled    = true;
  btnSauvegarder.textContent = 'Sauvegarde...';

  try {
    if (vehiculeEnEdition) {
      await updateDoc(doc(db, 'vehicules', vehiculeEnEdition), data);
    } else {
      await addDoc(collection(db, 'vehicules'), data);
    }

    fermerModale();
    chargerFlotte();

    // Recharge les options du filtre
    filtreVehicule.innerHTML = '<option value="">Tous les véhicules</option>';
    const snap = await getDocs(collection(db, 'vehicules'));
    statVehicules.textContent = snap.size;
    snap.forEach(d => {
      const o       = document.createElement('option');
      o.value       = d.id;
      o.textContent = d.data().nom;
      filtreVehicule.appendChild(o);
    });

  } catch (error) {
    alert('Erreur lors de la sauvegarde.');
    console.error(error);
  } finally {
    btnSauvegarder.disabled    = false;
    btnSauvegarder.textContent = 'Sauvegarder';
  }
});

// ============================================
// ÉCOUTE TEMPS RÉEL CHECK-UPS
// ============================================
function ecouterCheckups() {
  const q = query(
    collection(db, 'checkups'),
    orderBy('date', 'desc')
  );

  unsubscribeCheckups = onSnapshot(q, (snapshot) => {
    tousLesCheckups = [];
    snapshot.forEach(doc => tousLesCheckups.push({ id: doc.id, ...doc.data() }));
    mettreAJourStats();
    if (!vueFlotte.classList.contains('hidden') === false) afficherCheckups();
  });
}

// ============================================
// STATISTIQUES
// ============================================
function mettreAJourStats() {
  const aujourd_hui = new Date();
  aujourd_hui.setHours(0, 0, 0, 0);

  let countToday     = 0;
  let countAnomalies = 0;

  tousLesCheckups.forEach(checkup => {
    if (checkup.date && checkup.date.toDate() >= aujourd_hui) countToday++;
    if (Object.values(checkup.resultats || {}).some(r => r.statut === 'anomalie')) countAnomalies++;
  });

  statToday.textContent     = countToday;
  statAnomalies.textContent = countAnomalies;
}

// ============================================
// AFFICHAGE CHECK-UPS AVEC FILTRES
// ============================================
function afficherCheckups() {
  const filtreVeh       = filtreVehicule.value;
  const filtreStatutVal = filtreStatut.value;
  const filtreDateVal   = filtreDate.value;
  const aujourd_hui     = new Date();
  aujourd_hui.setHours(0, 0, 0, 0);

  const liste = tousLesCheckups.filter(c => {
    if (filtreActif === 'today') {
      if (!c.date) return false;
      const d = c.date.toDate();
      d.setHours(0, 0, 0, 0);
      if (d.getTime() !== aujourd_hui.getTime()) return false;
    }

    if (filtreActif === 'anomalie') {
      if (!Object.values(c.resultats || {}).some(r => r.statut === 'anomalie')) return false;
    }

    if (filtreVeh && c.vehiculeId !== filtreVeh) return false;

    if (filtreStatutVal) {
      const hasAno = Object.values(c.resultats || {}).some(r => r.statut === 'anomalie');
      if (filtreStatutVal === 'anomalie' && !hasAno) return false;
      if (filtreStatutVal === 'ok' && hasAno) return false;
    }

    if (filtreDateVal && c.date) {
      if (c.date.toDate().toISOString().split('T')[0] !== filtreDateVal) return false;
    }

    return true;
  });

  checkupsListe.innerHTML = liste.length === 0
    ? '<p class="loading">Aucun check-up trouvé.</p>'
    : '';

  liste.forEach(checkup => {
    const hasAnomalie = Object.values(checkup.resultats || {})
      .some(r => r.statut === 'anomalie');
    const date = checkup.date
      ? checkup.date.toDate().toLocaleString('fr-FR')
      : 'Date inconnue';

    const card = document.createElement('div');
    card.className = `checkup-card ${hasAnomalie ? 'has-anomalie' : ''}`;
    card.innerHTML = `
      <div class="checkup-card-header">
        <div>
          <h3>${checkup.vehiculeNom} — ${checkup.immatriculation}</h3>
          <p class="checkup-meta">${date}</p>
        </div>
        <span class="checkup-badge ${hasAnomalie ? 'anomalie' : 'ok'}">
          ${hasAnomalie ? '⚠️ Anomalie' : '✓ OK'}
        </span>
      </div>
      <div class="checkup-card-body" id="body-${checkup.id}">
        ${genererDetailCheckup(checkup.resultats)}
      </div>
    `;

    card.querySelector('.checkup-card-header').addEventListener('click', () => {
      document.getElementById(`body-${checkup.id}`).classList.toggle('visible');
    });

    checkupsListe.appendChild(card);
  });
}

// ============================================
// DÉTAIL CHECK-UP AVEC PHOTOS
// ============================================
function genererDetailCheckup(resultats) {
  if (!resultats) return '<p>Aucun détail disponible.</p>';

  return Object.entries(resultats).map(([point, data]) => `
    <div class="checkpoint-result ${data.statut === 'anomalie' ? 'has-anomalie' : ''}">
      <div class="checkpoint-result-info">
        <div class="checkpoint-result-label">${point}</div>
        ${data.detail
          ? `<div class="detail-text">${data.detail}</div>`
          : ''}
        ${data.photoUrl
          ? `<a href="${data.photoUrl}" target="_blank" class="photo-link">
               <img src="${data.photoUrl}" class="photo-thumb" alt="Photo anomalie">
               <span>Voir la photo</span>
             </a>`
          : ''}
      </div>
      <span class="statut-${data.statut}">
        ${data.statut === 'ok' ? '✓ OK' : '⚠️'}
      </span>
    </div>
  `).join('');
}

// ============================================
// FILTRES — reset filtreActif au changement
// ============================================
[filtreVehicule, filtreStatut, filtreDate].forEach(f => {
  f.addEventListener('change', () => {
    filtreActif = null;
    showVue(vueCheckups);
    document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
    afficherCheckups();
  });
});

// ============================================
// EXPORT CSV
// ============================================
btnExport.addEventListener('click', () => {
  if (tousLesCheckups.length === 0) {
    alert('Aucune donnée à exporter.');
    return;
  }

  const lignes = ['Date,Véhicule,Immatriculation,Point de contrôle,Statut,Détail,Photo'];

  tousLesCheckups.forEach(c => {
    const date = c.date ? c.date.toDate().toLocaleString('fr-FR') : '';
    Object.entries(c.resultats || {}).forEach(([point, data]) => {
      lignes.push([
        `"${date}"`,
        `"${c.vehiculeNom}"`,
        `"${c.immatriculation}"`,
        `"${point}"`,
        `"${data.statut}"`,
        `"${data.detail || ''}"`,
        `"${data.photoUrl || ''}"`
      ].join(','));
    });
  });

  const csv  = lignes.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `checkups-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
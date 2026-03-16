// ============================================
// IMPORTS
// ============================================
import { db, auth } from './firebase.js';
import {
  collection,
  getDocs,
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
const screenLogin      = document.getElementById('screen-login');
const screenDashboard  = document.getElementById('screen-dashboard');
const emailInput       = document.getElementById('email');
const passwordInput    = document.getElementById('password');
const btnLogin         = document.getElementById('btn-login');
const btnLogout        = document.getElementById('btn-logout');
const btnExport        = document.getElementById('btn-export');
const loginError       = document.getElementById('login-error');
const checkupsListe    = document.getElementById('checkups-liste');
const filtreVehicule   = document.getElementById('filtre-vehicule');
const filtreStatut     = document.getElementById('filtre-statut');
const filtreDate       = document.getElementById('filtre-date');
const statToday        = document.getElementById('stat-today');
const statAnomalies    = document.getElementById('stat-anomalies');
const statVehicules    = document.getElementById('stat-vehicules');

// ============================================
// STATE
// ============================================
let tousLesCheckups     = [];
let unsubscribeCheckups = null;
let filtreActif         = null; // 'today' | 'anomalie' | 'vehicules' | null

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
  } catch (error) {
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
// NAVIGATION
// ============================================
function showScreen(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}

// ============================================
// INITIALISATION DU DASHBOARD
// ============================================
async function initialiserDashboard() {
  await chargerVehiculesFiltres();
  ecouterCheckups();
  initialiserFiltreDate();
}

// ============================================
// FILTRE DATE — initialise à aujourd'hui
// ============================================
function initialiserFiltreDate() {
  const today = new Date().toISOString().split('T')[0];
  filtreDate.value = today;
}

// ============================================
// CHARGEMENT VÉHICULES POUR LE FILTRE
// ============================================
async function chargerVehiculesFiltres() {
  try {
    const snapshot = await getDocs(collection(db, 'vehicules'));
    statVehicules.textContent = snapshot.size;

    snapshot.forEach(doc => {
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
// ÉCOUTE TEMPS RÉEL
// ============================================
function ecouterCheckups() {
  const q = query(
    collection(db, 'checkups'),
    orderBy('date', 'desc')
  );

  unsubscribeCheckups = onSnapshot(q, (snapshot) => {
    tousLesCheckups = [];
    snapshot.forEach(doc => {
      tousLesCheckups.push({ id: doc.id, ...doc.data() });
    });
    mettreAJourStats();
    afficherCheckups();
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
    if (checkup.date) {
      const dateCheckup = checkup.date.toDate();
      if (dateCheckup >= aujourd_hui) countToday++;
    }
    const hasAnomalie = Object.values(checkup.resultats || {})
      .some(r => r.statut === 'anomalie');
    if (hasAnomalie) countAnomalies++;
  });

  statToday.textContent     = countToday;
  statAnomalies.textContent = countAnomalies;

  // Highlight stat active
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
  if (filtreActif) {
    document.querySelector(`.stat-card[data-filtre="${filtreActif}"]`)
      ?.classList.add('active');
  }
}

// ============================================
// STATS CLIQUABLES
// ============================================
document.querySelectorAll('.stat-card').forEach(card => {
  card.addEventListener('click', () => {
    const filtre = card.dataset.filtre;

    // Toggle — si on reclique sur le même, on désactive
    if (filtreActif === filtre) {
      filtreActif = null;
      card.classList.remove('active');
    } else {
      filtreActif = filtre;
      document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    }

    // Reset les autres filtres si on clique sur une stat
    if (filtreActif) {
      filtreVehicule.value = '';
      filtreStatut.value   = '';
      filtreDate.value     = '';
    }

    afficherCheckups();
  });
});

// ============================================
// AFFICHAGE DES CHECK-UPS AVEC FILTRES
// ============================================
function afficherCheckups() {
  const filtreVeh       = filtreVehicule.value;
  const filtreStatutVal = filtreStatut.value;
  const filtreDateVal   = filtreDate.value;

  const aujourd_hui = new Date();
  aujourd_hui.setHours(0, 0, 0, 0);

  let checkupsFiltres = tousLesCheckups.filter(checkup => {
    // Filtre stat cliquée
    if (filtreActif === 'today') {
      if (!checkup.date) return false;
      const d = checkup.date.toDate();
      d.setHours(0, 0, 0, 0);
      if (d.getTime() !== aujourd_hui.getTime()) return false;
    }

    if (filtreActif === 'anomalie') {
      const hasAnomalie = Object.values(checkup.resultats || {})
        .some(r => r.statut === 'anomalie');
      if (!hasAnomalie) return false;
    }

    // Filtre véhicule
    if (filtreVeh && checkup.vehiculeId !== filtreVeh) return false;

    // Filtre statut
    if (filtreStatutVal) {
      const hasAnomalie = Object.values(checkup.resultats || {})
        .some(r => r.statut === 'anomalie');
      if (filtreStatutVal === 'anomalie' && !hasAnomalie) return false;
      if (filtreStatutVal === 'ok' && hasAnomalie) return false;
    }

    // Filtre date
    if (filtreDateVal && checkup.date) {
      const dateCheckup = checkup.date.toDate().toISOString().split('T')[0];
      if (dateCheckup !== filtreDateVal) return false;
    }

    return true;
  });

  if (checkupsFiltres.length === 0) {
    checkupsListe.innerHTML = `<p class="loading">Aucun check-up trouvé.</p>`;
    return;
  }

  checkupsListe.innerHTML = '';
  checkupsFiltres.forEach(checkup => afficherCarteCheckup(checkup));
}

// ============================================
// CARTE CHECK-UP
// ============================================
function afficherCarteCheckup(checkup) {
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
// FILTRES
// ============================================
filtreVehicule.addEventListener('change', () => {
  filtreActif = null;
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
  afficherCheckups();
});

filtreStatut.addEventListener('change', () => {
  filtreActif = null;
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
  afficherCheckups();
});

filtreDate.addEventListener('change', () => {
  filtreActif = null;
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
  afficherCheckups();
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

  tousLesCheckups.forEach(checkup => {
    const date = checkup.date
      ? checkup.date.toDate().toLocaleString('fr-FR')
      : '';

    Object.entries(checkup.resultats || {}).forEach(([point, data]) => {
      lignes.push([
        `"${date}"`,
        `"${checkup.vehiculeNom}"`,
        `"${checkup.immatriculation}"`,
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
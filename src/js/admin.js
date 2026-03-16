// ============================================
// IMPORTS
// ============================================
import { db, auth } from './firebase.js';
import {
  collection,
  getDocs,
  query,
  orderBy,
  onSnapshot,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ============================================
// RÉFÉRENCES DOM
// ============================================
const screenLogin     = document.getElementById('screen-login');
const screenDashboard = document.getElementById('screen-dashboard');
const emailInput      = document.getElementById('email');
const passwordInput   = document.getElementById('password');
const btnLogin        = document.getElementById('btn-login');
const btnLogout       = document.getElementById('btn-logout');
const btnExport       = document.getElementById('btn-export');
const loginError      = document.getElementById('login-error');
const checkupsListe   = document.getElementById('checkups-liste');
const filtreVehicule  = document.getElementById('filtre-vehicule');
const filtreStatut    = document.getElementById('filtre-statut');
const statToday       = document.getElementById('stat-today');
const statAnomalies   = document.getElementById('stat-anomalies');
const statVehicules   = document.getElementById('stat-vehicules');

// ============================================
// STATE
// ============================================
let tousLesCheckups = [];
let unsubscribeCheckups = null;

// ============================================
// AUTHENTIFICATION
// ============================================

// Surveille l'état de connexion en permanence
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Connecté → on affiche le dashboard
    showScreen(screenDashboard);
    initialiserDashboard();
  } else {
    // Déconnecté → on affiche le login
    showScreen(screenLogin);
    if (unsubscribeCheckups) unsubscribeCheckups();
  }
});

// Connexion
btnLogin.addEventListener('click', async () => {
  const email    = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginError.textContent = 'Remplis tous les champs.';
    return;
  }

  btnLogin.disabled = true;
  btnLogin.textContent = 'Connexion...';
  loginError.textContent = '';

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    loginError.textContent = 'Email ou mot de passe incorrect.';
    console.error('Erreur login :', error);
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Se connecter';
  }
});

// Déconnexion
btnLogout.addEventListener('click', async () => {
  await signOut(auth);
});

// Touche Entrée sur le champ mot de passe
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
}

// ============================================
// CHARGEMENT VÉHICULES POUR LE FILTRE
// ============================================
async function chargerVehiculesFiltres() {
  try {
    const snapshot = await getDocs(collection(db, 'vehicules'));
    statVehicules.textContent = snapshot.size;

    snapshot.forEach(doc => {
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = doc.data().nom;
      filtreVehicule.appendChild(option);
    });
  } catch (error) {
    console.error('Erreur chargement véhicules :', error);
  }
}

// ============================================
// ÉCOUTE EN TEMPS RÉEL DES CHECK-UPS
// onSnapshot = Firebase nous prévient dès qu'une
// donnée change, sans qu'on ait à redemander
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

  let countToday    = 0;
  let countAnomalies = 0;

  tousLesCheckups.forEach(checkup => {
    // Check-ups d'aujourd'hui
    if (checkup.date) {
      const dateCheckup = checkup.date.toDate();
      if (dateCheckup >= aujourd_hui) countToday++;
    }

    // Anomalies
    const hasAnomalie = Object.values(checkup.resultats || {})
      .some(r => r.statut === 'anomalie');
    if (hasAnomalie) countAnomalies++;
  });

  statToday.textContent     = countToday;
  statAnomalies.textContent = countAnomalies;
}

// ============================================
// AFFICHAGE DES CHECK-UPS AVEC FILTRES
// ============================================
function afficherCheckups() {
  const filtreVeh    = filtreVehicule.value;
  const filtreStatutVal = filtreStatut.value;

  let checkupsFiltres = tousLesCheckups.filter(checkup => {
    // Filtre véhicule
    if (filtreVeh && checkup.vehiculeId !== filtreVeh) return false;

    // Filtre statut
    if (filtreStatutVal) {
      const hasAnomalie = Object.values(checkup.resultats || {})
        .some(r => r.statut === 'anomalie');
      if (filtreStatutVal === 'anomalie' && !hasAnomalie) return false;
      if (filtreStatutVal === 'ok' && hasAnomalie) return false;
    }

    return true;
  });

  if (checkupsFiltres.length === 0) {
    checkupsListe.innerHTML = `
      <p class="loading">Aucun check-up trouvé.</p>
    `;
    return;
  }

  checkupsListe.innerHTML = '';

  checkupsFiltres.forEach(checkup => {
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

    // Déplier/replier le détail au clic
    card.querySelector('.checkup-card-header').addEventListener('click', () => {
      const body = document.getElementById(`body-${checkup.id}`);
      body.classList.toggle('visible');
    });

    checkupsListe.appendChild(card);
  });
}

// ============================================
// DÉTAIL D'UN CHECK-UP
// ============================================
function genererDetailCheckup(resultats) {
  if (!resultats) return '<p>Aucun détail disponible.</p>';

  return Object.entries(resultats).map(([point, data]) => `
    <div class="checkpoint-result">
      <div>
        <div>${point}</div>
        ${data.detail ? `<div class="detail-text">${data.detail}</div>` : ''}
      </div>
      <span class="statut-${data.statut}">
        ${data.statut === 'ok' ? '✓ OK' : '⚠️ Anomalie'}
      </span>
    </div>
  `).join('');
}

// ============================================
// FILTRES — réaffichage à chaque changement
// ============================================
filtreVehicule.addEventListener('change', afficherCheckups);
filtreStatut.addEventListener('change', afficherCheckups);

// ============================================
// EXPORT CSV
// ============================================
btnExport.addEventListener('click', () => {
  if (tousLesCheckups.length === 0) {
    alert('Aucune donnée à exporter.');
    return;
  }

  const lignes = ['Date,Véhicule,Immatriculation,Point de contrôle,Statut,Détail'];

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
        `"${data.detail || ''}"`
      ].join(','));
    });
  });

  const csv     = lignes.join('\n');
  const blob    = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  a.download    = `checkups-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
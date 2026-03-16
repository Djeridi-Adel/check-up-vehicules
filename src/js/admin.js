import { initAuth }              from './admin/auth.js';
import { mettreAJourStats, initFiltres, initStatCards, getFiltresValeurs } from './admin/stats.js';
import { ecouterCheckups, afficherCheckups } from './admin/checkups.js';
import { chargerVehiculesFiltres, chargerFlotte, tousLesVehicules } from './admin/flotte.js';
import { initModale, ouvrirModale }          from './admin/modale.js';
import { initExport }            from './admin/export.js';

// ============================================
// STATE GLOBAL
// ============================================
let tousLesCheckups     = [];
let unsubscribeCheckups = null;
let filtreActif         = null;

const screenLogin     = document.getElementById('screen-login');
const screenDashboard = document.getElementById('screen-dashboard');
const vueCheckups     = document.getElementById('vue-checkups');
const vueFlotte       = document.getElementById('vue-flotte');

// ============================================
// NAVIGATION
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

function rafraichirAffichage() {
  filtreActif = null;
  document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
  showVue(vueCheckups);
  afficherCheckups(tousLesCheckups, filtreActif, getFiltresValeurs());
}

// ============================================
// INITIALISATION
// ============================================
async function initialiserDashboard() {
  await chargerVehiculesFiltres();

  initModale(tousLesVehicules, async () => {
    await chargerVehiculesFiltres();
    chargerFlotte((id) => ouvrirModale(id, tousLesVehicules));
  });

initStatCards((filtre, card) => {
    if (filtre === 'flotte') {
      document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      filtreActif = 'flotte';
      showVue(vueFlotte);
      chargerFlotte((id) => ouvrirModale(id, tousLesVehicules));
      return;
    }

    showVue(vueCheckups);

    // On met à jour filtreActif AVANT d'appeler afficherCheckups
    if (filtreActif === filtre) {
      filtreActif = null;
      card.classList.remove('active');
    } else {
      filtreActif = filtre;
      document.querySelectorAll('.stat-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
    }

    // On réinitialise les autres filtres quand on clique une stat
    document.getElementById('filtre-vehicule').value = '';
    document.getElementById('filtre-statut').value   = '';
    document.getElementById('filtre-date').value     = '';

    // filtreActif est maintenant à jour
    afficherCheckups(tousLesCheckups, filtreActif, getFiltresValeurs());
  });

  initFiltres(() => rafraichirAffichage());

  unsubscribeCheckups = ecouterCheckups((checkups) => {
    tousLesCheckups = checkups;
    mettreAJourStats(tousLesCheckups);
    afficherCheckups(tousLesCheckups, filtreActif, getFiltresValeurs());
  });

  initExport(() => tousLesCheckups);
}

// ============================================
// AUTH — point d'entrée principal
// ============================================
initAuth(
  async () => {
    showScreen(screenDashboard);
    await initialiserDashboard();
  },
  () => {
    showScreen(screenLogin);
    if (unsubscribeCheckups) unsubscribeCheckups();
  }
);
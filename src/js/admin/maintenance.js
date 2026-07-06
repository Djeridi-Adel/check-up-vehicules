import { db } from '../firebase.js';
import { getHistoriqueVehicule } from '../anomalies.js';
import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================
// CHARGER LA LISTE DES VÉHICULES
// ============================================
export async function chargerVehiculesMaintenance() {
  const liste = document.getElementById('maintenance-vehicules');
  liste.innerHTML = '<p class="loading">Chargement...</p>';

  try {
    const snapshot = await getDocs(collection(db, 'vehicules'));
    const vehicules = [];
    snapshot.forEach(d => vehicules.push({ id: d.id, ...d.data() }));

    // Pour chaque véhicule, compte les anomalies actives
    const anomaliesSnapshot = await getDocs(collection(db, 'anomalies'));
    const anomaliesParVehicule = {};
    anomaliesSnapshot.forEach(d => {
      const data = d.data();
      if (!anomaliesParVehicule[data.vehiculeId]) {
        anomaliesParVehicule[data.vehiculeId] = { actives: 0, total: 0 };
      }
      anomaliesParVehicule[data.vehiculeId].total++;
      if (!['confirmee_resolue'].includes(data.statut)) {
        anomaliesParVehicule[data.vehiculeId].actives++;
      }
    });

    if (vehicules.length === 0) {
      liste.innerHTML = '<p class="loading">Aucun véhicule.</p>';
      return;
    }

    liste.innerHTML = '';

    vehicules.forEach(v => {
      const stats        = anomaliesParVehicule[v.id] || { actives: 0, total: 0 };
      const estDisponible = v.disponible !== false;

      const card = document.createElement('div');
      card.className = 'maintenance-vehicule-card';
      card.innerHTML = `
        <div class="maintenance-vehicule-info">
          <div class="maintenance-vehicule-icone">
            ${v.icone?.startsWith('http')
              ? `<img src="${v.icone}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;">`
              : (v.icone || '🚗')}
          </div>
          <div>
            <h3>${v.nom}</h3>
            <p>${v.immatriculation} — ${v.type}</p>
            ${!estDisponible ? '<span class="badge-indispo-small">🔧 En maintenance</span>' : ''}
          </div>
        </div>
        <div class="maintenance-vehicule-stats">
          ${stats.actives > 0
            ? `<span class="stat-anomalie-active">${stats.actives} active${stats.actives > 1 ? 's' : ''}</span>`
            : '<span class="stat-ok">✓ OK</span>'}
          <span class="stat-total">${stats.total} au total</span>
          <span class="maintenance-arrow">→</span>
        </div>
      `;

      card.addEventListener('click', () => afficherHistorique(v));
      liste.appendChild(card);
    });

  } catch (error) {
    liste.innerHTML = '<p class="loading">Erreur de chargement.</p>';
    console.error(error);
  }
}

// ============================================
// AFFICHER L'HISTORIQUE D'UN VÉHICULE
// ============================================
async function afficherHistorique(vehicule) {
  const vueVehicules  = document.getElementById('maintenance-vehicules');
  const vueHistorique = document.getElementById('maintenance-historique');
  const titre         = document.getElementById('maintenance-vehicule-titre');
  const listePannes   = document.getElementById('maintenance-liste-pannes');

  vueVehicules.classList.add('hidden');
  vueHistorique.classList.remove('hidden');
  titre.textContent = `${vehicule.nom} — ${vehicule.immatriculation}`;
  listePannes.innerHTML = '<p class="loading">Chargement...</p>';

  try {
    const anomalies = await getHistoriqueVehicule(vehicule.id);

    if (anomalies.length === 0) {
      listePannes.innerHTML = '<p class="loading">Aucune anomalie enregistrée.</p>';
      return;
    }

    listePannes.innerHTML = '';

    anomalies.forEach(a => {
      const date = a.dateSignalement?.toDate().toLocaleString('fr-FR') || '—';
      const dateResolution = a.dateResolution?.toDate().toLocaleString('fr-FR') || null;

      const statutConfig = {
        en_attente:        { label: '⏳ En attente',         class: 'statut-attente' },
        pris_en_compte:    { label: '👀 Pris en compte',     class: 'statut-pris' },
        astech_demande:    { label: '🔧 Demande atelier',    class: 'statut-astech' },
        marquee_resolue:   { label: '🔄 En cours de vérif.', class: 'statut-verif' },
        confirmee_resolue: { label: '✅ Réparé',             class: 'statut-resolu' },
        re_signalee:       { label: '🔴 Re-signalée',        class: 'statut-resignalee' },
      };

      const statut = statutConfig[a.statut] || { label: a.statut, class: '' };

      const card = document.createElement('div');
      card.className = `maintenance-panne-card ${a.statut === 'confirmee_resolue' ? 'panne-resolue' : 'panne-active'}`;
      card.innerHTML = `
        <div class="maintenance-panne-header">
          <div>
            <h4>${a.point}</h4>
            <p class="maintenance-panne-date">Signalée le ${date}</p>
            ${a.agentMail ? `<p class="maintenance-panne-agent">${a.agentMail}</p>` : ''}
          </div>
          <span class="maintenance-statut-badge ${statut.class}">${statut.label}</span>
        </div>
        ${a.description ? `<p class="maintenance-panne-desc">${a.description}</p>` : ''}
        ${dateResolution ? `<p class="maintenance-panne-date">Résolu le ${dateResolution}</p>` : ''}
        ${a.photoUrl ? `
          <a href="${a.photoUrl}" target="_blank" class="photo-link">
            <img src="${a.photoUrl}" class="photo-thumb" alt="Photo">
            <span>Voir la photo</span>
          </a>` : ''}
      `;

      listePannes.appendChild(card);
    });

  } catch (error) {
    listePannes.innerHTML = '<p class="loading">Erreur de chargement.</p>';
    console.error(error);
  }
}

// ============================================
// BOUTON RETOUR
// ============================================
export function initMaintenanceRetour() {
  const btn = document.getElementById('btn-retour-maintenance');
  if (btn) {
    btn.addEventListener('click', () => {
      document.getElementById('maintenance-vehicules').classList.remove('hidden');
      document.getElementById('maintenance-historique').classList.add('hidden');
    });
  }
}
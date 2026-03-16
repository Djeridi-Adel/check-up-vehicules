import { db } from '../firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function ecouterCheckups(onMiseAJour) {
  const q = query(
    collection(db, 'checkups'),
    orderBy('date', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const checkups = [];
    snapshot.forEach(doc => checkups.push({ id: doc.id, ...doc.data() }));
    onMiseAJour(checkups);
  });
}

export function afficherCheckups(tousLesCheckups, filtreActif, filtres) {
  const liste    = document.getElementById('checkups-liste');
  const aujourd_hui = new Date();
  aujourd_hui.setHours(0, 0, 0, 0);

  const filtrés = tousLesCheckups.filter(c => {
    if (filtreActif === 'today') {
      if (!c.date) return false;
      const d = c.date.toDate();
      d.setHours(0, 0, 0, 0);
      if (d.getTime() !== aujourd_hui.getTime()) return false;
    }

    if (filtreActif === 'anomalie') {
      const anomalies = Object.values(c.resultats || {})
        .filter(r => r.statut === 'anomalie');
      if (anomalies.length === 0) return false;
    }

    if (filtres.vehicule && c.vehiculeId !== filtres.vehicule) return false;

    if (filtres.statut) {
      const hasAno = Object.values(c.resultats || {}).some(r => r.statut === 'anomalie');
      if (filtres.statut === 'anomalie' && !hasAno) return false;
      if (filtres.statut === 'ok' && hasAno) return false;
    }

    if (filtres.date && c.date) {
      if (c.date.toDate().toISOString().split('T')[0] !== filtres.date) return false;
    }

    return true;
  });

  liste.innerHTML = filtrés.length === 0
    ? '<p class="loading">Aucun check-up trouvé.</p>'
    : '';

  filtrés.forEach(checkup => {
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

    liste.appendChild(card);
  });
}

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
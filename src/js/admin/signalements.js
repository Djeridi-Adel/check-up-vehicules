import { db } from '../firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function ecouterSignalements(onMiseAJour) {
  const q = query(
    collection(db, 'signalements'),
    orderBy('date', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const signalements = [];
    snapshot.forEach(doc => signalements.push({ id: doc.id, ...doc.data() }));
    onMiseAJour(signalements);
  });
}

export function afficherSignalements(signalements) {
  const liste = document.getElementById('signalements-liste');

  if (signalements.length === 0) {
    liste.innerHTML = '<p class="loading">Aucun signalement.</p>';
    return;
  }

  liste.innerHTML = '';

  signalements.forEach(s => {
    const date = s.date
      ? s.date.toDate().toLocaleString('fr-FR')
      : 'Date inconnue';

    const badgeClass = s.typeIncident || 'autre';
    const badgeLabel = {
      panne:    '🔧 Panne',
      accident: '💥 Accident',
      autre:    '❗ Autre'
    }[s.typeIncident] || '❗ Autre';

    const card = document.createElement('div');
    card.className = 'signalement-card';
    card.innerHTML = `
      card.innerHTML = `
  <div class="signalement-card-header">
    <div>
      <h3>${s.vehiculeNom} — ${s.immatriculation}</h3>
      <p class="checkup-meta">${date} — ${s.agentMail || 'Agent inconnu'}</p>
    </div>
    <div class="card-actions">
      <span class="signalement-badge ${badgeClass}">${badgeLabel}</span>
      <button class="btn-suppr-card" data-id="${s.id}" title="Supprimer ce signalement">🗑️</button>
    </div>
  </div>
  <div class="signalement-card-body" id="sbody-${s.id}">
    ${genererDetailSignalement(s)}
  </div>
`;

card.querySelector('.signalement-card-header').addEventListener('click', (e) => {
  if (e.target.closest('.btn-suppr-card')) return;
  document.getElementById(`sbody-${s.id}`).classList.toggle('visible');
});

card.querySelector('.btn-suppr-card').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!confirm('Supprimer ce signalement définitivement ?')) return;
  try {
    await deleteDoc(doc(db, 'signalements', s.id));
  } catch (error) {
    alert('Erreur lors de la suppression.');
    console.error(error);
  }
});

    card.querySelector('.signalement-card-header').addEventListener('click', () => {
      document.getElementById(`sbody-${s.id}`).classList.toggle('visible');
    });

    liste.appendChild(card);
  });
}

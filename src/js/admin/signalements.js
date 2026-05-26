import { db } from '../firebase.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot
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
      <div class="signalement-card-header">
        <div>
          <h3>${s.vehiculeNom} — ${s.immatriculation}</h3>
          <p class="checkup-meta">${date} — ${s.agentMail || 'Agent inconnu'}</p>
        </div>
        <span class="signalement-badge ${badgeClass}">${badgeLabel}</span>
      </div>
      <div class="signalement-card-body" id="sbody-${s.id}">
        ${s.lieu ? `
          <div class="signalement-detail-row">
            <span class="signalement-detail-label">Lieu</span>
            <span>${s.lieu}</span>
          </div>` : ''}
        ${s.description ? `
          <div class="signalement-detail-row">
            <span class="signalement-detail-label">Description</span>
            <span>${s.description}</span>
          </div>` : ''}
        ${s.photoUrl ? `
          <div class="signalement-detail-row">
            <span class="signalement-detail-label">Photo</span>
            <a href="${s.photoUrl}" target="_blank" class="photo-link">
              <img src="${s.photoUrl}" class="photo-thumb" alt="Photo incident">
              <span>Voir la photo</span>
            </a>
          </div>` : ''}
        ${!s.lieu && !s.description && !s.photoUrl
          ? '<p style="padding: 8px 0; color: var(--text-secondary); font-size: 0.85rem;">Aucun détail fourni.</p>'
          : ''}
      </div>
    `;

    card.querySelector('.signalement-card-header').addEventListener('click', () => {
      document.getElementById(`sbody-${s.id}`).classList.toggle('visible');
    });

    liste.appendChild(card);
  });
}

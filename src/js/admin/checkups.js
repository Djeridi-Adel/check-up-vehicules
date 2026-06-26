import { db } from '../firebase.js';
import { getAnomalieActive, marquePrisEnCompte, marquerAstechDemande } from '../anomalies.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export function ecouterCheckups(onMiseAJour) {
  const q = query(
    collection(db, 'checkups'),
    orderBy('date', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const checkups = [];
    snapshot.forEach(d => checkups.push({ id: d.id, ...d.data() }));
    onMiseAJour(checkups);
  });
}

export function afficherCheckups(tousLesCheckups, filtreActif, filtres) {
  const liste       = document.getElementById('checkups-liste');
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
          <p class="checkup-meta">${checkup.agentMail || 'Agent non identifié'}</p>
        </div>
        <div class="card-actions">
          <span class="checkup-badge ${hasAnomalie ? 'anomalie' : 'ok'}">
            ${hasAnomalie ? '⚠️ Anomalie' : '✓ OK'}
          </span>
          <button class="btn-suppr-card" data-id="${checkup.id}" title="Supprimer ce check-up">🗑️</button>
        </div>
      </div>
      <div class="checkup-card-body" id="body-${checkup.id}">
        ${genererDetailCheckup(checkup.resultats, checkup.vehiculeId)}
      </div>
    `;

    card.querySelector('.checkup-card-header').addEventListener('click', (e) => {
      if (e.target.closest('.btn-suppr-card')) return;
      document.getElementById(`body-${checkup.id}`).classList.toggle('visible');
    });

    card.querySelector('.btn-suppr-card').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Supprimer ce check-up définitivement ?')) return;
      try {
        await deleteDoc(doc(db, 'checkups', checkup.id));
      } catch (error) {
        alert('Erreur lors de la suppression.');
        console.error(error);
      }
    });

    // Boutons actions anomalie
card.querySelectorAll('.btn-action-anomalie').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const point      = btn.dataset.point;
    const vehiculeId = checkup.vehiculeId;

    try {
      const anomalie = await getAnomalieActive(vehiculeId, point);
      if (!anomalie) {
        alert('Anomalie introuvable.');
        return;
      }

      // Désactive tous les boutons de ce point
      const groupeBtns = btn.closest('.btn-actions-anomalie').querySelectorAll('.btn-action-anomalie');
      groupeBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.4'; });
      btn.style.opacity = '1';

      if (btn.classList.contains('btn-pris-en-compte')) {
        await marquerPrisEnCompte(anomalie.id);
        btn.textContent = '👀 Pris en compte ✓';
        btn.style.background = '#fff3e0';
        btn.style.color = '#e65100';
      }

      if (btn.classList.contains('btn-astech')) {
        await marquerAstechDemande(anomalie.id);
        btn.textContent = '🔧 Demande faite ✓';
        btn.style.background = '#fffde7';
        btn.style.color = '#f57f17';
      }

      if (btn.classList.contains('btn-resoudre')) {
        await updateDoc(doc(db, 'anomalies', anomalie.id), {
          statut: 'marquee_resolue',
          dateResolution: new Date()
        });
        btn.textContent = '✅ Résolu — attente confirmation agent';
        btn.style.background = '#e6f4ea';
        btn.style.color = 'var(--success)';
      }

    } catch (error) {
      alert('Erreur lors de la mise à jour.');
      console.error(error);
      btn.disabled    = false;
      btn.style.opacity = '1';
    }
  });
});

    liste.appendChild(card);
  });
}

// ============================================
// DÉTAIL CHECK-UP AVEC BOUTON RÉSOUDRE
// ============================================
function genererDetailCheckup(resultats, vehiculeId) {
  if (!resultats) return '<p>Aucun détail disponible.</p>';

  return Object.entries(resultats).map(([point, data]) => `
    <div class="checkpoint-result ${data.statut === 'anomalie' ? 'has-anomalie' : ''}">
      <div class="checkpoint-result-info">
        <div class="checkpoint-result-label">${point}</div>
        ${data.detail ? `<div class="detail-text">${data.detail}</div>` : ''}
        ${data.photoUrl ? `
          <a href="${data.photoUrl}" target="_blank" class="photo-link">
            <img src="${data.photoUrl}" class="photo-thumb" alt="Photo anomalie">
            <span>Voir la photo</span>
          </a>` : ''}
        ${data.statut === 'anomalie' ? `
          <div class="btn-actions-anomalie">
            <button class="btn-action-anomalie btn-pris-en-compte" data-point="${point}">
              👀 Pris en compte
            </button>
            <button class="btn-action-anomalie btn-astech" data-point="${point}">
              🔧 Demande atelier
            </button>
            <button class="btn-action-anomalie btn-resoudre" data-point="${point}">
              ✅ Résolu
            </button>
          </div>` : ''}
      </div>
      <span class="statut-${data.statut}">
        ${data.statut === 'ok' ? '✓ OK' : '⚠️'}
      </span>
    </div>
  `).join('');
}
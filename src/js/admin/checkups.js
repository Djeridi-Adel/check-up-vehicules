import { db } from '../firebase.js';
import { getAnomalieActive, marquerPrisEnCompte, marquerAstechDemande, photosDe } from '../anomalies.js';
import { trouverVehiculeParc, importerUnVehicule, ajouterIntervention, listerInterventions, dateVersISO } from '../parc.js';
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

    // Boutons "Reporter sur la fiche du véhicule"
    card.querySelectorAll('.btn-reporter').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const point = btn.dataset.point;
        const data  = checkup.resultats?.[point] || {};

        btn.disabled = true;
        try {
          // 1. Fiche du véhicule dans le parc
          let fiche = await trouverVehiculeParc(checkup.vehiculeId);
          if (!fiche) {
            if (!confirm(`« ${checkup.vehiculeNom} » n'a pas encore de fiche dans le parc.\nL'ajouter maintenant ?`)) return;
            fiche = await importerUnVehicule(checkup.vehiculeId);
            if (!fiche) {
              alert('Véhicule introuvable dans le check-up.');
              return;
            }
          }

          // 2. Déjà reporté depuis ce check-up ?
          const existantes = await listerInterventions(fiche.id);
          const exacte = existantes.find(i => i.sourceCheckupId === checkup.id && i.sourcePoint === point);
          if (exacte) {
            remplacerParLien(btn, fiche.id, '✅ Déjà reporté — ouvrir la fiche');
            return;
          }

          // 3. Même point déjà en panne sur la fiche (anomalie qui revient chaque matin) ?
          const enCours = existantes.find(i => i.nature === 'panne' && !i.reparee && i.sourcePoint === point);
          if (enCours) {
            const depuis = enCours.date.split('-').reverse().join('/');
            if (!confirm(`Une panne « ${point} » est déjà en cours sur la fiche (déclarée le ${depuis}).\nReporter quand même ?`)) return;
          }

          // 4. Description proposée, modifiable
          const defaut      = `${point}${data.detail ? ' — ' + data.detail : ''}`;
          const description = prompt(`Description à reporter sur la fiche de « ${fiche.nom} » (modifiable) :`, defaut);
          if (description === null) return;
          if (!description.trim()) {
            alert('La description ne peut pas être vide.');
            return;
          }
          // 5. Création de la panne, datée du jour du check-up
          const dateCheckup = checkup.date ? checkup.date.toDate() : new Date();

          await ajouterIntervention({
            type: 'vehicule',
            objetId: fiche.id,
            nature: 'panne',
            date: dateVersISO(dateCheckup),
            description: description.trim(),
            extra: {
              sourceCheckupId: checkup.id,
              sourcePoint: point,
              heure: dateCheckup.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              photoUrls: photosDe(data)
            }
          });
                    remplacerParLien(btn, fiche.id, '✅ Reporté — ouvrir la fiche');

        } catch (err) {
          console.error(err);
          alert('Erreur lors du report sur la fiche.');
        } finally {
          if (btn.isConnected) btn.disabled = false;
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
                ${photosDe(data).length > 0 ? `
          <div class="photo-galerie">
            ${photosDe(data).map((url, i) => `
              <a href="${url}" target="_blank" class="photo-link" title="Ouvrir la photo ${i + 1}">
                <img src="${url}" class="photo-thumb" alt="Photo ${i + 1}">
              </a>`).join('')}
          </div>` : ''}
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
            <button type="button" class="btn-reporter" data-point="${point}">
              ➡️ Reporter sur la fiche
            </button>
          </div>` : ''}
      </div>
      <span class="statut-${data.statut}">
        ${data.statut === 'ok' ? '✓ OK' : '⚠️'}
      </span>
    </div>
  `).join('');
}

// Remplace le bouton "Reporter" par un lien vers la fiche une fois la panne reportée
function remplacerParLien(btn, ficheId, texte) {
  const lien = document.createElement('a');
  lien.className   = 'btn-reporter reporte';
  lien.href        = `admin-parc-fiche.html?type=vehicule&id=${ficheId}`;
  lien.textContent = texte;
  lien.addEventListener('click', (e) => e.stopPropagation());
  btn.replaceWith(lien);
}
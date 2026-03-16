import { db } from '../firebase.js';
import {
  collection,
  getDocs,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export let tousLesVehicules = [];

export async function chargerVehiculesFiltres() {
  const snapshot = await getDocs(collection(db, 'vehicules'));
  tousLesVehicules = [];

  document.getElementById('stat-vehicules').textContent = snapshot.size;
  const filtreVehicule = document.getElementById('filtre-vehicule');
  filtreVehicule.innerHTML = '<option value="">Tous les véhicules</option>';

  snapshot.forEach(d => {
    tousLesVehicules.push({ id: d.id, ...d.data() });
    const o       = document.createElement('option');
    o.value       = d.id;
    o.textContent = d.data().nom;
    filtreVehicule.appendChild(o);
  });

  return tousLesVehicules;
}

export async function chargerFlotte(onEditer) {
  const liste = document.getElementById('liste-flotte');
  liste.innerHTML = '<p class="loading">Chargement...</p>';

  const snapshot = await getDocs(collection(db, 'vehicules'));
  tousLesVehicules = [];
  snapshot.forEach(d => tousLesVehicules.push({ id: d.id, ...d.data() }));

  if (tousLesVehicules.length === 0) {
    liste.innerHTML = '<p class="loading">Aucun véhicule dans la flotte.</p>';
    return;
  }

  liste.innerHTML = '';

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

    card.querySelector('.btn-edit').addEventListener('click', () => onEditer(v.id));
    card.querySelector('.btn-delete').addEventListener('click', () => supprimerVehicule(v.id, v.nom, onEditer));

    liste.appendChild(card);
  });
}

async function supprimerVehicule(id, nom, onEditer) {
  if (!confirm(`Supprimer "${nom}" de la flotte ? Cette action est irréversible.`)) return;

  try {
    await deleteDoc(doc(db, 'vehicules', id));
    chargerFlotte(onEditer);
    const stat = document.getElementById('stat-vehicules');
    stat.textContent = parseInt(stat.textContent) - 1;
  } catch (error) {
    alert('Erreur lors de la suppression.');
    console.error(error);
  }
}
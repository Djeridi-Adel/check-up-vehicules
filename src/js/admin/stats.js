export function mettreAJourStats(tousLesCheckups) {
  const aujourd_hui = new Date();
  aujourd_hui.setHours(0, 0, 0, 0);

  let countToday     = 0;
  let countAnomalies = 0;

  tousLesCheckups.forEach(checkup => {
    if (checkup.date && checkup.date.toDate() >= aujourd_hui) countToday++;
    if (Object.values(checkup.resultats || {}).some(r => r.statut === 'anomalie')) countAnomalies++;
  });

  document.getElementById('stat-today').textContent     = countToday;
  document.getElementById('stat-anomalies').textContent = countAnomalies;
}

export function initFiltres(onFiltre) {
  const filtreVehicule = document.getElementById('filtre-vehicule');
  const filtreStatut   = document.getElementById('filtre-statut');
  const filtreDate     = document.getElementById('filtre-date');

  filtreDate.value = new Date().toISOString().split('T')[0];

  [filtreVehicule, filtreStatut, filtreDate].forEach(f => {
    f.addEventListener('change', () => onFiltre());
  });
}

export function initStatCards(onCardClick) {
  document.querySelectorAll('.stat-card').forEach(card => {
    card.addEventListener('click', () => onCardClick(card.dataset.filtre, card));
  });
}

export function getFiltresValeurs() {
  return {
    vehicule: document.getElementById('filtre-vehicule').value,
    statut:   document.getElementById('filtre-statut').value,
    date:     document.getElementById('filtre-date').value,
  };
}
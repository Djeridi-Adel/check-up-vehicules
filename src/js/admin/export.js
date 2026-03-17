export function initExport(getTousLesCheckups) {
  document.getElementById('btn-export').addEventListener('click', () => {
    const checkups = getTousLesCheckups();

    if (checkups.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    const lignes = ['Date,Véhicule,Immatriculation,Point de contrôle,Statut,Détail,Photo'];

    checkups.forEach(c => {
      const date = c.date ? c.date.toDate().toLocaleString('fr-FR') : '';
      Object.entries(c.resultats || {}).forEach(([point, data]) => {
        lignes.push([
          `"${date}"`,
          `"${c.vehiculeNom}"`,
          `"${c.immatriculation}"`,
          `"${point}"`,
          `"${data.statut}"`,
          `"${data.detail || ''}"`,
          `"${data.photoUrl || ''}"`
        ].join(','));
      });
    });

    const csv  = lignes.join('\n');
    const BOM  = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `checkups-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
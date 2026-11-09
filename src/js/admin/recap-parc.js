// src/js/admin/recap-parc.js
// Récap annuel : jours d'immobilisation, pannes déclarées / réparées et délai moyen
// de réparation, pour les véhicules et les cellules sanitaires. Export Excel.

import {
  listerObjets,
  listerToutesInterventions,
  joursImmobilises,
  joursEntre,
  aujourdhuiISO
} from "../parc.js";

let donnees      = { vehicule: [], cellule: [], interventions: [] };
let anneeChoisie = new Date().getFullYear();

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function nombre(n) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
}

function moyenne(valeurs) {
  return valeurs.length ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : null;
}

function texteDelai(n) {
  return n === null ? "—" : `${nombre(n)} j`;
}

// ============================================
// CALCULS
// ============================================

// Nombre de périodes d'immobilisation qui touchent l'année
function periodesDansAnnee(objet, annee) {
  const debutAnnee = `${annee}-01-01`;
  const finAnnee   = `${annee}-12-31`;
  const aujourdhui = aujourdhuiISO();
  return (objet.immobilisations || []).filter(
    (p) => p.debut <= finAnnee && (p.fin || aujourdhui) >= debutAnnee
  ).length;
}

function calculerObjet(type, objet, annee) {
  const prefixe  = String(annee);
  const pannes   = donnees.interventions.filter(
    (i) => i.objetId === objet.id && i.nature === "panne" && (i.date || "").startsWith(prefixe)
  );
  const reparees = pannes.filter((i) => i.reparee && i.dateReparation);

  return {
    categorie: type === "vehicule" ? "Véhicule" : "Cellule",
    nom: objet.nom || "",
    reference: objet.immatriculation || objet.adresse || "",
    jours: joursImmobilises(objet, annee),
    immobilisations: periodesDansAnnee(objet, annee),
    pannes: pannes.length,
    reparees: reparees.length,
    delais: reparees.map((i) => joursEntre(i.date, i.dateReparation) - 1)
  };
}

function agreger(lignes) {
  const somme = (cle) => lignes.reduce((t, l) => t + l[cle], 0);
  return {
    jours: somme("jours"),
    immobilisations: somme("immobilisations"),
    pannes: somme("pannes"),
    reparees: somme("reparees"),
    delaiMoyen: moyenne(lignes.flatMap((l) => l.delais))
  };
}

function calculer() {
  const trier = (lignes) =>
    lignes.sort((a, b) => b.jours - a.jours || a.nom.localeCompare(b.nom));

  const lignesV = trier(donnees.vehicule.map((o) => calculerObjet("vehicule", o, anneeChoisie)));
  const lignesC = trier(donnees.cellule.map((o) => calculerObjet("cellule", o, anneeChoisie)));
  return { lignesV, lignesC, total: agreger([...lignesV, ...lignesC]) };
}

// ============================================
// ANNÉES DISPONIBLES
// ============================================
function anneesDisponibles() {
  const annees = [new Date().getFullYear()];
  const ajouter = (iso) => {
    const a = Number((iso || "").slice(0, 4));
    if (a) annees.push(a);
  };

  [...donnees.vehicule, ...donnees.cellule].forEach((o) =>
    (o.immobilisations || []).forEach((p) => { ajouter(p.debut); ajouter(p.fin); })
  );
  donnees.interventions.forEach((i) => { ajouter(i.date); ajouter(i.dateReparation); });

  const liste = [];
  for (let a = Math.max(...annees); a >= Math.min(...annees); a--) liste.push(a);
  return liste;
}

function remplirAnnees() {
  const select = document.getElementById("recap-annee");
  const annees = anneesDisponibles();
  if (!annees.includes(anneeChoisie)) anneeChoisie = annees[0];
  select.innerHTML = annees
    .map((a) => `<option value="${a}"${a === anneeChoisie ? " selected" : ""}>${a}</option>`)
    .join("");
}

// ============================================
// AFFICHAGE
// ============================================
function tableau(titre, lignes) {
  if (lignes.length === 0) {
    return `<h3 class="recap-titre">${titre}</h3><p class="fiche-vide">Aucun élément.</p>`;
  }

  const t = agreger(lignes);
  const rows = lignes.map((l) => `
    <tr>
      <td><strong>${esc(l.nom)}</strong>${l.reference ? `<br><span class="recap-ref">${esc(l.reference)}</span>` : ""}</td>
      <td class="num">${l.jours}</td>
      <td class="num">${l.immobilisations}</td>
      <td class="num">${l.pannes}</td>
      <td class="num">${l.reparees}</td>
      <td class="num">${texteDelai(moyenne(l.delais))}</td>
    </tr>`).join("");

  return `
    <h3 class="recap-titre">${titre}</h3>
    <div class="recap-table-wrap">
      <table class="recap-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th class="num">Jours immobilisé</th>
            <th class="num">Immobilisations</th>
            <th class="num">Pannes</th>
            <th class="num">Réparées</th>
            <th class="num">Délai moyen</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="num">${t.jours}</td>
            <td class="num">${t.immobilisations}</td>
            <td class="num">${t.pannes}</td>
            <td class="num">${t.reparees}</td>
            <td class="num">${texteDelai(t.delaiMoyen)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function rendre() {
  const conteneur = document.getElementById("recap-contenu");
  const { lignesV, lignesC, total } = calculer();

  conteneur.innerHTML = `
    <div class="fiche-stats">
      <div class="fiche-stat"><span class="fiche-stat-n">${total.jours}</span><span>${total.jours > 1 ? "jours" : "jour"} d'immobilisation</span></div>
      <div class="fiche-stat"><span class="fiche-stat-n">${total.pannes}</span><span>${total.pannes > 1 ? "pannes déclarées" : "panne déclarée"}</span></div>
      <div class="fiche-stat"><span class="fiche-stat-n">${total.reparees}</span><span>${total.reparees > 1 ? "pannes réparées" : "panne réparée"}</span></div>
      <div class="fiche-stat"><span class="fiche-stat-n">${texteDelai(total.delaiMoyen)}</span><span>délai moyen de réparation</span></div>
    </div>
    ${tableau("🚛 Véhicules", lignesV)}
    ${tableau("🚻 Cellules sanitaires", lignesC)}
    <p class="recap-note">
      Les jours d'immobilisation comptent le jour de début et le jour de remise en service ;
      une immobilisation en cours est comptée jusqu'à aujourd'hui.
      Les pannes sont rattachées à l'année de leur déclaration.
      Le délai de réparation va de la date de la panne à sa date de réparation (0 j = réparée le jour même).
    </p>`;
}

// ============================================
// EXPORT EXCEL
// ============================================
function feuille(lignes, largeurs) {
  const ws = XLSX.utils.aoa_to_sheet(lignes);
  ws["!cols"] = largeurs.map((wch) => ({ wch }));
  return ws;
}

function exporter() {
  if (typeof XLSX === "undefined") {
    alert("La bibliothèque d'export Excel n'a pas pu se charger. Vérifiez votre connexion et réessayez.");
    return;
  }

  const { lignesV, lignesC, total } = calculer();
  const arrondi = (n) => (n === null ? "" : Math.round(n * 10) / 10);

  // Feuille 1 : récap par objet
  const recap = [[
    "Catégorie", "Nom", "Immatriculation / adresse",
    "Jours d'immobilisation", "Immobilisations", "Pannes déclarées", "Pannes réparées",
    "Délai moyen de réparation (jours)"
  ]];
  [...lignesV, ...lignesC].forEach((l) => {
    recap.push([l.categorie, l.nom, l.reference, l.jours, l.immobilisations, l.pannes, l.reparees, arrondi(moyenne(l.delais))]);
  });
  recap.push(["TOTAL", "", "", total.jours, total.immobilisations, total.pannes, total.reparees, arrondi(total.delaiMoyen)]);

  // Feuille 2 : détail des pannes et réparations de l'année
  const index = new Map();
  donnees.vehicule.forEach((o) => index.set(o.id, { categorie: "Véhicule", nom: o.nom }));
  donnees.cellule.forEach((o) => index.set(o.id, { categorie: "Cellule", nom: o.nom }));

  const prefixe = String(anneeChoisie);
  const detail = [[
    "Catégorie", "Objet", "Type", "Date", "Description",
    "Date de réparation", "Délai de réparation (jours)", "Détail de la réparation"
  ]];
  donnees.interventions
    .filter((i) => (i.date || "").startsWith(prefixe) && index.has(i.objetId))
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((i) => {
      const ref    = index.get(i.objetId);
      const repare = i.nature === "panne" && i.reparee && i.dateReparation;

      let type = "Réparation";
      if (i.nature === "panne") type = repare ? "Panne réparée" : "Panne en cours";

      detail.push([
        ref.categorie,
        ref.nom,
        type,
        fmtDate(i.date),
        i.description || "",
        repare ? fmtDate(i.dateReparation) : "",
        repare ? joursEntre(i.date, i.dateReparation) - 1 : "",
        repare ? (i.noteReparation || "") : ""
      ]);
    });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, feuille(recap, [12, 28, 26, 20, 16, 16, 16, 30]), `Récap ${anneeChoisie}`);
  XLSX.utils.book_append_sheet(wb, feuille(detail, [12, 28, 16, 12, 44, 18, 24, 36]), `Pannes ${anneeChoisie}`);
  XLSX.writeFile(wb, `recap-parc-${anneeChoisie}.xlsx`);
}

// ============================================
// CHARGEMENT ET INITIALISATION
// ============================================
export async function chargerRecapParc() {
  const conteneur = document.getElementById("recap-contenu");
  conteneur.innerHTML = '<p class="loading">Chargement...</p>';
  try {
    const [vehicules, cellules, interventions] = await Promise.all([
      listerObjets("vehicule"),
      listerObjets("cellule"),
      listerToutesInterventions()
    ]);
    donnees = { vehicule: vehicules, cellule: cellules, interventions };
    remplirAnnees();
    rendre();
  } catch (e) {
    console.error(e);
    conteneur.innerHTML = '<p class="loading">Erreur de chargement.</p>';
  }
}

export function initRecapParc() {
  document.getElementById("recap-annee").addEventListener("change", (e) => {
    anneeChoisie = Number(e.target.value);
    rendre();
  });
  document.getElementById("recap-actualiser").addEventListener("click", chargerRecapParc);
  document.getElementById("recap-excel").addEventListener("click", exporter);
}
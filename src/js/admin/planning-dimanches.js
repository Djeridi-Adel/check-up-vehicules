// src/js/admin/planning-dimanches.js
// UI du planning des dimanches travaillés (heures supplémentaires).
// Page admin autonome : src/pages/admin-planning-dimanches.html

import {
  listerCompetences, creerCompetence, supprimerCompetence,
  listerPostes, creerPoste, modifierPoste, supprimerPoste,
  listerAgents, creerAgent, modifierAgent, supprimerAgent,
  listerDimanches, assurerDimanche, sauvegarderDimanche, supprimerDimanche,
  obtenirPeriode, sauvegarderPeriode,
  assurerDonneesParDefaut
} from "../planning-dimanches.js";

// ---------- état local (miroir de Firestore, tenu à jour après chaque écriture) ----------
let state = { competences: [], postes: [], agents: [], periode: { debut: "", fin: "" }, dimanches: {} };
let currentTab = "agents";
let currentAvailAgent = null;
let saveTimers = {};

// ---------- dates ----------
function parseISO(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function toISO(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function addDays(iso, n) { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
function fmtLong(iso) { if (!iso) return ""; return parseISO(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }); }
function fmtShort(iso) { if (!iso) return ""; return parseISO(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }); }
function getSundaysInRange(startIso, endIso) {
  if (!startIso || !endIso) return [];
  const out = []; let cur = parseISO(startIso); const end = parseISO(endIso);
  while (cur <= end) { if (cur.getDay() === 0) out.push(toISO(cur)); cur.setDate(cur.getDate() + 1); }
  return out;
}
function getRelevantSaturdays() {
  const dates = Object.keys(state.dimanches);
  if (dates.length === 0) return [];
  const set = new Set();
  dates.forEach((sun) => { set.add(addDays(sun, -1)); set.add(addDays(sun, 6)); });
  return Array.from(set).sort();
}

// ---------- helpers état ----------
function agentObj(id) { return state.agents.find((a) => a.id === id); }
function agentLabel(id) { const a = agentObj(id); return a ? a.initiales : "(supprimé)"; }
function competenceNom(id) { const c = state.competences.find((c) => c.id === id); return c ? c.nom : ""; }
function posteObj(id) { return state.postes.find((p) => p.id === id); }
function totalAffecteCount(agentId) {
  return Object.values(state.dimanches).filter((s) => Object.values(s.affectations || {}).includes(agentId)).length;
}
function affectesCeDimanche(dateISO) {
  const s = state.dimanches[dateISO];
  return new Set(Object.values(s.affectations || {}).filter(Boolean));
}

// ---------- éligibilité ----------
function estEnConges(agent, dateISO) {
  // Périodes de congés (nouveau modèle)
  const enPeriode = (agent.conges || []).some((p) => dateISO >= p.debut && dateISO <= p.fin);
  if (enPeriode) return true;
  // Compatibilité avec l'ancien modèle (dimanches cochés un par un)
  return (agent.vacances || []).includes(dateISO);
}
function checkBaseEligibilite(agentId, dateISO) {
  const raisons = [];
  const agent = agentObj(agentId);
  if (!agent) return raisons;
  if (estEnConges(agent, dateISO)) raisons.push("en congés cette semaine");
  const satAvant = addDays(dateISO, -1);
  const satApres = addDays(dateISO, 6);
  const travailles = agent.samedisTravailles || [];
  if (travailles.includes(satAvant)) raisons.push(`travaille le samedi précédent (${fmtShort(satAvant)})`);
  if (travailles.includes(satApres)) raisons.push(`travaille le samedi suivant (${fmtShort(satApres)})`);
  return raisons;
}
function checkPosteEligibilite(agentId, dateISO, poste) {
  const raisons = checkBaseEligibilite(agentId, dateISO);
  const agent = agentObj(agentId);
  if (poste.competenceId && agent && !(agent.competences || []).includes(poste.competenceId)) {
    raisons.push("compétence manquante : " + competenceNom(poste.competenceId));
  }
  if (agent && (agent.restrictions || []).includes(poste.id)) raisons.push("restriction sur ce poste");
  return { eligible: raisons.length === 0, raisons };
}

// ---------- sauvegarde différée (regroupe les clics rapprochés) ----------
function debouncedSaveAgent(agent) {
  const key = "agent:" + agent.id;
  clearTimeout(saveTimers[key]);
  setSaveStatus("saving");
  saveTimers[key] = setTimeout(async () => {
    try {
      await modifierAgent(agent.id, {
        competences: agent.competences,
        restrictions: agent.restrictions,
        conges: agent.conges,
        samedisTravailles: agent.samedisTravailles
      });
      setSaveStatus("saved");
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
    }
  }, 400);
}
function debouncedSaveDimanche(dateISO) {
  const key = "dimanche:" + dateISO;
  clearTimeout(saveTimers[key]);
  setSaveStatus("saving");
  saveTimers[key] = setTimeout(async () => {
    try {
      await sauvegarderDimanche(dateISO, state.dimanches[dateISO]);
      setSaveStatus("saved");
    } catch (e) {
      console.error(e);
      setSaveStatus("error");
    }
  }, 400);
}
function setSaveStatus(status) {
  const dot = document.getElementById("pd-save-dot");
  const label = document.getElementById("pd-save-label");
  if (!dot) return;
  if (status === "saving") { dot.className = "pd-save-dot saving"; label.textContent = "enregistrement…"; }
  else if (status === "saved") { dot.className = "pd-save-dot"; label.textContent = "à jour"; }
  else { dot.className = "pd-save-dot error"; label.textContent = "échec de l'enregistrement"; }
}

function render() {
  renderTabs();
  const el = document.getElementById("pd-tab-content");
  el.innerHTML = "";
  if (currentTab === "agents") el.appendChild(renderAgentsTab());
  else if (currentTab === "postes") el.appendChild(renderPostesTab());
  else if (currentTab === "profils") el.appendChild(renderProfilsTab());
  else if (currentTab === "planning") el.appendChild(renderPlanningTab());
  else if (currentTab === "equite") el.appendChild(renderEquiteTab());
}

const TABS = [
  { id: "agents", label: "Agents" },
  { id: "postes", label: "Postes & compétences" },
  { id: "profils", label: "Profils agents" },
  { id: "planning", label: "Planning" },
  { id: "equite", label: "Équité" }
];

function renderTabs() {
  const nav = document.getElementById("pd-tabs");
  nav.innerHTML = "";
  const incomplet = Object.keys(state.dimanches).filter((sun) => {
    const s = state.dimanches[sun];
    const actifs = state.postes.filter((p) => !(s.postesDesactives || []).includes(p.id));
    return actifs.some((p) => !(s.affectations || {})[p.id]);
  }).length;
  TABS.forEach((t) => {
    const btn = document.createElement("button");
    btn.textContent = t.label;
    btn.className = "pd-tab-btn" + (t.id === currentTab ? " active" : "");
    if (t.id === "planning" && incomplet > 0) {
      const b = document.createElement("span");
      b.className = "pd-badge"; b.textContent = incomplet;
      btn.appendChild(b);
    }
    btn.addEventListener("click", () => { currentTab = t.id; render(); });
    nav.appendChild(btn);
  });
}

// ---------- Agents ----------
function renderAgentsTab() {
  const wrap = document.createElement("div");
  const panel = document.createElement("div"); panel.className = "pd-panel";
  panel.innerHTML = `<h2>Équipe</h2><p class="pd-sub">Identifiez chaque agent par ses initiales ou un surnom — aucun nom complet n'est stocké. Compétences et restrictions se règlent dans l'onglet « Profils agents ».</p>`;

  const addRow = document.createElement("div"); addRow.className = "pd-add-row";
  const input = document.createElement("input"); input.type = "text"; input.placeholder = "Initiales ou surnom (ex : J.D.)";
  const addBtn = document.createElement("button"); addBtn.className = "btn-primary"; addBtn.textContent = "Ajouter";
  async function doAdd() {
    const initiales = input.value.trim();
    if (!initiales) return;
    addBtn.disabled = true;
    try {
      const id = await creerAgent(initiales);
      state.agents.push({ id, initiales, competences: [], restrictions: [], vacances: [], samedisTravailles: [] });
      state.agents.sort((a, b) => a.initiales.localeCompare(b.initiales));
      input.value = "";
      render();
    } catch (e) { console.error(e); alert("Erreur lors de l'ajout de l'agent."); }
    finally { addBtn.disabled = false; }
  }
  addBtn.addEventListener("click", doAdd);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); });
  addRow.appendChild(input); addRow.appendChild(addBtn);
  panel.appendChild(addRow);

  if (state.agents.length === 0) {
    const empty = document.createElement("div"); empty.className = "pd-empty";
    empty.textContent = "Aucun agent pour le moment. Ajoutez le premier ci-dessus.";
    panel.appendChild(empty);
  } else {
    const list = document.createElement("div"); list.className = "pd-agent-list";
    state.agents.forEach((a) => {
      const row = document.createElement("div"); row.className = "pd-agent-row";
      const left = document.createElement("div"); left.className = "pd-agent-name";
      const nameSpan = document.createElement("span"); nameSpan.textContent = a.initiales; nameSpan.style.fontWeight = "700";
      left.appendChild(nameSpan);
      const c = totalAffecteCount(a.id);
      const count = document.createElement("span"); count.className = "pd-agent-count";
      count.textContent = `${c} dimanche${c > 1 ? "s" : ""}`;
      left.appendChild(count);
      (a.competences || []).forEach((cid) => { const t = document.createElement("span"); t.className = "pd-tag-mini"; t.textContent = competenceNom(cid); left.appendChild(t); });
      (a.restrictions || []).forEach((pid) => { const p = posteObj(pid); if (!p) return; const t = document.createElement("span"); t.className = "pd-tag-mini restr"; t.textContent = "pas " + p.nom; left.appendChild(t); });

      const right = document.createElement("div"); right.className = "pd-row";
      const delBtn = document.createElement("button"); delBtn.className = "btn-secondary pd-danger"; delBtn.textContent = "Supprimer";
      delBtn.addEventListener("click", async () => {
        if (!confirm(`Supprimer l'agent "${a.initiales}" ? Il sera retiré de tous les dimanches.`)) return;
        try {
          await supprimerAgent(a.id);
          state.agents = state.agents.filter((x) => x.id !== a.id);
          Object.keys(state.dimanches).forEach((sun) => {
            const s = state.dimanches[sun];
            s.volontaires = (s.volontaires || []).filter((id) => id !== a.id);
            Object.keys(s.affectations || {}).forEach((pid) => { if (s.affectations[pid] === a.id) s.affectations[pid] = null; });
          });
          if (currentAvailAgent === a.id) currentAvailAgent = null;
          render();
        } catch (e) { console.error(e); alert("Erreur lors de la suppression."); }
      });
      right.appendChild(delBtn);
      row.appendChild(left); row.appendChild(right);
      list.appendChild(row);
    });
    panel.appendChild(list);
  }
  wrap.appendChild(panel);
  return wrap;
}

// ---------- Postes & compétences ----------
function renderPostesTab() {
  const wrap = document.createElement("div");

  const skillPanel = document.createElement("div"); skillPanel.className = "pd-panel";
  skillPanel.innerHTML = `<h2>Compétences</h2><p class="pd-sub">Les compétences requises pour certains postes.</p>`;
  const skillList = document.createElement("div"); skillList.className = "pd-config-list";
  state.competences.forEach((sk) => {
    const row = document.createElement("div"); row.className = "pd-config-row";
    const name = document.createElement("span"); name.textContent = sk.nom; name.style.fontWeight = "600";
    const delBtn = document.createElement("button"); delBtn.className = "btn-secondary pd-danger"; delBtn.textContent = "Supprimer";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Supprimer la compétence "${sk.nom}" ? Les postes qui l'exigent n'exigeront plus rien.`)) return;
      try {
        await supprimerCompetence(sk.id);
        state.competences = state.competences.filter((x) => x.id !== sk.id);
        for (const p of state.postes.filter((p) => p.competenceId === sk.id)) {
          p.competenceId = null;
          await modifierPoste(p.id, { competenceId: null });
        }
        state.agents.forEach((a) => { a.competences = (a.competences || []).filter((id) => id !== sk.id); });
        render();
      } catch (e) { console.error(e); alert("Erreur lors de la suppression."); }
    });
    row.appendChild(name); row.appendChild(delBtn);
    skillList.appendChild(row);
  });
  skillPanel.appendChild(skillList);
  const skillAdd = document.createElement("div"); skillAdd.className = "pd-add-row";
  const skillInput = document.createElement("input"); skillInput.type = "text"; skillInput.placeholder = "Nouvelle compétence";
  const skillAddBtn = document.createElement("button"); skillAddBtn.className = "btn-secondary"; skillAddBtn.textContent = "Ajouter";
  skillAddBtn.addEventListener("click", async () => {
    const nom = skillInput.value.trim(); if (!nom) return;
    try {
      const id = await creerCompetence(nom);
      state.competences.push({ id, nom });
      state.competences.sort((a, b) => a.nom.localeCompare(b.nom));
      skillInput.value = "";
      render();
    } catch (e) { console.error(e); alert("Erreur lors de l'ajout."); }
  });
  skillAdd.appendChild(skillInput); skillAdd.appendChild(skillAddBtn);
  skillPanel.appendChild(skillAdd);
  wrap.appendChild(skillPanel);

  const postPanel = document.createElement("div"); postPanel.className = "pd-panel";
  postPanel.innerHTML = `<h2>Postes du dimanche</h2><p class="pd-sub">Un poste à pourvoir chaque dimanche, avec la compétence requise le cas échéant.</p>`;
  const postList = document.createElement("div"); postList.className = "pd-config-list";
  state.postes.forEach((p) => {
    const row = document.createElement("div"); row.className = "pd-config-row";
    const name = document.createElement("span"); name.textContent = p.nom; name.style.fontWeight = "600";

    const select = document.createElement("select");
    const noneOpt = document.createElement("option"); noneOpt.value = ""; noneOpt.textContent = "Aucune compétence requise";
    select.appendChild(noneOpt);
    state.competences.forEach((sk) => { const o = document.createElement("option"); o.value = sk.id; o.textContent = sk.nom; if (p.competenceId === sk.id) o.selected = true; select.appendChild(o); });
    select.addEventListener("change", async () => {
      try { p.competenceId = select.value || null; await modifierPoste(p.id, { competenceId: p.competenceId }); render(); }
      catch (e) { console.error(e); alert("Erreur lors de la modification."); }
    });

    const delBtn = document.createElement("button"); delBtn.className = "btn-secondary pd-danger"; delBtn.textContent = "Supprimer";
    delBtn.addEventListener("click", async () => {
      if (!confirm(`Supprimer le poste "${p.nom}" ?`)) return;
      try {
        await supprimerPoste(p.id);
        state.postes = state.postes.filter((x) => x.id !== p.id);
        state.agents.forEach((a) => { a.restrictions = (a.restrictions || []).filter((id) => id !== p.id); });
        Object.values(state.dimanches).forEach((s) => {
          if (s.affectations) delete s.affectations[p.id];
          s.postesDesactives = (s.postesDesactives || []).filter((id) => id !== p.id);
        });
        render();
      } catch (e) { console.error(e); alert("Erreur lors de la suppression."); }
    });
    const right = document.createElement("div"); right.className = "pd-row";
    right.appendChild(select); right.appendChild(delBtn);
    row.appendChild(name); row.appendChild(right);
    postList.appendChild(row);
  });
  postPanel.appendChild(postList);

  const postAdd = document.createElement("div"); postAdd.className = "pd-add-row";
  const postInput = document.createElement("input"); postInput.type = "text"; postInput.placeholder = "Nouveau poste";
  const postSelect = document.createElement("select");
  const noneOpt2 = document.createElement("option"); noneOpt2.value = ""; noneOpt2.textContent = "Aucune compétence requise"; postSelect.appendChild(noneOpt2);
  state.competences.forEach((sk) => { const o = document.createElement("option"); o.value = sk.id; o.textContent = sk.nom; postSelect.appendChild(o); });
  const postAddBtn = document.createElement("button"); postAddBtn.className = "btn-secondary"; postAddBtn.textContent = "Ajouter";
  postAddBtn.addEventListener("click", async () => {
    const nom = postInput.value.trim(); if (!nom) return;
    try {
      const id = await creerPoste({ nom, competenceId: postSelect.value || null });
      state.postes.push({ id, nom, competenceId: postSelect.value || null });
      state.postes.sort((a, b) => a.nom.localeCompare(b.nom));
      postInput.value = "";
      render();
    } catch (e) { console.error(e); alert("Erreur lors de l'ajout."); }
  });
  postAdd.appendChild(postInput); postAdd.appendChild(postSelect); postAdd.appendChild(postAddBtn);
  postPanel.appendChild(postAdd);
  wrap.appendChild(postPanel);

  return wrap;
}

// ---------- Profils agents ----------
function renderProfilsTab() {
  const wrap = document.createElement("div");
  const panel = document.createElement("div"); panel.className = "pd-panel";
  panel.innerHTML = `<h2>Profils par agent</h2><p class="pd-sub">Compétences, restrictions, vacances et samedis travaillés : tout ce qui alimente les règles automatiques.</p>`;

  if (state.agents.length === 0) {
    const empty = document.createElement("div"); empty.className = "pd-empty";
    empty.textContent = "Ajoutez d'abord des agents dans l'onglet Agents.";
    panel.appendChild(empty); wrap.appendChild(panel); return wrap;
  }
  if (!currentAvailAgent || !agentObj(currentAvailAgent)) currentAvailAgent = state.agents[0].id;

  const layout = document.createElement("div"); layout.className = "pd-avail-layout";
  const agentsCol = document.createElement("div"); agentsCol.className = "pd-avail-agents";
  state.agents.forEach((a) => {
    const b = document.createElement("button"); b.textContent = a.initiales;
    b.className = "pd-avail-agent-btn" + (a.id === currentAvailAgent ? " active" : "");
    b.addEventListener("click", () => { currentAvailAgent = a.id; render(); });
    agentsCol.appendChild(b);
  });
  layout.appendChild(agentsCol);

  const detail = document.createElement("div"); detail.className = "pd-avail-detail";
  const agent = agentObj(currentAvailAgent);

  const skillTitle = document.createElement("div"); skillTitle.className = "pd-chip-title"; skillTitle.textContent = "Compétences";
  detail.appendChild(skillTitle);
  const skillGrid = document.createElement("div"); skillGrid.className = "pd-chip-grid";
  if (state.competences.length === 0) {
    const none = document.createElement("div"); none.className = "pd-empty-inline"; none.textContent = "Aucune compétence définie (onglet Postes & compétences).";
    skillGrid.appendChild(none);
  }
  state.competences.forEach((sk) => {
    const chip = document.createElement("span"); chip.className = "pd-chip";
    if ((agent.competences || []).includes(sk.id)) chip.classList.add("skill-on");
    chip.textContent = sk.nom;
    chip.addEventListener("click", () => {
      agent.competences = agent.competences || [];
      const idx = agent.competences.indexOf(sk.id);
      if (idx >= 0) agent.competences.splice(idx, 1); else agent.competences.push(sk.id);
      debouncedSaveAgent(agent);
      render();
    });
    skillGrid.appendChild(chip);
  });
  detail.appendChild(skillGrid);

  const restrTitle = document.createElement("div"); restrTitle.className = "pd-chip-title"; restrTitle.textContent = "Restrictions (postes interdits)";
  detail.appendChild(restrTitle);
  const restrGrid = document.createElement("div"); restrGrid.className = "pd-chip-grid";
  state.postes.forEach((p) => {
    const chip = document.createElement("span"); chip.className = "pd-chip";
    if ((agent.restrictions || []).includes(p.id)) chip.classList.add("restriction-on");
    chip.textContent = p.nom;
    chip.addEventListener("click", () => {
      agent.restrictions = agent.restrictions || [];
      const idx = agent.restrictions.indexOf(p.id);
      if (idx >= 0) agent.restrictions.splice(idx, 1); else agent.restrictions.push(p.id);
      debouncedSaveAgent(agent);
      render();
    });
    restrGrid.appendChild(chip);
  });
  detail.appendChild(restrGrid);

  const sundays = Object.keys(state.dimanches).sort();
  const saturdays = getRelevantSaturdays();

  const congesTitle = document.createElement("div"); congesTitle.className = "pd-chip-title"; congesTitle.textContent = "Congés";
  detail.appendChild(congesTitle);
  agent.conges = agent.conges || [];

  const congesForm = document.createElement("div"); congesForm.className = "pd-conges-form";
  congesForm.innerHTML = `
    <div class="pd-field"><label>Du</label><input type="date" id="pd-conges-debut"></div>
    <div class="pd-field"><label>Au</label><input type="date" id="pd-conges-fin"></div>`;
  const addCongesBtn = document.createElement("button"); addCongesBtn.className = "btn-secondary"; addCongesBtn.textContent = "Ajouter la période";
  addCongesBtn.addEventListener("click", () => {
    const debut = document.getElementById("pd-conges-debut").value;
    const fin = document.getElementById("pd-conges-fin").value;
    if (!debut || !fin || debut > fin) { alert("Indiquez une période valide (début avant fin)."); return; }
    agent.conges.push({ debut, fin });
    agent.conges.sort((a, b) => a.debut.localeCompare(b.debut));
    debouncedSaveAgent(agent);
    render();
  });
  congesForm.appendChild(addCongesBtn);
  detail.appendChild(congesForm);

  if (agent.conges.length === 0) {
    const none = document.createElement("div"); none.className = "pd-empty-inline"; none.textContent = "Aucune période de congés enregistrée.";
    detail.appendChild(none);
  } else {
    const congesList = document.createElement("div"); congesList.className = "pd-conges-list";
    agent.conges.forEach((periode, idx) => {
      const row = document.createElement("div"); row.className = "pd-conges-row";
      const label = document.createElement("span");
      label.textContent = `${fmtShort(periode.debut)} → ${fmtShort(periode.fin)}`;
      const delBtn = document.createElement("button"); delBtn.className = "pd-conges-remove"; delBtn.textContent = "✕"; delBtn.title = "Supprimer cette période";
      delBtn.addEventListener("click", () => {
        agent.conges.splice(idx, 1);
        debouncedSaveAgent(agent);
        render();
      });
      row.appendChild(label); row.appendChild(delBtn);
      congesList.appendChild(row);
    });
    detail.appendChild(congesList);
  }

  if (sundays.length === 0) {
    const none = document.createElement("div"); none.className = "pd-empty-inline"; none.textContent = "Définissez d'abord une période dans l'onglet Planning pour les samedis travaillés.";
    detail.appendChild(none);
  } else {
    const satTitle = document.createElement("div"); satTitle.className = "pd-chip-title"; satTitle.textContent = "Samedis travaillés";
    detail.appendChild(satTitle);
    const satGrid = document.createElement("div"); satGrid.className = "pd-chip-grid";
    saturdays.forEach((sat) => {
      const chip = document.createElement("span"); chip.className = "pd-chip";
      if ((agent.samedisTravailles || []).includes(sat)) chip.classList.add("sat-worked");
      chip.textContent = fmtShort(sat);
      chip.addEventListener("click", () => {
        agent.samedisTravailles = agent.samedisTravailles || [];
        const idx = agent.samedisTravailles.indexOf(sat);
        if (idx >= 0) agent.samedisTravailles.splice(idx, 1); else agent.samedisTravailles.push(sat);
        debouncedSaveAgent(agent);
        render();
      });
      satGrid.appendChild(chip);
    });
    detail.appendChild(satGrid);
  }

  layout.appendChild(detail);
  panel.appendChild(layout);
  wrap.appendChild(panel);
  return wrap;
}

// ---------- Planning ----------
function renderPlanningTab() {
  const wrap = document.createElement("div");

  const periodPanel = document.createElement("div"); periodPanel.className = "pd-panel";
  periodPanel.innerHTML = `<h2>Période à planifier</h2><p class="pd-sub">Génère automatiquement tous les dimanches de la période, avec les ${state.postes.length} postes à pourvoir chacun.</p>`;
  const bar = document.createElement("div"); bar.className = "pd-period-bar";
  bar.innerHTML = `
    <div class="pd-field"><label>Début</label><input type="date" id="pd-period-start" value="${state.periode.debut || ""}"></div>
    <div class="pd-field"><label>Fin</label><input type="date" id="pd-period-end" value="${state.periode.fin || ""}"></div>`;
  const genBtn = document.createElement("button"); genBtn.className = "btn-primary"; genBtn.textContent = "Générer / mettre à jour";
  genBtn.addEventListener("click", async () => {
    const start = document.getElementById("pd-period-start").value;
    const end = document.getElementById("pd-period-end").value;
    if (!start || !end || start > end) { alert("Veuillez indiquer une période valide (début avant fin)."); return; }
    genBtn.disabled = true;
    try {
      state.periode = { debut: start, fin: end };
      await sauvegarderPeriode(start, end);
      const sundays = getSundaysInRange(start, end);
      for (const sun of sundays) {
        if (!state.dimanches[sun]) {
          state.dimanches[sun] = await assurerDimanche(sun);
        }
      }
      render();
    } catch (e) { console.error(e); alert("Erreur lors de la génération."); }
    finally { genBtn.disabled = false; }
  });
  bar.appendChild(genBtn);
  periodPanel.appendChild(bar);

  const addForm = document.createElement("div"); addForm.className = "pd-add-sunday-form";
  addForm.innerHTML = `<div class="pd-field"><label>Ajouter un dimanche ponctuel</label><input type="date" id="pd-extra-sunday"></div>`;
  const addExtraBtn = document.createElement("button"); addExtraBtn.className = "btn-secondary"; addExtraBtn.textContent = "Ajouter";
  addExtraBtn.addEventListener("click", async () => {
    const v = document.getElementById("pd-extra-sunday").value; if (!v) return;
    if (parseISO(v).getDay() !== 0) { alert("La date choisie n'est pas un dimanche."); return; }
    if (state.dimanches[v]) return;
    try { state.dimanches[v] = await assurerDimanche(v); render(); }
    catch (e) { console.error(e); alert("Erreur lors de l'ajout."); }
  });
  addForm.appendChild(addExtraBtn);
  periodPanel.appendChild(addForm);
  wrap.appendChild(periodPanel);

  const sundayDates = Object.keys(state.dimanches).sort();

  if (sundayDates.length === 0) {
    const empty = document.createElement("div"); empty.className = "pd-panel pd-empty";
    empty.textContent = "Définissez une période ci-dessus pour commencer.";
    wrap.appendChild(empty); return wrap;
  }
  if (state.agents.length === 0) {
    const empty = document.createElement("div"); empty.className = "pd-panel pd-empty";
    empty.textContent = "Ajoutez des agents (onglet Agents) avant de désigner des volontaires.";
    wrap.appendChild(empty); return wrap;
  }

  const actionsPanel = document.createElement("div"); actionsPanel.className = "pd-panel";
  actionsPanel.innerHTML = `<h2>Répartition</h2><p class="pd-sub">Complète automatiquement les postes non pourvus, en respectant compétences et restrictions, et en priorisant les agents ayant le moins de dimanches à leur compteur.</p>`;
  const actRow = document.createElement("div"); actRow.className = "pd-row";
  const autoBtn = document.createElement("button"); autoBtn.className = "btn-primary"; autoBtn.textContent = "Répartir automatiquement (postes restants)";
  autoBtn.addEventListener("click", async () => { autoBtn.disabled = true; await autoAssign(); autoBtn.disabled = false; render(); });
  const resetBtn = document.createElement("button"); resetBtn.className = "btn-secondary"; resetBtn.textContent = "Réinitialiser toutes les affectations";
  resetBtn.addEventListener("click", async () => {
    if (!confirm("Retirer toutes les affectations actuelles (les volontaires restent enregistrés) ?")) return;
    resetBtn.disabled = true;
    try {
      for (const sun of Object.keys(state.dimanches)) {
        state.dimanches[sun].affectations = {};
        await sauvegarderDimanche(sun, state.dimanches[sun]);
      }
      render();
    } catch (e) { console.error(e); alert("Erreur lors de la réinitialisation."); }
    finally { resetBtn.disabled = false; }
  });
  const printBtn = document.createElement("button"); printBtn.className = "btn-secondary"; printBtn.textContent = "🖨️ Imprimer / exporter le planning";
  printBtn.addEventListener("click", () => imprimerPlanning());
  actRow.appendChild(autoBtn); actRow.appendChild(resetBtn); actRow.appendChild(printBtn);
  actionsPanel.appendChild(actRow);
  wrap.appendChild(actionsPanel);

  const listPanel = document.createElement("div"); listPanel.className = "pd-panel";
  listPanel.innerHTML = "<h2>Dimanches</h2>";
  sundayDates.forEach((sun) => listPanel.appendChild(renderSundayCard(sun)));
  wrap.appendChild(listPanel);
  return wrap;
}

function renderSundayCard(sun) {
  const s = state.dimanches[sun];
  s.volontaires = s.volontaires || [];
  s.affectations = s.affectations || {};
  s.postesDesactives = s.postesDesactives || [];
  const actifs = state.postes.filter((p) => !s.postesDesactives.includes(p.id));
  const rempli = actifs.filter((p) => s.affectations[p.id]).length;
  const complet = actifs.length > 0 && rempli >= actifs.length;

  const card = document.createElement("div");
  card.className = "pd-sunday-card " + (complet ? "complete" : "incomplete");

  const head = document.createElement("div"); head.className = "pd-sunday-head";
  const left = document.createElement("div"); left.className = "pd-sunday-date"; left.textContent = fmtLong(sun);
  head.appendChild(left);
  const right = document.createElement("div"); right.className = "pd-row";
  const status = document.createElement("span"); status.className = "pd-fill-status " + (complet ? "complete" : "incomplete");
  status.textContent = `${rempli}/${actifs.length}`;
  right.appendChild(status);
  const delBtn = document.createElement("button"); delBtn.className = "pd-del-sunday"; delBtn.title = "Supprimer ce dimanche"; delBtn.textContent = "✕";
  delBtn.addEventListener("click", async () => {
    if (!confirm("Retirer ce dimanche du planning ?")) return;
    try { await supprimerDimanche(sun); delete state.dimanches[sun]; render(); }
    catch (e) { console.error(e); alert("Erreur lors de la suppression."); }
  });
  right.appendChild(delBtn);
  head.appendChild(right);
  card.appendChild(head);

  const volTitle = document.createElement("div"); volTitle.className = "pd-chip-title"; volTitle.textContent = "Volontaires";
  card.appendChild(volTitle);
  const volGrid = document.createElement("div"); volGrid.className = "pd-chip-grid";
  state.agents.forEach((a) => {
    const chip = document.createElement("span"); chip.className = "pd-chip pd-volunteer";
    if (s.volontaires.includes(a.id)) chip.classList.add("selected");
    chip.textContent = `${a.initiales} (${totalAffecteCount(a.id)})`;
    chip.addEventListener("click", () => {
      const idx = s.volontaires.indexOf(a.id);
      if (idx >= 0) {
        s.volontaires.splice(idx, 1);
        Object.keys(s.affectations).forEach((pid) => { if (s.affectations[pid] === a.id) s.affectations[pid] = null; });
      } else s.volontaires.push(a.id);
      debouncedSaveDimanche(sun);
      render();
    });
    volGrid.appendChild(chip);
  });
  card.appendChild(volGrid);

  if (s.volontaires.length === 0) {
    const none = document.createElement("div"); none.className = "pd-empty-inline"; none.textContent = "Aucun volontaire enregistré pour ce dimanche.";
    card.appendChild(none);
    return card;
  }

  const postsTitle = document.createElement("div"); postsTitle.className = "pd-chip-title"; postsTitle.textContent = "Postes";
  card.appendChild(postsTitle);

  state.postes.forEach((poste) => {
    const desactive = s.postesDesactives.includes(poste.id);
    const block = document.createElement("div"); block.className = "pd-post-block" + (desactive ? " disabled" : "");
    const bhead = document.createElement("div"); bhead.className = "pd-post-head";
    const bname = document.createElement("div");
    bname.innerHTML = `<span class="pd-post-name">${poste.nom}</span>` + (poste.competenceId ? `<span class="pd-skill-badge">${competenceNom(poste.competenceId)}</span>` : "");
    bhead.appendChild(bname);

    const bright = document.createElement("div"); bright.className = "pd-row";
    const assignedId = s.affectations[poste.id];
    if (desactive) {
      const filledLabel = document.createElement("span"); filledLabel.className = "pd-post-filled";
      filledLabel.textContent = "non requis";
      bright.appendChild(filledLabel);
    }
    const toggleLabel = document.createElement("label"); toggleLabel.className = "pd-post-toggle";
    const toggleInput = document.createElement("input"); toggleInput.type = "checkbox"; toggleInput.checked = !desactive;
    toggleInput.addEventListener("change", () => {
      if (toggleInput.checked) s.postesDesactives = s.postesDesactives.filter((id) => id !== poste.id);
      else { s.postesDesactives.push(poste.id); s.affectations[poste.id] = null; }
      debouncedSaveDimanche(sun);
      render();
    });
    toggleLabel.appendChild(toggleInput);
    toggleLabel.appendChild(document.createTextNode("requis ce dimanche"));
    bright.appendChild(toggleLabel);
    bhead.appendChild(bright);
    block.appendChild(bhead);

    if (!desactive) {
      const selectRow = document.createElement("div"); selectRow.className = "pd-post-select-row";
      const select = document.createElement("select"); select.className = "pd-post-select";
      const emptyOpt = document.createElement("option"); emptyOpt.value = ""; emptyOpt.textContent = "— Non pourvu —";
      select.appendChild(emptyOpt);
      s.volontaires.forEach((agentId) => {
        const elig = checkPosteEligibilite(agentId, sun, poste);
        const opt = document.createElement("option");
        opt.value = agentId;
        opt.textContent = agentLabel(agentId) + (elig.eligible ? "" : " ⚠");
        if (assignedId === agentId) opt.selected = true;
        select.appendChild(opt);
      });
      if (assignedId && !s.volontaires.includes(assignedId)) {
        // agent affecté mais retiré des volontaires depuis : on le garde visible pour ne pas le perdre en silence
        const opt = document.createElement("option");
        opt.value = assignedId; opt.textContent = agentLabel(assignedId) + " (non volontaire)"; opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener("change", () => {
        const agentId = select.value || null;
        if (agentId) {
          const elig = checkPosteEligibilite(agentId, sun, poste);
          if (!elig.eligible) {
            const ok = confirm(`${agentLabel(agentId)} ne respecte pas une contrainte :\n- ${elig.raisons.join("\n- ")}\n\nAffecter quand même ?`);
            if (!ok) { select.value = assignedId || ""; return; }
          }
          Object.keys(s.affectations).forEach((pid) => { if (pid !== poste.id && s.affectations[pid] === agentId) s.affectations[pid] = null; });
        }
        s.affectations[poste.id] = agentId;
        debouncedSaveDimanche(sun);
        render();
      });
      selectRow.appendChild(select);
      if (assignedId) {
        const elig = checkPosteEligibilite(assignedId, sun, poste);
        if (!elig.eligible) {
          const warn = document.createElement("span"); warn.className = "pd-post-warn";
          warn.textContent = "⚠ " + elig.raisons.join(" · ");
          selectRow.appendChild(warn);
        }
      }
      block.appendChild(selectRow);
    }
    card.appendChild(block);
  });

  return card;
}

function imprimerPlanning() {
  let area = document.getElementById("pd-print-area");
  if (!area) {
    area = document.createElement("div");
    area.id = "pd-print-area";
    document.body.appendChild(area);
  }

  const sundayDates = Object.keys(state.dimanches).sort();
  let html = `<h1>Planning des dimanches</h1>`;
  if (state.periode.debut && state.periode.fin) {
    html += `<p class="pd-print-periode">Du ${fmtLong(state.periode.debut)} au ${fmtLong(state.periode.fin)}</p>`;
  }
  html += `<table class="pd-print-table"><thead><tr><th>Dimanche</th><th>Poste</th><th>Agent</th></tr></thead><tbody>`;

  sundayDates.forEach((sun) => {
    const s = state.dimanches[sun];
    const actifs = state.postes.filter((p) => !(s.postesDesactives || []).includes(p.id));
    if (actifs.length === 0) return;
    actifs.forEach((poste, idx) => {
      const assignedId = (s.affectations || {})[poste.id];
      html += `<tr class="${idx === 0 ? "pd-print-first-row" : ""}">`;
      html += `<td>${idx === 0 ? fmtLong(sun) : ""}</td>`;
      html += `<td>${poste.nom}</td>`;
      html += `<td>${assignedId ? agentLabel(assignedId) : "—"}</td>`;
      html += `</tr>`;
    });
  });
  html += `</tbody></table>`;

  area.innerHTML = html;
  window.print();
}

async function autoAssign() {
  const sundayDates = Object.keys(state.dimanches).sort();
  for (const sun of sundayDates) {
    const s = state.dimanches[sun];
    s.volontaires = s.volontaires || []; s.affectations = s.affectations || {}; s.postesDesactives = s.postesDesactives || [];
    const actifs = state.postes.filter((p) => !s.postesDesactives.includes(p.id));

    function eligiblesPour(poste) {
      const occupes = affectesCeDimanche(sun);
      return s.volontaires.filter((id) => !occupes.has(id)).filter((id) => checkPosteEligibilite(id, sun, poste).eligible);
    }

    const ordre = [...actifs].sort((a, b) => eligiblesPour(a).length - eligiblesPour(b).length);
    let modifie = false;
    ordre.forEach((poste) => {
      if (s.affectations[poste.id]) return;
      const candidats = eligiblesPour(poste).map((id) => ({ id, count: totalAffecteCount(id), label: agentLabel(id) }));
      candidats.sort((a, b) => a.count - b.count || a.label.localeCompare(b.label));
      if (candidats.length > 0) { s.affectations[poste.id] = candidats[0].id; modifie = true; }
    });
    if (modifie) await sauvegarderDimanche(sun, s);
  }
}

// ---------- Équité ----------
function renderEquiteTab() {
  const wrap = document.createElement("div");

  if (state.agents.length === 0 || Object.keys(state.dimanches).length === 0) {
    const panel = document.createElement("div"); panel.className = "pd-panel";
    panel.innerHTML = "<h2>Équité de la répartition</h2>";
    const empty = document.createElement("div"); empty.className = "pd-empty";
    empty.textContent = "Ajoutez des agents et un planning pour voir la répartition.";
    panel.appendChild(empty); wrap.appendChild(panel); return wrap;
  }

  const covPanel = document.createElement("div"); covPanel.className = "pd-panel";
  covPanel.innerHTML = `<h2>Couverture par poste</h2><p class="pd-sub">Nombre de dimanches où chaque poste a été pourvu.</p>`;
  const covTable = document.createElement("table"); covTable.className = "pd-coverage";
  covTable.innerHTML = "<thead><tr><th>Poste</th><th>Pourvu</th><th>Requis</th></tr></thead>";
  const covBody = document.createElement("tbody");
  state.postes.forEach((p) => {
    let requis = 0, rempli = 0;
    Object.values(state.dimanches).forEach((s) => {
      if ((s.postesDesactives || []).includes(p.id)) return;
      requis++;
      if ((s.affectations || {})[p.id]) rempli++;
    });
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.nom}${p.competenceId ? ` <span class="pd-skill-badge">${competenceNom(p.competenceId)}</span>` : ""}</td><td>${rempli}</td><td>${requis}</td>`;
    covBody.appendChild(tr);
  });
  covTable.appendChild(covBody);
  covPanel.appendChild(covTable);
  wrap.appendChild(covPanel);

  const panel = document.createElement("div"); panel.className = "pd-panel";
  panel.innerHTML = `<h2>Équité entre agents</h2><p class="pd-sub">Nombre de dimanches affectés par agent, tous postes confondus.</p>`;

  const counts = state.agents.map((a) => {
    const dates = Object.keys(state.dimanches).filter((sun) => Object.values(state.dimanches[sun].affectations || {}).includes(a.id)).sort();
    const details = dates.map((sun) => {
      const s = state.dimanches[sun];
      const pid = Object.keys(s.affectations || {}).find((k) => s.affectations[k] === a.id);
      const p = posteObj(pid);
      return `${fmtShort(sun)} (${p ? p.nom : "?"})`;
    });
    return { agent: a, count: dates.length, details };
  });
  const maxCount = Math.max(1, ...counts.map((c) => c.count));
  counts.sort((x, y) => y.count - x.count);

  const table = document.createElement("table"); table.className = "pd-equity";
  table.innerHTML = "<thead><tr><th>Agent</th><th>Dimanches</th><th>Répartition</th><th>Détail</th></tr></thead>";
  const tbody = document.createElement("tbody");
  counts.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.agent.initiales}</td>
      <td>${c.count}</td>
      <td><div class="pd-bar-wrap"><div class="pd-bar-fill" style="width:${(c.count / maxCount * 100).toFixed(0)}%;"></div></div></td>
      <td class="pd-dates-list">${c.details.join(", ") || "—"}</td>`;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  panel.appendChild(table);

  if (counts.length > 1) {
    const spread = counts[0].count - counts[counts.length - 1].count;
    const note = document.createElement("p"); note.className = "pd-sub"; note.style.marginTop = "12px";
    note.textContent = spread <= 1
      ? `Répartition équilibrée (écart de ${spread} dimanche entre le plus et le moins sollicité).`
      : `Écart actuel de ${spread} dimanches entre l'agent le plus et le moins sollicité — relancez la répartition automatique si de nouveaux volontaires s'ajoutent.`;
    panel.appendChild(note);
  }

  wrap.appendChild(panel);
  return wrap;
}

// ---------- point d'entrée ----------
export async function initPlanningDimanches() {
  const loadingEl = document.getElementById("pd-loading");
  try {
    await assurerDonneesParDefaut();
    const [competences, postes, agents, dimanches, periode] = await Promise.all([
      listerCompetences(), listerPostes(), listerAgents(), listerDimanches(), obtenirPeriode()
    ]);
    state = { competences, postes, agents, periode, dimanches };
    if (loadingEl) loadingEl.classList.add("hidden");
    document.getElementById("pd-app").classList.remove("hidden");
    render();
  } catch (e) {
    console.error(e);
    if (loadingEl) loadingEl.textContent = "Erreur de chargement des données. Rafraîchissez la page.";
  }
}
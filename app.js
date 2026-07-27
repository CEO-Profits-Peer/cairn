/* ============================================================
   CAIRN — application logic
   ============================================================ */

const qs = new URLSearchParams(location.search);
const DEMO = qs.has('demo');
const CAT_LABEL = { general: 'General', product: 'Product', pricing: 'Pricing', people: 'People', ops: 'Ops', finance: 'Finance' };

const TYPES = ['decision', 'note', 'meeting', 'glossary', 'link'];
const TYPE_LABEL = { decision: 'Decision', note: 'Note', meeting: 'Meeting', glossary: 'Glossary', link: 'Link' };
const TYPE_META = {
  decision: { contextLabel: 'Context', contextPh: 'What prompted this? (optional)', reasoningLabel: 'Reasoning', reasoningPh: 'What did you decide, and why?', dateLabel: 'Date decided', titlePh: 'e.g. Switch to usage-based pricing', showCategory: true, showContext: true },
  note: { reasoningLabel: 'Note', reasoningPh: 'Whatever your team should remember — no wrong format', dateLabel: 'Date', titlePh: 'e.g. How our staging environment works', showCategory: false, showContext: false },
  meeting: { contextLabel: 'Attendees', contextPh: 'Who was there? (optional)', reasoningLabel: 'Notes', reasoningPh: 'What was discussed, decided, or needs follow-up?', dateLabel: 'Meeting date', titlePh: 'e.g. Q3 roadmap sync', showCategory: false, showContext: true },
  glossary: { reasoningLabel: 'Definition', reasoningPh: 'What does this term mean, in your team\'s context?', dateLabel: 'Date added', titlePh: 'e.g. MRR', showCategory: false, showContext: false },
  link: { contextLabel: 'URL', contextPh: 'https://... (optional)', reasoningLabel: 'Why it matters', reasoningPh: 'Why should the team care about this?', dateLabel: 'Date saved', titlePh: 'e.g. Competitor pricing page', showCategory: false, showContext: true },
};

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + (String(d).length <= 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function monthKey(d) {
  const dt = new Date(d + (String(d).length <= 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function initials(name) {
  return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';
}
function uid() { return 'id-' + Math.random().toString(36).slice(2, 11); }

function toast(msg, opts = {}) {
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast';
  const span = document.createElement('span');
  span.textContent = msg;
  el.appendChild(span);
  if (opts.undo) {
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    btn.onclick = () => { opts.undo(); el.remove(); };
    el.appendChild(btn);
  }
  wrap.appendChild(el);
  setTimeout(() => el.remove(), opts.undo ? 6000 : 3200);
}

/* ---------------- Supabase client ---------------- */
const cfg = window.CAIRN_CONFIG || {};
let sb = null;
if (!DEMO && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
  sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
}
const BACKEND_READY = DEMO || !!sb;

/* ---------------- Demo seed data ---------------- */
function seedDemo() {
  const today = new Date();
  const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  return {
    workspace: { id: 'demo-ws', name: 'Acme Inc. (Demo)', invite_code: 'demo1234' },
    member: { id: 'm-you', name: 'You', role: 'owner' },
    members: [
      { id: 'm-you', name: 'You', role: 'owner' },
      { id: 'm-jamie', name: 'Jamie Ruiz', role: 'member' },
    ],
    decisions: [
      { id: uid(), type: 'decision', pinned: true, title: 'Switch to usage-based pricing', context: 'Flat pricing was under-charging our top 5% of accounts while over-charging casual users.', reasoning: 'Churn on the low end was 3x higher than on the high end. Usage-based pricing aligns cost with value and should reduce low-end churn while capturing more from power users.', category: 'pricing', tags: ['pricing', 'revenue'], decided_on: daysAgo(6), created_by: 'm-you' },
      { id: uid(), type: 'meeting', title: 'Q3 roadmap sync', context: 'You, Jamie', reasoning: 'Agreed to ship usage-based pricing before the mobile web revamp. Follow-up: Jamie to draft the migration email for existing flat-rate customers by Friday.', category: 'general', tags: ['roadmap'], decided_on: daysAgo(9), created_by: 'm-you' },
      { id: uid(), type: 'decision', title: 'Drop the mobile app, focus on web', context: 'Mobile app had <2% of weekly active users but consumed ~30% of engineering time.', reasoning: 'The ROI was clearly negative. We decided to sunset the app and invest that time into making the mobile web experience faster instead — same outcome, far less maintenance.', category: 'product', tags: ['mobile', 'roadmap'], decided_on: daysAgo(19), created_by: 'm-jamie' },
      { id: uid(), type: 'glossary', pinned: true, title: 'NRR', context: '', reasoning: 'Net Revenue Retention — revenue from existing customers this month vs. the same customers last month, including upgrades, downgrades, and churn. Above 100% means expansion outpaces churn.', category: 'general', tags: ['finance'], decided_on: daysAgo(25), created_by: 'm-jamie' },
      { id: uid(), type: 'decision', title: 'Hire our first support person before a 2nd engineer', context: 'Support tickets were taking 2-3 hours a day away from the founders.', reasoning: 'Even though engineering velocity felt more urgent, the support backlog was directly costing us customers. A dedicated hire pays back faster here than another engineer would right now.', category: 'people', tags: ['hiring'], decided_on: daysAgo(33), created_by: 'm-you' },
      { id: uid(), type: 'link', title: 'Competitor pricing page — annual discount structure', context: 'https://example.com/pricing', reasoning: 'They give 20% off annual, we give 15%. Worth revisiting when we redo our own pricing page.', category: 'general', tags: ['pricing', 'research'], decided_on: daysAgo(37), created_by: 'm-you' },
      { id: uid(), type: 'decision', title: 'Move off the shared Postgres instance', context: 'Two noisy-neighbor incidents in one month caused visible slowdowns for customers.', reasoning: 'A dedicated instance costs more, but the incidents were starting to show up in churn surveys. Reliability wins over cost at our current stage.', category: 'ops', tags: ['infra', 'reliability'], decided_on: daysAgo(41), created_by: 'm-jamie' },
      { id: uid(), type: 'note', title: 'How our staging environment works', context: '', reasoning: 'staging.internal mirrors prod nightly at 3am UTC. Seed data resets on every deploy — do not rely on manually-entered staging data surviving a deploy.', category: 'general', tags: ['infra'], decided_on: daysAgo(50), created_by: 'm-jamie' },
      { id: uid(), type: 'decision', title: 'Extend runway by cutting the conference budget', context: 'Q2 burn was 18% over plan, mostly from event sponsorships with unclear ROI.', reasoning: 'None of the three conferences we sponsored last year produced a traceable customer. Cutting this extends runway by roughly 2 months without touching headcount.', category: 'finance', tags: ['budget'], decided_on: daysAgo(58), created_by: 'm-you' },
      { id: uid(), type: 'decision', title: 'Rename the "Projects" feature to "Workspaces"', context: 'User interviews showed people confused our "Projects" with their own client projects.', reasoning: '"Workspaces" tested clearly better in 6 of 7 interviews and matches language competitors already use, so there is no re-learning cost for switchers.', category: 'product', tags: ['naming', 'ux'], decided_on: daysAgo(72), created_by: 'm-you' },
      { id: uid(), type: 'decision', title: 'No more Friday deploys', context: 'Two of our last three production incidents happened from Friday afternoon deploys.', reasoning: 'The cost of a weekend incident with a skeleton crew outweighs the benefit of shipping a few hours earlier. Deploys freeze Friday noon onward.', category: 'ops', tags: ['process'], decided_on: daysAgo(95), created_by: 'm-jamie' },
      { id: uid(), type: 'decision', title: 'Keep the free tier instead of a trial', context: 'Considered switching to a 14-day trial to boost paid conversion.', reasoning: 'A free tier keeps top-of-funnel word-of-mouth alive, which is our biggest acquisition channel. We would rather optimize upgrade prompts than remove the free tier.', category: 'pricing', tags: ['pricing', 'growth'], decided_on: daysAgo(120), created_by: 'm-you' },
    ],
  };
}

/* ---------------- Demo API ---------------- */
let demo = null;
const demoApi = {
  async getSession() { return demo ? { user: { id: 'demo-user', email: 'you@demo.cairn' } } : null; },
  async signIn() { demo = seedDemo(); return { user: { id: 'demo-user' } }; },
  async signUp() { demo = seedDemo(); return { user: { id: 'demo-user' } }; },
  async signOut() { demo = null; },
  async resetPassword() { return true; },
  async getWorkspace() { return demo ? { workspace: demo.workspace, member: demo.member } : null; },
  async createWorkspace(name, memberName) { demo = seedDemo(); demo.workspace.name = name || demo.workspace.name; demo.member.name = memberName || demo.member.name; return demo.workspace; },
  async joinWorkspace() { demo = demo || seedDemo(); return demo.workspace; },
  async listMembers() { return demo.members; },
  async removeMember(id) { demo.members = demo.members.filter(m => m.id !== id); },
  async listDecisions() { return [...demo.decisions].sort((a, b) => b.decided_on.localeCompare(a.decided_on)); },
  async createDecision(d) { const row = { ...d, id: uid(), created_by: 'm-you' }; demo.decisions.unshift(row); return row; },
  async updateDecision(id, patch) { const i = demo.decisions.findIndex(x => x.id === id); if (i > -1) demo.decisions[i] = { ...demo.decisions[i], ...patch }; return demo.decisions[i]; },
  async deleteDecision(id) { const i = demo.decisions.findIndex(x => x.id === id); const [removed] = i > -1 ? demo.decisions.splice(i, 1) : [null]; return removed; },
  async restoreDecision(row) { demo.decisions.push(row); },
  async askCairn(question) {
    await new Promise(r => setTimeout(r, 550));
    const q = question.toLowerCase();
    const words = q.split(/\W+/).filter(w => w.length > 3);
    const scored = demo.decisions.map(d => {
      const hay = (d.title + ' ' + d.context + ' ' + d.reasoning + ' ' + d.tags.join(' ')).toLowerCase();
      const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
      return { d, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) {
      return { answer: "I couldn't find anything related to that yet in this workspace. Log it and ask again.", citations: [] };
    }
    const top = scored.slice(0, 2).map(x => x.d);
    const answer = top.map(d => `**${d.title}** (${fmtDate(d.decided_on)}): ${d.reasoning}`).join('\n\n');
    return { answer, citations: top.map(d => ({ id: d.id, title: d.title })) };
  },
};

/* ---------------- Supabase-backed API ---------------- */
const supaApi = {
  async getSession() { const { data } = await sb.auth.getSession(); return data.session ? data.session.user : null; },
  async signIn(email, password) { const { data, error } = await sb.auth.signInWithPassword({ email, password }); if (error) throw error; return data.user; },
  async signUp(email, password) { const { data, error } = await sb.auth.signUp({ email, password }); if (error) throw error; return data.user; },
  async signOut() { await sb.auth.signOut(); },
  async resetPassword(email) { const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }); if (error) throw error; return true; },
  async getWorkspace() {
    const { data: members } = await sb.from('cairn_members').select('*, cairn_workspaces(*)').limit(1);
    if (!members || !members.length) return null;
    return { workspace: members[0].cairn_workspaces, member: members[0] };
  },
  async createWorkspace(name, memberName) {
    const { data, error } = await sb.rpc('cairn_create_workspace', { ws_name: name, member_name: memberName });
    if (error) throw error;
    return data;
  },
  async joinWorkspace(code, memberName) {
    const { data, error } = await sb.rpc('cairn_join_workspace', { code, member_name: memberName });
    if (error) throw error;
    return data;
  },
  async listMembers(wsId) {
    const { data, error } = await sb.from('cairn_members').select('*').eq('workspace_id', wsId).order('created_at');
    if (error) throw error;
    return data;
  },
  async removeMember(id) {
    const { error } = await sb.from('cairn_members').delete().eq('id', id);
    if (error) throw error;
  },
  async listDecisions(wsId) {
    const { data, error } = await sb.from('cairn_decisions').select('*').eq('workspace_id', wsId).order('decided_on', { ascending: false });
    if (error) throw error;
    return data;
  },
  async createDecision(d) {
    const { data: { user } } = await sb.auth.getUser();
    const { data, error } = await sb.from('cairn_decisions').insert({ ...d, created_by: user.id }).select().single();
    if (error) throw error;
    return data;
  },
  async updateDecision(id, patch) {
    const { data, error } = await sb.from('cairn_decisions').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  async deleteDecision(id) {
    const { data, error } = await sb.from('cairn_decisions').select().eq('id', id).single();
    await sb.from('cairn_decisions').delete().eq('id', id);
    if (error) throw error;
    return data;
  },
  async restoreDecision(row) { await sb.from('cairn_decisions').insert(row); },
  async askCairn(question) {
    const { data: sessionData } = await sb.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/ai-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Ask Cairn is not set up yet.');
    }
    return res.json();
  },
};

const api = DEMO ? demoApi : supaApi;

/* ---------------- App state ---------------- */
const state = {
  workspace: null,
  member: null,
  members: [],
  decisions: [],
  view: 'overview',
  filter: { cat: 'all', q: '' },
};

/* ---------------- Boot ---------------- */
async function boot() {
  if (!BACKEND_READY) {
    showAuth();
    document.getElementById('authMsg').innerHTML = `<div class="auth-msg error">config.js has no Supabase credentials yet. Add <code>?demo</code> to the URL to try the demo, or follow CAIRN-SETUP.md.</div>`;
    return;
  }
  if (qs.has('signup')) switchAuthTab('signup');
  const user = DEMO ? null : await supaApi.getSession().catch(() => null);
  if (DEMO || user) {
    if (!DEMO) await afterAuth(); else showAuth();
  } else {
    showAuth();
  }
}

async function afterAuth() {
  const gate = await api.getWorkspace();
  if (!gate) { showWsGate(); return; }
  state.workspace = gate.workspace;
  state.member = gate.member;
  await loadWorkspaceData();
  showShell();
}

async function loadWorkspaceData() {
  const [members, decisions] = await Promise.all([
    api.listMembers(state.workspace.id),
    api.listDecisions(state.workspace.id),
  ]);
  state.members = members;
  state.decisions = decisions;
}

function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('wsGate').style.display = 'none';
  document.getElementById('shell').style.display = 'none';
}
function showWsGate() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('wsGate').style.display = 'flex';
  document.getElementById('shell').style.display = 'none';
}
function showShell() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('wsGate').style.display = 'none';
  document.getElementById('shell').style.display = 'flex';
  document.getElementById('wsNameLabel').textContent = state.workspace.name;
  document.getElementById('wsMemberLabel').textContent = state.member.name;
  document.getElementById('wsAvatar').textContent = initials(state.workspace.name);
  navigate(location.hash.replace('#/', '') || 'overview');
  if (!DEMO && !localStorage.getItem('cairn-tour-seen')) openTour();
}

/* ---------------- Quick tour ---------------- */
function openTour() { document.getElementById('tourOverlay').classList.remove('hidden'); }
function closeTour() {
  document.getElementById('tourOverlay').classList.add('hidden');
  localStorage.setItem('cairn-tour-seen', '1');
}
document.getElementById('tourClose').onclick = closeTour;
document.getElementById('tourGotIt').onclick = closeTour;
document.getElementById('tourOverlay').addEventListener('click', (e) => { if (e.target.id === 'tourOverlay') closeTour(); });

/* ---------------- Auth screen wiring ---------------- */
function switchAuthTab(which) {
  document.getElementById('tabLogin').classList.toggle('on', which === 'login');
  document.getElementById('tabSignup').classList.toggle('on', which === 'signup');
  document.getElementById('loginForm').style.display = which === 'login' ? 'block' : 'none';
  document.getElementById('signupForm').style.display = which === 'signup' ? 'block' : 'none';
  document.getElementById('resetForm').style.display = 'none';
}
document.getElementById('tabLogin').onclick = () => switchAuthTab('login');
document.getElementById('tabSignup').onclick = () => switchAuthTab('signup');
document.getElementById('forgotLink').onclick = () => {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('signupForm').style.display = 'none';
  document.getElementById('resetForm').style.display = 'block';
};
document.getElementById('backToLogin').onclick = () => switchAuthTab('login');

function authError(msg) {
  document.getElementById('authMsg').innerHTML = `<div class="auth-msg error">${esc(msg)}</div>`;
}
function authGood(msg) {
  document.getElementById('authMsg').innerHTML = `<div class="auth-msg good">${esc(msg)}</div>`;
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api.signIn(document.getElementById('loginEmail').value.trim(), document.getElementById('loginPassword').value);
    document.getElementById('authMsg').innerHTML = '';
    await afterAuth();
  } catch (err) { authError(err.message || 'Sign in failed.'); }
});

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api.signUp(document.getElementById('signupEmail').value.trim(), document.getElementById('signupPassword').value);
    window._pendingName = document.getElementById('signupName').value.trim();
    document.getElementById('authMsg').innerHTML = '';
    await afterAuth();
    if (document.getElementById('wsMemberName')) document.getElementById('wsMemberName').value = window._pendingName || '';
  } catch (err) { authError(err.message || 'Sign up failed.'); }
});

document.getElementById('resetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api.resetPassword(document.getElementById('resetEmail').value.trim());
    authGood('Check your email for a reset link.');
  } catch (err) { authError(err.message || 'Could not send reset email.'); }
});

/* ---------------- Workspace gate wiring ---------------- */
document.getElementById('wsCreateBtn').onclick = async () => {
  const name = document.getElementById('wsNewName').value.trim();
  const memberName = document.getElementById('wsMemberName').value.trim();
  if (!name) { document.getElementById('wsMsg').innerHTML = '<div class="auth-msg error">Give your workspace a name.</div>'; return; }
  try {
    state.workspace = await api.createWorkspace(name, memberName);
    state.member = { name: memberName || 'Owner', role: 'owner' };
    await loadWorkspaceData();
    showShell();
  } catch (err) { document.getElementById('wsMsg').innerHTML = `<div class="auth-msg error">${esc(err.message)}</div>`; }
};
document.getElementById('wsJoinBtn').onclick = async () => {
  const code = document.getElementById('wsJoinCode').value.trim();
  const memberName = document.getElementById('wsMemberName').value.trim();
  if (!code) { document.getElementById('wsMsg').innerHTML = '<div class="auth-msg error">Enter an invite code.</div>'; return; }
  try {
    state.workspace = await api.joinWorkspace(code, memberName);
    state.member = { name: memberName || 'Member', role: 'member' };
    await loadWorkspaceData();
    showShell();
  } catch (err) { document.getElementById('wsMsg').innerHTML = `<div class="auth-msg error">Invalid invite code.</div>`; }
};
document.getElementById('wsLogout').onclick = async () => { await api.signOut(); location.reload(); };

/* ---------------- Navigation ---------------- */
document.querySelectorAll('.side-link').forEach(el => el.onclick = () => navigate(el.dataset.view));
document.querySelectorAll('.mobile-tabbar button').forEach(el => el.onclick = () => {
  if (el.dataset.view === 'new') { openDecisionModal(null); return; }
  navigate(el.dataset.view);
});

function navigate(view) {
  state.view = view;
  location.hash = '#/' + view;
  document.querySelectorAll('.side-link').forEach(el => el.classList.toggle('on', el.dataset.view === view));
  document.querySelectorAll('.mobile-tabbar button').forEach(el => el.classList.toggle('on', el.dataset.view === view));
  document.getElementById('viewTitle').textContent = { overview: 'Overview', decisions: 'Memory', settings: 'Settings' }[view] || 'Overview';
  render();
}
window.addEventListener('hashchange', () => {
  const v = location.hash.replace('#/', '');
  if (v && v !== state.view && document.getElementById('shell').style.display !== 'none') navigate(v);
});

function render() {
  const view = document.getElementById('view');
  if (state.view === 'decisions') { view.innerHTML = decisionsViewHtml(); bindDecisionsView(); }
  else if (state.view === 'settings') { view.innerHTML = settingsViewHtml(); bindSettingsView(); }
  else { view.innerHTML = overviewViewHtml(); bindOverviewView(); }
}

/* ---------------- Overview ---------------- */
function overviewViewHtml() {
  const total = state.decisions.length;
  const thisMonth = state.decisions.filter(d => monthKey(d.decided_on) === monthKey(new Date().toISOString())).length;
  const typesUsed = new Set(state.decisions.map(d => d.type || 'decision')).size;
  const recent = state.decisions.slice(0, 6);
  const pinned = state.decisions.filter(d => d.pinned);

  return `
    <div class="view-head">
      <div><h1>Overview</h1><p>Your team's memory at a glance.</p></div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="n">${total}</div><div class="l">Items logged</div></div>
      <div class="stat-card"><div class="n">${thisMonth}</div><div class="l">This month</div></div>
      <div class="stat-card"><div class="n">${typesUsed}</div><div class="l">Types in use</div></div>
      <div class="stat-card"><div class="n">${state.members.length}</div><div class="l">Team members</div></div>
    </div>

    <div class="ask-box">
      <div class="ask-box-head">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 17h.01"/><path d="M9.1 9a2.9 2.9 0 0 1 5.6 1c0 1.9-2.7 2.3-2.7 4.2"/><circle cx="12" cy="12" r="9.5"/></svg>
        <span>Ask Cairn</span>
      </div>
      <div class="ask-input-row">
        <input type="text" id="askInput" placeholder="Why did we...? What does... mean? Who was in...?">
        <button class="btn btn-primary" id="askBtn">Ask</button>
      </div>
      <div id="askResult"></div>
    </div>

    ${pinned.length ? `
      <div class="section-title">Pinned</div>
      <div class="decision-list" id="pinnedList" style="margin-bottom:26px;">
        ${pinned.map(decisionRowHtml).join('')}
      </div>
    ` : ''}

    <div class="section-title">Recently logged</div>
    <div class="decision-list" id="recentList">
      ${recent.length ? recent.map(decisionRowHtml).join('') : emptyStateHtml('overview')}
    </div>
  `;
}

function bindOverviewView() {
  document.querySelectorAll('#recentList .decision-row, #pinnedList .decision-row').forEach(el => el.onclick = () => openDecisionModal(findDecision(el.dataset.id)));
  bindPinButtons(document.getElementById('view'));
  const askBtn = document.getElementById('askBtn');
  const askInput = document.getElementById('askInput');
  const run = () => askCairnGo(askInput.value.trim());
  askBtn.onclick = run;
  askInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
}

async function askCairnGo(question) {
  if (!question) return;
  const box = document.getElementById('askResult');
  box.innerHTML = `<div class="ask-loading"><div class="spin"></div> Reading your team's decision history...</div>`;
  try {
    const res = await api.askCairn(question);
    const answerHtml = esc(res.answer).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    const cites = (res.citations || []).map(c => `<span class="ask-cite" data-id="${esc(c.id)}" role="button" tabindex="0"><span class="dot"></span>${esc(c.title)}</span>`).join('');
    box.innerHTML = `<div class="ask-answer">${answerHtml}${cites ? `<div class="ask-cites">${cites}</div>` : ''}</div>`;
    box.querySelectorAll('.ask-cite').forEach(el => el.onclick = () => { const d = findDecision(el.dataset.id); if (d) openDecisionModal(d); });
  } catch (err) {
    box.innerHTML = `<div class="ask-answer">${esc(err.message || 'Ask Cairn is not available yet.')}</div>`;
  }
}

/* ---------------- Decisions view ---------------- */
function decisionsViewHtml() {
  const filtered = filteredDecisions();
  const groups = groupByMonth(filtered);
  return `
    <div class="view-head">
      <div><h1>Memory</h1><p>${state.decisions.length} items logged in total.</p></div>
    </div>
    <div class="field" style="max-width:360px;">
      <input type="text" id="decisionSearch" placeholder="Search title, content, tags..." value="${esc(state.filter.q)}">
    </div>
    <div class="filter-row">
      <button class="pill-filter ${state.filter.cat === 'all' ? 'on' : ''}" data-cat="all">All</button>
      ${TYPES.map(t => `<button class="pill-filter ${state.filter.cat === t ? 'on' : ''}" data-cat="${t}">${TYPE_LABEL[t]}</button>`).join('')}
    </div>
    <div id="decisionGroups">
      ${groups.length ? groups.map(g => `
        <div class="month-group">
          <div class="month-label">${esc(g.label)}</div>
          <div class="decision-list">${g.items.map(decisionRowHtml).join('')}</div>
        </div>
      `).join('') : emptyStateHtml('decisions')}
    </div>
  `;
}

function filteredDecisions() {
  let list = state.decisions;
  if (state.filter.cat !== 'all') list = list.filter(d => (d.type || 'decision') === state.filter.cat);
  if (state.filter.q) {
    const q = state.filter.q.toLowerCase();
    list = list.filter(d => (d.title + ' ' + d.context + ' ' + d.reasoning + ' ' + (d.tags || []).join(' ')).toLowerCase().includes(q));
  }
  return list;
}
function groupByMonth(list) {
  const map = new Map();
  for (const d of list) { const k = monthKey(d.decided_on); if (!map.has(k)) map.set(k, []); map.get(k).push(d); }
  return [...map.entries()].map(([label, items]) => ({ label, items }));
}

function bindDecisionsView() {
  document.querySelectorAll('#decisionGroups .decision-row').forEach(el => el.onclick = () => openDecisionModal(findDecision(el.dataset.id)));
  bindPinButtons(document.getElementById('decisionGroups'));
  document.querySelectorAll('.pill-filter').forEach(el => el.onclick = () => { state.filter.cat = el.dataset.cat; render(); });
  const search = document.getElementById('decisionSearch');
  search.oninput = () => { state.filter.q = search.value; renderDecisionGroupsOnly(); };
  search.focus();
  search.setSelectionRange(search.value.length, search.value.length);
}
function renderDecisionGroupsOnly() {
  const groups = groupByMonth(filteredDecisions());
  document.getElementById('decisionGroups').innerHTML = groups.length ? groups.map(g => `
    <div class="month-group">
      <div class="month-label">${esc(g.label)}</div>
      <div class="decision-list">${g.items.map(decisionRowHtml).join('')}</div>
    </div>
  `).join('') : emptyStateHtml('decisions');
  document.querySelectorAll('#decisionGroups .decision-row').forEach(el => el.onclick = () => openDecisionModal(findDecision(el.dataset.id)));
  bindPinButtons(document.getElementById('decisionGroups'));
}

function decisionRowHtml(d) {
  const type = d.type || 'decision';
  const preview = d.context || d.reasoning || '';
  const tags = (d.tags || []).slice(0, 3).map(t => `<span class="badge">${esc(t)}</span>`).join('');
  const catBadge = type === 'decision' ? `<span class="badge cat-${esc(d.category)}">${CAT_LABEL[d.category] || d.category}</span>` : '';
  const authorName = authorOf(d);
  const author = authorName ? `<span class="badge">by ${esc(authorName)}</span>` : '';
  return `
    <div class="decision-row" data-id="${esc(d.id)}" role="button" tabindex="0">
      <div class="decision-date">${fmtDate(d.decided_on)}</div>
      <div class="decision-body">
        <div class="decision-title">${esc(d.title)}</div>
        <div class="decision-context">${esc(preview)}</div>
        <div class="decision-meta">
          <span class="badge type-${esc(type)}">${TYPE_LABEL[type] || type}</span>
          ${catBadge}
          ${tags}
          ${author}
        </div>
      </div>
      <button class="pin-btn ${d.pinned ? 'on' : ''}" data-pin-id="${esc(d.id)}" title="${d.pinned ? 'Unpin' : 'Pin'}" aria-label="${d.pinned ? 'Unpin' : 'Pin'}">
        <svg viewBox="0 0 24 24" fill="${d.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8"><path d="m12 2 2.6 6.6L21 11l-6.4 2.4L12 20l-2.6-6.6L3 11l6.4-2.4Z"/></svg>
      </button>
    </div>
  `;
}
function authorOf(d) {
  const m = state.members.find(x => x.user_id === d.created_by || x.id === d.created_by);
  return m ? m.name : '';
}
async function togglePinned(id) {
  const d = findDecision(id);
  if (!d) return;
  const updated = await api.updateDecision(id, { pinned: !d.pinned });
  const i = state.decisions.findIndex(x => x.id === id);
  if (i > -1) state.decisions[i] = updated;
  render();
}
function bindPinButtons(root) {
  root.querySelectorAll('.pin-btn').forEach(el => el.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePinned(el.dataset.pinId);
  }));
}

function emptyStateHtml(kind) {
  const isSearch = kind === 'decisions' && state.filter.q;
  return `
    <div class="empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5.3l3.6 2.1"/></svg>
      <h3>${isSearch ? 'No matches' : 'Nothing logged yet'}</h3>
      <p>${isSearch ? 'Try a different search or type.' : 'Log your first decision, note, meeting, term, or link — it takes about 30 seconds.'}</p>
      ${isSearch ? '' : '<button class="btn btn-primary" onclick="openDecisionModal(null)">New item</button>'}
    </div>
  `;
}

function findDecision(id) { return state.decisions.find(d => d.id === id); }

/* ---------------- Settings view ---------------- */
function settingsViewHtml() {
  return `
    <div class="view-head"><div><h1>Settings</h1><p>Workspace, members, and your profile.</p></div></div>

    <div class="section-title">Workspace</div>
    <div class="field" style="max-width:420px;">
      <label>Invite code — share this with your team</label>
      <div class="auth-code-display"><span>${esc(state.workspace.invite_code)}</span>
        <button class="btn btn-ghost btn-sm" id="copyCodeBtn">Copy</button>
      </div>
    </div>

    <div class="section-title" style="margin-top:26px;">Members (${state.members.length})</div>
    <div style="max-width:420px; border:1px solid var(--line); border-radius:var(--r); padding:6px 12px;">
      ${state.members.map(m => `
        <div class="member-row">
          <div class="member-avatar">${esc(initials(m.name))}</div>
          <div class="member-name">${esc(m.name)}</div>
          <div class="member-role">${m.role === 'owner' ? 'Owner' : 'Member'}</div>
          ${state.member.role === 'owner' && m.id !== state.member.id
            ? `<button class="pin-btn" data-remove-member="${esc(m.id)}" title="Remove ${esc(m.name)}" aria-label="Remove ${esc(m.name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`
            : ''}
        </div>
      `).join('')}
    </div>

    <div class="section-title" style="margin-top:26px;">Your profile</div>
    <div class="field" style="max-width:320px;"><label>Display name</label><input type="text" id="myNameInput" value="${esc(state.member.name)}"></div>
    <button class="btn btn-primary btn-sm" id="saveNameBtn" style="margin-bottom:26px;">Save</button>

    <div class="section-title" style="margin-top:26px;">Your data</div>
    <p style="font-size:13.5px; color:var(--text-2); max-width:420px; margin:0 0 12px;">Everything you've logged, as a JSON file — yours to keep, no lock-in.</p>
    <button class="btn btn-ghost btn-sm" id="exportBtn" style="margin-bottom:26px;">Export all data</button>

    <div class="section-title">Account</div>
    <button class="btn btn-ghost" id="signOutBtn" style="margin-right:10px;">Sign out</button>
    <button class="btn btn-ghost" id="showTourBtn">Show quick tour</button>
  `;
}
function bindSettingsView() {
  document.getElementById('exportBtn').onclick = () => {
    const payload = { workspace: state.workspace.name, exported_at: new Date().toISOString(), items: state.decisions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cairn-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Export downloaded');
  };
  document.getElementById('showTourBtn').onclick = () => openTour();
  document.querySelectorAll('[data-remove-member]').forEach(el => el.onclick = async () => {
    const id = el.dataset.removeMember;
    const m = state.members.find(x => x.id === id);
    if (!m) return;
    if (!el.classList.contains('confirming')) {
      el.classList.add('confirming');
      el.innerHTML = '<span style="font-size:11.5px; padding:0 4px;">Confirm?</span>';
      el.title = `Click again to remove ${m.name}`;
      setTimeout(() => {
        if (el.isConnected && el.classList.contains('confirming')) render();
      }, 4000);
      return;
    }
    try {
      await api.removeMember(id);
      state.members = state.members.filter(x => x.id !== id);
      render();
      toast(`${m.name} removed`);
    } catch (err) { toast(err.message || 'Could not remove member.'); }
  });
  document.getElementById('copyCodeBtn').onclick = () => {
    navigator.clipboard?.writeText(state.workspace.invite_code);
    toast('Invite code copied');
  };
  document.getElementById('saveNameBtn').onclick = () => {
    state.member.name = document.getElementById('myNameInput').value.trim() || state.member.name;
    toast('Profile updated');
    document.getElementById('wsMemberLabel').textContent = state.member.name;
  };
  document.getElementById('signOutBtn').onclick = async () => { await api.signOut(); location.href = 'index.html'; };
}

/* ---------------- Decision modal ---------------- */
let modalTags = [];
let editingId = null;
const overlay = document.getElementById('decisionModalOverlay');

function applyTypeUI(type) {
  const meta = TYPE_META[type] || TYPE_META.decision;
  const modalTypeName = type === 'glossary' ? 'glossary term' : TYPE_LABEL[type].toLowerCase();
  document.getElementById('decisionModalTitle').textContent = (editingId ? 'Edit ' : 'New ') + modalTypeName;
  document.getElementById('dTitleLabel').textContent = type === 'glossary' ? 'Term' : 'Title';
  document.getElementById('dTitle').placeholder = meta.titlePh;
  document.getElementById('dContextField').style.display = meta.showContext ? 'block' : 'none';
  if (meta.showContext) {
    document.getElementById('dContextLabel').textContent = meta.contextLabel;
    document.getElementById('dContext').placeholder = meta.contextPh;
  }
  document.getElementById('dReasoningLabel').textContent = meta.reasoningLabel;
  document.getElementById('dReasoning').placeholder = meta.reasoningPh;
  document.getElementById('dCategoryField').style.display = meta.showCategory ? 'block' : 'none';
  document.getElementById('dDateLabel').textContent = meta.dateLabel;
}
document.getElementById('dType').addEventListener('change', (e) => applyTypeUI(e.target.value));

function openDecisionModal(d) {
  editingId = d ? d.id : null;
  modalTags = d ? [...(d.tags || [])] : [];
  const type = d ? (d.type || 'decision') : 'decision';
  document.getElementById('dType').value = type;
  document.getElementById('dTitle').value = d ? d.title : '';
  document.getElementById('dContext').value = d ? d.context : '';
  document.getElementById('dReasoning').value = d ? d.reasoning : '';
  document.getElementById('dCategory').value = d ? d.category : 'general';
  document.getElementById('dDate').value = d ? d.decided_on : new Date().toISOString().slice(0, 10);
  document.getElementById('dDeleteBtn').style.display = d ? 'block' : 'none';
  applyTypeUI(type);
  renderTags();
  overlay.classList.remove('hidden');
  setTimeout(() => document.getElementById('dTitle').focus(), 30);
}
function closeDecisionModal() { overlay.classList.add('hidden'); }

function renderTags() {
  const box = document.getElementById('dTagBox');
  box.querySelectorAll('.tag-chip').forEach(el => el.remove());
  const input = document.getElementById('dTagInput');
  modalTags.forEach(t => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    const span = document.createElement('span');
    span.textContent = t;
    const btn = document.createElement('button');
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    btn.onclick = () => { modalTags = modalTags.filter(x => x !== t); renderTags(); };
    chip.append(span, btn);
    box.insertBefore(chip, input);
  });
}
document.getElementById('dTagInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    e.preventDefault();
    const v = e.target.value.trim();
    if (!modalTags.includes(v)) modalTags.push(v);
    e.target.value = '';
    renderTags();
  }
});
document.getElementById('decisionModalClose').onclick = closeDecisionModal;
document.getElementById('decisionCancelBtn').onclick = closeDecisionModal;
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDecisionModal(); });

document.getElementById('decisionSaveBtn').onclick = async () => {
  const title = document.getElementById('dTitle').value.trim();
  if (!title) { toast('Title is required'); return; }
  const payload = {
    type: document.getElementById('dType').value,
    title,
    context: document.getElementById('dContext').value.trim(),
    reasoning: document.getElementById('dReasoning').value.trim(),
    category: document.getElementById('dCategory').value,
    tags: modalTags,
    decided_on: document.getElementById('dDate').value,
  };
  try {
    if (editingId) {
      const updated = await api.updateDecision(editingId, payload);
      const i = state.decisions.findIndex(d => d.id === editingId);
      if (i > -1) state.decisions[i] = updated;
      toast('Decision updated');
    } else {
      const created = await api.createDecision({ ...payload, workspace_id: state.workspace.id });
      state.decisions.unshift(created);
      toast('Decision logged');
    }
    closeDecisionModal();
    render();
  } catch (err) { toast(err.message || 'Could not save.'); }
};
document.getElementById('dDeleteBtn').onclick = async () => {
  if (!editingId) return;
  const removed = await api.deleteDecision(editingId);
  state.decisions = state.decisions.filter(d => d.id !== editingId);
  closeDecisionModal();
  render();
  toast('Decision deleted', { undo: async () => { await api.restoreDecision(removed); state.decisions.unshift(removed); render(); } });
};
document.getElementById('newDecisionBtn').onclick = () => openDecisionModal(null);

/* ---------------- Command palette ---------------- */
const cmdkOverlay = document.getElementById('cmdkOverlay');
const cmdkInput = document.getElementById('cmdkInput');
let cmdkActive = 0;
let cmdkMatches = [];

function openCmdk() {
  cmdkOverlay.classList.remove('hidden');
  cmdkInput.value = '';
  cmdkResults([]);
  setTimeout(() => cmdkInput.focus(), 20);
}
function closeCmdk() { cmdkOverlay.classList.add('hidden'); }
function cmdkResults(list) {
  cmdkMatches = list;
  cmdkActive = 0;
  const box = document.getElementById('cmdkResults');
  if (!list.length) { box.innerHTML = `<div class="cmdk-empty">${cmdkInput.value ? 'No matches' : 'Type to search your memory...'}</div>`; return; }
  box.innerHTML = list.map((d, i) => `
    <div class="cmdk-item ${i === 0 ? 'active' : ''}" data-i="${i}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v5.3l3.6 2.1"/></svg>
      <span>${esc(d.title)}</span>
      <span class="meta">${TYPE_LABEL[d.type || 'decision']} · ${fmtDate(d.decided_on)}</span>
    </div>
  `).join('');
  box.querySelectorAll('.cmdk-item').forEach(el => el.onclick = () => { openDecisionModal(cmdkMatches[+el.dataset.i]); closeCmdk(); });
}
cmdkInput.addEventListener('input', () => {
  const q = cmdkInput.value.trim().toLowerCase();
  const list = !q ? [] : state.decisions.filter(d =>
    (d.title + ' ' + (d.context || '') + ' ' + (d.reasoning || '') + ' ' + d.tags.join(' ')).toLowerCase().includes(q)
  ).slice(0, 8);
  cmdkResults(list);
});
cmdkInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdkActive = Math.min(cmdkActive + 1, cmdkMatches.length - 1); highlightCmdk(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cmdkActive = Math.max(cmdkActive - 1, 0); highlightCmdk(); }
  else if (e.key === 'Enter' && cmdkMatches[cmdkActive]) { openDecisionModal(cmdkMatches[cmdkActive]); closeCmdk(); }
  else if (e.key === 'Escape') closeCmdk();
});
function highlightCmdk() {
  document.querySelectorAll('.cmdk-item').forEach((el, i) => el.classList.toggle('active', i === cmdkActive));
}
document.getElementById('searchTrigger').onclick = openCmdk;
document.getElementById('mobileSearchBtn')?.addEventListener('click', openCmdk);
cmdkOverlay.addEventListener('click', (e) => { if (e.target === cmdkOverlay) closeCmdk(); });

/* ---------------- Accessibility: role=button divs act like buttons ---------------- */
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target?.getAttribute?.('role') === 'button') {
    e.preventDefault();
    e.target.click();
  }
});

/* ---------------- Global keyboard shortcuts ---------------- */
document.addEventListener('keydown', (e) => {
  const inShell = document.getElementById('shell').style.display !== 'none';
  if (!inShell) return;
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCmdk(); return; }
  if (e.key === 'Escape') { closeCmdk(); closeDecisionModal(); return; }
  if (!typing && e.key.toLowerCase() === 'n' && cmdkOverlay.classList.contains('hidden') && overlay.classList.contains('hidden')) { openDecisionModal(null); }
});

boot();

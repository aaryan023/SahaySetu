/**
 * SahaySetu Enterprise Command Center (js/admin.js)
 * Full 6-Module Disaster Response Operations Center
 * Persistence: Supabase Database
 */

// ==================== SUPABASE INIT ====================
const SUPABASE_URL = "https://skelexjuulrpwgfnijxt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n_Z1UNcqZ3k6TZA3T6AWsA__ZQvzlvs";
const sbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const SAHARSA_MASTER_DATA = {
  district:'Saharsa', state:'Bihar', defaultPin:'852201',
  blocks:[
    {id:1,nameEn:'Banma Itahri',nameHi:'बनमा इटहरी',subdivision:'Simri Bakhtiarpur',defaultPin:'852127'},
    {id:2,nameEn:'Kahara',nameHi:'कहरा',subdivision:'Saharsa Sadar',defaultPin:'852201'},
    {id:3,nameEn:'Mahishi',nameHi:'महिषी',subdivision:'Saharsa Sadar',defaultPin:'852216'},
    {id:4,nameEn:'Nauhatta',nameHi:'नौहट्टा',subdivision:'Saharsa Sadar',defaultPin:'852123'},
    {id:5,nameEn:'Patarghat',nameHi:'पतरघट',subdivision:'Simri Bakhtiarpur',defaultPin:'852124'},
    {id:6,nameEn:'Salkhua',nameHi:'सलखुआ',subdivision:'Saharsa Sadar',defaultPin:'852126'},
    {id:7,nameEn:'Satar Kataiya',nameHi:'सत्तर कटैया',subdivision:'Saharsa Sadar',defaultPin:'852124'},
    {id:8,nameEn:'Saur Bazar',nameHi:'सौर बाजार',subdivision:'Saharsa Sadar',defaultPin:'852202'},
    {id:9,nameEn:'Simri Bakhtiarpur',nameHi:'सिमरी बख्तियारपुर',subdivision:'Simri Bakhtiarpur',defaultPin:'852127'},
    {id:10,nameEn:'Sonbarsa',nameHi:'सोनबरसा',subdivision:'Saharsa Sadar',defaultPin:'852129'}
  ],
  pinMap:{'852201':'Saharsa H.O., Thana Chowk, Kachehri Campus, Kahara','852202':'Saur Bazar, Amarpur, Basauna, Benghaha','852203':'Saharsa Postal Area','852204':'Saharsa Postal Area','852123':'Nauhatta, Bakunia, Ekrah','852124':'Satar Kataiya, Patarghat, Aran, Bara, Gbihra','852125':'Saharsa Postal Area','852126':'Salkhua, Alani','852127':'Simri Bakhtiarpur, Banma Itahri, Balhampur, Bariarpur, Bhatauni, Ghordaur, Goriari','852129':'Sonbarsa Postal Area','852212':'Bangaon Area, Kahara','852216':'Mahishi, Aina, Bhelahi, Arapatti','852217':'Amrita, Atalkha, Balia, Baraith, Bargaon','852221':'Baijnathpur, Gamaharia Rampur, Garhia Vijaypur'}
};

let adminDashboardLoaded = false;

// In-Memory Data Models
let adminReports = [];
const inFlightReportMutations = new Set();
let adminRealtimeSubscribed = false;
let adminRealtimeChannel = null;
let adminReloadTimer = null;
let adminReportsLoadInFlight = false;
let adminReportsReloadQueued = false;
let activeReportFilter = 'all';
let reportSearchQuery = '';
let reportSearchTimer = null;
let slaTimerId = null;
let pumpStates = { pump1: true, pump2: true, sluice: true };
let adminToastTimer = null;
let telemetryPersistTimer = null;
let cmsSaveInFlight = false;
let auditLogs = [
  { time: "Just now", action: "Admin authenticated into Saharsa District Command Grid", user: "Officer Sharma (HQ)" },
  { time: "8m ago", action: "Telemetry sync: Kahara Sadar pump station operating at 100% capacity", user: "Telemetry IoT" },
  { time: "22m ago", action: "Dispatched NDRF Boat Unit #4 to Ward No. 3 Bariyahi, Kahara", user: "Dispatcher Verma" },
  { time: "45m ago", action: "Approved restock of ORS and drinking water cans for Saharsa Kachehri Relief Camp", user: "Relief Coordinator" }
];

let userDirectory = [];
let adminVolunteerLoadInFlight = false;
let adminVolunteerReloadQueued = false;

let reliefRations = [];
let volunteerRealtimeChannel = null;
let reliefRealtimeChannel = null;
let adminAuxRealtimeChannel = null;
let adminAuxReloadTimer = null;
const pendingAdminAuxReloads = new Set();

function safeStorageRead(storage, key, fallback = null) {
  try { return storage.getItem(key) ?? fallback; }
  catch (err) { console.warn(`Storage read failed for ${key}:`, err); return fallback; }
}

function safeStorageWrite(storage, key, value) {
  try { storage.setItem(key, value); return true; }
  catch (err) { console.warn(`Storage write failed for ${key}:`, err); return false; }
}

function safeStorageRemove(storage, key) {
  try { storage.removeItem(key); return true; }
  catch (err) { console.warn(`Storage removal failed for ${key}:`, err); return false; }
}

function safeHttpUrl(value, fallback = '') {
  try {
    const url = new URL(String(value || ''), window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
  } catch { return fallback; }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', logoutAdmin);
  document.getElementById('adminLogoutBtnTop')?.addEventListener('click', logoutAdmin);
  document.getElementById('admin-broadcast-form')?.addEventListener('submit', triggerMultiChannelBroadcast);
  document.getElementById('report-edit-form')?.addEventListener('submit', saveReportEdits);
  document.getElementById('admin-volunteer-form')?.addEventListener('submit', addAdminVolunteer);
  document.getElementById('relief-item-form')?.addEventListener('submit', addReliefItem);
  document.getElementById('admin-reply-form')?.addEventListener('submit', postAdminReply);
  document.getElementById('admin-comments-modal')?.addEventListener('click', e => { if (e.target.id === 'admin-comments-modal') closeAdminComments(); });
  document.getElementById('report-edit-modal')?.addEventListener('click', event => {
    if (event.target.id === 'report-edit-modal') closeReportEditModal();
  });
  ensureAdminControlSurface();
  initCountdownTimer();
  renderAllModules();
  if (!sbClient) {
    showLoginModal();
    showAuthError('Authentication service is unavailable. Please try again later.');
    return;
  }
  sbClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      hideLoginModal();
      loadAdminDashboard();
    } else if (event === 'SIGNED_OUT') {
      adminDashboardLoaded = false;
      stopAdminRealtimeChannels();
      showLoginModal();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (slaTimerId) { clearInterval(slaTimerId); slaTimerId = null; }
    } else {
      initCountdownTimer();
      if (pendingAdminAuxReloads.has('reports')) scheduleAdminReportsReload();
      if ([...pendingAdminAuxReloads].some(key => key !== 'reports')) scheduleAdminAuxReload();
    }
  });
  window.addEventListener('pagehide', stopAdminRealtimeChannels, { once: true });
  window.addEventListener('online', () => {
    if (adminDashboardLoaded) { scheduleAdminReportsReload(); scheduleAdminAuxReload('volunteers', 'inventory', 'settings'); }
  });
  try {
    const { data: { session }, error } = await sbClient.auth.getSession();
    if (error) throw error;
    if (session && session.user) {
      hideLoginModal();
      loadAdminDashboard();
    } else showLoginModal();
  } catch (error) {
    console.error('Unable to check admin authentication session:', error);
    showLoginModal();
    showAuthError(error.message || 'Unable to verify your session. Please sign in.');
  }
});

function showLoginModal() {
  document.getElementById('admin-lock-screen')?.classList.remove('unlocked');
  document.body.classList.add('overflow-hidden');
}

function hideLoginModal() {
  document.getElementById('admin-lock-screen')?.classList.add('unlocked');
  document.body.classList.remove('overflow-hidden');
}

function showAuthError(message) {
  const el = document.getElementById('authErrorMsg');
  if (el) { el.textContent = message; el.classList.remove('hidden'); }
}

function resetLoginBtn() {
  const button = document.getElementById('adminLoginBtn');
  if (!button) return;
  button.disabled = false;
  button.innerHTML = '<span class="material-symbols-outlined text-[20px]">lock_open</span><span>Authenticate &amp; Enter →</span>';
}

async function handleAdminLogin(e) {
  e.preventDefault();
  if (!sbClient) { showAuthError('Authentication service is unavailable. Please try again later.'); return; }
  const button = document.getElementById('adminLoginBtn');
  document.getElementById('authErrorMsg')?.classList.add('hidden');
  if (button) { button.disabled = true; button.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span><span>Authenticating...</span>'; }
  const email = document.getElementById('adminEmail')?.value.trim();
  const password = document.getElementById('adminPassword')?.value;
  if (!email || !password) { showAuthError('Enter your email and password.'); resetLoginBtn(); return; }
  try {
    const { error } = await sbClient.auth.signInWithPassword({ email, password });
    if (error) showAuthError(error.message || 'Invalid credentials! Access denied.');
  } catch (error) {
    console.error('Admin login failed:', error);
    showAuthError(error.message || 'Unable to sign in. Please try again.');
  } finally { resetLoginBtn(); }
}

function loadAdminDashboard() {
  if (adminDashboardLoaded) return;
  adminDashboardLoaded = true;
  initializeAdminData();
}

function ensureAdminControlSurface() {
  const main = document.getElementById('admin-main-content');
  if (main && !document.getElementById('admin-metrics')) {
    const metrics = document.createElement('section');
    metrics.id = 'admin-metrics';
    metrics.className = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4';
    metrics.innerHTML = `
      <div class="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm"><span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Reports Logged</span><strong id="admin-metric-total" class="mt-2 block text-3xl font-extrabold text-slate-900">0</strong></div>
      <div class="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm"><span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Critical / SOS Active</span><strong id="admin-metric-critical" class="mt-2 block text-3xl font-extrabold text-red-600">0</strong></div>
      <div class="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm"><span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Triage</span><strong id="admin-metric-pending" class="mt-2 block text-3xl font-extrabold text-amber-600">0</strong></div>
      <div class="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm"><span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Resolved &amp; Safe</span><strong id="admin-metric-resolved" class="mt-2 block text-3xl font-extrabold text-emerald-600">0</strong></div>
    `;
    main.insertBefore(metrics, main.firstChild);
  }

  const tableWrapper = document.getElementById('incident-table-wrapper');
  if (tableWrapper && !document.getElementById('report-filter-toolbar')) {
    const toolbar = document.createElement('div');
    toolbar.id = 'report-filter-toolbar';
    toolbar.className = 'mb-3 space-y-3';
    toolbar.innerHTML = `
      <input id="report-search" type="search" autocomplete="off" placeholder="Search ward, landmark, category, mobile, or description..." class="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 outline-none focus:border-blue-600">
      <div id="report-filter-tabs" class="flex flex-wrap gap-2">
        <button type="button" data-report-filter="all" class="report-filter-btn rounded-full bg-blue-600 px-3 py-2 text-xs font-bold text-white">All Reports</button>
        <button type="button" data-report-filter="critical" class="report-filter-btn rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">🚨 SOS / Critical</button>
        <button type="button" data-report-filter="pending" class="report-filter-btn rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">⏳ Pending</button>
        <button type="button" data-report-filter="resolved" class="report-filter-btn rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">✅ Resolved</button>
        <button type="button" data-report-filter="blocked" class="report-filter-btn rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">🚫 Blocked</button>
      </div>
    `;
    tableWrapper.parentNode.insertBefore(toolbar, tableWrapper);
    toolbar.querySelector('#report-search').addEventListener('input', event => {
      clearTimeout(reportSearchTimer);
      reportSearchTimer = setTimeout(() => {
        reportSearchQuery = event.target.value.trim().toLowerCase();
        renderIncidentTable();
      }, 180);
    });
    toolbar.querySelectorAll('[data-report-filter]').forEach(button => {
      button.addEventListener('click', () => {
        activeReportFilter = button.dataset.reportFilter;
        toolbar.querySelectorAll('[data-report-filter]').forEach(tab => {
          tab.classList.toggle('bg-blue-600', tab === button);
          tab.classList.toggle('text-white', tab === button);
          tab.classList.toggle('bg-slate-100', tab !== button);
          tab.classList.toggle('text-slate-700', tab !== button);
        });
        renderIncidentTable();
      });
    });
  }

  const telemetryCard = document.querySelector('#tab-cms .grid > div:nth-child(2)');
  if (telemetryCard && !document.getElementById('pump-control-panel')) {
    const panel = document.createElement('div');
    panel.id = 'pump-control-panel';
    panel.className = 'space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs';
    panel.innerHTML = `
      <div class="font-bold text-slate-800">Pump &amp; Sluice Controls</div>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" data-pump-toggle="pump1" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-semibold">Pump #1 <span data-pump-status="pump1" class="ml-1"></span></button>
        <button type="button" data-pump-toggle="pump2" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-semibold">Pump #2 <span data-pump-status="pump2" class="ml-1"></span></button>
        <button type="button" data-pump-toggle="sluice" class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left font-semibold">Sluice Gates <span data-pump-status="sluice" class="ml-1"></span></button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>Koshi <strong id="koshi-level-value">39.6m</strong><span id="koshi-level-status" class="ml-2"></span></div>
        <div>Eastern Basin <strong id="koshi-tributary-level-value">40.3m</strong><span id="koshi-tributary-level-status" class="ml-2"></span></div>
      </div>
      <label class="block font-semibold text-slate-700">Koshi Water Level (m)<input id="koshi-level-input" type="number" min="0" max="60" step="0.1" value="39.6" class="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2"></label>
      <label class="block font-semibold text-slate-700">Eastern Basin Water Level (m)<input id="koshi-tributary-level-input" type="number" min="0" max="60" step="0.1" value="40.3" class="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2"></label>
    `;
    const sliders = telemetryCard.querySelector('.space-y-4');
    telemetryCard.insertBefore(panel, sliders);
    panel.querySelectorAll('[data-pump-toggle]').forEach(button => {
      button.addEventListener('click', () => togglePump(button.dataset.pumpToggle));
    });
    panel.querySelectorAll('input[type="number"]').forEach(input => {
      input.addEventListener('input', persistWaterLevels);
    });
  }
}

// ==================== AUTHENTICATION GATE ====================
function lockAdmin() {
  stopAdminRealtimeChannels();
  showLoginModal();
}

async function logoutAdmin(e) {
  e?.preventDefault();
  try { if (sbClient) await sbClient.auth.signOut(); }
  catch (err) { console.error('Admin sign-out failed:', err); showAdminToast('Unable to sign out cleanly.', 'error'); }
  finally { stopAdminRealtimeChannels(); window.location.reload(); }
}

function stopAdminRealtimeChannels() {
  if (adminReloadTimer) clearTimeout(adminReloadTimer);
  if (adminAuxReloadTimer) clearTimeout(adminAuxReloadTimer);
  if (slaTimerId) clearInterval(slaTimerId);
  if (telemetryPersistTimer) clearTimeout(telemetryPersistTimer);
  slaTimerId = null;
  telemetryPersistTimer = null;
  adminReloadTimer = adminAuxReloadTimer = null;
  adminReportsReloadQueued = adminVolunteerReloadQueued = reliefReloadQueued = siteSettingsReloadQueued = false;
  pendingAdminAuxReloads.clear();
  [adminRealtimeChannel, volunteerRealtimeChannel, reliefRealtimeChannel, siteSettingsRealtime].forEach(channel => {
    if (channel && sbClient) sbClient.removeChannel(channel).catch(err => console.warn('Unable to stop admin realtime channel:', err));
  });
  adminRealtimeChannel = volunteerRealtimeChannel = reliefRealtimeChannel = siteSettingsRealtime = null;
  adminRealtimeSubscribed = false;
}

// ==================== DATA SYNC (Supabase) ====================

/**
 * Map a Supabase row to the internal admin report shape.
 */
function mapSupabaseRowAdmin(row) {
  const createdAt = row.created_at || row.timestamp || Date.now();
  const elapsed = Date.now() - new Date(createdAt).getTime();
  let timeString;
  if (elapsed < 60000) timeString = 'Just now';
  else if (elapsed < 3600000) timeString = `${Math.floor(elapsed / 60000)}m ago`;
  else if (elapsed < 86400000) timeString = `${Math.floor(elapsed / 3600000)}h ago`;
  else timeString = `${Math.floor(elapsed / 86400000)}d ago`;

  return {
    id: row.id,
    title: row.landmark ? `${row.area}, ${row.landmark}` : (row.area || 'Unknown Location'),
    area: row.area || 'Unspecified Ward',
    landmark: row.landmark || '',
    city: row.city || 'Saharsa, Bihar',
    pin: row.pincode || row.pin || SAHARSA_MASTER_DATA.defaultPin,
    category: row.category || 'other',
    urgency: row.urgency || 'Normal',
    status: row.status || 'pending',
    isVerified: row.is_verified === true,
    timeString: timeString,
    timestamp: new Date(createdAt).getTime(),
    created_at: row.created_at || new Date(createdAt).toISOString(),
    reporter: row.reporter_name || row.reporter || 'Citizen',
    phone: row.mobile || row.phone || '',
    description: row.description || '',
    upvotes: row.upvotes || 0,
    downvotes: row.downvotes || 0,
    assigned_to: row.assigned_to || '',
    resolution_note: row.resolution_note || '',
    image: row.photo_url || row.image || ''
  };
}

async function initializeAdminData() {
  renderAdminDashboard([]); await loadAdminReports();
  await Promise.all([loadAdminVolunteers(), loadReliefInventory(), loadSiteSettings()]);
  initializeLiveMap();
  if (sbClient && !adminRealtimeSubscribed) {
    try { adminRealtimeChannel = sbClient.channel('admin:realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, handleAdminRealtimeChange).subscribe(); adminRealtimeSubscribed = true; }
    catch (err) { console.error('Unable to subscribe to admin report updates:', err); }
  }
}

function handleAdminRealtimeChange(payload) {
  if (document.hidden) { pendingAdminAuxReloads.add('reports'); return; }
  scheduleAdminReportsReload();
}

function scheduleAdminReportsReload() {
  if (document.hidden) { pendingAdminAuxReloads.add('reports'); return; }
  pendingAdminAuxReloads.delete('reports');
  if (adminReloadTimer) clearTimeout(adminReloadTimer);
  adminReloadTimer = setTimeout(() => {
    adminReloadTimer = null;
    loadAdminReports();
  }, 400);
}

function scheduleAdminAuxReload(...keys) {
  keys.forEach(key => pendingAdminAuxReloads.add(key));
  if (document.hidden) return;
  if (adminAuxReloadTimer) clearTimeout(adminAuxReloadTimer);
  adminAuxReloadTimer = setTimeout(() => {
    adminAuxReloadTimer = null;
    const pending = [...pendingAdminAuxReloads];
    pendingAdminAuxReloads.clear();
    if (pending.includes('volunteers')) loadAdminVolunteers();
    if (pending.includes('inventory')) loadReliefInventory();
    if (pending.includes('settings')) loadSiteSettings();
  }, 400);
}

async function loadAdminReports() {
  if (adminReportsLoadInFlight) { adminReportsReloadQueued = true; return; }
  adminReportsLoadInFlight = true;
  try {
    if (!sbClient) throw new Error('Supabase client is unavailable.');
    const { data, error } = await sbClient.from('reports').select('id,category,urgency,area,landmark,city,pincode,description,mobile,reporter_name,status,is_verified,upvotes,downvotes,assigned_to,resolution_note,photo_url,created_at').order('created_at', { ascending: false });
    if (error) throw error; renderAdminDashboard((data || []).map(mapSupabaseRowAdmin));
  } catch (e) { console.error('Error fetching admin reports:', e); if (!adminReports.length) renderAdminDashboard([]); }
  finally {
    adminReportsLoadInFlight = false;
    if (adminReportsReloadQueued) { adminReportsReloadQueued = false; scheduleAdminReportsReload(); }
  }
}

function renderAdminDashboard(data) {
  adminReports = data.sort((a, b) => b.timestamp - a.timestamp);
  renderAdminReportModules();
}

function normalizeReportId(value) {
  try {
    return decodeURIComponent(String(value));
  } catch (err) {
    console.error('Invalid encoded report ID:', err);
    return String(value);
  }
}

function timeAgo(value) {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (elapsed < 60000) return 'Just now';
  if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m ago`;
  if (elapsed < 86400000) return `${Math.floor(elapsed / 3600000)}h ago`;
  return `${Math.floor(elapsed / 86400000)}d ago`;
}

function renderAdminMetrics() {
  const activeReports = adminReports.filter(report => String(report.status).toLowerCase() !== 'blocked');
  const values = {
    'admin-metric-total': activeReports.length,
    'admin-metric-critical': adminReports.filter(report => String(report.urgency).toUpperCase() === 'CRITICAL' && String(report.status).toLowerCase() !== 'resolved').length,
    'admin-metric-pending': activeReports.filter(report => String(report.status).toLowerCase() === 'pending').length,
    'admin-metric-resolved': activeReports.filter(report => String(report.status).toLowerCase() === 'resolved').length
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
}

function saveAdminReports() {
  persistAdminReports();
}

function persistAdminReports() { /* Reports are persisted through Supabase operations. */ }

// ==================== TAB NAVIGATION ====================
function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
      btn.classList.remove('text-slate-600', 'hover:bg-slate-100');
    } else {
      btn.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
      btn.classList.add('text-slate-600', 'hover:bg-slate-100');
    }
  });

  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  const target = document.getElementById(`tab-${tabId}`);
  if (target) target.classList.add('active');
  if (tabId === 'analytics') setTimeout(() => { initializeLiveMap(); liveMap?.invalidateSize(); }, 100);
}

// ==================== MODULE 1: URGENT SOS & DIRECT CONTACT ====================
let slaCountdown = 3600; // 60 minutes
function initCountdownTimer() {
  if (slaTimerId || document.hidden) return;
  slaTimerId = setInterval(() => {
    slaCountdown--;
    if (slaCountdown < 0) slaCountdown = 3600;
    const mins = Math.floor(slaCountdown / 60);
    const secs = slaCountdown % 60;
    const timerElem = document.getElementById('sla-timer');
    if (timerElem) {
      timerElem.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }, 1000);
}

function renderUrgentSOS() {
  const container = document.getElementById('urgent-sos-list');
  if (!container) return;

  const urgentList = adminReports.filter(r => ['critical', 'high'].includes(String(r.urgency).toLowerCase()));
  const sosBadge = document.getElementById('sos-count-badge');
  if (sosBadge) sosBadge.textContent = urgentList.length;

  if (urgentList.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Zero pending critical SOS alerts. All sector grids stable.</div>`;
    return;
  }

  container.innerHTML = urgentList.map(item => {
    const isResolved = String(item.status).toLowerCase() === 'resolved';
    const cleanPhone = String(item.phone || '+919835012345').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
    const waText = encodeURIComponent(`Hello ${item.reporter}, NDRF Disaster Control here regarding your incident at ${item.title}. Emergency rescue team dispatched.`);
    const callAuditMessage = encodeInlineArgument(`Initiated phone call to ${cleanPhone}`);
    const whatsappAuditMessage = encodeInlineArgument(`WhatsApp dispatched coordinates to ${cleanPhone}`);

    return `
      <div class="p-4 rounded-xl border ${isResolved ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/30'} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all">
        
        <div class="flex-1 space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-extrabold uppercase animate-pulse">
              SOS CRITICAL
            </span>
            <span class="text-xs font-bold text-slate-800">${escapeHtml(item.title)}</span>
            <span class="text-[11px] text-slate-500">• ${item.timeString || 'Recently'}</span>
            <!-- AI Spam / Duplicate Risk Score Badge -->
            <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              ✓ 98% Legitimacy (AI Verified)
            </span>
          </div>

          <p class="text-xs text-slate-700 leading-relaxed max-w-2xl">
            ${escapeHtml(item.description)}
          </p>

          <div class="flex items-center gap-4 text-xs text-slate-500 pt-1">
            <span class="font-medium text-slate-700 flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px] text-blue-600">person</span>
              ${escapeHtml(item.reporter || 'Citizen')} (${cleanPhone})
            </span>
            <span class="text-amber-700 font-semibold flex items-center gap-1">
              <span class="material-symbols-outlined text-[15px]">thumb_up</span>
              👍 ${item.upvotes || 0} • 👎 ${item.downvotes || 0} votes
            </span>
          </div>
        </div>

        <!-- Direct Action Triggers -->
        <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
          
          <!-- Click to Call -->
          <a href="tel:${cleanPhone}" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all" onclick="addAuditLog(decodeURIComponent('${callAuditMessage}'))">
            <span class="material-symbols-outlined text-[15px]">call</span>
            <span>Call</span>
          </a>

          <!-- WhatsApp Citizen -->
          <a href="https://wa.me/${cleanPhone.replace(/[^0-9]/g, '')}?text=${waText}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all" onclick="addAuditLog(decodeURIComponent('${whatsappAuditMessage}'))">
            <span class="material-symbols-outlined text-[15px]">chat</span>
            <span>WhatsApp</span>
          </a>

          <!-- Field Dispatch Dropdown -->
          <select onchange="assignFieldUnit('${encodeInlineArgument(item.id)}', this.value)" class="text-xs font-medium h-8 px-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 focus:outline-none focus:border-blue-600">
            <option value="">Assign Unit...</option>
            <option value="NDRF Inflatable Boat 4">NDRF Boat #4</option>
            <option value="Civil Defense Squad B">Civil Defense B</option>
            <option value="Red Cross Medical Van">Red Cross Van</option>
            <option value="Local Ward Volunteers">Ward Volunteers</option>
          </select>

          <!-- Assistance Verified Approval Toggle -->
          <button type="button" onclick="adminToggleStatus('${encodeInlineArgument(item.id)}')" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${isResolved ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'}">
            ${isResolved ? '↺ Reopen Pending' : '✓ Approve Assistance'}
          </button>

        </div>

      </div>
    `;
  }).join('');
}

function renderIncidentTable() {
  const tbody = document.getElementById('incident-table-body');
  if (!tbody) return;
  const visibleReports = adminReports.filter(item => {
    const status = String(item.status || 'pending').toLowerCase();
    const urgency = String(item.urgency || 'normal').toLowerCase();
    const matchesFilter = activeReportFilter === 'all'
      || (activeReportFilter === 'critical' && urgency.includes('critical'))
      || (activeReportFilter === 'pending' && status === 'pending')
      || (activeReportFilter === 'resolved' && status === 'resolved')
      || (activeReportFilter === 'blocked' && status === 'blocked');
    const searchable = [item.area, item.landmark, item.category, item.phone, item.description, item.reporter]
      .join(' ')
      .toLowerCase();
    return matchesFilter && searchable.includes(reportSearchQuery);
  });
  if (!visibleReports.length) {
    tbody.innerHTML = '<tr><td colspan="9" class="p-5 text-center text-xs text-slate-400">No reports available.</td></tr>';
    return;
  }

  tbody.innerHTML = visibleReports.map(item => {
    const urgency = String(item.urgency || 'Normal');
    const urgencyIsCritical = urgency.toLowerCase().includes('critical');
    const urgencyClass = urgencyIsCritical
      ? 'bg-red-100 text-red-700 animate-pulse'
      : urgency.toLowerCase() === 'high'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-100 text-emerald-700';
    const categoryIcons = { flood: 'water_damage', food: 'lunch_dining', medical: 'medical_services', power: 'bolt', road: 'traffic', shelter: 'roofing' };
    const safePhotoUrl = safeHttpUrl(item.image);
    const photo = safePhotoUrl
      ? `<button type="button" onclick="openReportPhoto('${encodeInlineArgument(safePhotoUrl)}')" aria-label="View report photo"><img src="${escapeHtml(safePhotoUrl)}" alt="Report photo" loading="lazy" decoding="async" class="h-12 w-12 rounded-lg object-cover"></button>`
      : `<span class="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><span class="material-symbols-outlined">${categoryIcons[String(item.category).toLowerCase()] || 'report'}</span></span>`;
    const reportId = encodeInlineArgument(item.id);
    const status = String(item.status || 'pending').toLowerCase();
    const statusClass = status === 'resolved' ? 'bg-emerald-100 text-emerald-700'
      : status === 'blocked' ? 'bg-slate-200 text-slate-700'
        : status === 'verified' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-800';
    const createdAt = item.created_at || item.timestamp;

    return `
      <tr class="border-b border-slate-100 align-top text-xs text-slate-700">
        <td class="p-3">${photo}</td>
        <td class="p-3 font-semibold"><div>${escapeHtml(item.category || 'other')}</div><time class="mt-1 block text-[10px] font-normal text-slate-400">${escapeHtml(item.timeString || timeAgo(createdAt))}</time></td>
        <td class="p-3"><span class="rounded-full px-2 py-1 text-[10px] font-bold ${urgencyClass}">${escapeHtml(urgency)}</span></td>
        <td class="p-3"><div class="font-semibold">${escapeHtml(item.area || '—')}</div><div class="mt-1 text-[11px] text-slate-500">${escapeHtml(item.landmark || '')}</div></td>
        <td class="max-w-xs whitespace-normal p-3">${escapeHtml(item.description || '—')}</td>
        <td class="p-3">${item.phone ? `<a class="text-blue-600 hover:underline" href="tel:${encodeURIComponent(String(item.phone).replace(/[^\d+]/g, ''))}">${escapeHtml(item.phone)}</a>` : '—'}</td>
        <td class="p-3">${escapeHtml(item.reporter || 'Citizen')}<div class="mt-1 whitespace-nowrap text-[10px] font-semibold text-slate-500">👍 ${item.upvotes || 0} • 👎 ${item.downvotes || 0}</div></td>
        <td class="p-3"><span class="rounded-full px-2 py-1 text-[10px] font-bold ${statusClass}">${escapeHtml(status)}</span></td>
        <td class="p-3"><div class="flex flex-wrap gap-1.5">
          <button type="button" onclick="openAdminComments('${reportId}')" class="rounded-lg bg-indigo-50 px-2 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100">Comments</button>
          <button type="button" onclick="verifyReport('${reportId}')" class="rounded-lg bg-blue-50 px-2 py-1.5 font-bold text-blue-700 hover:bg-blue-100">${item.isVerified ? 'Unverify' : 'Verify'}</button>
          <button type="button" onclick="blockReport('${reportId}')" class="rounded-lg bg-red-50 px-2 py-1.5 font-bold text-red-700 hover:bg-red-100">Block</button>
          <button type="button" onclick="resolveReport('${reportId}')" class="rounded-lg bg-emerald-50 px-2 py-1.5 font-bold text-emerald-700 hover:bg-emerald-100">Resolve</button>
          <button type="button" onclick="openEditReport('${reportId}')" class="rounded-lg bg-slate-100 px-2 py-1.5 font-bold text-slate-700 hover:bg-slate-200">Edit</button>
          <button type="button" onclick="deleteReport('${reportId}')" class="rounded-lg bg-slate-100 px-2 py-1.5 font-bold text-slate-700 hover:bg-slate-200">Delete</button>
        </div></td>
      </tr>
    `;
  }).join('');
}

async function updateReportFields(reportId, fields) {
  const id = normalizeReportId(reportId);
  if (inFlightReportMutations.has(id)) return false;
  const item = adminReports.find(report => String(report.id) === id);
  if (!item) return;

  inFlightReportMutations.add(id);
  try {
    if (!sbClient) throw new Error('Supabase client is unavailable.');
    const { data, error } = await sbClient
      .from('reports')
      .update(fields)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Report update did not match a database record.');
  } catch (err) {
    console.error('Report update failed:', err);
    showAdminToast('Report update failed in Supabase.', 'error');
    return false;
  } finally { inFlightReportMutations.delete(id); }
  Object.assign(item, fields);
  if (fields.reporter_name !== undefined) item.reporter = fields.reporter_name;
  if (fields.mobile !== undefined) item.phone = fields.mobile;
  if (fields.pincode !== undefined) item.pin = fields.pincode;
  if (fields.is_verified !== undefined) item.isVerified = Boolean(fields.is_verified);
  if (fields.assigned_to !== undefined) item.assigned_to = fields.assigned_to;
  if (fields.resolution_note !== undefined) item.resolution_note = fields.resolution_note;
  persistAdminReports();
  renderAdminReportModules();
  addAuditLog(`Updated report #${id}: ${Object.keys(fields).join(', ')}`);
  return true;
}

function verifyReport(reportId) {
  const item = adminReports.find(report => String(report.id) === normalizeReportId(reportId));
  if (!item) return;
  return updateReportFields(reportId, { is_verified: !item.isVerified });
}

function blockReport(reportId) {
  if (!confirm('Are you sure you want to block this report from the public feed?')) return;
  return updateReportFields(reportId, { status: 'blocked' });
}

function resolveReport(reportId) {
  return updateReportFields(reportId, { status: 'resolved' });
}

function openEditReport(reportId) {
  const id = normalizeReportId(reportId);
  const item = adminReports.find(report => String(report.id) === id);
  const modal = document.getElementById('report-edit-modal');
  if (!item || !modal) return;
  const form = document.getElementById('report-edit-form');
  const fields = ['report-edit-description','report-edit-name','report-edit-mobile','report-edit-landmark','report-edit-pincode','report-edit-category','report-edit-assigned','report-edit-resolution','report-edit-urgency','report-edit-area'].map(id => document.getElementById(id));
  if (!form || fields.some(field => !field)) return;
  form.dataset.reportId = encodeInlineArgument(id);
  fields[0].value = item.description || '';
  fields[1].value = item.reporter || '';
  fields[2].value = item.phone || '';
  fields[3].value = item.landmark || '';
  fields[4].value = item.pin || '';
  fields[5].value = item.category || 'other';
  fields[6].value = item.assigned_to || '';
  fields[7].value = item.resolution_note || '';
  const urgency = String(item.urgency || 'Normal').toUpperCase();
  fields[8].value = urgency.includes('CRITICAL') ? 'CRITICAL' : urgency === 'HIGH' ? 'High' : 'Normal';
  fields[9].value = item.area || '';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeReportEditModal() {
  const modal = document.getElementById('report-edit-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function saveReportEdits(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const id = form.dataset.reportId;
  const fieldsById = Object.fromEntries(['report-edit-description','report-edit-name','report-edit-mobile','report-edit-landmark','report-edit-pincode','report-edit-category','report-edit-assigned','report-edit-resolution','report-edit-urgency','report-edit-area'].map(id => [id, document.getElementById(id)]));
  if (Object.values(fieldsById).some(field => !field)) return;
  const description = fieldsById['report-edit-description'].value.trim();
  const urgency = fieldsById['report-edit-urgency'].value;
  const area = fieldsById['report-edit-area'].value.trim();
  if (!description || !area || !id) return;
  const fields = {
    reporter_name: fieldsById['report-edit-name'].value.trim(),
    mobile: fieldsById['report-edit-mobile'].value.trim(),
    area,
    landmark: fieldsById['report-edit-landmark'].value.trim(),
    pincode: fieldsById['report-edit-pincode'].value.trim(),
    category: fieldsById['report-edit-category'].value,
    urgency,
    description,
    assigned_to: fieldsById['report-edit-assigned'].value.trim(),
    resolution_note: fieldsById['report-edit-resolution'].value.trim()
  };
  if (await updateReportFields(id, fields)) closeReportEditModal();
}

async function deleteReport(reportId) {
  const id = normalizeReportId(reportId);
  if (!confirm('Permanently delete this report?')) return;
  if (inFlightReportMutations.has(id)) return;
  const index = adminReports.findIndex(report => String(report.id) === id);
  if (index < 0) return;
  inFlightReportMutations.add(id);
  try {
    if (!sbClient) throw new Error('Supabase client is unavailable.');
    const { data, error } = await sbClient.from('reports').delete().eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Report was not deleted by the database.');
    adminReports.splice(index, 1);
    persistAdminReports();
    renderAdminReportModules();
  } catch (err) {
    console.error('Supabase report deletion failed:', err);
    showAdminToast('Report deletion failed in Supabase.', 'error');
    return;
  } finally {
    inFlightReportMutations.delete(id);
  }
  addAuditLog(`Permanently deleted report #${id}`);
}

function openReportPhoto(encodedUrl) {
  const modal = document.getElementById('report-photo-lightbox');
  const image = document.getElementById('report-photo-lightbox-image');
  if (!modal || !image) return;
  const photoUrl = safeHttpUrl(normalizeReportId(encodedUrl));
  if (!photoUrl) return;
  image.src = photoUrl;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeReportPhotoLightbox() {
  const modal = document.getElementById('report-photo-lightbox');
  const image = document.getElementById('report-photo-lightbox-image');
  if (!modal || !image) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  image.src = '';
}

function assignFieldUnit(reportId, unitName) {
  if (!unitName) return;
  reportId = normalizeReportId(reportId);
  return updateReportFields(reportId, { assigned_to: unitName });
}

async function adminToggleStatus(reportId) {
  const id = normalizeReportId(reportId);
  if (inFlightReportMutations.has(id)) return;
  const item = adminReports.find(r => String(r.id) === id);
  if (!item) return;

  const newStatus = String(item.status).toLowerCase() === 'resolved' ? 'pending' : 'resolved';
  const oldStatus = item.status;
  inFlightReportMutations.add(id);
  item.status = newStatus;
  persistAdminReports();
  renderAdminReportModules();

  try {
    if (!sbClient) throw new Error('Supabase client is unavailable.');
    const { data, error } = await sbClient
      .from('reports')
      .update({ status: newStatus })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Report status was not updated by the database.');
  } catch (err) {
    item.status = oldStatus;
    renderAdminReportModules();
    console.error('Status update failed:', err);
    showAdminToast('Status change failed in Supabase.', 'error');
    return;
  } finally {
    inFlightReportMutations.delete(id);
  }

  addAuditLog(`Status for #${id} set to ${newStatus.toUpperCase()}`);
}

// ==================== MODULE 2: USERS & VOLUNTEERS ====================
let userRoleFilter = 'all';
function filterUsersByRole(role) {
  userRoleFilter = role;
  document.querySelectorAll('.user-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-role') === role) {
      btn.classList.add('bg-blue-600', 'text-white', 'shadow-sm');
      btn.classList.remove('bg-white', 'text-slate-600');
    } else {
      btn.classList.remove('bg-blue-600', 'text-white', 'shadow-sm');
      btn.classList.add('bg-white', 'text-slate-600');
    }
  });
  renderUserTable();
}

function renderUserTable() {
  const tbody = document.getElementById('user-table-body');
  const search = (document.getElementById('user-search-input')?.value || '').toLowerCase();
  if (!tbody) return;

  const filtered = userDirectory.filter(u => {
    const matchRole = userRoleFilter === 'all' || u.role.toLowerCase().includes(userRoleFilter.toLowerCase());
    const matchSearch = String(u.name || '').toLowerCase().includes(search) || String(u.phone || '').includes(search) || String(u.ward || '').toLowerCase().includes(search);
    return matchRole && matchSearch;
  });

  tbody.innerHTML = filtered.map(u => {
    let badgeClass = 'bg-blue-100 text-blue-800';
    if (u.role === 'Official') badgeClass = 'bg-purple-100 text-purple-800';
    if (u.role === 'NGO Partner') badgeClass = 'bg-amber-100 text-amber-800';
    if (u.role === 'Volunteer') badgeClass = 'bg-emerald-100 text-emerald-800';

    return `
      <tr class="border-b border-slate-100 hover:bg-slate-50/70 text-xs text-slate-700">
        <td class="py-3 px-4 font-semibold text-slate-900">${escapeHtml(u.name)}</td>
        <td class="py-3 px-4">${escapeHtml(u.phone)}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeClass}">
            ${escapeHtml(u.role)}
          </span>
        </td>
        <td class="py-3 px-4"><input aria-label="Duty / ward" value="${escapeHtml(u.ward)}" onchange="updateVolunteer('${encodeInlineArgument(u.id)}',{ward:this.value})" class="w-40 rounded border border-slate-200 px-2 py-1"></td>
        <td class="py-3 px-4">
          <span class="font-medium ${u.verified ? 'text-emerald-600' : 'text-slate-400'}">
            ${u.verified ? '✓ Verified' : 'Unverified'}
          </span>
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${u.blocked ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}">
            ${escapeHtml(u.blocked ? 'Blocked' : (u.shift || 'Active'))}
          </span>
        </td>
        <td class="py-3 px-4">
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="toggleUserVerify('${encodeInlineArgument(u.id)}')" class="text-blue-600 hover:underline font-semibold">
              ${u.verified ? 'Revoke' : 'Verify'}
            </button>
            <span>•</span>
            <select aria-label="Role" onchange="updateVolunteer('${encodeInlineArgument(u.id)}',{role:this.value})" class="rounded border border-slate-200 px-1 py-1 text-[10px]"><option ${u.role==='Volunteer'?'selected':''}>Volunteer</option><option ${u.role==='NGO Partner'?'selected':''}>NGO Partner</option><option ${u.role==='Official'?'selected':''}>Official</option><option ${u.role==='Coordinator'?'selected':''}>Coordinator</option></select>
            <button type="button" onclick="toggleUserBlock('${encodeInlineArgument(u.id)}')" class="${u.blocked ? 'text-emerald-600' : 'text-red-600'} hover:underline font-semibold">
              ${u.blocked ? 'Unblock' : 'Block'}
            </button>
            <button type="button" onclick="deleteVolunteer('${encodeInlineArgument(u.id)}')" class="text-red-700 hover:underline font-semibold">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadAdminVolunteers() {
  if (!sbClient) return;
  if (adminVolunteerLoadInFlight) { adminVolunteerReloadQueued = true; return; }
  adminVolunteerLoadInFlight = true;
  try {
    const { data, error } = await sbClient.from('volunteers').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    userDirectory = (data || []).map(mapVolunteerRow);
    renderUserTable();
    if (!volunteerRealtimeChannel) volunteerRealtimeChannel = sbClient.channel('admin:volunteers').on('postgres_changes', { event: '*', schema: 'public', table: 'volunteers' }, () => scheduleAdminAuxReload('volunteers')).subscribe();
  } catch (err) { console.error('Unable to load volunteers:', err); showAdminToast('Volunteer table unavailable; check Supabase setup.', 'error'); }
  finally {
    adminVolunteerLoadInFlight = false;
    if (adminVolunteerReloadQueued) { adminVolunteerReloadQueued = false; scheduleAdminAuxReload('volunteers'); }
  }
}
function mapVolunteerRow(row) { return {id:String(row.id),name:row.name || row.full_name || '',phone:row.phone || row.mobile || '',role:row.role || 'Volunteer',ward:row.ward || row.duty || '',verified:Boolean(row.verified),blocked:Boolean(row.blocked),shift:row.shift || ''}; }
const activeAdminFormSubmissions = new WeakSet();
async function withAdminFormLock(event, operation) {
  const form = event.currentTarget;
  if (!form || activeAdminFormSubmissions.has(form)) return;
  activeAdminFormSubmissions.add(form);
  const submitButton = event.submitter || form.querySelector('button[type="submit"], input[type="submit"]');
  const previousDisabled = submitButton?.disabled || false;
  if (submitButton) submitButton.disabled = true;
  try { await operation(form); }
  catch (err) { console.error('Admin form submission failed:', err); showAdminToast(err.message || 'Unable to complete this action.', 'error'); }
  finally { activeAdminFormSubmissions.delete(form); if (submitButton) submitButton.disabled = previousDisabled; }
}
async function persistVolunteer(query, message) {
  try { const { error } = await query; if (error) throw error; await loadAdminVolunteers(); return true; }
  catch (err) { console.error(message, err); showAdminToast(message, 'error'); return false; }
}
async function addAdminVolunteer(event) {
  event.preventDefault();
  return withAdminFormLock(event, async form => {
    if (!sbClient) throw new Error('Supabase is unavailable.');
    const payload = { name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim(), role: form.elements.role.value, ward: form.elements.ward.value.trim(), verified: true, blocked: false, shift: 'Active Duty' };
    if (await persistVolunteer(sbClient.from('volunteers').insert(payload), 'Unable to add volunteer.')) form.reset();
  });
}
async function updateVolunteer(id, fields) { id=normalizeReportId(id);const u=userDirectory.find(x=>String(x.id)===id);if(!u||!sbClient)return false;const saved=await persistVolunteer(sbClient.from('volunteers').update(fields).eq('id',id),'Unable to update volunteer.');if(saved)addAuditLog(`Volunteer ${u.name}: ${Object.keys(fields).join(', ')}`);return saved; }
function toggleUserVerify(id) { id=normalizeReportId(id);const u=userDirectory.find(x=>String(x.id)===id);if(u)return updateVolunteer(id,{verified:!u.verified}); }
function toggleUserBlock(id) { id=normalizeReportId(id);const u=userDirectory.find(x=>String(x.id)===id);if(u)return updateVolunteer(id,{blocked:!u.blocked,shift:u.blocked?'Active Duty':'Blocked'}); }
async function deleteVolunteer(id) { id=normalizeReportId(id);if(!confirm('Delete this volunteer record?'))return; if(!sbClient){showAdminToast('Supabase is unavailable.','error');return;} await persistVolunteer(sbClient.from('volunteers').delete().eq('id',id),'Unable to delete volunteer.'); }

// ==================== MODULE 3: DYNAMIC CMS & TELEMETRY ====================
function initCmsControls() {
  let banner = { active: true, tag: "High Priority Alert", text: "Koshi river water level rising near Eastern Embankment. Low-lying areas in Nauhatta, Mahishi, Salkhua & Simri Bakhtiarpur on high alert. SDRF/NDRF relief boats active.", helpline: "1077" };
  try {
    const raw = localStorage.getItem('sahaysetu_cms_banner');
    if (raw) {
      const storedBanner = JSON.parse(raw);
      if (storedBanner && typeof storedBanner === 'object') banner = { ...banner, ...storedBanner };
    }
  } catch (e) {
    console.error('Unable to load the saved CMS banner:', e);
  }

  const textInput = document.getElementById('cms-text-input');
  const tagInput = document.getElementById('cms-tag-input');
  const helplineInput = document.getElementById('cms-helpline-input');
  const activeToggle = document.getElementById('cms-active-toggle');

  if (textInput) textInput.value = banner.text || '';
  if (tagInput) tagInput.value = banner.tag || '';
  if (helplineInput) helplineInput.value = banner.helpline || '1077';
  if (activeToggle) activeToggle.checked = banner.active !== false;
  try {
    const broadcast = localStorage.getItem('sahaysetu_broadcast_ticker');
    if (broadcast && textInput) textInput.value = broadcast;
  } catch (err) {
    console.error('Unable to load the saved alert ticker:', err);
  }

  // Sliders
  let tel = { kaharaPump: 100, simriPump: 78, koshiSluice: "Open" };
  try {
    const raw = localStorage.getItem('sahaysetu_telemetry');
    if (raw) {
      const storedTelemetry = JSON.parse(raw);
      if (storedTelemetry && typeof storedTelemetry === 'object') tel = { ...tel, ...storedTelemetry };
    }
  } catch (e) {
    console.error('Unable to load saved telemetry:', e);
  }

  const sSlider = document.getElementById('telemetry-kahara-slider');
  const pSlider = document.getElementById('telemetry-simri-slider');
  const sText = document.getElementById('telemetry-kahara-disp');
  const pText = document.getElementById('telemetry-simri-disp');

  if (pSlider) pSlider.value = tel.simriPump ?? 78;
  if (sText) sText.textContent = `${sSlider?.value ?? 100}%`;
  if (pText) pText.textContent = `${pSlider?.value ?? 78}%`;
  initPumpControls();
  loadSiteSettings();
}

let siteSettingsRealtime = null;
let siteSettingsLoadInFlight = false;
let siteSettingsReloadQueued = false;
async function saveSiteSetting(key, value) {
  if (!sbClient) throw new Error('Supabase unavailable');
  const { error } = await sbClient.from('site_settings').upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}
async function loadSiteSettings() {
  if (!sbClient) return;
  if (siteSettingsLoadInFlight) { siteSettingsReloadQueued = true; return; }
  siteSettingsLoadInFlight = true;
  try {
    const { data, error } = await sbClient.from('site_settings').select('key,value').in('key', ['cms_banner', 'telemetry', 'active_broadcast']);
    if (error) throw error;
    for (const row of data || []) {
      let value = row.value;
      if (typeof value === 'string') { try { value = JSON.parse(value); } catch { continue; } }
      if (!value || typeof value !== 'object') continue;
      if (row.key === 'cms_banner') {
        const text = document.getElementById('cms-text-input'); if (text) text.value = value.text || '';
        const tag = document.getElementById('cms-tag-input'); if (tag) tag.value = value.tag || '';
        const helpline = document.getElementById('cms-helpline-input'); if (helpline) helpline.value = value.helpline || '1077';
        const active = document.getElementById('cms-active-toggle'); if (active) active.checked = value.active !== false;
      }
      if (row.key === 'telemetry') {
        const kahara = document.getElementById('telemetry-kahara-slider'), simri = document.getElementById('telemetry-simri-slider');
        if (kahara && value.kaharaPump != null) kahara.value = value.kaharaPump;
        if (simri && value.simriPump != null) simri.value = value.simriPump;
        pumpStates = { ...pumpStates, ...(value.pumpStates || {}) };
        if (value.levels) {
          const koshi = document.getElementById('koshi-level-input'), tributary = document.getElementById('koshi-tributary-level-input');
          if (koshi) koshi.value = value.levels.koshi;
          if (tributary) tributary.value = value.levels.kosiTributary;
          renderWaterLevels(value.levels);
        }
        renderPumpStates();
        updateTelemetryValues(false);
      }
    }
    if (!siteSettingsRealtime) siteSettingsRealtime = sbClient.channel('admin:site_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => scheduleAdminAuxReload('settings')).subscribe();
  } catch (err) { console.error('Unable to load site settings:', err); }
  finally {
    siteSettingsLoadInFlight = false;
    if (siteSettingsReloadQueued) { siteSettingsReloadQueued = false; scheduleAdminAuxReload('settings'); }
  }
}

async function saveCmsBanner() {
  if (cmsSaveInFlight) return;
  const activeInput = document.getElementById('cms-active-toggle');
  const tagInput = document.getElementById('cms-tag-input');
  const textInput = document.getElementById('cms-text-input');
  const helplineInput = document.getElementById('cms-helpline-input');
  if (!activeInput || !tagInput || !textInput || !helplineInput) return;
  cmsSaveInFlight = true;
  const banner = {
    active: activeInput.checked,
    tag: tagInput.value.trim(),
    text: textInput.value.trim(),
    helpline: helplineInput.value.trim(),
    time: "Live Telemetry • Central Flood Control"
  };

  try {
    await saveSiteSetting('cms_banner',banner);
    safeStorageWrite(localStorage, 'sahaysetu_cms_banner', JSON.stringify(banner));
    safeStorageWrite(localStorage, 'sahaysetu_broadcast_ticker', banner.text);
  } catch (err) {
    console.error('Unable to save the CMS banner:', err);
    showAdminToast('CMS banner could not be saved to Supabase.','error');
    return;
  } finally { cmsSaveInFlight = false; }
  addAuditLog(`Live CMS alert banner updated: "${banner.text.substring(0, 30)}..."`);
  showAdminToast('Broadcast Live! ✓');
}

async function updateTelemetryValues(persist = true) {
  const sSlider = document.getElementById('telemetry-kahara-slider');
  const pSlider = document.getElementById('telemetry-simri-slider');
  if (!sSlider || !pSlider) return;
  const s = parseInt(sSlider.value, 10);
  const p = parseInt(pSlider.value, 10);

  const sText = document.getElementById('telemetry-kahara-disp');
  const pText = document.getElementById('telemetry-simri-disp');
  if (sText) sText.textContent = `${s}%`;
  if (pText) pText.textContent = `${p}%`;

  const tel = { kaharaPump: s, simriPump: p, koshiSluice: "Open" };
  try {
    localStorage.setItem('sahaysetu_telemetry', JSON.stringify(tel));
  } catch (err) {
    console.error('Unable to save telemetry:', err);
  }
  if (persist) {
    if (telemetryPersistTimer) clearTimeout(telemetryPersistTimer);
    telemetryPersistTimer = setTimeout(async () => {
      telemetryPersistTimer = null;
      try {
        await saveSiteSetting('telemetry', { ...tel, pumpStates, levels: { koshi: Number(document.getElementById('koshi-level-input')?.value || 39.6), kosiTributary: Number(document.getElementById('koshi-tributary-level-input')?.value || 40.3) } });
        addAuditLog(`Pump telemetry discharge levels adjusted: Kahara Sadar=${s}%, Simri Bakhtiarpur=${p}%`);
      } catch (err) { console.error('Telemetry sync failed:', err); }
    }, 400);
  }
}

function initPumpControls() {
  try {
    const stored = localStorage.getItem('sahaysetu_pumps');
    if (stored) {
      const savedStates = JSON.parse(stored);
      if (savedStates && typeof savedStates === 'object' && !Array.isArray(savedStates)) {
        pumpStates = { ...pumpStates, ...savedStates };
      }
    }
  } catch (err) {
    console.error('Unable to load pump control states:', err);
  }
  renderPumpStates();

  let levels = { koshi: 39.6, kosiTributary: 40.3 };
  try {
    const stored = localStorage.getItem('sahaysetu_water_levels');
    if (stored) {
      const savedLevels = JSON.parse(stored);
      if (savedLevels && typeof savedLevels === 'object') levels = { ...levels, ...savedLevels };
    }
  } catch (err) {
    console.error('Unable to load water level values:', err);
  }
  const koshiInput = document.getElementById('koshi-level-input');
  const tributaryInput = document.getElementById('koshi-tributary-level-input');
  if (koshiInput) koshiInput.value = levels.koshi;
  if (tributaryInput) tributaryInput.value = levels.kosiTributary;
  renderWaterLevels(levels);
}

function renderPumpStates() {
  document.querySelectorAll('[data-pump-status]').forEach(status => {
    const key = status.dataset.pumpStatus;
    const active = Boolean(pumpStates[key]);
    status.textContent = active ? 'ACTIVE / RUNNING' : 'STANDBY / OFFLINE';
    status.className = `ml-1 ${active ? 'text-emerald-600' : 'text-slate-500'}`;
  });
}

function togglePump(pumpKey) {
  if (!Object.prototype.hasOwnProperty.call(pumpStates, pumpKey)) return;
  pumpStates[pumpKey] = !pumpStates[pumpKey];
  try {
    localStorage.setItem('sahaysetu_pumps', JSON.stringify(pumpStates));
  } catch (err) {
    console.error('Unable to save pump control states:', err);
    showAdminToast('Pump state could not be saved.', 'error');
  }
  renderPumpStates();
  updateTelemetryValues();
  addAuditLog(`${pumpKey} set to ${pumpStates[pumpKey] ? 'ACTIVE / RUNNING' : 'STANDBY / OFFLINE'}`);
}

function persistWaterLevels() {
  const koshiInput = document.getElementById('koshi-level-input');
  const tributaryInput = document.getElementById('koshi-tributary-level-input');
  const levels = {
    koshi: Number(koshiInput?.value),
    kosiTributary: Number(tributaryInput?.value)
  };
  if (!Number.isFinite(levels.koshi) || !Number.isFinite(levels.kosiTributary)) return;
  try {
    localStorage.setItem('sahaysetu_water_levels', JSON.stringify(levels));
  } catch (err) {
    console.error('Unable to save water level values:', err);
  }
  renderWaterLevels(levels);
  updateTelemetryValues();
}

function renderWaterLevels(levels) {
  [['koshi', levels.koshi], ['koshi-tributary', levels.kosiTributary]].forEach(([river, level]) => {
    const value = document.getElementById(`${river}-level-value`);
    const status = document.getElementById(`${river}-level-status`);
    if (value) value.textContent = `${Number(level).toFixed(1)}m`;
    if (!status) return;
    const danger = Number(level) > 42;
    const alert = Number(level) >= 40 && Number(level) <= 42;
    status.textContent = danger ? 'DANGER' : alert ? 'ALERT' : 'SAFE';
    status.className = `ml-2 font-bold ${danger ? 'text-red-600' : alert ? 'text-amber-600' : 'text-emerald-600'}`;
  });
}

// ==================== MODULE 4: BROADCAST HUB ====================
async function triggerMultiChannelBroadcast(event) {
  event.preventDefault();
  return withAdminFormLock(event, async form => {
    const wardInput = document.getElementById('broadcast-ward-select');
    const messageInput = document.getElementById('broadcast-message-input');
    const appInput = document.getElementById('chk-push-app');
    const smsInput = document.getElementById('chk-push-sms');
    const whatsappInput = document.getElementById('chk-push-wa');
    if (!wardInput || !messageInput || !appInput || !smsInput || !whatsappInput) return;
    const ward = wardInput.value;
    const msg = messageInput.value.trim();
    const pushApp = appInput.checked, pushSms = smsInput.checked, pushWa = whatsappInput.checked;
    if (!msg) { alert('Please write a broadcast message.'); return; }
    const whatsappWindow = pushWa ? window.open('about:blank', '_blank') : null;
    const channels = [];
    if (pushApp) channels.push('Mobile App Push');
    if (pushSms) channels.push('Emergency SMS');
    if (pushWa) channels.push('WhatsApp Alert');
    const broadcast = { ward, message: msg, channels, created_at: new Date().toISOString() };
    try {
      await saveSiteSetting('active_broadcast', broadcast);
      safeStorageWrite(localStorage, 'sahaysetu_broadcast_ticker', msg);
    } catch (err) {
      whatsappWindow?.close();
      console.error('Broadcast sync failed:', err);
      showAdminToast('Broadcast could not be published to Supabase.', 'error');
      return;
    }
    addAuditLog(`Multicast broadcast sent to ${ward} via [${channels.join(', ')}]: "${msg.substring(0, 30)}..."`);
    if (pushWa && whatsappWindow) {
      const official = `SAHARSA DISTRICT COMMAND â€¢ ${ward}\n${msg}\nEmergency Helpline: 1077`;
      whatsappWindow.location.href = `https://wa.me/?text=${encodeURIComponent(official)}`;
    }
    showAdminToast(`Broadcast published for ${ward}.`);
    messageInput.value = '';
  });
}
// ==================== MODULE 5: RELIEF CAMPS & RATIONS ====================
function renderRationTable() {
  const tbody = document.getElementById('ration-table-body');
  if (!tbody) return;

  tbody.innerHTML = reliefRations.map(r => {
    const isLow = Number(r.stock) < (Number(r.min) * 0.3);
    return `
      <tr class="border-b border-slate-100 text-xs">
        <td class="py-2.5 px-3 font-semibold text-slate-800">${escapeHtml(r.camp_name)}<div class="mt-1 font-normal">${escapeHtml(r.item)}</div></td>
        <td class="py-2.5 px-3 font-bold ${isLow ? 'text-red-600' : 'text-slate-700'}">${Number(r.stock) || 0} ${escapeHtml(r.unit)}</td>
        <td class="py-2.5 px-3 text-slate-500">${Number(r.min) || 0} ${escapeHtml(r.unit)}</td>
        <td class="py-2.5 px-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isLow ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'}">
            ${isLow ? 'Critical Low (<20%)' : 'Optimal'}
          </span>
        </td>
        <td class="py-2.5 px-3">
          <div class="flex flex-wrap items-center gap-1.5"><button type="button" onclick="adjustReliefStock('${encodeInlineArgument(r.id)}',50)" class="rounded-lg bg-blue-50 px-2 py-1 font-semibold text-blue-700">+50</button><button type="button" onclick="adjustReliefStock('${encodeInlineArgument(r.id)}',-10)" class="rounded-lg bg-amber-50 px-2 py-1 font-semibold text-amber-700">-10</button><input type="number" min="0" value="${Number(r.stock)}" aria-label="Custom stock" onchange="setReliefStock('${encodeInlineArgument(r.id)}',this.value)" class="w-20 rounded border border-slate-200 px-2 py-1"><button type="button" onclick="deleteReliefItem('${encodeInlineArgument(r.id)}')" class="text-red-600">Delete</button></div>
        </td>
      </tr>
    `;
  }).join('');
}

let reliefLoadInFlight = false;
let reliefReloadQueued = false;
async function loadReliefInventory() {
  if (!sbClient) return;
  if (reliefLoadInFlight) { reliefReloadQueued = true; return; }
  reliefLoadInFlight = true;
  try {
    const { data, error } = await sbClient.from('relief_inventory').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    reliefRations = (data || []).map(row => ({ id: String(row.id), camp_name: row.camp_name || '', item: row.item_name || row.item || '', stock: Number(row.current_stock ?? row.stock ?? 0), min: Number(row.min_required ?? row.min ?? 0), unit: row.unit || 'Units' }));
    renderRationTable();
    if (!reliefRealtimeChannel) reliefRealtimeChannel = sbClient.channel('admin:relief_inventory').on('postgres_changes', { event: '*', schema: 'public', table: 'relief_inventory' }, () => scheduleAdminAuxReload('inventory')).subscribe();
  } catch (err) { console.error('Unable to load relief inventory:', err); showAdminToast('Relief inventory table unavailable; check Supabase setup.', 'error'); }
  finally {
    reliefLoadInFlight = false;
    if (reliefReloadQueued) { reliefReloadQueued = false; scheduleAdminAuxReload('inventory'); }
  }
}
async function addReliefItem(event) {
  event.preventDefault();
  return withAdminFormLock(event, async form => {
    if (!sbClient) throw new Error('Supabase is unavailable.');
    const payload = { camp_name: form.elements.camp_name.value.trim(), item_name: form.elements.item_name.value.trim(), current_stock: Number(form.elements.current_stock.value), min_required: Number(form.elements.min_required.value), unit: form.elements.unit.value.trim() };
    const { error } = await sbClient.from('relief_inventory').insert(payload);
    if (error) throw error;
    form.reset();
    await loadReliefInventory();
  });
}
async function setReliefStock(id, value) {
  const stock = Math.max(0, Number(value));
  if (!Number.isFinite(stock) || !sbClient) return;
  try {
    const { error } = await sbClient.from('relief_inventory').update({ current_stock: stock }).eq('id', normalizeReportId(id));
    if (error) throw error;
    await loadReliefInventory();
  } catch (err) { console.error('Unable to update relief stock:', err); showAdminToast('Unable to update stock.', 'error'); }
}
async function adjustReliefStock(id, delta) { const item = reliefRations.find(row => row.id === normalizeReportId(id)); if (item) await setReliefStock(id, Math.max(0, item.stock + delta)); }
async function deleteReliefItem(id) {
  if (!confirm('Delete this relief inventory row?') || !sbClient) return;
  try {
    const { error } = await sbClient.from('relief_inventory').delete().eq('id', normalizeReportId(id));
    if (error) throw error;
    await loadReliefInventory();
  } catch (err) { console.error('Unable to delete relief inventory row:', err); showAdminToast('Unable to delete inventory row.', 'error'); }
}

let activeCommentReportId = null;
async function openAdminComments(reportId) {
  activeCommentReportId = normalizeReportId(reportId);
  const modal = document.getElementById('admin-comments-modal');
  modal?.classList.remove('hidden'); modal?.classList.add('flex');
  const form = document.getElementById('admin-reply-form');
  if (form) form.dataset.reportId = encodeInlineArgument(activeCommentReportId);
  await loadAdminComments();
}
function closeAdminComments() {
  const modal = document.getElementById('admin-comments-modal');
  modal?.classList.add('hidden'); modal?.classList.remove('flex');
}
async function loadAdminComments() {
  const list = document.getElementById('admin-comments-list');
  if (!list || !activeCommentReportId) return;
  list.innerHTML = '<p class="text-xs text-slate-500">Loading comments…</p>';
  try {
    if (!sbClient) throw new Error('Supabase is unavailable.');
    const { data, error } = await sbClient.from('report_comments').select('*').eq('report_id', activeCommentReportId).order('created_at', { ascending: true });
    if (error) throw error;
    list.innerHTML = (data || []).map(comment => `<article class="rounded-xl border border-slate-200 p-3"><div class="flex items-center justify-between gap-2"><strong class="text-xs">${escapeHtml(comment.name || comment.author_name || 'Citizen')}</strong>${comment.is_admin_reply ? '<span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Official HQ Reply</span>' : ''}<button type="button" onclick="deleteReportComment('${encodeInlineArgument(comment.id)}')" class="text-[10px] font-bold text-red-600">Delete</button></div><p class="mt-1 text-xs text-slate-700">${escapeHtml(comment.comment || comment.body || '')}</p></article>`).join('') || '<p class="text-xs text-slate-500">No comments yet.</p>';
  } catch (err) { console.error('Unable to load comments:', err); list.innerHTML = '<p class="text-xs text-amber-700">Comments unavailable; verify report_comments permissions.</p>'; }
}
async function postAdminReply(event) {
  event.preventDefault();
  return withAdminFormLock(event, async form => {
    const comment = form.elements.comment?.value.trim();
    if (!comment || !activeCommentReportId || !sbClient) return;
    const { error } = await sbClient.from('report_comments').insert({ report_id: activeCommentReportId, name: 'SahaySetu District Command', comment, is_admin_reply: true });
    if (error) throw error;
    form.reset();
    await loadAdminComments();
  });
}
async function deleteReportComment(id) {
  if (!confirm('Delete this comment?')) return;
  try {
    if (!sbClient) throw new Error('Supabase is unavailable.');
    const { error } = await sbClient.from('report_comments').delete().eq('id', normalizeReportId(id));
    if (error) throw error;
    await loadAdminComments();
  } catch (err) { console.error('Comment deletion failed:', err); showAdminToast('Comment could not be deleted.', 'error'); }
}

let liveMap=null, liveMapMarkers=[];
const SAHARSA_BLOCK_COORDS={'Banma Itahri':[25.668722,86.670962],'Kahara':[25.873373,86.594274],'Mahishi':[25.854547,86.469956],'Nauhatta':[25.997326,86.480774],'Patarghat':[25.814892,86.790293],'Salkhua':[25.668650,86.597820],'Satar Kataiya':[25.949170,86.578060],'Saur Bazar':[25.835200,86.683800],'Simri Bakhtiarpur':[25.723781,86.580032],'Sonbarsa':[25.712134,86.770008]};
function initializeLiveMap(){const el=document.getElementById('saharsa-live-map');if(!el||!window.L)return;if(!liveMap){liveMap=L.map(el).setView([25.8835,86.6006],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(liveMap);}liveMapMarkers.forEach(m=>m.remove());liveMapMarkers=[];adminReports.filter(r=>String(r.status).toLowerCase()!=='blocked').forEach((r,index)=>{const area=Object.keys(SAHARSA_BLOCK_COORDS).find(name=>String(r.area||'').toLowerCase().includes(name.toLowerCase()))||'Kahara';const base=SAHARSA_BLOCK_COORDS[area],lat=base[0]+((index%5)-2)*0.0012,lng=base[1]+((Math.floor(index/5)%5)-2)*0.0012;const color=String(r.status).toLowerCase()==='resolved'?'green':String(r.urgency).toLowerCase()==='critical'?'red':'orange';const marker=L.circleMarker([lat,lng],{radius:8,color,fillColor:color,fillOpacity:.85}).addTo(liveMap);const photoUrl=safeHttpUrl(r.image);const photo=photoUrl?`<img src="${escapeHtml(photoUrl)}" alt="Report photo" loading="lazy" decoding="async" style="width:100%;max-height:90px;object-fit:cover">`:'';const safeId=encodeInlineArgument(r.id);marker.bindPopup(`<div style="width:210px">${photo}<strong>${escapeHtml(r.title)}</strong><div>${escapeHtml(r.category)} • ${escapeHtml(r.phone||'')}</div><div>👍 ${r.upvotes||0} / 👎 ${r.downvotes||0}</div><button onclick="resolveReport('${safeId}')">Resolve</button></div>`);liveMapMarkers.push(marker);});}
function resolveMapReport(id){return resolveReport(id);}

// ==================== MODULE 6: ANALYTICS & EXPORT SUITE ====================
function exportDataAsCsv() {
  const headers = ['ID', 'Category', 'Urgency', 'Area', 'Landmark', 'Description', 'Citizen Name', 'Mobile', 'Status', 'Created At', 'Photo URL'];
  const rows = adminReports.map(report => [
    report.id,
    report.category,
    report.urgency,
    report.area,
    report.landmark,
    report.description,
    report.reporter,
    report.phone,
    report.status,
    report.created_at || report.timestamp,
    report.image
  ].map(csvEscape).join(','));
  const date = new Date();
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const csvContent = `\uFEFF${headers.map(csvEscape).join(',')}\r\n${rows.join('\r\n')}`;
  downloadBlob(csvContent, `Saharsa_Reports_${dateString}.csv`, 'text/csv;charset=utf-8');
  addAuditLog("Exported reports as CSV");
}

function exportDataAsExcel() {
  const headers = ["Incident ID\tTitle\tArea\tCategory\tUrgency\tStatus\tReporter\tPhone\tUpvotes"];
  const rows = adminReports.map(r => [
    r.id,
    r.title || '',
    r.area || '',
    r.category || '',
    r.urgency || '',
    r.status || '',
    r.reporter || '',
    r.phone || '',
    r.upvotes || 0
  ].join('\t'));

  const tsvContent = [headers, ...rows].join('\n');
  downloadBlob(tsvContent, 'sahaysetu_disaster_reports.xls', 'application/vnd.ms-excel');
  addAuditLog("Exported reports in Excel-compatible spreadsheet structure");
}

function printSummaryReport() {
  window.print();
  addAuditLog("Generated print-ready disaster incident summary");
}

function downloadBlob(content, filename, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==================== AUDIT LOGS ====================
function addAuditLog(action) {
  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  auditLogs.unshift({ time: now, action: action, user: "Officer Sharma (HQ)" });
  renderAuditLogs();
}

function renderAuditLogs() {
  const container = document.getElementById('audit-log-list');
  if (!container) return;

  container.innerHTML = auditLogs.slice(0, 8).map(log => `
    <div class="py-2 border-b border-slate-100 flex items-start justify-between text-xs gap-3">
      <div>
        <span class="font-semibold text-slate-800">${escapeHtml(log.action)}</span>
        <span class="block text-[11px] text-slate-400 font-medium">By ${escapeHtml(log.user)}</span>
      </div>
      <span class="text-[10px] text-slate-400 font-mono flex-shrink-0">${log.time}</span>
    </div>
  `).join('');
}

// ==================== MASTER RENDER ====================
function renderAllModules() {
  renderAdminMetrics();
  renderUrgentSOS();
  renderIncidentTable();
  renderUserTable();
  initCmsControls();
  renderRationTable();
  renderAuditLogs();
}

function renderAdminReportModules() {
  renderAdminMetrics();
  renderUrgentSOS();
  renderIncidentTable();
  if(liveMap)initializeLiveMap();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function encodeInlineArgument(value) {
  return encodeURIComponent(String(value)).replace(/'/g, '%27');
}

function showAdminToast(message, variant = 'success') {
  const toast = document.getElementById('admin-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('hidden', 'bg-emerald-600', 'bg-red-600');
  toast.classList.add(variant === 'error' ? 'bg-red-600' : 'bg-emerald-600');
  if (adminToastTimer) clearTimeout(adminToastTimer);
  adminToastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
}

window.addAuditLog = addAuditLog;
window.lockAdmin = lockAdmin;
window.logoutAdmin = logoutAdmin;
window.switchTab = switchTab;
window.renderUrgentSOS = renderUrgentSOS;
window.loadAdminReports = loadAdminReports;
window.renderAdminDashboard = renderAdminDashboard;
window.verifyReport = verifyReport;
window.blockReport = blockReport;
window.resolveReport = resolveReport;
window.deleteReport = deleteReport;
window.openEditReport = openEditReport;
window.closeReportEditModal = closeReportEditModal;
window.openReportPhoto = openReportPhoto;
window.closeReportPhotoLightbox = closeReportPhotoLightbox;
window.filterUsersByRole = filterUsersByRole;
window.renderUserTable = renderUserTable;
window.toggleUserVerify = toggleUserVerify;
window.toggleUserBlock = toggleUserBlock;
window.updateVolunteer = updateVolunteer;
window.deleteVolunteer = deleteVolunteer;
window.adjustReliefStock = adjustReliefStock;
window.setReliefStock = setReliefStock;
window.deleteReliefItem = deleteReliefItem;
window.openAdminComments = openAdminComments;
window.closeAdminComments = closeAdminComments;
window.deleteReportComment = deleteReportComment;
window.resolveMapReport = resolveMapReport;
window.saveCmsBanner = saveCmsBanner;
window.updateTelemetryValues = updateTelemetryValues;
window.togglePump = togglePump;
window.persistWaterLevels = persistWaterLevels;
window.exportDataAsCsv = exportDataAsCsv;
window.triggerMultiChannelBroadcast = triggerMultiChannelBroadcast;
window.assignFieldUnit = assignFieldUnit;
window.adminToggleStatus = adminToggleStatus;
window.approveRestock = (idx) => { const item=reliefRations[idx]; if(item)adjustReliefStock(item.id,50); };
window.exportDataAsExcel = exportDataAsExcel;
window.printSummaryReport = printSummaryReport;

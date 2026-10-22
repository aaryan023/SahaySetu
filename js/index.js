/**
 * SahaySetu Public Incident & Flood Response Dashboard (js/index.js)
 * Fully responsive single-page civic platform with top ward deck, prioritized hero feed,
 * real-time bilingual engine (English and Hindi), and WhatsApp share alert integration.
 * Persistence: Supabase Realtime + Database
 */

// ==================== SUPABASE INIT ====================
const SUPABASE_URL = "https://skelexjuulrpwgfnijxt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n_Z1UNcqZ3k6TZA3T6AWsA__ZQvzlvs";
const sbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const SAHARSA_MASTER_DATA = {
  district: 'Saharsa', state: 'Bihar', defaultPin: '852201',
  blocks: [
    { id: 1, nameEn: 'Banma Itahri', nameHi: 'बनमा इटहरी', subdivision: 'Simri Bakhtiarpur', defaultPin: '852127' },
    { id: 2, nameEn: 'Kahara', nameHi: 'कहरा', subdivision: 'Saharsa Sadar', defaultPin: '852201' },
    { id: 3, nameEn: 'Mahishi', nameHi: 'महिषी', subdivision: 'Saharsa Sadar', defaultPin: '852216' },
    { id: 4, nameEn: 'Nauhatta', nameHi: 'नौहट्टा', subdivision: 'Saharsa Sadar', defaultPin: '852123' },
    { id: 5, nameEn: 'Patarghat', nameHi: 'पतरघट', subdivision: 'Simri Bakhtiarpur', defaultPin: '852124' },
    { id: 6, nameEn: 'Salkhua', nameHi: 'सलखुआ', subdivision: 'Saharsa Sadar', defaultPin: '852126' },
    { id: 7, nameEn: 'Satar Kataiya', nameHi: 'सत्तर कटैया', subdivision: 'Saharsa Sadar', defaultPin: '852124' },
    { id: 8, nameEn: 'Saur Bazar', nameHi: 'सौर बाजार', subdivision: 'Saharsa Sadar', defaultPin: '852202' },
    { id: 9, nameEn: 'Simri Bakhtiarpur', nameHi: 'सिमरी बख्तियारपुर', subdivision: 'Simri Bakhtiarpur', defaultPin: '852127' },
    { id: 10, nameEn: 'Sonbarsa', nameHi: 'सोनबरसा', subdivision: 'Saharsa Sadar', defaultPin: '852129' }
  ],
  pinMap: { '852201':'Saharsa H.O., Thana Chowk, Kachehri Campus, Kahara','852202':'Saur Bazar, Amarpur, Basauna, Benghaha','852203':'Saharsa Postal Area','852204':'Saharsa Postal Area','852123':'Nauhatta, Bakunia, Ekrah','852124':'Satar Kataiya, Patarghat, Aran, Bara, Gbihra','852125':'Saharsa Postal Area','852126':'Salkhua, Alani','852127':'Simri Bakhtiarpur, Banma Itahri, Balhampur, Bariarpur, Bhatauni, Ghordaur, Goriari','852129':'Sonbarsa Postal Area','852212':'Bangaon Area, Kahara','852216':'Mahishi, Aina, Bhelahi, Arapatti','852217':'Amrita, Atalkha, Balia, Baraith, Bargaon','852221':'Baijnathpur, Gamaharia Rampur, Garhia Vijaypur' },

};

// Global State
let reports = [];
let dashboardStats = null;
let wardAnalytics = null;
let activeCategory = 'all';
let activeStatus = 'all';
let activeWardFilter = null;
let searchQuery = '';
let currentLanguage = 'en';
let searchDebounceTimer = null;
let wardSearchDebounceTimer = null;
let remoteCmsBanner = null;
let remoteBroadcast = null;
let remoteTelemetry = null;
let feedSortMode = 'for-you';
let lastAffinitySearchArea = '';
const localVoteLocks = new Set();
const inFlightVotes = new Set();
const inFlightComments = new Set();
let reportRealtimeChannel = null;
let settingsRealtimeChannel = null;
let reportRealtimeTimer = null;
let settingsRealtimeTimer = null;
let reportRealtimeNeedsRefresh = false;
const pendingReportChanges = new Map();
let pendingPublicResync = false;

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

function safeStorageJSON(storage, key, fallback) {
  const raw = safeStorageRead(storage, key);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); }
  catch (err) { console.warn(`Stored JSON is invalid for ${key}:`, err); return fallback; }
}

function safeHttpUrl(value, fallback = '') {
  try {
    const url = new URL(String(value || ''), window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
  } catch { return fallback; }
}

function encodeInlineArgument(value) {
  return encodeURIComponent(String(value ?? '')).replace(/'/g, '%27');
}

function decodeInlineArgument(value) {
  try { return decodeURIComponent(String(value ?? '')); }
  catch { return String(value ?? ''); }
}

function readUserAffinity() {
  try {
    const stored = JSON.parse(localStorage.getItem('sahaysetu_user_affinity') || '{}');
    return { areas: stored.areas || {}, categories: stored.categories || {}, homeArea: stored.homeArea || '' };
  } catch { return { areas: {}, categories: {}, homeArea: '' }; }
}

function recordUserAffinity(type, value) {
  const affinity = readUserAffinity();
  const add = (bucket, key, amount) => {
    if (!key) return;
    const normalized = String(key).trim();
    if (normalized) bucket[normalized] = Number(bucket[normalized] || 0) + amount;
  };
  if (type === 'area') add(affinity.areas, value, 6);
  if (type === 'category') add(affinity.categories, value, 3);
  if (type === 'report') {
    const report = typeof value === 'object' ? value : reports.find(item => String(item.id) === decodeInlineArgument(value));
    if (report) { add(affinity.areas, report.area, 5); add(affinity.categories, report.category, 4); }
  }
  if (type === 'home' && value) { affinity.homeArea = String(value).trim(); add(affinity.areas, affinity.homeArea, 10); }
  try { localStorage.setItem('sahaysetu_user_affinity', JSON.stringify(affinity)); } catch (err) { console.warn('User affinity could not be saved:', err); }
}

function computeAiFeedScore(report) {
  const affinity = readUserAffinity();
  const areas = Object.entries(affinity.areas).sort((a, b) => b[1] - a[1]);
  const topAreas = [];
  if (affinity.homeArea) topAreas.push(affinity.homeArea);
  areas.forEach(([area]) => { if (!topAreas.includes(area)) topAreas.push(area); });
  const areaRank = topAreas.indexOf(report.area);
  const areaScore = areaRank === 0 ? 35 : areaRank > 0 && areaRank < 3 ? 15 : 0;
  const maxCategoryAffinity = Math.max(0, ...Object.values(affinity.categories).map(Number));
  const categoryScore = maxCategoryAffinity ? Math.min(25, (Number(affinity.categories[report.category] || 0) / maxCategoryAffinity) * 25) : 0;
  const urgency = String(report.urgency || '').toLowerCase();
  const urgencyScore = urgency === 'critical' && report.status !== 'resolved' ? 30 : urgency === 'high' ? 15 : 0;
  const engagementScore = (Number(report.upvotes || 0) * 4) + (Number(report.comment_count || 0) * 5) - (Number(report.downvotes || 0) * 6);
  const created = Number(report.timestamp) || new Date(report.created_at || 0).getTime();
  const hoursOld = Number.isFinite(created) ? Math.max(0, (Date.now() - created) / 3600000) : 0;
  const freshnessScore = 25 * Math.exp(-hoursOld / 24);
  return areaScore + categoryScore + urgencyScore + engagementScore + freshnessScore;
}

function recommendationReason(report) {
  const affinity = readUserAffinity();
  const areas = Object.entries(affinity.areas).sort((a, b) => b[1] - a[1]).map(([area]) => area);
  if (report.area === affinity.homeArea || areas.slice(0, 3).includes(report.area)) return 'Near Your Area';
  if (Number(report.upvotes || 0) * 4 + Number(report.comment_count || 0) * 5 - Number(report.downvotes || 0) * 6 > 20) return 'Trending';
  if (String(report.urgency).toLowerCase() === 'critical' && report.status !== 'resolved') return 'Recommended for You';
  if (Number(affinity.categories[report.category] || 0) > 0) return 'Recommended for You';
  return 'Fresh Report';
}

function setFeedSortMode(mode) {
  feedSortMode = mode === 'latest' ? 'latest' : 'for-you';
  const forYou = document.getElementById('feed-sort-for-you');
  const latest = document.getElementById('feed-sort-latest');
  if (forYou && latest) {
    forYou.className = feedSortMode === 'for-you' ? 'rounded-full bg-blue-600 px-2.5 py-1.5 text-white' : 'rounded-full px-2.5 py-1.5 text-slate-600';
    latest.className = feedSortMode === 'latest' ? 'rounded-full bg-blue-600 px-2.5 py-1.5 text-white' : 'rounded-full px-2.5 py-1.5 text-slate-600';
    forYou.setAttribute('aria-pressed', String(feedSortMode === 'for-you'));
    latest.setAttribute('aria-pressed', String(feedSortMode === 'latest'));
  }
  renderCitizenFeed();
}

// ==================== BILINGUAL TRANSLATION DICTIONARY ====================
const translations = {
  en: {
    tagline: "Civic & Flood Relief Tracker",
    locationPill: "Saharsa, Bihar",
    reportBtn: "+ Report Problem",
    statTotalLabel: "Total Reported",
    statPendingLabel: "Pending Action",
    statResolvedLabel: "Resolved / Help Reached",
    incidentsUnit: "incidents",
    awaitingUnit: "awaiting relief",
    clearedUnit: "cleared",
    statRealtime: "Live Data Feed",
    statAvgResponse: "Assistance Verified",
    activeLocationsTitle: "Active Locations & Wards",
    activeLocationsSubtitle: "Tap any ward to filter citizen reports below",
    clearFilter: "Clear Filter",
    catAll: "All Reports",
    catFlood: "Flood / Water",
    catFood: "Food & Ration",
    catMedical: "Medical Aid",
    catPower: "Power Hazard",
    catRoad: "Broken Road",
    catShelter: "Evac Shelter",
    searchPlaceholder: "Search Saharsa block, village, ward or PIN (852201)...",
    statusAll: "All",
    statusPending: "Pending",
    statusResolved: "Resolved",
    feedTitle: "Live Ground Reports Feed",
    verifiedCitizenFeed: "Citizen Verified & Emergency Linked",
    upvoteBtn: "+1 Sahi Hai",
    shareBtn: "Share Alert",
    confirmedBy: "citizens confirmed",
    pendingTag: "Pending Action",
    resolvedTag: "Resolved",
    criticalUrgency: "Urgent Alert",
    highUrgency: "High Priority",
    standardUrgency: "Standard",
    verifiedCitizen: "Verified Citizen",
    recent: "Recently",
    noResultsTitle: "No matching citizen reports found",
    noResultsDesc: "Try clearing your search terms, area selection, or category filters to view all civic alerts.",
    resetAllFiltersBtn: "Reset All Filters",
    footerBrand: "SahaySetu Civic Pulse",
    footerTagline: "Hyper-local Citizen Response Network",
    helplineFooter: "Disaster Helpline: 1077",
    toastLangSwitched: "Language switched to English",
    toastVoteAdded: "Vote recorded: Sahi Hai (+1)",
    toastVoteRemoved: "Vote removed."
  },
  hi: {
    tagline: "नागरिक एवं बाढ़ राहत ट्रैकर",
    locationPill: "सहरसा, बिहार",
    reportBtn: "+ समस्या दर्ज करें",
    statTotalLabel: "कुल दर्ज समस्याएं",
    statPendingLabel: "कार्रवाई लंबित",
    statResolvedLabel: "समाधान / राहत पहुंची",
    incidentsUnit: "मामले",
    awaitingUnit: "राहत प्रतीक्षारत",
    clearedUnit: "हल किए गए",
    statRealtime: "लाइव डेटा फीड",
    statAvgResponse: "सहायता सत्यापित",
    activeLocationsTitle: "सक्रिय क्षेत्र एवं वार्ड",
    activeLocationsSubtitle: "नीचे दी गई रिपोर्ट देखने के लिए किसी भी वार्ड पर टैप करें",
    clearFilter: "फ़िल्टर हटाएं",
    catAll: "सभी रिपोर्ट",
    catFlood: "बाढ़ / जलभराव",
    catFood: "भोजन एवं राशन",
    catMedical: "चिकित्सा सहायता",
    catPower: "बिजली का खतरा",
    catRoad: "क्षतिग्रस्त सड़क",
    catShelter: "राहत शिविर",
    searchPlaceholder: "सहरसा प्रखंड, पंचायत, वार्ड या पिन कोड खोजें...",
    statusAll: "सभी",
    statusPending: "लंबित",
    statusResolved: "समाधान",
    feedTitle: "लाइव ग्राउंड रिपोर्ट फीड",
    verifiedCitizenFeed: "सत्यापित नागरिक व त्वरित राहत नेटवर्क",
    upvoteBtn: "+1 सही है",
    shareBtn: "अलर्ट भेजें",
    confirmedBy: "नागरिकों ने पुष्टि की",
    pendingTag: "कार्रवाई लंबित",
    resolvedTag: "समाधान हुआ",
    criticalUrgency: "गंभीर आपातकाल",
    highUrgency: "उच्च प्राथमिकता",
    standardUrgency: "सामान्य",
    verifiedCitizen: "सत्यापित नागरिक",
    recent: "हाल ही में",
    noResultsTitle: "कोई नागरिक रिपोर्ट नहीं मिली",
    noResultsDesc: "सभी अलर्ट देखने के लिए अपने सर्च शब्द, इलाका चयन या श्रेणी फ़िल्टर साफ़ करें।",
    resetAllFiltersBtn: "सभी फ़िल्टर साफ़ करें",
    footerBrand: "सहायसेतु नागरिक पल्स",
    footerTagline: "स्थानीय नागरिक त्वरित प्रतिक्रिया नेटवर्क",
    helplineFooter: "आपदा हेल्पलाइन: 1077",
    toastLangSwitched: "भाषा बदलकर हिन्दी कर दी गई है",
    toastVoteAdded: "सत्यापन दर्ज: सही है (+1)",
    toastVoteRemoved: "वोट हटा दिया गया।"
  }
};

// Category Display Metadata
const CATEGORY_MAP = {
  flood: { nameEn: 'Flood / Water', nameHi: 'बाढ़ / जलभराव', icon: 'water_damage', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  food: { nameEn: 'Food & Ration', nameHi: 'भोजन व राशन', icon: 'lunch_dining', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  medical: { nameEn: 'Medical Aid', nameHi: 'चिकित्सा सहायता', icon: 'medical_services', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  power: { nameEn: 'Power Hazard', nameHi: 'बिजली का खतरा', icon: 'bolt', color: 'bg-slate-100 text-slate-800 border-slate-300' },
  road: { nameEn: 'Broken Road', nameHi: 'क्षतिग्रस्त सड़क', icon: 'traffic', color: 'bg-orange-50 text-orange-800 border-orange-200' },
  shelter: { nameEn: 'Evac Shelter', nameHi: 'राहत शिविर', icon: 'roofing', color: 'bg-sky-50 text-sky-800 border-sky-200' },
  other: { nameEn: 'Civic Grievance', nameHi: 'नागरिक शिकायत', icon: 'help_center', color: 'bg-slate-100 text-slate-700 border-slate-200' }
};

const DEFAULT_CMS_BANNER = {
  active: true,
  tag: "High Priority Alert",
  time: "Live Telemetry | Central Flood Control",
  text: "Koshi river water level rising near Eastern Embankment. Low-lying areas in Nauhatta, Mahishi, Salkhua & Simri Bakhtiarpur on high alert. SDRF/NDRF relief boats active.",
  helpline: "1077"
};

// ==================== SUPABASE DATA HELPERS ====================

/**
 * Map a Supabase row to the internal report shape used by all renderers.
 */
function mapSupabaseRow(row) {
  const createdAt = row.created_at || row.timestamp || Date.now();
  const elapsed = Date.now() - new Date(createdAt).getTime();
  let timeString;
  if (elapsed < 60000) timeString = 'Just now';
  else if (elapsed < 3600000) timeString = `${Math.floor(elapsed / 60000)}m ago`;
  else if (elapsed < 86400000) timeString = `${Math.floor(elapsed / 3600000)}h ago`;
  else timeString = `${Math.floor(elapsed / 86400000)}d ago`;

  return {
    id: row.id,
    title: row.landmark ? `${row.area}, ${row.landmark}` : row.area,
    area: row.area || 'Unspecified Ward',
    landmark: row.landmark || '',
    city: row.city || 'Saharsa, Bihar',
    pin: row.pincode || row.pin || SAHARSA_MASTER_DATA.defaultPin,
    category: row.category || 'other',
    urgency: String(row.urgency || 'Normal').toUpperCase() === 'CRITICAL'
      ? 'Critical'
      : String(row.urgency || 'Normal').toLowerCase() === 'high' ? 'High' : 'Normal',
    status: String(row.status || 'pending').toLowerCase(),
    isVerified: row.is_verified === true,
    timeString: timeString,
    timestamp: new Date(createdAt).getTime(),
    reporter: row.reporter_name || 'Citizen',
    phone: row.mobile || '',
    description: row.description || '',
    upvotes: row.upvotes || 0,
    downvotes: row.downvotes || 0,
    image: row.image || row.photo_url || 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=600&q=80'
  };
}

/**
 * Load aggregate views and the newest feed items without downloading the full table.
 */
async function fetchAndRenderReports() {
  if (!reports.length) {
    const cached = safeStorageJSON(localStorage, 'sahaysetu_reports', []);
    if (Array.isArray(cached)) reports = cached.filter(report => report && report.id != null && String(report.status).toLowerCase() !== 'blocked');
  }
  renderDashboard();
  if (!sbClient) { console.error('Supabase client is unavailable; reports cannot be loaded.'); return; }

  const aggregatesPromise = refreshDashboardAggregates();
  try {
    const { data, error } = await sbClient
      .from('reports')
      .select('id,category,urgency,area,landmark,city,pincode,description,mobile,reporter_name,status,is_verified,upvotes,downvotes,photo_url,created_at')
      .neq('status', 'blocked')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;

    const remoteReports = (data || []).map(mapSupabaseRow);
    reports = remoteReports.filter(report => report.status !== 'blocked').sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
    safeStorageWrite(localStorage, 'sahaysetu_reports', JSON.stringify(reports));
  } catch (err) {
    console.error('Fetch reports failed; retaining previously fetched reports:', err);
    const cached = safeStorageJSON(localStorage, 'sahaysetu_reports', []);
    reports = Array.isArray(cached) ? cached.filter(report => report && report.id != null && String(report.status).toLowerCase() !== 'blocked') : [];
  }
  renderDashboard();
  await aggregatesPromise;
  try {
    const reportIds = reports.map(report => String(report.id));
    if (!reportIds.length) return;
    const { data: commentRows, error } = await sbClient.from('report_comments').select('report_id').in('report_id', reportIds);
    if (error) throw error;
    const counts = (commentRows || []).reduce((acc, row) => { acc[String(row.report_id)] = (acc[String(row.report_id)] || 0) + 1; return acc; }, {});
    reports.forEach(report => { report.comment_count = counts[String(report.id)] || 0; });
  } catch (err) { console.warn('Comment counts unavailable:', err); }
  renderDashboard();
}

async function refreshDashboardAggregates() {
  if (!sbClient) return;

  const [statsResult, wardsResult] = await Promise.allSettled([
    sbClient.from('dashboard_stats').select('*').single(),
    sbClient.from('ward_analytics').select('*')
  ]);
  if (statsResult.status === 'fulfilled' && !statsResult.value.error) {
    dashboardStats = statsResult.value.data;
  } else {
    dashboardStats = null;
    console.warn('Dashboard stats view is unavailable; using feed counts:', statsResult.status === 'rejected' ? statsResult.reason : statsResult.value.error);
  }
  if (wardsResult.status === 'fulfilled' && !wardsResult.value.error) {
    wardAnalytics = Array.isArray(wardsResult.value.data)
      ? wardsResult.value.data.map(normalizeWardAnalytics)
      : null;
  } else {
    wardAnalytics = null;
    console.warn('Ward analytics view is unavailable; using feed data:', wardsResult.status === 'rejected' ? wardsResult.reason : wardsResult.value.error);
  }
}

function firstAvailableNumber(source, keys, fallback) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function normalizeWardAnalytics(row) {
  const total = firstAvailableNumber(row, ['total_reports', 'report_count', 'total', 'total_count'], 0);
  const resolved = firstAvailableNumber(row, ['resolved_reports', 'resolved_count', 'resolved', 'solved'], 0);
  return {
    name: row.ward_name || row.ward || row.area || row.name || 'Unspecified Ward',
    total,
    pending: firstAvailableNumber(row, ['pending_reports', 'pending_count', 'pending'], Math.max(0, total - resolved)),
    resolved,
    hasCritical: firstAvailableNumber(row, ['critical_reports', 'critical_count', 'active_critical'], 0) > 0
  };
}

function handleReportRealtime(payload) {
  const eventType = payload?.eventType;
  const row = eventType === 'DELETE' ? payload.old : payload.new;
  if (!row || row.id == null) {
    reportRealtimeNeedsRefresh = true;
  } else {
    pendingReportChanges.set(String(row.id), { eventType, row });
  }
  if (document.hidden) { pendingPublicResync = true; return; }
  if (reportRealtimeTimer) clearTimeout(reportRealtimeTimer);
  reportRealtimeTimer = setTimeout(flushPublicRealtime, 400);
}

async function flushPublicRealtime() {
  reportRealtimeTimer = null;
  if (document.hidden) { pendingPublicResync = true; return; }
  pendingPublicResync = false;
  if (reportRealtimeNeedsRefresh) {
    reportRealtimeNeedsRefresh = false;
    pendingReportChanges.clear();
    await fetchAndRenderReports();
    return;
  }
  for (const [id, change] of pendingReportChanges) {
    reports = reports.filter(report => String(report.id) !== id);
    if (change.eventType !== 'DELETE' && String(change.row.status || '').toLowerCase() !== 'blocked') reports.unshift(mapSupabaseRow(change.row));
  }
  pendingReportChanges.clear();
  reports.sort((a, b) => b.timestamp - a.timestamp);
  reports = reports.slice(0, 30);
  await refreshDashboardAggregates();
  renderDashboard();
  safeStorageWrite(localStorage, 'sahaysetu_reports', JSON.stringify(reports));
}


// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  // Load language preference
  const savedLang = safeStorageRead(localStorage, 'sahaysetu_lang');
  if (savedLang === 'hi' || savedLang === 'en') {
    currentLanguage = savedLang;
  }

  renderAlertBanner();
  applyLanguage(currentLanguage, false);
  setupEventListeners();
  document.getElementById('lang-en-btn')?.addEventListener('click', () => setLanguage('en'));
  document.getElementById('lang-hi-btn')?.addEventListener('click', () => setLanguage('hi'));
  window.addEventListener('storage', event => {
    if (event.key === 'sahaysetu_cms_banner') renderAlertBanner();
    if (event.key === 'sahaysetu_broadcast_ticker') renderAlertBanner();
  });
  document.getElementById('volunteer-form')?.addEventListener('submit', submitVolunteerRegistration);

  reports = []; renderDashboard();

  // Setup Supabase Realtime subscription
  if (sbClient) {
    try {
      reportRealtimeChannel = sbClient
        .channel('public:reports')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, handleReportRealtime)
        .subscribe((status, err) => {
          if (err) console.error('Realtime subscription failed:', err);
        });
    } catch (err) {
      console.error('Unable to subscribe to report updates:', err);
    }
    fetchAndRenderReports();
    loadPublicSettings();
  }

  // Toast check from report.html
  const pendingToast = safeStorageRead(sessionStorage, 'sahaysetu_toast');
  if (pendingToast) {
    showToast(pendingToast);
    safeStorageRemove(sessionStorage, 'sahaysetu_toast');
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && pendingPublicResync) {
      if (pendingReportChanges.size || reportRealtimeNeedsRefresh) flushPublicRealtime();
      else fetchAndRenderReports();
      loadPublicSettings();
    }
  });
  window.addEventListener('online', () => { fetchAndRenderReports(); loadPublicSettings(); });
  window.addEventListener('pagehide', () => {
    if (reportRealtimeTimer) clearTimeout(reportRealtimeTimer);
    if (settingsRealtimeTimer) clearTimeout(settingsRealtimeTimer);
    if (sbClient) [reportRealtimeChannel, settingsRealtimeChannel].forEach(channel => { if (channel) sbClient.removeChannel(channel).catch(() => {}); });
  }, { once: true });
});

// ==================== BILINGUAL ENGINE ====================
function setLanguage(lang) {
  if (lang !== 'en' && lang !== 'hi') return;
  currentLanguage = lang;
  try {
    safeStorageWrite(localStorage, 'sahaysetu_lang', lang);
  } catch (err) {
    console.error('Unable to save language preference:', err);
  }
  applyLanguage(lang, true);
  renderDashboard();
}

function applyLanguage(lang, triggerToast = true) {
  const dict = translations[lang] || translations.en;
  document.documentElement.lang = lang;

  // Toggle button active states
  const btnEn = document.getElementById('lang-en-btn');
  const btnHi = document.getElementById('lang-hi-btn');
  if (btnEn && btnHi) {
    if (lang === 'hi') {
      btnHi.className = 'min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg bg-white text-blue-600 shadow-sm transition-all font-bold';
      btnEn.className = 'min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition-all font-semibold';
    } else {
      btnEn.className = 'min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg bg-white text-blue-600 shadow-sm transition-all font-bold';
      btnHi.className = 'min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-slate-600 hover:text-slate-900 transition-all font-semibold';
    }
  }

  // Apply all data-i18n attributes in DOM
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // Search input placeholder
  const searchInput = document.getElementById('search-input');
  if (searchInput && dict.searchPlaceholder) {
    searchInput.placeholder = dict.searchPlaceholder;
  }

  if (triggerToast) {
    showToast(dict.toastLangSwitched);
  }
}

// ==================== ALERT BANNER ====================
function renderAlertBanner() {
  const container = document.getElementById('cms-alert-ticker');
  if (!container) return;

  let banner = remoteCmsBanner || DEFAULT_CMS_BANNER;
  try {
    const stored = !remoteCmsBanner && safeStorageRead(localStorage, 'sahaysetu_cms_banner');
    if (stored) banner = JSON.parse(stored);
    const broadcastText = remoteBroadcast?.message || remoteBroadcast?.text || safeStorageRead(localStorage, 'sahaysetu_broadcast_ticker');
    if (broadcastText && banner && typeof banner === 'object') {
      banner = { ...banner, text: broadcastText };
    }
  } catch (e) {
    console.error("Error reading sahaysetu_cms_banner:", e);
  }

  if (!banner || banner.active === false) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  const tagEl = document.getElementById('cms-banner-tag');
  const timeEl = document.getElementById('cms-banner-time');
  const textEl = document.getElementById('cms-banner-text');
  const helplineEl = document.getElementById('cms-banner-helpline');
  const callBtn = document.getElementById('cms-banner-call-btn');

  if (tagEl) tagEl.textContent = banner.tag || "High Priority Alert";
  if (timeEl) timeEl.textContent = banner.time || "Live Telemetry | Emergency Dispatch";
  if (textEl) {
    const levels = remoteTelemetry?.levels;
    const levelText = levels ? ` Koshi: ${Number(levels.koshi).toFixed(1)}m; Eastern Basin: ${Number(levels.kosiTributary).toFixed(1)}m.` : '';
    textEl.textContent = `${banner.text || ''}${levelText}`;
  }
  if (helplineEl) helplineEl.textContent = banner.helpline ? `Disaster Helpline: ${banner.helpline}` : "Disaster Helpline: 1077";
  if (callBtn) callBtn.href = banner.helpline ? `tel:${banner.helpline}` : "tel:1077";
}

async function loadPublicSettings() {
  if (!sbClient) return;
  try {
    const { data, error } = await sbClient.from('site_settings').select('key,value').in('key', ['cms_banner', 'active_broadcast', 'telemetry']);
    if (error) throw error;
    for (const row of data || []) {
      const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
      if (row.key === 'cms_banner') remoteCmsBanner = value;
      if (row.key === 'active_broadcast') remoteBroadcast = value;
      if (row.key === 'telemetry') remoteTelemetry = value;
    }
    renderAlertBanner();
    if (settingsRealtimeChannel) return;
    settingsRealtimeChannel = sbClient.channel('public:site_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, payload => {
      const row = payload.new; if (!row?.key) return;
      let value = row.value; try { if (typeof value === 'string') value = JSON.parse(value); } catch {}
      if (row.key === 'cms_banner') remoteCmsBanner = value;
      if (row.key === 'active_broadcast') remoteBroadcast = value;
      if (row.key === 'telemetry') remoteTelemetry = value;
      if (settingsRealtimeTimer) clearTimeout(settingsRealtimeTimer);
      settingsRealtimeTimer = setTimeout(() => {
        settingsRealtimeTimer = null;
        if (document.hidden) { pendingPublicResync = true; return; }
        renderAlertBanner();
      }, 400);
    }).subscribe();
  } catch (err) { console.error('Public settings sync failed:', err); }
}

function openVolunteerModal() { const modal = document.getElementById('volunteer-modal'); modal?.classList.remove('hidden'); modal?.classList.add('flex'); }
function closeVolunteerModal() { const modal = document.getElementById('volunteer-modal'); modal?.classList.add('hidden'); modal?.classList.remove('flex'); }
async function submitVolunteerRegistration(event) {
  event.preventDefault(); const form = event.currentTarget;
  const payload = { name: form.elements.name.value.trim(), phone: form.elements.phone.value.trim(), role: form.elements.role.value, ward: form.elements.ward.value, organization_name: form.elements.organization.value.trim(), verified: false, shift: 'Pending Approval' };
  try { const { error } = await sbClient.from('volunteers').insert(payload); if (error) throw error; form.reset(); closeVolunteerModal(); showToast('Registration submitted for approval.'); }
  catch (err) { console.error('Volunteer registration failed:', err); showToast('Registration could not be submitted.'); }
}

// ==================== MASTER RENDER ====================
function renderDashboard() {
  renderTopStats();
  renderWardDeck();
  renderCitizenFeed();
  renderFilterSummary();
}

// 1. Top 3 Metric Cards
function renderTopStats() {
  const currentPending = reports.filter(r => r.status === 'pending').length;
  const currentResolved = reports.filter(r => r.status === 'resolved').length;
  const liveTotal = reports.filter(r => r.status !== 'blocked').length;
  const total = reports.length === 30 ? Math.max(liveTotal, firstAvailableNumber(dashboardStats, ['total_reports', 'total_count', 'total'], 0)) : liveTotal;
  const liveUrgent = reports.filter(r => r.status === 'pending' && ['Critical', 'High'].includes(r.urgency)).length;
  const urgentCount = reports.length === 30 ? Math.max(liveUrgent, firstAvailableNumber(dashboardStats, ['critical_reports', 'active_critical', 'urgent_reports', 'urgent_count'], 0)) : liveUrgent;

  const callsCount = document.getElementById('mobile-active-calls-count'); if (callsCount) callsCount.innerHTML = `${urgentCount} Calls Active &nbsp; <b class="material-symbols-outlined">sensors</b>`;

  const uniqueAreas = Array.isArray(wardAnalytics)
    ? wardAnalytics.length
    : new Set(reports.map(r => r.area)).size;

  const totalEl = document.getElementById('metric-total');
  const pendingEl = document.getElementById('metric-pending');
  const resolvedEl = document.getElementById('metric-resolved');
  const totalMobileEl = document.getElementById('metric-total-mobile');
  const pendingMobileEl = document.getElementById('metric-pending-mobile');
  const resolvedMobileEl = document.getElementById('metric-resolved-mobile');
  const areasEl = document.getElementById('metric-areas-count');
  const pendingPctEl = document.getElementById('metric-pending-pct');
  const resolvedPctEl = document.getElementById('metric-resolved-pct');
  const urgentTagEl = document.getElementById('metric-urgent-tag');
  const urgentTagMobileEl = document.getElementById('metric-urgent-tag-mobile');
  const resolvedPctMobileEl = document.getElementById('metric-resolved-pct-mobile');

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = currentPending;
  if (resolvedEl) resolvedEl.textContent = currentResolved;
  if (totalMobileEl) totalMobileEl.textContent = total;
  if (pendingMobileEl) pendingMobileEl.textContent = currentPending;
  if (resolvedMobileEl) resolvedMobileEl.textContent = currentResolved;

  const dict = translations[currentLanguage] || translations.en;
  if (areasEl) areasEl.textContent = currentLanguage === 'hi' ? `${uniqueAreas || 0} सक्रिय क्षेत्र` : `${uniqueAreas || 0} Areas Monitored`;

  const pendingPct = total > 0 ? Math.round((currentPending / total) * 100) : 0;
  const resolvedPct = total > 0 ? Math.round((currentResolved / total) * 100) : 0;

  if (pendingPctEl) pendingPctEl.textContent = currentLanguage === 'hi' ? `${pendingPct}% सक्रिय` : `${pendingPct}% Active`;
  if (resolvedPctEl) resolvedPctEl.textContent = currentLanguage === 'hi' ? `${resolvedPct}% समाधान` : `${resolvedPct}% Resolved`;
  if (urgentTagEl) urgentTagEl.textContent = currentLanguage === 'hi' ? `${urgentCount} गंभीर अलर्ट` : `${urgentCount} Urgent Alerts`;
  if (resolvedPctMobileEl) resolvedPctMobileEl.textContent = currentLanguage === 'hi' ? `${resolvedPct}% समाधान` : `${resolvedPct}% Verified`;
  if (urgentTagMobileEl) urgentTagMobileEl.textContent = currentLanguage === 'hi' ? `${urgentCount} गंभीर` : `${urgentCount} Urgent`;
}

// 2. Active Locations & Wards Deck (Positioned at TOP Above Feed)
function renderWardDeck() {
  const container = document.getElementById('ward-deck-container');
  if (!container) return;

  const groups = {};
  if (Array.isArray(wardAnalytics)) {
    wardAnalytics.forEach(item => {
      groups[item.name] = { ...item };
    });
  } else reports.forEach(r => {
    const area = r.area || "Unspecified Ward";
    if (!groups[area]) {
      groups[area] = { name: area, total: 0, pending: 0, resolved: 0, hasCritical: false };
    }
    groups[area].total++;
    if (r.status === 'pending') {
      groups[area].pending++;
      if (r.urgency === 'Critical' || r.urgency === 'High') {
        groups[area].hasCritical = true;
      }
    } else if (r.status === 'resolved') {
      groups[area].resolved++;
    }
  });

  SAHARSA_MASTER_DATA.blocks.forEach(block => {
    if (!groups[block.nameEn]) groups[block.nameEn] = { name: block.nameEn, total: 0, pending: 0, resolved: 0, hasCritical: false };
  });
  const areas = Object.values(groups);
  const badgeEl = document.getElementById('locations-count-badge');
  if (badgeEl) badgeEl.textContent = areas.length;

  const clearBtn = document.getElementById('clear-ward-filter-btn');
  if (clearBtn) {
    if (activeWardFilter) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }

  if (areas.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 py-3 text-center w-full">No active wards currently recorded.</p>`;
    return;
  }

  const dict = translations[currentLanguage] || translations.en;

  container.innerHTML = areas.map(item => {
    const isSelected = activeWardFilter === item.name;
    const resolvedPct = item.total > 0 ? Math.round((item.resolved / item.total) * 100) : 0;
    const pendingPct = item.total > 0 ? (100 - resolvedPct) : 0;

    const criticalPill = item.hasCritical && item.pending > 0
      ? `<span class="px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold shrink-0" aria-label="${dict.criticalUrgency}">${item.total} ${dict.incidentsUnit}</span>`
      : `<span class="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold shrink-0">${item.total} ${dict.incidentsUnit}</span>`;

    const activeCardClass = isSelected
      ? 'ring-2 ring-blue-600 bg-blue-50/80 border-blue-400 shadow-md'
      : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-sm';

    const pendingText = currentLanguage === 'hi' ? `${item.pending} लंबित` : `${item.pending} Pending`;
    const solvedText = currentLanguage === 'hi' ? `${item.resolved} समाधान` : `${item.resolved} Solved`;

    return `
      <div class="ward-card-item rounded-2xl border ${activeCardClass} p-3.5 transition-all cursor-pointer select-none group min-h-[44px]" onclick="toggleWardFilter('${encodeInlineArgument(item.name)}')">
        <div class="flex min-w-0 items-center justify-between gap-1.5">
          <span class="block min-w-0 text-xs font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors truncate">${escapeHtml(item.name)}</span>
          ${criticalPill}
        </div>
        <p class="mt-1 min-w-0 truncate text-[11px] font-medium text-slate-500"><span class="text-amber-600 font-bold">${item.pending} Pending</span> <span class="text-slate-300 mx-1">|</span> <span class="text-emerald-600 font-bold">${item.resolved} Solved</span></p>

        <!-- Dual-tone Segmented Resolution Progress Bar -->
        <div class="mt-2.5 w-full h-1.5 rounded-full bg-slate-100 overflow-hidden flex" title="${solvedText} (${resolvedPct}%)">
          <div class="bg-amber-500 h-full transition-all duration-300" style="width: ${pendingPct}%;"></div>
          <div class="bg-emerald-500 h-full transition-all duration-300" style="width: ${resolvedPct}%;"></div>
        </div>
      </div>
    `;
  }).join('');
  const wardQuery = document.getElementById('wardSearchInput')?.value.trim().toLowerCase();
  if (wardQuery) container.querySelectorAll('.ward-card-item').forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(wardQuery); });
}

// 3. Reported Problems Feed (Prioritized Hero Section)
function renderCitizenFeed() {
  const container = document.getElementById('reports-feed');
  const emptyState = document.getElementById('empty-feed-state');
  const feedBadge = document.getElementById('feed-count-badge');
  if (!container) return;

  const query = searchQuery.toLowerCase().trim();
  const dict = translations[currentLanguage] || translations.en;

  const filtered = reports.filter(item => {
    const matchCat = activeCategory === 'all' || item.category === activeCategory;
    const matchStatus = activeStatus === 'all' || item.status === activeStatus;
    const matchWard = !activeWardFilter || item.area === activeWardFilter || (item.title && item.title.includes(activeWardFilter));
    
    let matchQuery = true;
    if (query) {
      const fullText = `${item.title} ${item.area} ${item.description} ${item.reporter}`.toLowerCase();
      matchQuery = fullText.includes(query);
    }
    return matchCat && matchStatus && matchWard && matchQuery;
  }).slice();
  if (feedSortMode === 'latest') filtered.sort((a, b) => (Number(b.timestamp) || new Date(b.created_at || 0).getTime()) - (Number(a.timestamp) || new Date(a.created_at || 0).getTime()));
  else filtered.sort((a, b) => computeAiFeedScore(b) - computeAiFeedScore(a));

  if (feedBadge) {
    feedBadge.textContent = currentLanguage === 'hi' 
      ? `${filtered.length} रिपोर्ट` 
      : `${filtered.length} Reports`;
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  const upvotedMap = getSessionUpvotes();
  const votesMap = getSessionVotes();

  container.innerHTML = filtered.map((item, rank) => {
    const catMeta = CATEGORY_MAP[item.category] || CATEGORY_MAP.other;
    const catName = currentLanguage === 'hi' ? catMeta.nameHi : catMeta.nameEn;
    const isResolved = item.status === 'resolved';
    const vote = votesMap[item.id] || (upvotedMap[item.id] ? 'up' : null);
    const isUpvoted = vote === 'up';
    const verifiedBadge = item.isVerified === true
      ? '<span class="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700"><span class="material-symbols-outlined text-[14px] text-blue-600 fill">verified</span>Verified Report</span>'
      : '<span class="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">Unverified | Under Review</span>';
    const commentCount = Number(item.comment_count || 0);
    const recommendationReasonText = recommendationReason(item);
    const recommendationIcon = recommendationReasonText === 'Near Your Area' ? 'location_on' : recommendationReasonText === 'Trending' ? 'local_fire_department' : 'auto_awesome';
    const recommendationTag = feedSortMode === 'for-you' && rank < 3
      ? `<span class="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700"><span class="material-symbols-outlined text-[13px]" aria-hidden="true">${recommendationIcon}</span>${recommendationReasonText}</span>` : '';

    // Urgency badge with high contrast
    let urgencyBadge = '';
    if (String(item.urgency).toLowerCase() === 'critical') {
      urgencyBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-bold border border-red-200 animate-urgent-pulse">
          <span class="w-1.5 h-1.5 rounded-full bg-red-600"></span>
          <span>${dict.criticalUrgency}</span>
        </span>
      `;
    } else if (String(item.urgency).toLowerCase() === 'high') {
      urgencyBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
          <span>${dict.highUrgency}</span>
        </span>
      `;
    } else {
      urgencyBadge = `
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
          <span>${dict.standardUrgency}</span>
        </span>
      `;
    }

    // Upvote styling
    const upvoteBtnClass = isUpvoted
      ? 'bg-blue-600 text-white shadow-sm'
      : 'bg-slate-100 hover:bg-slate-200 text-slate-700';

    // Status pill
    const statusText = isResolved ? dict.resolvedTag : dict.pendingTag;
    const statusPillClass = isResolved
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-amber-50 text-amber-700 border border-amber-200';

    const thumb = safeHttpUrl(item.image, 'https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=400&q=80');

    return `
      <article class="rounded-2xl bg-white border border-[#E2E8F0] p-3.5 lg:p-5 shadow-sm transition-card flex flex-col justify-between group" id="card-${item.id}">
        <div class="space-y-3">
          
          <!-- Top Row: Category pill & Urgency on Left; Timestamp & Verified Reporter on Right -->
          <div class="flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              ${recommendationTag}
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${catMeta.color}">
                <span class="material-symbols-outlined text-[14px]">${catMeta.icon}</span>
                <span>${catName}</span>
              </span>
              ${urgencyBadge}
            </div>

            <div class="flex items-center gap-1.5 text-xs text-slate-500">
              <time class="font-medium text-slate-500">${item.timeString || dict.recent}</time>
              <span>|</span>
              <span class="font-medium text-slate-700">${escapeHtml(item.reporter || 'Citizen')}</span>
              ${verifiedBadge}
            </div>
          </div>

          <!-- Middle Row: Ward/Landmark title + 2-line Description & Image Thumbnail -->
          <div class="flex items-start justify-between gap-3 sm:gap-4">
            <div class="flex-1 space-y-1">
              <h3 class="font-bold text-sm sm:text-base text-slate-900 flex items-center gap-1.5 leading-snug">
                <span class="material-symbols-outlined text-blue-600 text-[18px] flex-shrink-0">location_on</span>
                <span>${escapeHtml(item.title)}</span>
              </h3>
              <p class="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                ${escapeHtml(item.description)}
              </p>
            </div>

            <!-- Image Thumbnail (80x80) with zoom hover -->
            <div class="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-slate-100 border border-slate-200 shadow-inner group-hover:scale-105 transition-transform duration-200">
              <img src="${escapeHtml(thumb)}" alt="Ground Evidence" loading="lazy" decoding="async" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=400&q=80'" class="w-full h-full object-cover">
            </div>
          </div>

        </div>

        <!-- Bottom Action Bar: Upvote "+1 Sahi Hai", Status Badge & WhatsApp Share Alert -->
        <div class="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-slate-100 text-xs">
          
          <!-- +1 Sahi Hai Upvote Button -->
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" onclick="handleUpvote('${encodeInlineArgument(item.id)}')" class="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${isUpvoted ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}" ${vote ? 'disabled' : ''}>
              <span class="material-symbols-outlined text-[16px]">thumb_up</span>
              <span>${dict.upvoteBtn}</span>
              <span data-upvote-count="${escapeHtml(item.id)}" class="ml-0.5 px-1.5 py-0.2 rounded-full ${isUpvoted ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'} font-bold text-[11px]">
                ${item.upvotes || 0}
              </span>
            </button>
            <button type="button" onclick="handleVote('${encodeInlineArgument(item.id)}', 'down')" class="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200" ${vote ? 'disabled' : ''}><span class="material-symbols-outlined text-[15px]" aria-hidden="true">thumb_down</span>Sahi Nahi Hai (${item.downvotes || 0})</button>
            <span class="text-slate-400 hidden lg:inline text-[11px]">
              ${item.upvotes} ${dict.confirmedBy}
            </span>
          </div>

          <!-- Right: Status Badge & WhatsApp Share -->
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-comment-count="${escapeHtml(item.id)}" onclick="recordUserAffinity('report','${encodeInlineArgument(item.id)}');toggleComments('${encodeInlineArgument(item.id)}')" class="min-h-[38px] inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><span class="material-symbols-outlined text-[15px]" aria-hidden="true">chat_bubble</span>Comments (${commentCount})</button>
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold ${statusPillClass}">
              <span class="material-symbols-outlined text-[14px]">${isResolved ? 'check_circle' : 'hourglass_top'}</span>
              <span>${statusText}</span>
            </span>

            <!-- WhatsApp Share Alert Button -->
            <button type="button" onclick="handleShareAlert('${encodeInlineArgument(item.id)}')" class="min-h-[38px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold transition-all shadow-sm active:scale-95">
              <span class="material-symbols-outlined text-[16px] text-emerald-600">share</span>
              <span>${dict.shareBtn}</span>
            </button>
          </div>

        </div>
        <p class="mt-2 text-[11px] text-slate-500">${item.upvotes || 0} Sahi | ${item.downvotes || 0} Galat</p>
        <section id="comments-drawer-${escapeHtml(item.id)}" class="hidden mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3" data-report-id="${escapeHtml(item.id)}">
          <div id="comments-list-${escapeHtml(item.id)}" class="space-y-1.5 text-xs text-slate-700 max-h-48 overflow-y-auto"></div>
          <form class="mt-2 flex flex-wrap items-center gap-2" onsubmit="submitComment(event,'${encodeInlineArgument(item.id)}')">
            <input type="text" id="comment-author-${escapeHtml(item.id)}" name="author" maxlength="80" placeholder="Your Name" aria-label="Your name" class="w-28 h-9 px-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none">
            <input type="text" id="comment-input-${escapeHtml(item.id)}" name="comment" maxlength="1000" required placeholder="Write ground update..." aria-label="Write a comment" class="min-w-0 flex-1 h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none">
            <button type="submit" class="min-h-[36px] px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">Post</button>
          </form>
        </section>
      </article>
    `;
  }).join('');
}

// ==================== UPVOTING SYSTEM (Supabase-backed) ====================
function getSessionUpvotes() {
  const value = safeStorageJSON(localStorage, 'sahaysetu_upvoted', {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getSessionVotes() {
  const value = safeStorageJSON(localStorage, 'sahaysetu_votes', {});
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

async function handleVote(reportId, direction) {
  if (!['up', 'down'].includes(direction)) return;
  if (direction === 'up') return handleUpvote(reportId);
  const id = decodeInlineArgument(reportId), voteMap = getSessionVotes();
  const report = reports.find(item => String(item.id) === id);
  if (!report || voteMap[id] || inFlightVotes.has(id)) return;
  inFlightVotes.add(id);
  const column = 'downvotes';
  report[column] = Number(report[column] || 0) + 1;
  voteMap[id] = direction;
  safeStorageWrite(localStorage, 'sahaysetu_votes', JSON.stringify(voteMap));
  renderCitizenFeed();
  try {
    if (!sbClient) return;
    const rpcName = 'increment_downvotes';
    const result = await sbClient.rpc(rpcName, { row_id: id });
    if (result.error) throw result.error;
    const count = Number(result.data?.downvotes ?? result.data);
    if (Number.isFinite(count)) report.downvotes = count;
  } catch (rpcError) {
    console.warn('Downvote RPC unavailable; trying a direct count update:', rpcError);
    try {
      const { error } = await sbClient.from('reports').update({ downvotes: report.downvotes }).eq('id', id);
      if (error) throw error;
    } catch (err) { console.error('Vote update failed:', err); }
  } finally { inFlightVotes.delete(id); renderCitizenFeed(); }
}

function getLocalComments(reportId) {
  const saved = safeStorageJSON(localStorage, `sahaysetu_comments_${String(reportId)}`, []);
  return Array.isArray(saved) ? saved : [];
}

function renderReportComments(reportId, comments) {
  const list = document.getElementById(`comments-list-${CSS.escape(String(reportId))}`);
  if (!list) return;
  list.innerHTML = comments.length ? comments.map(comment => `
    <article class="rounded-lg bg-white p-2">
      <div class="flex items-center justify-between gap-2"><strong>${escapeHtml(comment.name || comment.author_name || 'Citizen')}</strong>${comment.is_admin_reply ? '<span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">Official HQ Reply</span>' : ''}</div>
      <p class="mt-1 text-slate-700">${escapeHtml(comment.comment || comment.body || '')}</p>
    </article>`).join('') : '<p class="text-xs text-slate-500">No comments yet.</p>';
}

async function toggleComments(reportId) {
  const idStr = decodeInlineArgument(reportId);
  const drawer = document.getElementById(`comments-drawer-${CSS.escape(idStr)}`);
  if (!drawer) return;
  const opening = drawer.classList.contains('hidden');
  drawer.classList.toggle('hidden', !opening);
  if (!opening) return;
  recordUserAffinity('report', idStr);

  let comments;
  try {
    if (!sbClient) throw new Error('Supabase is unavailable');
    const { data, error } = await sbClient.from('report_comments').select('*').eq('report_id', idStr).order('created_at', { ascending: true });
    if (error) throw error;
    comments = data || [];
    const localComments = getLocalComments(idStr);
    const seenComments = new Set(comments.map(comment => `${comment.name || comment.author_name || 'Citizen'}|${comment.comment || comment.body || ''}`));
    comments = comments.concat(localComments.filter(comment => {
      const key = `${comment.name || 'Citizen'}|${comment.comment || ''}`;
      if (seenComments.has(key)) return false;
      seenComments.add(key);
      return true;
    }));
  } catch (err) {
    console.warn('Using locally saved comments:', err);
    comments = getLocalComments(idStr);
  }
  renderReportComments(idStr, comments);
}

async function submitComment(event, reportId) {
  event.preventDefault();
  const idStr = decodeInlineArgument(reportId);
  if (inFlightComments.has(idStr)) return;
  const form = event.currentTarget;
  const name = form.querySelector('[name="author"]')?.value.trim() || 'Citizen';
  const input = form.querySelector('[name="comment"]');
  const commentText = input?.value.trim();
  if (!commentText) return;
  inFlightComments.add(idStr);

  const payload = { report_id: idStr, name, comment: commentText, is_admin_reply: false, created_at: new Date().toISOString() };
  const localComments = getLocalComments(idStr);
  localComments.push(payload);
  safeStorageWrite(localStorage, `sahaysetu_comments_${idStr}`, JSON.stringify(localComments));

  const list = document.getElementById(`comments-list-${CSS.escape(idStr)}`);
  const existing = [...(list?.querySelectorAll('article') || [])].map(article => ({
    name: article.querySelector('strong')?.textContent || 'Citizen',
    comment: article.querySelector('p')?.textContent || ''
  }));
  renderReportComments(idStr, [...existing, payload]);
  if (input) input.value = '';
  recordUserAffinity('report', idStr);

  const report = reports.find(item => String(item.id) === idStr);
  if (report) report.comment_count = Number(report.comment_count || 0) + 1;
  const button = document.querySelector(`[data-comment-count="${CSS.escape(idStr)}"]`);
  if (button) button.innerHTML = `<span class="material-symbols-outlined text-[15px]" aria-hidden="true">chat_bubble</span>Comments (${Number(report?.comment_count || 0)})`;

  let savedRemotely = false;
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    if (!sbClient) throw new Error('Supabase is unavailable');
    const { error } = await sbClient.from('report_comments').insert(payload);
    if (error) throw error;
    savedRemotely = true;
  } catch (err) {
    console.warn('Comment could not be saved to Supabase; keeping a local copy:', err);
  } finally {
    inFlightComments.delete(idStr);
    if (submitButton) submitButton.disabled = false;
  }
  if (!savedRemotely) showToast('Comment saved on this device; it may not be visible to others.');
}

async function handleUpvote(reportId) {
  const idStr = decodeInlineArgument(reportId);
  if (inFlightVotes.has(idStr)) return;
  const target = reports.find(report => String(report.id) === idStr);
  if (!target) return;

  const votedKey = `sahaysetu_voted_${idStr}`;
  const votedMap = getSessionUpvotes();
  const legacyVotes = getSessionVotes();
  let votedOnDevice = localVoteLocks.has(idStr);
  try { votedOnDevice = votedOnDevice || localStorage.getItem(votedKey) === 'true'; }
  catch (err) { console.warn('Could not read the local vote lock:', err); }
  if (votedOnDevice || votedMap[idStr] || legacyVotes[idStr]) {
    showToast(currentLanguage === 'hi' ? 'आप पहले ही वोट कर चुके हैं।' : 'You have already voted on this report.');
    return;
  }

  localVoteLocks.add(idStr);
  inFlightVotes.add(idStr);
  recordUserAffinity('report', target);
  target.upvotes = Number(target.upvotes || 0) + 1;
  votedMap[idStr] = true;
  legacyVotes[idStr] = 'up';
  try {
    safeStorageWrite(localStorage, votedKey, 'true');
    safeStorageWrite(localStorage, 'sahaysetu_upvoted', JSON.stringify(votedMap));
    safeStorageWrite(localStorage, 'sahaysetu_votes', JSON.stringify(legacyVotes));
  } catch (err) { console.warn('Upvote could not be saved locally:', err); }

  const badge = document.querySelector(`[data-upvote-count="${CSS.escape(idStr)}"]`);
  if (badge) badge.textContent = String(target.upvotes);
  renderCitizenFeed();
  showToast((translations[currentLanguage] || translations.en).toastVoteAdded);

  if (!sbClient) { inFlightVotes.delete(idStr); return; }
  const isSignatureMismatch = error => ['PGRST202', 'PGRST204', '42883', '22P02'].includes(error?.code);
  try {
    let result = await sbClient.rpc('increment_upvotes', { row_id: target.id });
    if (result.error && isSignatureMismatch(result.error)) {
      result = await sbClient.rpc('increment_upvotes', { p_report_id: idStr });
    }
    if (result.error) throw result.error;
    const resultRow = Array.isArray(result.data) ? result.data[0] : result.data;
    const count = Number(resultRow?.upvotes ?? resultRow);
    if (Number.isFinite(count)) target.upvotes = count;
  } catch (rpcError) {
    console.warn('Atomic upvote failed; applying the optimistic count directly:', rpcError);
    try {
      const { error } = await sbClient.from('reports').update({ upvotes: target.upvotes }).eq('id', target.id);
      if (error) throw error;
    } catch (updateError) { console.error('Supabase upvote update failed:', updateError); }
  } finally {
    inFlightVotes.delete(idStr);
  }

  renderCitizenFeed();
}


// ==================== FILTERING & SEARCH ====================
function filterByCategory(cat) {
  activeCategory = cat;
  if (cat !== 'all') recordUserAffinity('category', cat);
  document.querySelectorAll('#category-pills .category-btn').forEach(btn => {
    if (btn.getAttribute('data-category') === cat) {
      btn.className = 'category-btn active min-h-[40px] px-3.5 py-1.5 rounded-full bg-blue-600 text-white font-semibold text-xs shadow-sm whitespace-nowrap transition-all';
    } else {
      btn.className = 'category-btn min-h-[40px] px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-xs whitespace-nowrap transition-all';
    }
  });
  renderCitizenFeed();
  renderFilterSummary();
}

function filterByStatus(status) {
  activeStatus = status;
  document.querySelectorAll('.status-btn').forEach(btn => {
    if (btn.getAttribute('data-status') === status) {
      btn.className = 'status-btn flex-1 sm:flex-none min-h-[36px] px-3 py-1.5 rounded-lg bg-white text-slate-900 font-bold shadow-sm transition-all text-center';
    } else {
      btn.className = 'status-btn flex-1 sm:flex-none min-h-[36px] px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 transition-all text-center';
    }
  });
  renderCitizenFeed();
  renderFilterSummary();
}

function toggleWardFilter(wardName) {
  wardName = decodeInlineArgument(wardName);
  recordUserAffinity('area', wardName);
  if (activeWardFilter === wardName) {
    activeWardFilter = null;
  } else {
    activeWardFilter = wardName;
  }
  renderWardDeck();
  renderCitizenFeed();
  renderFilterSummary();
  if (activeWardFilter && window.matchMedia('(max-width: 1023px)').matches) setMobileTab('feed');
}

function openLegalTerms() {
  openSiteInfoModal('Disclaimer & Platform Terms (नियम व अस्वीकरण)', `
    <p>SahaySetu ek swatantra citizen-tech platform hai, yeh koi sarkari vibhag ya first-responder emergency service nahi hai.</p>
    <p>Hamara kaam ground level ki samasyaon ko digital roop se verify karke public record banana aur use prashasan, volunteers aur NGOs tak connect karna hai.</p>
    <p>Aapatkaal (life-threatening emergency) ke samay turant official helpline 1077 ya 112 par call karein. SahaySetu ground par direct rescue ya physical repair ki legal responsibility nahi leta.</p>
    <p>Galat ya fake afwah phailane par report admin dwara delete ki ja sakti hai.</p>
  `);
}

function openFaqModal() {
  const faqs = [
    ['Kya SahaySetu sarkari website hai?', 'Nahi, yeh Saharsa ke nagrikon dwara shuru kiya gaya ek open civic-tech platform hai jo janta ki aawaz ko photo aur GPS proof ke sath prashasan aur relief teams tak pahunchata hai.'],
    ['Report darj karne ke baad kya hota hai?', "Report darj hote hi yeh live portal par aati hai. Local nagrik ise '+1 Sahi Hai' se verify karte hain aur Admin panel se ise sambhandhit Ward Parshad, BDO, aur ground volunteers ko forward kiya jaata hai."],
    ['Kya mujhe report karne ke liye paise dene honge?', 'Bilkul nahi. SahaySetu 100% muft aur open-source jan-seva platform hai.'],
    ['Mera gaon ya tola list mein nahi hai toh kya karein?', "Aap 'Report Problem' form mein 'Other / Unlisted Tola' chunn kar apna poora pata likh sakte hain."],
    ['Koshi baadh ke samay ration ya naav ki madad kaise milegi?', "Aap apni report mein 'Food & Ration' ya 'Rescue / Boat' category chunein aur apna sahi mobile number dein taaki nazdeeki relief camp ya SDRF team aapse sampark kar sake."]
  ];
  const content = faqs.map(([question, answer]) => `<details class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><summary class="cursor-pointer font-bold text-slate-800">${question}</summary><p class="mt-2 text-slate-600">${answer}</p></details>`).join('');
  openSiteInfoModal('❓ FAQ & Madad', content);
}

let siteInfoReturnFocus = null;
function openSiteInfoModal(title, content) {
  const modal = document.getElementById('site-info-modal');
  const heading = document.getElementById('site-info-title');
  const body = document.getElementById('site-info-content');
  if (!modal || !heading || !body) return;
  siteInfoReturnFocus = document.activeElement;
  heading.textContent = title;
  body.innerHTML = content;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  modal.focus();
}

function closeSiteInfoModal() {
  const modal = document.getElementById('site-info-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  if (siteInfoReturnFocus instanceof HTMLElement) siteInfoReturnFocus.focus();
}

async function handleShareAlert(reportId) {
  const id = decodeInlineArgument(reportId);
  const report = reports.find(item => String(item.id) === id);
  if (!report) return;
  recordUserAffinity('report', report);
  const reportUrl = `https://sahaysetu-6023a.web.app/?report=${encodeURIComponent(report.id)}`;
  const text = `🚨 ${report.category || 'Civic'} report at ${report.area || 'Saharsa'}. Please verify and share:`;
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `SahaySetu Alert: ${report.area || 'Saharsa'}`, text, url: reportUrl });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.warn('Native sharing failed; opening WhatsApp instead:', err);
    }
  }
  const message = `${text}\n${reportUrl}`;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
}

function clearWardFilter() {
  activeWardFilter = null;
  renderWardDeck();
  renderCitizenFeed();
  renderFilterSummary();
}

function handleSearchInput(e) {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchQuery = e.target.value;
    const matchingArea = SAHARSA_MASTER_DATA.blocks.find(block => block.nameEn.toLowerCase() === searchQuery.trim().toLowerCase());
    if (matchingArea && lastAffinitySearchArea !== matchingArea.nameEn) { recordUserAffinity('area', matchingArea.nameEn); lastAffinitySearchArea = matchingArea.nameEn; }
    if (!searchQuery.trim()) lastAffinitySearchArea = '';
    const clearBtn = document.getElementById('clear-search-btn');
    if (clearBtn) {
      if (searchQuery) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }
    renderCitizenFeed();
    renderFilterSummary();
  }, 200);
}

function clearSearch() {
  searchQuery = '';
  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.classList.add('hidden');
  renderCitizenFeed();
  renderFilterSummary();
}

function resetAllFilters() {
  activeCategory = 'all';
  activeStatus = 'all';
  activeWardFilter = null;
  searchQuery = '';

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.classList.add('hidden');

  filterByCategory('all');
  filterByStatus('all');
  renderWardDeck();
  renderCitizenFeed();
  renderFilterSummary();
}

function renderFilterSummary() {
  const summaryBar = document.getElementById('filter-summary-bar');
  const summaryText = document.getElementById('filter-summary-text');
  const mobilePill = document.getElementById('mobile-active-filter');
  const mobilePillText = document.getElementById('mobile-active-filter-text');
  if (!summaryBar || !summaryText) return;

  const parts = [];
  const catMeta = CATEGORY_MAP[activeCategory];
  const catName = catMeta ? (currentLanguage === 'hi' ? catMeta.nameHi : catMeta.nameEn) : null;

  if (activeCategory !== 'all' && catName) parts.push(`Category: ${catName}`);
  if (activeStatus !== 'all') parts.push(`Status: ${activeStatus}`);
  if (activeWardFilter) parts.push(`Ward: ${activeWardFilter}`);
  if (searchQuery) parts.push(`"${searchQuery}"`);

  if (parts.length > 0) {
    summaryBar.classList.remove('hidden');
    if (mobilePill && mobilePillText) { mobilePill.classList.remove('hidden'); mobilePill.classList.add('flex'); mobilePillText.textContent = 'Filtered: ' + parts.join(' | '); }
    summaryText.textContent = `Active Filters: ${parts.join(' | ')}`;
  } else {
    summaryBar.classList.add('hidden');
    if (mobilePill) { mobilePill.classList.add('hidden'); mobilePill.classList.remove('flex'); }
  }
}

// ==================== EVENT LISTENERS & TOAST ====================
function setMobileTab(tab) {
  document.querySelectorAll('[data-mobile-tab]').forEach(button => { button.classList.toggle('active', button.dataset.mobileTab === tab); button.setAttribute('aria-current', button.dataset.mobileTab === tab ? 'page' : 'false'); });
  document.body.classList.toggle('mobile-wards-active', tab === 'wards');
  document.body.classList.toggle('mobile-feed-active', tab !== 'wards');
  const label = document.getElementById('mobile-view-label'); if (label) label.textContent = tab === 'wards' ? 'WARDS & AREAS' : 'FEED';
}

function switchMobileTab(tab) { setMobileTab(tab); }

function viewMatchingReports() {
  const searchBox = document.getElementById('search-input');
  if (searchBox) { searchQuery = searchBox.value.trim(); clearTimeout(searchDebounceTimer); }
  renderCitizenFeed();
  renderFilterSummary();
  setMobileTab('feed');
}
function setupEventListeners() {
  const wardSearch = document.getElementById('wardSearchInput');
  if (wardSearch) wardSearch.addEventListener('input', () => {
    clearTimeout(wardSearchDebounceTimer);
    wardSearchDebounceTimer = setTimeout(() => {
      const q = wardSearch.value.trim().toLowerCase();
      document.querySelectorAll('#ward-deck-container .ward-card-item').forEach(card => { card.hidden = !card.textContent.toLowerCase().includes(q); });
      const block = SAHARSA_MASTER_DATA.blocks.find(item => item.nameEn.toLowerCase() === q);
      if (block && lastAffinitySearchArea !== block.nameEn) { recordUserAffinity('area', block.nameEn); lastAffinitySearchArea = block.nameEn; }
      if (!q) lastAffinitySearchArea = '';
    }, 200);
  });
  const searchBox = document.getElementById('search-input');
  if (searchBox) {
    searchBox.addEventListener('input', handleSearchInput);
    searchBox.addEventListener('keydown', event => { if (event.key === 'Enter' && window.matchMedia('(max-width: 1023px)').matches) { event.preventDefault(); viewMatchingReports(); } });
    searchBox.setAttribute('list', 'saharsa-search-locations');
    let suggestions = document.getElementById('saharsa-search-locations');
    if (!suggestions) {
      suggestions = document.createElement('datalist');
      suggestions.id = 'saharsa-search-locations';
      document.body.appendChild(suggestions);
    }
    suggestions.innerHTML = SAHARSA_MASTER_DATA.blocks.map(block => `<option value="${escapeHtml(block.nameEn)}">`).join('');
  }

  document.querySelectorAll('[data-mobile-tab]').forEach(button => button.addEventListener('click', () => setMobileTab(button.dataset.mobileTab)));
  setMobileTab('feed');
  try { const lastReport = JSON.parse(localStorage.getItem('sahaysetu_last_report') || 'null'); if (lastReport) recordUserAffinity('home', lastReport.area || lastReport.ward || lastReport.location); } catch {}
  window.switchMobileTab = switchMobileTab;
  window.setLanguage = setLanguage;
  window.filterByCategory = filterByCategory;
  window.setFeedSortMode = setFeedSortMode;
  window.recordUserAffinity = recordUserAffinity;
  window.computeAiFeedScore = computeAiFeedScore;
  window.viewMatchingReports = viewMatchingReports;
  window.filterByStatus = filterByStatus;
  window.toggleWardFilter = toggleWardFilter;
  window.clearWardFilter = clearWardFilter;
  window.handleUpvote = handleUpvote;
  window.handleVote = handleVote;
  window.handleShareAlert = handleShareAlert;
  window.openLegalTerms = openLegalTerms;
  window.openFaqModal = openFaqModal;
  window.closeSiteInfoModal = closeSiteInfoModal;
  window.toggleComments = toggleComments;
  window.submitComment = submitComment;
  window.postPublicComment = submitComment;
  window.openVolunteerModal = openVolunteerModal;
  window.closeVolunteerModal = closeVolunteerModal;
  window.clearSearch = clearSearch;
  window.resetAllFilters = resetAllFilters;

}

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  const text = document.getElementById('toast-text');
  if (!toast || !text) return;

  text.textContent = message;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 3200);
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

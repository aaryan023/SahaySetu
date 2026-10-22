/**
 * SahaySetu Report Confirmation Screen (js/success.js)
 * Dynamic receipt hydration, Web Audio success chime, and multi-channel social share modal sheet
 */

const SUPABASE_URL = "https://skelexjuulrpwgfnijxt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n_Z1UNcqZ3k6TZA3T6AWsA__ZQvzlvs";
const sbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentReport = null;

// Category display mapping
const CATEGORY_NAMES = {
  flood: "🌊 Flood / Rising Water",
  food: "🍲 Food & Ration Needed",
  medical: "🏥 Urgent Medical Aid",
  power: "⚡ Power Hazard / Wire Risk",
  road: "🚧 Broken Road / Inundation",
  shelter: "⛺ Dry Shelter Camp",
  other: "✨ Civic Grievance"
};

document.addEventListener('DOMContentLoaded', () => {
  hydrateReportData();
  playSuccessChime();
  const checkmark = document.getElementById('successCheckmark') || document.querySelector('.bg-green-500');
  if (checkmark) {
    checkmark.style.cursor = 'pointer';
    checkmark.addEventListener('click', playSuccessChime);
  }
});

// ==================== 1. DYNAMIC REPORT HYDRATION ====================
function hydrateReportData() {
  const urlParams = new URLSearchParams(window.location.search);
  const paramId = urlParams.get('id');

  // Prefer the one-time post-submit share payload, then fall back to the saved receipt.
  try {
    const rawShare = sessionStorage.getItem('sahaysetu_share_report');
    if (rawShare) {
      const shareReport = JSON.parse(rawShare);
      if (shareReport && (!paramId || String(shareReport.id) === String(paramId))) currentReport = shareReport;
    }
  } catch (e) {
    console.warn('Error reading the session share details:', e);
  }
  try {
    const rawLast = localStorage.getItem('sahaysetu_last_report');
    if (!currentReport && rawLast) {
      currentReport = JSON.parse(rawLast);
    }
  } catch (e) {
    console.warn("Error reading sahaysetu_last_report:", e);
  }

  if (currentReport && paramId && String(currentReport.id) !== String(paramId)) currentReport = null;
  if (!currentReport) currentReport = { id: paramId || 'unknown', title: 'Report receipt unavailable', area: 'Report details are not available on this device', category: 'other' };

  // Ensure clean ID format
  const reportId = String(currentReport.id || paramId || 'unknown');
  const displayId = reportId.startsWith('#') ? reportId : `#${reportId}`;
  const rawId = reportId.replace(/^#/, '');

  // Category formatted string
  let categoryStr = CATEGORY_NAMES[currentReport.category] || currentReport.category || "🌊 Flood / Rising Water";

  // Hydrate DOM
  const receiptCategory = document.getElementById('receiptCategory');
  const receiptLocation = document.getElementById('receiptLocation');
  const receiptTimestamp = document.getElementById('receiptTimestamp');
  const receiptTrackingId = document.getElementById('receiptTrackingId');
  const trackingInput = document.getElementById('shareTrackingUrlInput');

  if (receiptCategory) {
    receiptCategory.textContent = categoryStr;
    receiptCategory.title = categoryStr;
  }
  if (receiptLocation) {
    receiptLocation.textContent = currentReport.area || currentReport.title || "Ward No. 3, Bariyahi, Kahara (Saharsa)";
    receiptLocation.title = currentReport.area || currentReport.title || "Ward No. 3, Bariyahi, Kahara (Saharsa)";
  }
  if (receiptTimestamp) {
    const createdAt = currentReport.created_at || currentReport.timestamp;
    receiptTimestamp.textContent = currentReport.timeString || (createdAt
      ? new Date(createdAt).toLocaleString()
      : "Just now");
  }
  if (receiptTrackingId) {
    receiptTrackingId.textContent = displayId;
  }
  if (trackingInput) {
    trackingInput.value = getTrackingUrl(rawId);
  }
}

function getTrackingUrl(reportId) {
  const url = new URL('success.html', window.location.href);
  url.searchParams.set('id', reportId);
  return url.href;
}

function getPublicReportUrl(reportId) {
  const url = new URL('https://sahaysetu-6023a.web.app/');
  url.searchParams.set('report', reportId);
  return url.href;
}

// ==================== 2. SUCCESS CHIME ====================
function playSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;

    const firstOscillator = context.createOscillator();
    const firstGain = context.createGain();
    firstOscillator.type = 'sine';
    firstOscillator.frequency.setValueAtTime(659.25, now);
    firstGain.gain.setValueAtTime(0.15, now);
    firstGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    firstOscillator.connect(firstGain);
    firstGain.connect(context.destination);
    firstOscillator.start(now);
    firstOscillator.stop(now + 0.35);

    const secondOscillator = context.createOscillator();
    const secondGain = context.createGain();
    secondOscillator.type = 'sine';
    secondOscillator.frequency.setValueAtTime(830.61, now + 0.12);
    secondGain.gain.setValueAtTime(0.2, now + 0.12);
    secondGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    secondOscillator.connect(secondGain);
    secondGain.connect(context.destination);
    secondOscillator.start(now + 0.12);
    secondOscillator.stop(now + 0.65);

    if (context.state === 'suspended') {
      console.log('Audio autoplay prevented by browser policy');
      context.close().catch(error => console.error('Unable to close audio context:', error));
      return;
    }
    window.setTimeout(() => context.close().catch(error => console.error('Unable to close audio context:', error)), 800);
  } catch (err) {
    console.log('Audio autoplay prevented by browser policy', err);
  }
}

// ==================== 3. SHARE MODAL SHEET LOGIC ====================
function openShareModal() {
  const modal = document.getElementById('socialShareModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }
}

function closeShareModal() {
  const modal = document.getElementById('socialShareModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

// Action 1: 9:16 Story Card Text Copy
function shareStoryCard() {
  const reportId = String(currentReport?.id || "SHS-2026-9042").replace(/^#/, '');
  const area = currentReport?.area || "Ward No. 3, Bariyahi, Kahara (Saharsa)";
  const cat = CATEGORY_NAMES[currentReport?.category] || currentReport?.category || "Flood / Rising Water";

  const storyText = 
`🚨 CIVIC EMERGENCY ALERT 🚨
📍 Location: ${area}
⚠️ Issue: ${cat}
⏱️ Status: In Rescue & Relief Queue
📌 Tracking ID: #${reportId}

📞 District Emergency Helpline: 1070 / 112
Track live on: ${getTrackingUrl(reportId)}`;

  copyText(storyText).then(() => {
    showToast("Story card text copied! Ready to paste into 9:16 Story/Status.");
    showModalFeedback("✓ Story text copied to clipboard!");
  }).catch(() => {
    showToast("Story text ready!");
  });
}

// Action 2: WhatsApp Chat & Status Direct Share
function shareWhatsApp() {
  const reportId = String(currentReport?.id || 'unknown').replace(/^#/, '');
  const area = currentReport?.area || 'Saharsa';
  const landmark = currentReport?.landmark || '';
  const category = currentReport?.category || 'Civic grievance';
  const description = currentReport?.description || '';
  const reportUrl = getPublicReportUrl(reportId);
  const message = `🚨 *Saharsa Citizen Emergency Alert!*
📍 Jagah: ${area} (${landmark})
⚠️ Samasya: ${category} - ${description}

👉 Is samasya ko verify karein aur live status dekhein:
${reportUrl}

🌐 SahaySetu Civic Portal par apni samasya bhi darj karein: https://sahaysetu-6023a.web.app`;
  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}
// Action 3: Instagram Story & DM
function shareInstagram() {
  const reportId = String(currentReport?.id || "SHS-2026-9042").replace(/^#/, '');
  const area = currentReport?.area || "Ward No. 3, Bariyahi, Kahara (Saharsa)";
  const cat = CATEGORY_NAMES[currentReport?.category] || currentReport?.category || "Flood / Water";

  const igText = `🚨 SahaySetu Civic Alert: ${cat} reported at ${area}. Live tracking ID: #${reportId}. Track here: ${getTrackingUrl(reportId)}`;

  copyText(igText).then(() => {
    showToast("Alert text copied! Open Instagram to paste into Story/DM.");
    showModalFeedback("✓ Alert text copied for Instagram!");
    setTimeout(() => {
      window.open('https://instagram.com', '_blank');
    }, 1100);
  }).catch(() => {
    window.open('https://instagram.com', '_blank');
  });
}

// Action 4: Facebook Post & Story
function shareFacebook() {
  const reportId = String(currentReport?.id || "SHS-2026-9042").replace(/^#/, '');
  const trackingUrl = getTrackingUrl(reportId);
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(trackingUrl)}`;
  window.open(fbUrl, '_blank');
}

// Action 5: Native System Share / Other Apps
function shareSystem() {
  const reportId = String(currentReport?.id || "SHS-2026-9042").replace(/^#/, '');
  const area = currentReport?.area || "Ward No. 3, Bariyahi, Kahara (Saharsa)";
  const cat = CATEGORY_NAMES[currentReport?.category] || currentReport?.category || "Flood";
  const trackingUrl = getTrackingUrl(reportId);

  if (navigator.share) {
    navigator.share({
      title: `SahaySetu Civic Report #${reportId}`,
      text: `Civic emergency alert: ${cat} at ${area}. Triage in active queue.`,
      url: trackingUrl
    }).catch((err) => {
      console.log("Share dismissed:", err);
    });
  } else {
    copyText(trackingUrl).then(() => {
      showToast("Link copied for Telegram, X & other apps!");
      showModalFeedback("✓ Link copied for Telegram, X & SMS!");
    }).catch(() => showToast("Unable to copy the tracking link."));
  }
}

// Copy Direct Tracking Link
function copyTrackingLink() {
  const trackingInput = document.getElementById('shareTrackingUrlInput');
  const copyBtn = document.getElementById('copyLinkBtn');
  const textToCopy = trackingInput ? trackingInput.value : getTrackingUrl('SHS-2026-9042');

  copyText(textToCopy).then(() => {
    if (copyBtn) {
      const origText = copyBtn.textContent;
      copyBtn.textContent = "Copied! ✓";
      copyBtn.className = "shrink-0 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs";
      setTimeout(() => {
        copyBtn.textContent = origText;
        copyBtn.className = "shrink-0 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold transition-all shadow-xs";
      }, 2000);
    }
    showModalFeedback("✓ Tracking URL copied to clipboard!");
    showToast("Incident link copied to clipboard!");
  }).catch((error) => {
    console.error('Unable to copy tracking link:', error);
    showToast("Unable to copy the tracking link.");
  });
}

function copyText(value) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(value);
  }

  return new Promise((resolve, reject) => {
    const input = document.getElementById('shareTrackingUrlInput');
    if (!input) {
      reject(new Error('Clipboard access is unavailable.'));
      return;
    }
    const previousValue = input.value;
    input.value = value;
    input.select();
    const copied = document.execCommand('copy');
    input.value = previousValue;
    if (copied) resolve();
    else reject(new Error('Clipboard copy was rejected.'));
  });
}

function showModalFeedback(msg) {
  const feedback = document.getElementById('shareModalFeedback');
  if (feedback) {
    feedback.textContent = msg;
    feedback.classList.remove('hidden');
    setTimeout(() => {
      feedback.classList.add('hidden');
    }, 2800);
  }
}

// Toast Feedback Helper
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

window.playSuccessChime = playSuccessChime;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.shareStoryCard = shareStoryCard;
window.shareWhatsApp = shareWhatsApp;
window.shareInstagram = shareInstagram;
window.shareFacebook = shareFacebook;
window.shareSystem = shareSystem;
window.copyTrackingLink = copyTrackingLink;

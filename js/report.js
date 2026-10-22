/**
 * SahaySetu Report Page (js/report.js)
 * Mobile-First Instagram/BeReal style report authoring with Geolocation & SOS Interceptor
 * Persistence: Supabase (Storage + Database)
 */

// ==================== SUPABASE INIT ====================
const SUPABASE_URL = "https://skelexjuulrpwgfnijxt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_n_Z1UNcqZ3k6TZA3T6AWsA__ZQvzlvs";
const sbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const SAHARSA_MASTER_DATA = {
  district: 'Saharsa', state: 'Bihar', defaultPin: '852201',
  blocks: [
    { id:1,nameEn:'Banma Itahri',nameHi:'बनमा इटहरी',subdivision:'Simri Bakhtiarpur',defaultPin:'852127' },
    { id:2,nameEn:'Kahara',nameHi:'कहरा',subdivision:'Saharsa Sadar',defaultPin:'852201' },
    { id:3,nameEn:'Mahishi',nameHi:'महिषी',subdivision:'Saharsa Sadar',defaultPin:'852216' },
    { id:4,nameEn:'Nauhatta',nameHi:'नौहट्टा',subdivision:'Saharsa Sadar',defaultPin:'852123' },
    { id:5,nameEn:'Patarghat',nameHi:'पतरघट',subdivision:'Simri Bakhtiarpur',defaultPin:'852124' },
    { id:6,nameEn:'Salkhua',nameHi:'सलखुआ',subdivision:'Saharsa Sadar',defaultPin:'852126' },
    { id:7,nameEn:'Satar Kataiya',nameHi:'सत्तर कटैया',subdivision:'Saharsa Sadar',defaultPin:'852124' },
    { id:8,nameEn:'Saur Bazar',nameHi:'सौर बाजार',subdivision:'Saharsa Sadar',defaultPin:'852202' },
    { id:9,nameEn:'Simri Bakhtiarpur',nameHi:'सिमरी बख्तियारपुर',subdivision:'Simri Bakhtiarpur',defaultPin:'852127' },
    { id:10,nameEn:'Sonbarsa',nameHi:'सोनबरसा',subdivision:'Saharsa Sadar',defaultPin:'852129' }
  ],
  pinMap: { '852201':'Saharsa H.O., Thana Chowk, Kachehri Campus, Kahara','852202':'Saur Bazar, Amarpur, Basauna, Benghaha','852203':'Saharsa Postal Area','852204':'Saharsa Postal Area','852123':'Nauhatta, Bakunia, Ekrah','852124':'Satar Kataiya, Patarghat, Aran, Bara, Gbihra','852125':'Saharsa Postal Area','852126':'Salkhua, Alani','852127':'Simri Bakhtiarpur, Banma Itahri, Balhampur, Bariarpur, Bhatauni, Ghordaur, Goriari','852129':'Sonbarsa Postal Area','852212':'Bangaon Area, Kahara','852216':'Mahishi, Aina, Bhelahi, Arapatti','852217':'Amrita, Atalkha, Balia, Baraith, Bargaon','852221':'Baijnathpur, Gamaharia Rampur, Garhia Vijaypur' },

};

let uploadedImageDataUrl = null;
let selectedImageFile = null; // raw File for upload
let selectedCompressedBlobPromise = null;
let previewObjectUrl = null;
let selectedCategory = 'flood';
let selectedUrgency = 'Normal';
let isAnonymous = false;
let isSubmitting = false;
let lastSuccessfulReportAt = 0;
const UPLOAD_TIMESTAMPS_KEY = 'sahaysetu_upload_timestamps';
const REPORT_COOLDOWN_KEY = 'sahaysetu_last_report_submitted_at';
const TEN_MINUTES_MS = 10 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const REPORT_COOLDOWN_MS = 30 * 1000;

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

function getRecentUploadTimestamps() {
  const stored = safeStorageJSON(localStorage, UPLOAD_TIMESTAMPS_KEY, []);
  const timestamps = Array.isArray(stored) ? stored.filter(ts => Number.isFinite(ts) && ts > Date.now() - TWO_HOURS_MS) : [];
  safeStorageWrite(localStorage, UPLOAD_TIMESTAMPS_KEY, JSON.stringify(timestamps));
  return timestamps;
}

function checkDeviceRateLimit() {
  const uploads = getRecentUploadTimestamps();
  const now = Date.now();
  const uploadsInLast10Min = uploads.filter(ts => ts > now - TEN_MINUTES_MS);

  if (uploadsInLast10Min.length >= 2) {
    const oldestInWindow = Math.min(...uploadsInLast10Min);
    const waitMs = TWO_HOURS_MS - (now - oldestInWindow);
    return { allowed: false, waitMinutes: Math.ceil(waitMs / 60000) };
  }

  if (uploads.length >= 2) {
    const oldestUpload = Math.min(...uploads);
    const waitMs = TWO_HOURS_MS - (now - oldestUpload);
    if (waitMs > 0) return { allowed: false, waitMinutes: Math.ceil(waitMs / 60000) };
  }

  return { allowed: true };
}

function formatRateLimitWait(waitMinutes) {
  const totalMinutes = Math.max(1, waitMinutes || 1);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} ghante / ${minutes} minute`;
}

function showRateLimitAlert(waitMinutes) {
  alert(`Spam rokne ke liye limit lagi hai. Aap agla photo report ${formatRateLimitWait(waitMinutes)} baad hi darj kar sakte hain.`);
}

function recordCompletedPhotoUpload() {
  const uploads = getRecentUploadTimestamps();
  uploads.push(Date.now());
  safeStorageWrite(localStorage, UPLOAD_TIMESTAMPS_KEY, JSON.stringify(uploads));
}

async function checkMobileRateLimit(enteredMobile) {
  if (!sbClient) return { allowed: true };

  const twoHoursAgoISO = new Date(Date.now() - TWO_HOURS_MS).toISOString();
  const { count, error } = await sbClient
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .eq('mobile', enteredMobile)
    .gte('created_at', twoHoursAgoISO);

  if (error) throw error;
  if (count >= 2) {
    const { data: oldestReports, error: oldestError } = await sbClient
      .from('reports')
      .select('created_at')
      .eq('mobile', enteredMobile)
      .gte('created_at', twoHoursAgoISO)
      .order('created_at', { ascending: true })
      .limit(1);
    if (oldestError) throw oldestError;
    const oldestTimestamp = oldestReports?.[0]?.created_at
      ? new Date(oldestReports[0].created_at).getTime()
      : Date.now();
    const waitMinutes = Math.ceil((TWO_HOURS_MS - (Date.now() - oldestTimestamp)) / 60000);
    return { allowed: false, waitMinutes };
  }

  return { allowed: true };
}

document.addEventListener('DOMContentLoaded', () => {
  initFormHandlers();
  // Check if browser has geolocation permission already or trigger subtle status
  if (navigator.geolocation) {
    const headerStatus = document.getElementById('header-gps-status');
    if (headerStatus) headerStatus.textContent = 'GPS Ready';
  }
});

function initFormHandlers() {
  const dropzoneCard = document.getElementById('dropzoneCard');
  const photoInput = document.getElementById('photoInput');
  const removePhotoBtn = document.getElementById('removePhotoBtn');
  const reportForm = document.getElementById('reportForm') || document.getElementById('ground-report-form');
  if (dropzoneCard && photoInput) {
    dropzoneCard.addEventListener('click', (event) => {
      if (event.target.closest('#removePhotoBtn')) return;
      if (event.target === photoInput) return;
      if (event.target.closest('label[for="photoInput"]')) {
        return;
      }
      photoInput.click();
    });
  }
  if (photoInput) photoInput.addEventListener('change', handlePhotoSelect);
  if (reportForm) reportForm.addEventListener('submit', submitLiveReport, true);
  const locations = document.getElementById('saharsa-locations-list');
  if (locations) {
    const localities = ['Saharsa Town','Thana Chowk','Kachehri Campus','Ward No. 3, Bariyahi (Kahara)','Ghataho (Simri Bakhtiarpur)','Mahishi North','Patori (Nauhatta)','Bangaon','Baijnathpur','Saur Bazar','Salkhua','Sonbarsa','Patarghat','Satar Kataiya','Banma Itahri'];
    locations.innerHTML = [...SAHARSA_MASTER_DATA.blocks.flatMap(block => [block.nameEn, block.nameHi]), ...localities].map(value => `<option value="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`).join('');
  }
  const pinOptions = document.getElementById('saharsa-pins-list');
  if (pinOptions) pinOptions.innerHTML = Object.entries(SAHARSA_MASTER_DATA.pinMap).map(([pin, area]) => `<option value="${pin}">${area}</option>`).join('');
  const wardInput = document.getElementById('report-ward');
  const pinInput = document.getElementById('report-pin');
  const autoFillPin = () => {
    const value = wardInput?.value.trim().toLowerCase();
    const block = SAHARSA_MASTER_DATA.blocks.find(item => value === item.nameEn.toLowerCase() || value === item.nameHi);
    const localityPins = { 'ward no. 3, bariyahi (kahara)':'852201','ghataho (simri bakhtiarpur)':'852127','mahishi north':'852216','patori (nauhatta)':'852123','bangaon':'852212','baijnathpur':'852221' };
    const pin = block?.defaultPin || localityPins[value];
    if (pinInput && pin) pinInput.value = pin;
  };
  wardInput?.addEventListener('change', autoFillPin);
  pinInput?.addEventListener('input', () => {
    const area = SAHARSA_MASTER_DATA.pinMap[pinInput.value.trim()];
    if (area && wardInput && !wardInput.value.trim()) wardInput.value = area.split(',')[0];
  });
  const gpsButton = document.getElementById('getGpsBtn') || document.getElementById('gps-detect-btn');
  if (gpsButton && !gpsButton.hasAttribute('onclick')) {
    gpsButton.addEventListener('click', fetchUserGps);
  }
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeSelectedPhoto();
    });
  }

  document.querySelectorAll('.category-chip').forEach((chip) => {
    chip.addEventListener('click', (event) => {
      event.preventDefault();
      selectCategory(chip.dataset.category || chip.dataset.cat || chip.textContent.trim());
    });
  });

  document.querySelectorAll('.urgency-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      selectUrgency(button.dataset.urgency || button.textContent.trim());
    });
  });

  const closeSosBtn = document.getElementById('closeSosBtn');
  if (closeSosBtn) {
    closeSosBtn.addEventListener('click', closeSosModal);
  }

  // Caption auto-growing textarea and character counter
  const captionTextarea = document.getElementById('report-caption');
  const charCounter = document.getElementById('caption-char-count');
  if (captionTextarea) {
    captionTextarea.addEventListener('input', () => {
      captionTextarea.style.height = 'auto';
      captionTextarea.style.height = (captionTextarea.scrollHeight) + 'px';
      if (charCounter) {
        charCounter.textContent = captionTextarea.value.length;
      }

    });
  }

  // Anonymous toggle handler
  const anonToggle = document.getElementById('anon-toggle');
  const nameInput = document.getElementById('reporter-name');
  const anonLabel = document.getElementById('anon-label');
  if (anonToggle) {
    anonToggle.addEventListener('change', (e) => {
      isAnonymous = e.target.checked;
      if (anonLabel) {
        anonLabel.textContent = isAnonymous ? 'Posting Anonymously' : 'Post Anonymously';
      }
      if (nameInput) {
        nameInput.disabled = isAnonymous;
        if (isAnonymous) {
          nameInput.value = 'Anonymous Citizen';
          nameInput.classList.add('opacity-60', 'bg-slate-100');
        } else {
          nameInput.value = '';
          nameInput.classList.remove('opacity-60', 'bg-slate-100');
        }
      }
    });
  }
}

// Category Selection with animated 'Others' field
function selectCategory(cat) {
  selectedCategory = String(cat).toLowerCase();
  document.querySelectorAll('.cat-pill').forEach(btn => {
    if ((btn.dataset.category || btn.dataset.cat || '').toLowerCase() === selectedCategory) {
      btn.className = 'cat-pill category-chip px-3 py-2 rounded-xl border border-blue-600 bg-blue-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all';
    } else {
      btn.className = 'cat-pill category-chip px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all';
    }
  });

  const otherFieldContainer = document.getElementById('otherCategoryWrapper');
  const otherInput = document.getElementById('otherCategoryInput');
  if (otherFieldContainer) {
    if (cat === 'other') {
      otherFieldContainer.classList.add('open');
      if (otherInput) otherInput.focus();
    } else {
      otherFieldContainer.classList.remove('open');
      if (otherInput) otherInput.value = '';
    }
  }
}

// Urgency Selector & Emergency SOS Pop-up Interceptor
function selectUrgency(urgency) {
  const urgencyValue = String(urgency).trim().toUpperCase();
  selectedUrgency = urgencyValue.includes('CRITICAL') ? 'CRITICAL' : urgencyValue === 'HIGH' ? 'High' : 'Normal';
  const urgNormal = document.getElementById('urg-normal');
  const urgHigh = document.getElementById('urg-high');
  const urgCritical = document.getElementById('urg-critical');

  // Reset classes
  if (urgNormal) {
    urgNormal.className = 'urgency-option urgency-btn py-2.5 px-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition-all hover:bg-slate-50';
  }
  if (urgHigh) {
    urgHigh.className = 'urgency-option urgency-btn py-2.5 px-2 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition-all hover:bg-amber-50';
  }
  if (urgCritical) {
    urgCritical.className = 'urgency-option urgency-btn py-2.5 px-2 rounded-xl border border-red-300 bg-white text-red-600 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all hover:bg-red-50';
  }

  if (selectedUrgency === 'Normal' && urgNormal) {
    urgNormal.className = 'urgency-option urgency-btn py-2.5 px-2 rounded-xl border border-blue-600 bg-blue-50 ring-2 ring-blue-600 text-slate-900 font-semibold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-sm';
  } else if (selectedUrgency === 'High' && urgHigh) {
    urgHigh.className = 'urgency-option urgency-btn py-2.5 px-2 rounded-xl border border-amber-500 bg-amber-50 ring-2 ring-amber-500 text-slate-900 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-sm';
  } else if (selectedUrgency === 'CRITICAL' && urgCritical) {
    urgCritical.className = 'urgency-option urgency-btn py-2.5 px-2 rounded-xl border border-red-600 bg-red-50 ring-2 ring-red-600 text-red-700 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all shadow-md sos-glow';
    // Trigger SOS Emergency Modal
    openSosModal();
  }
}

// Emergency SOS Modal open/close controls
function openSosModal() {
  const modal = document.getElementById('sosModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeSosModal() {
  const modal = document.getElementById('sosModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

// ==================== IMAGE COMPRESSION HELPER ====================
/**
 * Compress an image File via HTML5 canvas to a maximum 700px dimension.
 * Returns a JPEG Blob encoded at 0.6 quality.
 */
function compressImage(file) {
  return (async () => {
    let source;
    let objectUrl;
    try {
      if (typeof createImageBitmap === 'function') {
        source = await createImageBitmap(file);
      } else {
        objectUrl = URL.createObjectURL(file);
        source = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error('Image load failed'));
          image.src = objectUrl;
        });
      }

  const scale = Math.min(1, 1200 / source.width, 1200 / source.height);
      const width = Math.max(1, Math.round(source.width * scale));
      const height = Math.max(1, Math.round(source.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('Canvas is unavailable');
      context.drawImage(source, 0, 0, width, height);
      return await new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas compression failed'));
        }, 'image/jpeg', 0.72);
      });
    } finally {
      if (source && typeof source.close === 'function') source.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  })();
}

// Photo Upload: show the original photo immediately while compression runs in parallel.
function handlePhotoSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select a valid image file.');
    removeSelectedPhoto();
    return;
  }

  selectedImageFile = file;
  selectedCompressedBlobPromise = compressImage(file).catch(err => {
    console.error('Image compression failed:', err);
    throw err;
  });
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  uploadedImageDataUrl = previewObjectUrl;

  const previewContainer = document.getElementById('previewContainer');
  const previewImg = document.getElementById('imagePreview');
  const dropzonePlaceholder = document.getElementById('uploadPrompt');

  if (previewImg) previewImg.src = previewObjectUrl;
  if (previewContainer) previewContainer.classList.remove('hidden');
  if (dropzonePlaceholder) dropzonePlaceholder.classList.add('hidden');

}

function removeSelectedPhoto() {
  uploadedImageDataUrl = null;
  selectedImageFile = null;
  selectedCompressedBlobPromise = null;
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }
  const fileInput = document.getElementById('photoInput');
  if (fileInput) fileInput.value = '';

  const previewContainer = document.getElementById('previewContainer');
  const previewImg = document.getElementById('imagePreview');
  const dropzonePlaceholder = document.getElementById('uploadPrompt');

  if (previewContainer) previewContainer.classList.add('hidden');
  if (previewImg) previewImg.src = '';
  if (dropzonePlaceholder) dropzonePlaceholder.classList.remove('hidden');
}

// HTML5 Geolocation API with Fallback
function fetchUserGps() {
  const gpsBtn = document.getElementById('gps-detect-btn');
  const gpsStatus = document.getElementById('gps-status-text');
  const headerGpsStatus = document.getElementById('header-gps-status');
  const areaInput = document.getElementById('report-ward');
  const landmarkInput = document.getElementById('report-landmark');

  if (gpsStatus) gpsStatus.textContent = "Detecting Location...";
  if (gpsBtn) gpsBtn.classList.add('animate-pulse');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(4);
        const lng = position.coords.longitude.toFixed(4);

        if (areaInput && !areaInput.value.trim()) areaInput.value = `${lat}, ${lng}`;
        if (landmarkInput && !landmarkInput.value) {
          landmarkInput.value = `GPS: ${lat}, ${lng}`;
        }
        if (gpsStatus) gpsStatus.textContent = `📍 ${lat}° N, ${lng}° E`;
        if (headerGpsStatus) headerGpsStatus.textContent = `${lat}, ${lng}`;
        if (gpsBtn) gpsBtn.classList.remove('animate-pulse');
      },
      (error) => {
        console.warn("GPS error or denied:", error);
        if (gpsStatus) gpsStatus.textContent = "📍 Auto-Detect My Live Location";
        if (headerGpsStatus) headerGpsStatus.textContent = 'GPS Tagged';
        if (gpsBtn) gpsBtn.classList.remove('animate-pulse');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    if (gpsBtn) gpsBtn.classList.remove('animate-pulse');
    if (gpsStatus) gpsStatus.textContent = "📍 Auto-Detect My Live Location";
    if (headerGpsStatus) headerGpsStatus.textContent = 'GPS Tagged';
    console.warn("Geolocation is not available in this browser.");
  }
}

// Form Submission -> Supabase Storage + DB -> Redirect to success.html
async function submitLiveReport(e) {
  if (isSubmitting || e.__sahaySetuHandled) return;
  e.__sahaySetuHandled = true;
  e.preventDefault();
  const submitBtn = document.getElementById('publish-submit-btn');
  const originalButtonMarkup = submitBtn?.innerHTML || '';
  const originalButtonDisabled = submitBtn?.disabled || false;
  isSubmitting = true;
  let submissionSucceeded = false;
  try {
    const caption = document.getElementById('report-caption')?.value.trim() || '';
    const ward = document.getElementById('report-ward')?.value.trim() || '';
    const landmark = document.getElementById('report-landmark')?.value.trim() || '';
    const city = document.getElementById('report-city')?.value.trim() || 'Saharsa, Bihar';
    const pin = document.getElementById('report-pin')?.value.trim() || SAHARSA_MASTER_DATA.defaultPin;
    const phone = document.getElementById('reporter-phone')?.value.trim() || '';
    const name = isAnonymous ? 'Anonymous Citizen' : (document.getElementById('reporter-name')?.value.trim() || 'Verified Citizen');
    if (!selectedCategory || !caption || !ward || !phone) throw new Error('Please fill in the required fields: Category, Description, Ward/Area, and Mobile Number.');

    let finalCat = selectedCategory;
    if (selectedCategory === 'other') {
      const customCat = document.getElementById('otherCategoryInput')?.value.trim();
      if (!customCat) throw new Error('Please specify the other category.');
      finalCat = customCat;
    }

    const lastSubmittedAt = Math.max(lastSuccessfulReportAt, Number(safeStorageRead(localStorage, REPORT_COOLDOWN_KEY, '0')) || 0);
    const cooldownLeftMs = REPORT_COOLDOWN_MS - (Date.now() - lastSubmittedAt);
    if (cooldownLeftMs > 0) throw new Error(`Please wait ${Math.ceil(cooldownLeftMs / 1000)} seconds before submitting another report.`);

    if (selectedImageFile) {
      const deviceLimit = checkDeviceRateLimit();
      if (!deviceLimit.allowed) { showRateLimitAlert(deviceLimit.waitMinutes); return; }
      const mobileLimit = await checkMobileRateLimit(phone);
      if (!mobileLimit.allowed) { showRateLimitAlert(mobileLimit.waitMinutes); return; }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">sync</span><span>Uploading to Cloud...</span>';
    }

    // ---- 1. Upload photo to Supabase Storage ----
    let photoUrl = null;

    if (selectedImageFile) {
      const compressedBlob = selectedCompressedBlobPromise
        ? await selectedCompressedBlobPromise
        : await compressImage(selectedImageFile);
      if (sbClient) {
        try {
          const contentType = compressedBlob.type || selectedImageFile.type || 'image/jpeg';
          const extension = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1] || 'bin';
          const filePath = `reports/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
          const { error: uploadError } = await sbClient.storage
            .from('reports-media')
            .upload(filePath, compressedBlob, {
              contentType,
              upsert: false
            });
          if (uploadError) throw uploadError;
          const { data } = sbClient.storage.from('reports-media').getPublicUrl(filePath);
          photoUrl = data.publicUrl;
        } catch (err) {
          console.error('Photo upload failed:', err);
          throw new Error('Photo upload failed. Please retry without a photo or try again when connected.');
        }
      }
      if (!photoUrl) throw new Error('Photo could not be uploaded. Please try again.');
    }

    const reportData = {
      category: finalCat,
      urgency: selectedUrgency,
      area: ward,
      landmark: landmark,
      city: city,
      pincode: pin,
      description: caption,
      mobile: phone,
      reporter_name: name,
      is_anonymous: isAnonymous,
      photo_url: photoUrl,
      status: 'pending',
      upvotes: 0
    };

    if (!sbClient) throw new Error('Cloud service is unavailable. Your report was not submitted. Please try again when connected.');
    let insertResult = await sbClient.from('reports').insert(reportData).select().single();
    if (insertResult.error && isSchemaColumnError(insertResult.error)) {
      const coreColumns = ['category','urgency','area','landmark','description','mobile','reporter_name','photo_url','status','upvotes'];
      const corePayload = Object.fromEntries(coreColumns.map(key => [key, reportData[key]]));
      insertResult = await sbClient.from('reports').insert(corePayload).select().single();
    }
    if (insertResult.error) throw new Error('Report could not be saved to the server: ' + (insertResult.error.message || 'database insert failed'));
    const insertedRow = insertResult.data;
    if (!insertedRow || insertedRow.id == null) throw new Error('The server did not return a saved report. Please retry.');
    safeStorageWrite(localStorage, 'sahaysetu_last_report', JSON.stringify(insertedRow));
    safeStorageWrite(sessionStorage, 'sahaysetu_share_report', JSON.stringify({
      id: insertedRow.id,
      area: insertedRow.area || ward,
      landmark: insertedRow.landmark || landmark,
      category: insertedRow.category || finalCat,
      description: insertedRow.description || caption
    }));
    lastSuccessfulReportAt = Date.now();
    safeStorageWrite(localStorage, REPORT_COOLDOWN_KEY, String(lastSuccessfulReportAt));

    if (selectedImageFile) recordCompletedPhotoUpload();
    const reportId = insertedRow.id;

    // Store success toast flag for index.html as fallback
    safeStorageWrite(sessionStorage, 'sahaysetu_toast', `Report #${reportId} published successfully to live feed!`);

    // Update button text
    if (submitBtn) {
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined text-[20px] animate-spin">sync</span>
        <span>Broadcasting to Ward ${ward}...</span>
      `;
    }

    // Smooth redirect to success.html with tracking ID
    submissionSucceeded = true;
    window.location.href = `success.html?id=${encodeURIComponent(reportId || Date.now())}`;

  } catch (err) {
    console.error("Submission error:", err);
    alert(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
  } finally {
    isSubmitting = false;
    if (submitBtn && !submissionSucceeded) {
      submitBtn.disabled = originalButtonDisabled;
      submitBtn.innerHTML = originalButtonMarkup;
    }
  }
}

function isSchemaColumnError(error) {
  const code = String(error?.code || ''), message = String(error?.message || '').toLowerCase();
  return ['42703','PGRST204','PGRST200'].includes(code) || /column .* does not exist|could not find .* column|schema cache/.test(message);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to create local photo fallback.'));
    reader.readAsDataURL(blob);
  });
}


window.submitLiveReport = submitLiveReport;
window.selectCategory = selectCategory;
window.selectUrgency = selectUrgency;
window.fetchUserGps = fetchUserGps;
window.handlePhotoSelect = handlePhotoSelect;
window.removeSelectedPhoto = removeSelectedPhoto;
window.closeSosModal = closeSosModal;

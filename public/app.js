/**
 * app.js — Frontend JS para PONTE LA CAMISETA KALA
 * Maneja: navegación de pasos, drag & drop, sliders,
 * llamada al backend, polling y descarga/share.
 */

'use strict';

/* ═══════════════════════════════════════════════
   API BASE
   '' = mismo origen (Render full-app o dev local).
   Para frontend en Vercel + API en Render, poner aquí
   la URL de Render, ej: 'https://ponte-la-camiseta-kala.onrender.com'
   ═══════════════════════════════════════════════ */
const API_BASE = 'https://ponte-la-camiseta-kala.onrender.com';

/* ═══════════════════════════════════════════════
   ESTADO GLOBAL
   ═══════════════════════════════════════════════ */
const state = {
  currentStep:   1,
  selfieFile:    null,
  selfieURL:     null,   // object URL para preview
  selfieBase64:  null,   // base64 redimensionado (sin prefijo data:)
  selfieMime:    'image/jpeg',
  genero:        'Hombre',
  altura:        170,
  peso:          70,
  resultImageUrl: null,
};

/* ═══════════════════════════════════════════════
   INICIALIZACIÓN
   ═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initParticles();
  initNavbarScroll();
  syncSlider('slider-altura', 'val-altura', 'cm');
  syncSlider('slider-peso',   'val-peso',   'kg');
  updateComplexion();
});

/* ═══════════════════════════════════════════════
   NAVBAR SCROLL EFFECT
   ═══════════════════════════════════════════════ */
function initNavbarScroll() {
  const nav = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

/* ═══════════════════════════════════════════════
   PARTÍCULAS CANVAS (estadio)
   ═══════════════════════════════════════════════ */
function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const resize = () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const GOLD  = 'rgba(27,109,245,';
  const GREEN = 'rgba(34,211,255,';

  const particles = Array.from({ length: 55 }, () => ({
    x:     Math.random() * canvas.width,
    y:     Math.random() * canvas.height,
    r:     Math.random() * 1.8 + 0.4,
    dx:    (Math.random() - 0.5) * 0.3,
    dy:    -Math.random() * 0.5 - 0.2,
    alpha: Math.random() * 0.5 + 0.1,
    color: Math.random() > 0.7 ? GREEN : GOLD,
    pulse: Math.random() * Math.PI * 2,
  }));

  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.pulse += 0.02;
      const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + a + ')';
      ctx.fill();
      p.x += p.dx;
      p.y += p.dy;
      if (p.y < -10)              p.y = canvas.height + 10;
      if (p.x < -10)              p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
    });
    requestAnimationFrame(animate);
  };
  animate();
}

/* ═══════════════════════════════════════════════
   SCROLL TO FORM
   ═══════════════════════════════════════════════ */
function scrollToForm() {
  document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════
   NAVEGACIÓN DE PASOS
   ═══════════════════════════════════════════════ */
function goStep(n) {
  // Ocultar paso actual
  document.getElementById(`step-${state.currentStep}`).classList.add('hidden');

  // Marcar paso anterior como done en indicador
  if (n > state.currentStep) {
    const prevDot = document.getElementById(`sdot-${state.currentStep}`);
    prevDot.classList.remove('active');
    prevDot.classList.add('done');

    const con = document.getElementById(`scon-${state.currentStep}`);
    if (con) con.classList.add('filled');
  }

  state.currentStep = n;

  // Mostrar nuevo paso
  const newCard = document.getElementById(`step-${n}`);
  newCard.classList.remove('hidden');

  // Activar indicador
  const newDot = document.getElementById(`sdot-${n}`);
  if (newDot) {
    newDot.classList.remove('done');
    newDot.classList.add('active');
  }

  // Scroll suave al formulario
  document.getElementById('form-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ═══════════════════════════════════════════════
   UPLOAD — DRAG & DROP
   ═══════════════════════════════════════════════ */
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.add('drag-over');
}

function handleDragLeave(e) {
  document.getElementById('upload-zone').classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function triggerFileInput() {
  document.getElementById('selfie-input').click();
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  hideUploadError();

  // Validar tipo
  if (!file.type.startsWith('image/')) {
    showUploadError('El archivo debe ser una imagen (JPG, PNG, WEBP).');
    return;
  }

  // Validar tamaño (10MB)
  if (file.size > 10 * 1024 * 1024) {
    showUploadError('La imagen supera el límite de 10MB.');
    return;
  }

  state.selfieFile = file;

  // Mostrar preview
  if (state.selfieURL) URL.revokeObjectURL(state.selfieURL);
  state.selfieURL = URL.createObjectURL(file);

  document.getElementById('preview-img').src = state.selfieURL;
  document.getElementById('upload-empty').classList.add('hidden');
  document.getElementById('upload-preview').classList.remove('hidden');

  // Redimensionar a base64 (para enviar liviano al backend serverless)
  document.getElementById('btn-step1').disabled = true;
  resizeToBase64(file, 1024).then(({ base64, mime }) => {
    state.selfieBase64 = base64;
    state.selfieMime   = mime;
    document.getElementById('btn-step1').disabled = false;
  }).catch(() => {
    showUploadError('No se pudo procesar la imagen. Prueba con otra.');
  });
}

/**
 * Redimensiona una imagen a un lado máximo y la devuelve como base64 JPEG.
 * Mantiene el payload bajo el límite de Vercel (~4.5MB) y acelera la subida.
 */
function resizeToBase64(file, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width >= height) { height = Math.round(height * maxDim / width); width = maxDim; }
        else                 { width  = Math.round(width  * maxDim / height); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], mime: 'image/jpeg' });
    };
    img.onerror = reject;
    img.src = url;
  });
}

function showUploadError(msg) {
  const el = document.getElementById('upload-error');
  document.getElementById('upload-error-msg').textContent = msg;
  el.classList.remove('hidden');
}

function hideUploadError() {
  document.getElementById('upload-error').classList.add('hidden');
}

/* ═══════════════════════════════════════════════
   GÉNERO
   ═══════════════════════════════════════════════ */
function selectGender(genero, btn) {
  state.genero = genero;
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateComplexion();
}

/* ═══════════════════════════════════════════════
   CONSENTIMIENTO + PRIVACIDAD
   ═══════════════════════════════════════════════ */
function toggleConsent() {
  const ok = document.getElementById('consent-check').checked;
  document.getElementById('btn-generate').disabled = !ok;
}

function openPrivacy() {
  document.getElementById('privacy-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePrivacy() {
  document.getElementById('privacy-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function acceptPrivacy() {
  const chk = document.getElementById('consent-check');
  chk.checked = true;
  toggleConsent();
  closePrivacy();
}

/* ═══════════════════════════════════════════════
   SLIDERS
   ═══════════════════════════════════════════════ */
function syncSlider(sliderId, labelId, unit) {
  const slider = document.getElementById(sliderId);
  const label  = document.getElementById(labelId);
  if (!slider || !label) return;

  const val = parseInt(slider.value);
  label.textContent = `${val} ${unit}`;

  // Actualizar estado
  if (sliderId === 'slider-altura') state.altura = val;
  if (sliderId === 'slider-peso')   state.peso   = val;

  // Actualizar fill visual (webkit)
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--pct', pct + '%');
  slider.style.background = `linear-gradient(to right, var(--gold) ${pct}%, rgba(255,255,255,0.1) ${pct}%)`;
}

/* ═══════════════════════════════════════════════
   COMPLEXIÓN CHIP
   ═══════════════════════════════════════════════ */
// 6 niveles por IMC — debe coincidir con server/promptBuilder.js
const TIERS_CHIP = {
  Hombre: [
    { max: 17.5, txt: '🏃 Muy delgado' },
    { max: 21,   txt: '🏃 Delgado' },
    { max: 25,   txt: '⚡ Promedio / atlético' },
    { max: 28,   txt: '💪 Sólido / fornido' },
    { max: 32,   txt: '💪 Robusto / corpulento' },
    { max: Infinity, txt: '💪 Muy corpulento' },
  ],
  Mujer: [
    { max: 17.5, txt: '🏃 Muy delgada' },
    { max: 21,   txt: '🏃 Delgada / estilizada' },
    { max: 25,   txt: '⚡ Promedio / atlética' },
    { max: 28,   txt: '✨ Con curvas' },
    { max: 32,   txt: '✨ Robusta / curvy' },
    { max: Infinity, txt: '✨ Plus / voluminosa' },
  ],
};

function updateComplexion() {
  const m   = state.altura / 100;
  const imc = state.peso / (m * m);
  const tiers = TIERS_CHIP[state.genero] || TIERS_CHIP.Hombre;
  const tier  = tiers.find(t => imc < t.max) || tiers[tiers.length - 1];
  const label = `${tier.txt} · IMC ${imc.toFixed(1)}`;

  const chip = document.getElementById('complexion-chip');
  const txt  = document.getElementById('complexion-txt');
  if (txt) txt.textContent = label;

  // Pequeña animación al cambiar
  chip.style.transform = 'scale(1.03)';
  setTimeout(() => { chip.style.transform = 'scale(1)'; }, 200);
}

/* ═══════════════════════════════════════════════
   GENERAR IMAGEN — llamada al backend
   ═══════════════════════════════════════════════ */
async function generateImage() {
  if (!state.selfieBase64) {
    alert('Por favor sube una selfie primero.');
    goStep(1);
    return;
  }

  if (!document.getElementById('consent-check').checked) {
    alert('Debes autorizar el tratamiento de datos para generar tu retrato.');
    return;
  }

  // Ir al paso de loading
  goStep(3);

  // Animar checklist + progress bar
  startLoadingAnimation();

  try {
    const base = {
      selfie:     state.selfieBase64,
      selfieMime: state.selfieMime,
      genero:     state.genero,
      altura:     state.altura,
      peso:       state.peso,
    };

    // 2 pedidos independientes con el mismo motor (Gemini) pero distinta
    // variación de pose → 2 opciones distintas, rápidas y confiables en Vercel.
    const reqOne = (provider, variant, label) =>
      fetch(`${API_BASE}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...base, provider, variant }),
      })
      .then(r => r.json())
      .then(d => {
        if (!d || !d.success) throw new Error(d && d.error ? d.error : 'fallo');
        return { label, imageDataUrl: d.imageDataUrl, imageUrl: d.imageUrl };
      })
      .catch(err => { console.warn(`[APP] ${label} falló:`, err.message); return { label, error: true }; });

    // Opción 1 = Gemini, Opción 2 = OpenAI. Son APIs distintas → en paralelo
    // no se encolan entre sí. (Requiere backend sin límite de 60s: Render.)
    const settled = await Promise.all([
      reqOne('gemini', undefined, 'Opción 1'),
      reqOne('openai', undefined, 'Opción 2'),
    ]);

    const versions = settled.filter(v => v.imageDataUrl || v.imageUrl);
    if (versions.length === 0) {
      throw new Error('No se generó ninguna versión.');
    }

    finishLoadingAnimation(() => showResults(versions));

  } catch (err) {
    console.error('[APP] Error:', err); // detalle técnico solo en consola
    stopLoadingAnimation();
    goStep(2); // volver a datos
    alert('😕 No pudimos crear tu retrato en este momento.\n\nIntenta de nuevo en unos segundos. Si vuelve a pasar, prueba con otra foto bien iluminada, de frente y sin gafas.');
  }
}

/* ═══════════════════════════════════════════════
   LOADING ANIMATION
   ═══════════════════════════════════════════════ */
let loadingTimer = null;

const LOAD_STEPS = [
  { id: 'lc-1', msg: 'Analizando tu rostro...',                                 pct: 10,  delay: 0    },
  { id: 'lc-2', msg: 'Calculando complexión corporal...',                       pct: 22,  delay: 6000 },
  { id: 'lc-3', msg: 'Creando tus 2 versiones del retrato...',                  pct: 45,  delay: 15000},
  { id: 'lc-4', msg: 'Poniéndote la camiseta en el estadio...',                 pct: 72,  delay: 34000},
  { id: 'lc-5', msg: 'Finalizando en alta resolución...',                       pct: 92,  delay: 54000},
];

function startLoadingAnimation() {
  const fill  = document.getElementById('loading-fill');
  const msgEl = document.getElementById('loading-msg');

  // Reset
  LOAD_STEPS.forEach(s => {
    const el = document.getElementById(s.id);
    el.className = 'lc-item';
    el.querySelector('.lc-icon').textContent = '○';
  });
  fill.style.width = '0%';

  // Programar pasos
  LOAD_STEPS.forEach((step, i) => {
    const t = setTimeout(() => {
      // Marcar anteriores como done
      if (i > 0) {
        const prev = document.getElementById(LOAD_STEPS[i - 1].id);
        prev.classList.remove('active');
        prev.classList.add('done');
        prev.querySelector('.lc-icon').textContent = '';
      }
      // Activar actual
      const el = document.getElementById(step.id);
      el.classList.add('active');
      el.querySelector('.lc-icon').textContent = '▶';

      fill.style.width = step.pct + '%';
      if (msgEl) msgEl.textContent = step.msg;
    }, step.delay);

    loadingTimer = t; // guardar último para poder cancelar
  });
}

function finishLoadingAnimation(callback) {
  const fill  = document.getElementById('loading-fill');
  const msgEl = document.getElementById('loading-msg');

  fill.style.width = '100%';
  if (msgEl) msgEl.textContent = '¡Retrato listo! 🎉';

  // Marcar todos como done
  LOAD_STEPS.forEach(s => {
    const el = document.getElementById(s.id);
    el.classList.remove('active');
    el.classList.add('done');
    el.querySelector('.lc-icon').textContent = '';
  });

  setTimeout(callback, 700);
}

function stopLoadingAnimation() {
  clearTimeout(loadingTimer);
}

/* ═══════════════════════════════════════════════
   MOSTRAR RESULTADO (1 o 2 versiones)
   ═══════════════════════════════════════════════ */
const SVG_WA = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';
const SVG_TW = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
const SVG_IG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>';
const SVG_DL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

function showResults(versions) {
  goStep(4);

  const dot3 = document.getElementById('sdot-3');
  if (dot3) { dot3.classList.remove('active'); dot3.classList.add('done'); }

  const cont = document.getElementById('result-versions');
  cont.innerHTML = '';

  const ok = versions.filter(v => v && (v.imageDataUrl || v.imageUrl));
  if (ok.length === 0) return;

  ok.forEach((v, i) => {
    const url = v.imageDataUrl || v.imageUrl;
    const label = ok.length > 1 ? `Opción ${i + 1}` : 'Tu retrato';

    const card = document.createElement('div');
    card.className = 'version-card';
    card.innerHTML = `
      <div class="version-label">${label}</div>
      <div class="result-frame">
        <img class="result-img" alt="Retrato KALA" />
        <div class="result-badge-overlay">
          <img src="kala-white.png" class="result-kala-badge" alt="KALA"
               onerror="this.outerHTML='<span class=\\'result-kala-text\\'>KALA</span>'" />
        </div>
      </div>
      <button class="btn-download" type="button">${SVG_DL} Guardar imagen</button>
      <div class="share-row">
        <span class="share-label">Compartir:</span>
        <button class="share-btn wa" type="button" title="WhatsApp">${SVG_WA}</button>
        <button class="share-btn tw" type="button" title="X / Twitter">${SVG_TW}</button>
        <button class="share-btn ig" type="button" title="Instagram">${SVG_IG}</button>
      </div>`;

    const img = card.querySelector('.result-img');
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.5s ease';
    img.onload = () => { img.style.opacity = '1'; };
    img.src = url;

    card.querySelector('.btn-download').addEventListener('click', (e) => saveImage(url, e.currentTarget));
    card.querySelector('.share-btn.wa').addEventListener('click', () => shareWhatsApp(url));
    card.querySelector('.share-btn.tw').addEventListener('click', () => shareTwitter(url));
    card.querySelector('.share-btn.ig').addEventListener('click', () => shareInstagram(url));

    cont.appendChild(card);
  });

  const hint = document.createElement('p');
  hint.className = 'download-hint';
  hint.innerHTML = 'En el celular elige <strong>“Guardar imagen”</strong> para enviarla a tu galería.';
  cont.appendChild(hint);
}

/* ═══════════════════════════════════════════════
   GUARDAR / COMPARTIR (por imagen)
   ═══════════════════════════════════════════════ */
async function getBlobFromUrl(url) {
  return (await fetch(url)).blob();
}

function triggerDownload(blob) {
  const objURL = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objURL;
  a.download = `kala-soykala-${Date.now()}.jpg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objURL);
}

/** MÓVIL: comparte la imagen ADJUNTA con el menú nativo (incluye "Guardar imagen"). */
async function shareImageNative(url, text) {
  try {
    const blob = await getBlobFromUrl(url);
    const file = new File([blob], `kala-soykala-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text, title: 'PONTE LA CAMISETA KALA' });
      } catch (err) {
        if (err && err.name === 'AbortError') return true; // canceló
        throw err;
      }
      return true;
    }
  } catch (err) {
    console.warn('[APP] Share nativo no disponible:', err.message);
  }
  return false;
}

/** Botón "Guardar imagen": móvil → galería vía share; PC → descarga. */
async function saveImage(url, btn) {
  if (!url) return;
  if (await shareImageNative(url, 'Yo #SoyKala ⚽🏟️')) return;
  try {
    const blob = await getBlobFromUrl(url);
    triggerDownload(blob);
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '✓ ¡Listo!';
      setTimeout(() => { btn.innerHTML = original; }, 2500);
    }
  } catch (_) {
    window.open(url, '_blank');
  }
}

/** ESCRITORIO: descarga la foto y abre la red para adjuntarla. */
async function desktopShareFallback(url, openUrl) {
  try { const blob = await getBlobFromUrl(url); triggerDownload(blob); } catch (_) {}
  window.open(openUrl, '_blank');
  setTimeout(() => {
    alert('💡 En la computadora descargamos tu foto.\nAdjúntala en la ventana que se abrió y publica con #SoyKala.');
  }, 400);
}

async function shareWhatsApp(url) {
  const text = '¡Ya tengo la camiseta KALA puesta! Esta es mi nueva foto de perfil 🏟️⚽ Yo #SoyKala';
  if (await shareImageNative(url, text)) return;
  await desktopShareFallback(url, `https://wa.me/?text=${encodeURIComponent(text)}`);
}

async function shareTwitter(url) {
  const text = 'Me puse la camiseta KALA y esta es mi nueva foto de perfil 🏟️⚽🔥 Yo #SoyKala';
  if (await shareImageNative(url, text)) return;
  await desktopShareFallback(url, `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`);
}

async function shareInstagram(url) {
  const text = 'Yo #SoyKala ⚽🏟️';
  if (await shareImageNative(url, text)) return;
  try { const blob = await getBlobFromUrl(url); triggerDownload(blob); } catch (_) {}
  alert('📲 Descargamos tu foto.\nSúbela a tu feed o historias de Instagram con #SoyKala para participar por el premio.');
}

/* ═══════════════════════════════════════════════
   RESET FORMULARIO
   ═══════════════════════════════════════════════ */
function resetForm() {
  // Reset estado
  state.currentStep    = 1;
  state.selfieFile     = null;
  state.selfieBase64   = null;
  state.resultImageUrl = null;
  if (state.selfieURL) {
    URL.revokeObjectURL(state.selfieURL);
    state.selfieURL = null;
  }

  // Reset UI upload
  document.getElementById('selfie-input').value = '';
  document.getElementById('preview-img').src = '';
  document.getElementById('upload-empty').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('btn-step1').disabled = true;
  hideUploadError();

  // Reset consentimiento
  const consent = document.getElementById('consent-check');
  if (consent) consent.checked = false;
  document.getElementById('btn-generate').disabled = true;

  // Reset step indicators
  ['sdot-1','sdot-2','sdot-3'].forEach((id, i) => {
    const dot = document.getElementById(id);
    dot.classList.remove('active', 'done');
    if (i === 0) dot.classList.add('active');
  });
  ['scon-1','scon-2'].forEach(id => {
    document.getElementById(id)?.classList.remove('filled');
  });

  // Mostrar step 1
  ['step-2','step-3','step-4'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
  document.getElementById('step-1').classList.remove('hidden');

  scrollToForm();
}

/**
 * app.js — Frontend JS para PONTE LA CAMISETA KALA
 * Maneja: navegación de pasos, drag & drop, sliders,
 * llamada al backend, polling y descarga/share.
 */

'use strict';

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

function triggerCameraInput() {
  document.getElementById('selfie-camera').click();
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
    showUploadError('No se pudo procesar la imagen. Probá con otra.');
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

  // Ir al paso de loading
  goStep(3);

  // Animar checklist + progress bar
  startLoadingAnimation();

  try {
    const response = await fetch('/api/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        selfie:     state.selfieBase64,
        selfieMime: state.selfieMime,
        genero:     state.genero,
        altura:     state.altura,
        peso:       state.peso,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Error al generar la imagen.');
    }

    const imageUrl = data.imageDataUrl || data.imageUrl;
    state.resultImageUrl = imageUrl;

    // Avanzar al resultado
    finishLoadingAnimation(() => showResult(imageUrl));

  } catch (err) {
    console.error('[APP] Error:', err);
    stopLoadingAnimation();
    goStep(2); // volver a datos
    alert(`❌ ${err.message}\n\nVerificá tu conexión o configuración de API.`);
  }
}

/* ═══════════════════════════════════════════════
   LOADING ANIMATION
   ═══════════════════════════════════════════════ */
let loadingTimer = null;

const LOAD_STEPS = [
  { id: 'lc-1', msg: 'Analizando tu rostro...',                                 pct: 15,  delay: 0    },
  { id: 'lc-2', msg: 'Calculando complexión corporal...',                       pct: 35,  delay: 3500 },
  { id: 'lc-3', msg: 'Construyendo prompt especializado KALA...',               pct: 55,  delay: 7000 },
  { id: 'lc-4', msg: 'Renderizando retrato hiperrealista...',                   pct: 80,  delay: 12000},
  { id: 'lc-5', msg: 'Finalizando imagen en alta resolución...',                pct: 95,  delay: 22000},
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
   MOSTRAR RESULTADO
   ═══════════════════════════════════════════════ */
function showResult(imageUrl) {
  goStep(4);

  // Marcar step 3 como done en indicador
  const dot3 = document.getElementById('sdot-3');
  if (dot3) { dot3.classList.remove('active'); dot3.classList.add('done'); }

  const img = document.getElementById('result-img');
  img.src = imageUrl;
  img.onload = () => { img.style.opacity = '1'; };
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.5s ease';
}

/* ═══════════════════════════════════════════════
   DESCARGAR IMAGEN
   ═══════════════════════════════════════════════ */
async function downloadImage() {
  const url = state.resultImageUrl;
  if (!url) return;

  try {
    const btn = document.getElementById('btn-download');
    btn.textContent = 'Descargando...';

    const response = await fetch(url);
    const blob     = await response.blob();
    const objURL   = URL.createObjectURL(blob);

    const a    = document.createElement('a');
    a.href     = objURL;
    a.download = `kala-retrato-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objURL);

    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><polyline points="20 6 9 17 4 12"/></svg> ¡Descargado!`;
    setTimeout(() => {
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:20px;height:20px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Descargar`;
    }, 2500);
  } catch (err) {
    console.error('[APP] Download error:', err);
    // Fallback: abrir en nueva pestaña
    window.open(url, '_blank');
  }
}

/* ═══════════════════════════════════════════════
   SHARE
   ═══════════════════════════════════════════════ */
function shareWhatsApp() {
  const text = encodeURIComponent(
    '¡Ya tengo la camiseta KALA puesta! Esta es mi nueva foto de perfil 🏟️⚽ Yo #SoyKala'
  );
  window.open(`https://wa.me/?text=${text}`, '_blank');
}

function shareTwitter() {
  const text = encodeURIComponent(
    'Me puse la camiseta KALA y esta es mi nueva foto de perfil 🏟️⚽🔥 Yo #SoyKala'
  );
  window.open(`https://x.com/intent/tweet?text=${text}`, '_blank');
}

function shareInstagram() {
  // Instagram no permite share directo vía URL — mostrar instrucción
  downloadImage().then(() => {
    alert('📲 Imagen descargada.\nPonla de foto de perfil y súbela a tu feed o historias con #SoyKala para participar por el premio.');
  });
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
  document.getElementById('selfie-camera').value = '';
  document.getElementById('preview-img').src = '';
  document.getElementById('upload-empty').classList.remove('hidden');
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('btn-step1').disabled = true;
  hideUploadError();

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

/**
 * handler.js — Lógica compartida de generación.
 * La usan tanto el servidor Express (dev local) como la función
 * serverless de Vercel (api/generate.js).
 */

'use strict';

const { construirPromptFinal }                            = require('./promptBuilder');
const { generatePortrait, generateForProvider, withTimeout } = require('./aiClient');

// Tope por motor. En Vercel free conviene <60s; en Render (sin límite) se sube
// con GEN_TIMEOUT_MS para permitir alta calidad.
const PROVIDER_TIMEOUT_MS = parseInt(process.env.GEN_TIMEOUT_MS, 10) || 58000;

/** Convierte un resultado de IA (o fallo) en una "versión" para el frontend. */
function toVersion(label, provider, settled) {
  if (settled.status === 'fulfilled') {
    const r = settled.value;
    if (r.type === 'base64') return { label, provider, imageDataUrl: `data:${r.mimeType};base64,${r.data}` };
    if (r.type === 'url')    return { label, provider, imageUrl: r.url };
  }
  const detail = settled.reason?.message || 'error desconocido';
  console.warn(`[handler] versión ${label} falló:`, detail);
  return { label, provider, error: true, detail }; // detail = diagnóstico (no se muestra al usuario)
}

/**
 * Procesa una solicitud de generación.
 * @param {object} input
 * @param {string} input.genero        "Hombre" | "Mujer"
 * @param {number|string} input.altura cm
 * @param {number|string} input.peso   kg
 * @param {string} input.selfieBase64  imagen del usuario en base64 (sin prefijo data:)
 * @param {string} input.selfieMime    mime type, ej "image/jpeg"
 * @returns {Promise<{ imageDataUrl?: string, imageUrl?: string, demo?: boolean, metadata: object }>}
 */
async function handleGenerate(input) {
  const genero = input.genero;
  const altura = parseFloat(input.altura);
  const peso   = parseFloat(input.peso);

  // ── Validación ──────────────────────────────
  if (!input.selfieBase64) {
    const e = new Error('Se requiere una foto (selfie).'); e.status = 400; throw e;
  }
  if (!genero || !['Hombre', 'Mujer'].includes(genero)) {
    const e = new Error('Género inválido. Usa "Hombre" o "Mujer".'); e.status = 400; throw e;
  }
  if (isNaN(altura) || altura < 100 || altura > 250) {
    const e = new Error('Altura inválida (100-250 cm).'); e.status = 400; throw e;
  }
  if (isNaN(peso) || peso < 30 || peso > 300) {
    const e = new Error('Peso inválido (30-300 kg).'); e.status = 400; throw e;
  }

  const both      = input.mode === 'both';
  const faceImage = { base64: input.selfieBase64, mimeType: input.selfieMime || 'image/jpeg' };

  // ── Modo demo ───────────────────────────────
  if (process.env.DEMO_MODE === 'true') {
    await new Promise(r => setTimeout(r, 2500));
    const demoUrl = 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=768&q=80';
    if (both) {
      return {
        demo: true,
        versions: [
          { label: 'Gemini', provider: 'gemini', imageUrl: demoUrl },
          { label: 'OpenAI', provider: 'openai', imageUrl: demoUrl },
        ],
        metadata: { genero, altura, peso },
      };
    }
    return {
      demo: true, imageUrl: demoUrl,
      metadata: { genero, altura, peso },
      message: 'Demo mode. Configura GEMINI_API_KEY y DEMO_MODE=false para generación real.',
    };
  }

  // ── Construir prompt ────────────────────────
  const { positivePrompt, negativePrompt, metadata } = construirPromptFinal({ genero, altura, peso });

  // ── Modo "2 versiones" (Gemini + OpenAI en paralelo) ──
  if (both) {
    let prompt = positivePrompt;
    if (negativePrompt) prompt += `\n\nAVOID: ${negativePrompt}.`;

    const [g, o] = await Promise.allSettled([
      withTimeout(generateForProvider('gemini', prompt, faceImage), PROVIDER_TIMEOUT_MS, 'gemini'),
      withTimeout(generateForProvider('openai', prompt, faceImage), PROVIDER_TIMEOUT_MS, 'openai'),
    ]);

    const versions = [
      toVersion('Gemini', 'gemini', g),
      toVersion('OpenAI', 'openai', o),
    ];

    if (!versions.some(v => v.imageDataUrl || v.imageUrl)) {
      // Ninguna salió: devolvemos 200 con el detalle de cada fallo (para diagnóstico).
      return { versions, metadata, allFailed: true };
    }
    return { versions, metadata };
  }

  // ── Un solo proveedor específico (cada pedido = su propia función de 60s) ──
  if (input.provider === 'gemini' || input.provider === 'openai') {
    let prompt = positivePrompt;
    if (negativePrompt) prompt += `\n\nAVOID: ${negativePrompt}.`;
    const result = await withTimeout(
      generateForProvider(input.provider, prompt, faceImage),
      PROVIDER_TIMEOUT_MS,
      input.provider,
    );
    if (result.type === 'url')    return { imageUrl: result.url, provider: input.provider, model: result.model, metadata };
    if (result.type === 'base64') return { imageDataUrl: `data:${result.mimeType};base64,${result.data}`, provider: input.provider, model: result.model, metadata };
    throw new Error('Resultado de IA desconocido.');
  }

  // ── Modo single por defecto (con fallback automático) ───
  const result = await generatePortrait({ positivePrompt, negativePrompt, faceImage });

  if (result.type === 'url')    return { imageUrl: result.url, metadata };
  if (result.type === 'base64') return { imageDataUrl: `data:${result.mimeType};base64,${result.data}`, metadata };
  throw new Error('Resultado de IA desconocido.');
}

module.exports = { handleGenerate };

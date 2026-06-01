/**
 * aiClient.js — Cliente de IA para KALA Campaign (serverless-ready)
 *
 * Modelos:
 *   GEMINI:  gemini-3-pro-image  (análisis facial + generación de imagen)
 *   OPENAI:  gpt-image-2         (alternativa OpenAI)
 *
 * La imagen del usuario se recibe como { base64, mimeType } — NO como ruta
 * de disco — para funcionar igual en Express local y en funciones serverless
 * (Vercel), donde el sistema de archivos es efímero/solo-lectura.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ─────────────────────────────────────────────
// Imágenes de referencia fijas (camiseta + balón)
// Se cargan UNA vez a base64 al iniciar el módulo.
// ─────────────────────────────────────────────
const REFS_DIR   = path.join(__dirname, '..', 'refs');
const JERSEY_REF = path.join(REFS_DIR, 'camiseta-kala.jpeg');
const BALL_REF   = path.join(REFS_DIR, 'balon.jpeg');

function loadRef(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return { base64: fs.readFileSync(filePath).toString('base64'), mimeType: 'image/jpeg' };
  } catch (_) {
    return null;
  }
}

const JERSEY_IMG = loadRef(JERSEY_REF);
const BALL_IMG   = loadRef(BALL_REF);

// ─────────────────────────────────────────────
// SDKs (cargados por demanda)
// ─────────────────────────────────────────────
let _GoogleGenerativeAI;
let _OpenAI;

function geminiClient() {
  if (!_GoogleGenerativeAI) {
    ({ GoogleGenerativeAI: _GoogleGenerativeAI } = require('@google/generative-ai'));
  }
  return new _GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

function openaiClient() {
  if (!_OpenAI) _OpenAI = require('openai');
  // maxRetries bajo + timeout para que falle rápido en vez de colgarse.
  return new _OpenAI({
    apiKey:     process.env.OPENAI_API_KEY,
    maxRetries: 1,
    timeout:    50000,
  });
}

function inlinePart(img) {
  return img ? { inlineData: { mimeType: img.mimeType, data: img.base64 } } : null;
}

// ─────────────────────────────────────────────
// PASO 1 — Análisis facial
// Recibe { base64, mimeType } y devuelve descripción textual.
// ─────────────────────────────────────────────
async function analyzeFace(faceImg) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  const instruction =
    'Describe this person\'s facial features accurately for ultra-realistic AI portrait generation. ' +
    'Include: exact skin tone (e.g. "warm medium brown", "fair with pink undertones"), ' +
    'eye color and shape, nose bridge and tip, jawline shape, hair color and style, ' +
    'eyebrow thickness and shape, lip fullness, overall facial structure (oval/square/round/heart). ' +
    'Keep the response under 120 words. Photorealistic descriptor language only. ' +
    'No names, no personal identifiers, just precise visual descriptors.';

  // ── OpenAI vision (alternativa) ──────────────
  if (provider === 'openai') {
    const oai = openaiClient();
    const res = await oai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${faceImg.mimeType};base64,${faceImg.base64}` } },
          { type: 'text', text: instruction },
        ],
      }],
      max_tokens: 200,
    });
    return res.choices[0].message.content;
  }

  // ── Gemini — visión ──────────────────────────
  const genAI = geminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image' });
  const result = await model.generateContent([
    inlinePart(faceImg),
    { text: instruction },
  ]);
  return result.response.text();
}

// ─────────────────────────────────────────────
// Armado de las partes (selfie + camiseta + balón + prompt)
// ─────────────────────────────────────────────
function buildParts(positivePrompt, faceImg) {
  const parts = [];
  if (faceImg) {
    parts.push({ text: 'FACE REFERENCE — replicate this exact person\'s face and identity:' });
    parts.push(inlinePart(faceImg));
  }
  if (JERSEY_IMG) {
    parts.push({ text: 'JERSEY REFERENCE — the person must wear THIS exact white KALA jersey with the navy "kala" wordmark:' });
    parts.push(inlinePart(JERSEY_IMG));
  }
  if (BALL_IMG) {
    parts.push({ text: 'BALL REFERENCE — the person must hold THIS exact adidas TRIONDA match ball:' });
    parts.push(inlinePart(BALL_IMG));
  }
  parts.push({ text: positivePrompt });
  return parts;
}

// ─────────────────────────────────────────────
// Extracción DEFENSIVA de la imagen de la respuesta.
// Devuelve el objeto imagen, o null si no hay imagen.
// Lanza error claro si fue bloqueada por seguridad.
// ─────────────────────────────────────────────
function extractImageFromResponse(response) {
  const block = response?.promptFeedback?.blockReason;
  if (block) {
    const e = new Error(`bloqueado por seguridad (${block})`);
    e.blocked = true;
    throw e;
  }

  const candidate = response?.candidates?.[0];
  if (!candidate) return null;

  const parts = candidate.content?.parts;
  if (!Array.isArray(parts)) {
    const fr = candidate.finishReason;
    if (fr && fr !== 'STOP') {
      const e = new Error(`respuesta sin imagen (finishReason: ${fr})`);
      e.blocked = (fr === 'SAFETY' || fr === 'PROHIBITED_CONTENT');
      throw e;
    }
    return null; // estructura inesperada → tratar como "sin imagen"
  }

  for (const part of parts) {
    if (part?.inlineData?.data) {
      return {
        type:     'base64',
        data:     part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────
// Gemini — un intento con un modelo concreto
// ─────────────────────────────────────────────
async function generateWithGeminiModel(positivePrompt, faceImg, modelId) {
  const genAI = geminiClient();
  const model = genAI.getGenerativeModel({ model: modelId });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: buildParts(positivePrompt, faceImg) }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  const img = extractImageFromResponse(result.response);
  if (!img) throw new Error(`${modelId}: respuesta sin imagen`);
  return img;
}

// ─────────────────────────────────────────────
// Gemini — cadena de modelos (fallback automático)
// Configurable con GEMINI_IMAGE_MODELS (coma-separado).
// ─────────────────────────────────────────────
const DEFAULT_GEMINI_MODELS = [
  'gemini-3-pro-image',
  'gemini-2.5-flash-image',
  'gemini-2.5-flash-image-preview',
  'gemini-2.0-flash-preview-image-generation',
];

async function generateWithGeminiChain(positivePrompt, faceImg) {
  const models = (process.env.GEMINI_IMAGE_MODELS
    ? process.env.GEMINI_IMAGE_MODELS.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_GEMINI_MODELS);

  const errors = [];
  for (const modelId of models) {
    try {
      console.log('[AI] Probando modelo Gemini:', modelId);
      return await generateWithGeminiModel(positivePrompt, faceImg, modelId);
    } catch (err) {
      console.warn(`[AI] Modelo ${modelId} falló: ${err.message}`);
      errors.push(`${modelId}: ${err.message}`);
    }
  }
  throw new Error(`Gemini sin imagen tras probar ${models.length} modelo(s) → ${errors.join(' | ')}`);
}

// ─────────────────────────────────────────────
// OpenAI — gpt-image-2
// Usa EDIT con la selfie + camiseta + balón para conservar la identidad.
// Si el edit falla, cae a generación por texto.
// ─────────────────────────────────────────────
async function generateWithOpenAI(positivePrompt, faceImg) {
  const oai = openaiClient();
  const { toFile } = require('openai');

  // Intento 1: EDIT con imágenes de referencia (mejor fidelidad facial)
  try {
    const images = [];
    if (faceImg) {
      images.push(await toFile(Buffer.from(faceImg.base64, 'base64'), 'selfie.jpg', { type: faceImg.mimeType || 'image/jpeg' }));
    }
    if (JERSEY_IMG) images.push(await toFile(Buffer.from(JERSEY_IMG.base64, 'base64'), 'jersey.jpg', { type: 'image/jpeg' }));
    if (BALL_IMG)   images.push(await toFile(Buffer.from(BALL_IMG.base64, 'base64'),   'ball.jpg',   { type: 'image/jpeg' }));

    if (images.length) {
      const res = await oai.images.edit({
        model:  'gpt-image-2',
        image:  images,
        prompt: positivePrompt,
        size:   '1024x1536',
      });
      const img = res?.data?.[0];
      if (img?.b64_json) return { type: 'base64', data: img.b64_json, mimeType: 'image/png' };
      if (img?.url)      return { type: 'url', url: img.url };
    }
  } catch (err) {
    console.warn('[AI] gpt-image-2 edit falló, intento generate:', err.message);
  }

  // Intento 2: generación por texto
  const res = await oai.images.generate({
    model:   'gpt-image-2',
    prompt:  positivePrompt,
    n:       1,
    size:    '1024x1536',
    quality: 'high',
  });
  const img = res?.data?.[0];
  if (img?.b64_json) return { type: 'base64', data: img.b64_json, mimeType: 'image/png' };
  if (img?.url)      return { type: 'url', url: img.url };
  throw new Error('gpt-image-2: sin datos de imagen');
}

// ─────────────────────────────────────────────
// Genera con UN proveedor concreto (para comparación A/B).
// @param {'gemini'|'openai'} provider
// @param {string} prompt  prompt completo (ya incluye AVOID)
// @param {object} faceImage { base64, mimeType }
// ─────────────────────────────────────────────
async function generateForProvider(provider, prompt, faceImage) {
  if (provider === 'openai') return generateWithOpenAI(prompt, faceImage);
  return generateWithGeminiChain(prompt, faceImage);
}

/** Limita una promesa a `ms` milisegundos. */
function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label}: timeout tras ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — generatePortrait
// Con fallbacks: cadena de modelos Gemini + respaldo OpenAI.
// @param {object} params
// @param {string} params.positivePrompt
// @param {string} params.negativePrompt
// @param {object} params.faceImage  { base64, mimeType }
// ─────────────────────────────────────────────
async function generatePortrait({ positivePrompt, negativePrompt, faceImage }) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  // La foto de referencia es la fuente de verdad de la identidad (sin descripción textual).
  let prompt = positivePrompt;
  if (negativePrompt) prompt += `\n\nAVOID: ${negativePrompt}.`;

  const hasGemini = !!process.env.GEMINI_API_KEY;
  const hasOpenAI = !!process.env.OPENAI_API_KEY;

  // Orden de proveedores según preferencia + claves disponibles.
  const order = [];
  if (provider === 'openai') {
    if (hasOpenAI) order.push('openai');
    if (hasGemini) order.push('gemini');
  } else {
    if (hasGemini) order.push('gemini');
    if (hasOpenAI) order.push('openai');
  }

  if (order.length === 0) {
    throw new Error('No hay API keys configuradas (GEMINI_API_KEY u OPENAI_API_KEY).');
  }

  const errors = [];
  for (const p of order) {
    try {
      console.log(`[AI] Generando con proveedor: ${p}`);
      if (p === 'gemini') return await generateWithGeminiChain(prompt, faceImage);
      if (p === 'openai') return await generateWithOpenAI(prompt, faceImage);
    } catch (err) {
      console.warn(`[AI] Proveedor ${p} falló: ${err.message}`);
      errors.push(`${p} → ${err.message}`);
    }
  }

  throw new Error(`No se pudo generar la imagen. Detalle: ${errors.join(' || ')}`);
}

module.exports = { generatePortrait, generateForProvider, withTimeout, analyzeFace };

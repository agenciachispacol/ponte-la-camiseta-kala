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
  return new _OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
// PASO 2A — Gemini 3 Pro Image (generación)
// ─────────────────────────────────────────────
async function generateWithGemini3(positivePrompt, faceImg) {
  const genAI = geminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image' });

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

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });

  const candidate = result.response.candidates?.[0];
  if (!candidate) throw new Error('Gemini 3 Pro Image: no candidates in response.');

  for (const part of candidate.content.parts) {
    if (part.inlineData) {
      return {
        type:     'base64',
        data:     part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/jpeg',
      };
    }
  }
  throw new Error('Gemini 3 Pro Image: no image part found in response.');
}

// ─────────────────────────────────────────────
// PASO 2B — GPT-image-2 (OpenAI alternativa)
// ─────────────────────────────────────────────
async function generateWithGPTImage2(positivePrompt) {
  const oai = openaiClient();
  const res = await oai.images.generate({
    model:   'gpt-image-2',
    prompt:  positivePrompt,
    n:       1,
    size:    '1024x1536',
    quality: 'high',
  });
  const img = res.data[0];
  if (img.b64_json) return { type: 'base64', data: img.b64_json, mimeType: 'image/png' };
  if (img.url)      return { type: 'url', url: img.url };
  throw new Error('gpt-image-2: no image data returned.');
}

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL — generatePortrait
// @param {object} params
// @param {string} params.positivePrompt
// @param {string} params.negativePrompt
// @param {object} params.faceImage  { base64, mimeType }
// ─────────────────────────────────────────────
async function generatePortrait({ positivePrompt, negativePrompt, faceImage }) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  console.log(`[AI] Provider: ${provider} | Modelo: ${provider === 'openai' ? 'gpt-image-2' : 'gemini-3-pro-image'}`);

  // Para máxima fidelidad facial NO inyectamos una descripción textual de la cara
  // (tiende a "promediar" el rostro): la foto de referencia es la fuente de verdad.
  let enrichedPrompt = positivePrompt;

  // Gemini no tiene parámetro de negativos: se incluyen como línea AVOID en el texto.
  if (negativePrompt) {
    enrichedPrompt += `\n\nAVOID: ${negativePrompt}.`;
  }

  // Generar imagen
  if (provider === 'openai') {
    return generateWithGPTImage2(enrichedPrompt);
  }
  return generateWithGemini3(enrichedPrompt, faceImage);
}

module.exports = { generatePortrait, analyzeFace };

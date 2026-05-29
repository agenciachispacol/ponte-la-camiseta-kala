/**
 * aiClient.js — Cliente de IA para KALA Campaign
 *
 * Modelos:
 *   GEMINI:  gemini-3-pro-image  (análisis facial + generación de imagen)
 *   OPENAI:  gpt-image-2         (alternativa OpenAI)
 *
 * Flujo en 2 pasos:
 *   1. Análisis facial → Gemini 3 Pro Image describe los rasgos del usuario
 *   2. Generación de imagen → Gemini 3 Pro Image genera el retrato KALA
 */

'use strict';

const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');

// ─────────────────────────────────────────────
// Imágenes de referencia fijas (camiseta + balón)
// ─────────────────────────────────────────────
const REFS_DIR     = path.join(__dirname, '..', 'refs');
const JERSEY_REF    = path.join(REFS_DIR, 'camiseta-kala.jpeg');
const BALL_REF      = path.join(REFS_DIR, 'balon.jpeg');

/** Lee una imagen de disco y la devuelve como part inlineData de Gemini. */
function fileToInlinePart(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const buf      = fs.readFileSync(filePath);
  const ext      = filePath.toLowerCase();
  const mimeType = ext.endsWith('.png') ? 'image/png'
                 : ext.endsWith('.webp') ? 'image/webp'
                 : 'image/jpeg';
  return { inlineData: { mimeType, data: buf.toString('base64') } };
}

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

// ─────────────────────────────────────────────
// PASO 1 — Análisis facial con Gemini 3 Pro Image
// Lee la selfie y devuelve descripción textual
// de los rasgos para enriquecer el prompt.
// ─────────────────────────────────────────────
async function analyzeFace(imagePath) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  const imageBuffer = fs.readFileSync(imagePath);
  const base64      = imageBuffer.toString('base64');
  const mimeType    = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

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
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          { type: 'text', text: instruction },
        ],
      }],
      max_tokens: 200,
    });
    return res.choices[0].message.content;
  }

  // ── Gemini 3 Pro Image — visión ──────────────
  const genAI = geminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image' });
  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: instruction },
  ]);
  return result.response.text();
}

// ─────────────────────────────────────────────
// PASO 2A — Gemini 3 Pro Image (generación)
// Toma la selfie y el prompt → retrato KALA
// ─────────────────────────────────────────────
async function generateWithGemini3(positivePrompt, imagePath) {
  const genAI = geminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image' });

  const parts = [];

  // ── Referencia 1: rostro del usuario (identidad) ──
  const facePart = fileToInlinePart(imagePath);
  if (facePart) {
    parts.push({ text: 'FACE REFERENCE — replicate this exact person\'s face and identity:' });
    parts.push(facePart);
  }

  // ── Referencia 2: camiseta KALA (diseño exacto) ──
  const jerseyPart = fileToInlinePart(JERSEY_REF);
  if (jerseyPart) {
    parts.push({ text: 'JERSEY REFERENCE — the person must wear THIS exact white KALA jersey with the navy "kala" wordmark:' });
    parts.push(jerseyPart);
  }

  // ── Referencia 3: balón oficial (diseño exacto) ──
  const ballPart = fileToInlinePart(BALL_REF);
  if (ballPart) {
    parts.push({ text: 'BALL REFERENCE — the person must hold THIS exact adidas TRIONDA match ball:' });
    parts.push(ballPart);
  }

  parts.push({ text: positivePrompt });

  const result = await model.generateContent({
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
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
async function generateWithGPTImage2(positivePrompt, imagePath) {
  const oai = openaiClient();

  // Con selfie: usar image edit para máxima fidelidad facial.
  // gpt-image-2 acepta múltiples imágenes: selfie + camiseta + balón.
  if (imagePath && fs.existsSync(imagePath)) {
    try {
      const images = [fs.createReadStream(imagePath)];
      if (fs.existsSync(JERSEY_REF)) images.push(fs.createReadStream(JERSEY_REF));
      if (fs.existsSync(BALL_REF))   images.push(fs.createReadStream(BALL_REF));

      const res = await oai.images.edit({
        model:  'gpt-image-2',
        image:  images,
        prompt: positivePrompt,
        n:      1,
        size:   '1024x1536',
      });
      const img = res.data[0];
      if (img.b64_json) return { type: 'base64', data: img.b64_json, mimeType: 'image/png' };
      if (img.url)      return { type: 'url', url: img.url };
    } catch (editErr) {
      console.warn('[AI] gpt-image-2 edit falló, usando generate:', editErr.message);
    }
  }

  // Fallback: generación pura texto
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
// ─────────────────────────────────────────────
async function generatePortrait({ positivePrompt, negativePrompt, imagePath }) {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  console.log(`\n[AI] ── Iniciando generación ──`);
  console.log(`[AI] Provider : ${provider}`);
  console.log(`[AI] Modelo   : ${provider === 'openai' ? 'gpt-image-2' : 'gemini-3-pro-image'}`);

  // PASO 1 — Analizar cara
  console.log('[AI] Paso 1: Analizando rasgos faciales...');
  let faceDescription = '';
  try {
    faceDescription = await analyzeFace(imagePath);
    console.log('[AI] Descripción:', faceDescription.slice(0, 80) + '...');
  } catch (err) {
    console.warn('[AI] Análisis facial falló (continúa sin él):', err.message);
  }

  // Enriquecer prompt con descripción facial
  const enrichedPrompt = faceDescription
    ? `${positivePrompt}\n\nFACE PRECISE DESCRIPTION FROM REFERENCE PHOTO: ${faceDescription}`
    : positivePrompt;

  // PASO 2 — Generar imagen
  console.log('[AI] Paso 2: Generando retrato hiperrealista...');

  if (provider === 'openai') {
    return generateWithGPTImage2(enrichedPrompt, imagePath);
  }

  return generateWithGemini3(enrichedPrompt, imagePath);
}

module.exports = { generatePortrait, analyzeFace };

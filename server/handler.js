/**
 * handler.js — Lógica compartida de generación.
 * La usan tanto el servidor Express (dev local) como la función
 * serverless de Vercel (api/generate.js).
 */

'use strict';

const { construirPromptFinal } = require('./promptBuilder');
const { generatePortrait }     = require('./aiClient');

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

  // ── Modo demo ───────────────────────────────
  if (process.env.DEMO_MODE === 'true') {
    await new Promise(r => setTimeout(r, 2500));
    return {
      demo:     true,
      imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=768&q=80',
      metadata: { genero, altura, peso },
      message:  'Demo mode. Configura GEMINI_API_KEY y DEMO_MODE=false para generación real.',
    };
  }

  // ── Construir prompt + generar ──────────────
  const { positivePrompt, negativePrompt, metadata } = construirPromptFinal({ genero, altura, peso });

  const result = await generatePortrait({
    positivePrompt,
    negativePrompt,
    faceImage: { base64: input.selfieBase64, mimeType: input.selfieMime || 'image/jpeg' },
  });

  if (result.type === 'url') {
    return { imageUrl: result.url, metadata };
  }
  if (result.type === 'base64') {
    return { imageDataUrl: `data:${result.mimeType};base64,${result.data}`, metadata };
  }
  throw new Error('Resultado de IA desconocido.');
}

module.exports = { handleGenerate };

/**
 * api/generate.js — Función serverless de Vercel.
 * Recibe JSON { selfie (base64), selfieMime, genero, altura, peso }
 * y devuelve { imageDataUrl | imageUrl, metadata }.
 */

'use strict';

const { handleGenerate } = require('../server/handler');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Vercel parsea JSON automáticamente cuando Content-Type: application/json.
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    const result = await handleGenerate({
      genero:       body.genero,
      altura:       body.altura,
      peso:         body.peso,
      selfieBase64: body.selfie,
      selfieMime:   body.selfieMime,
      mode:         body.mode,
      provider:     body.provider,
      variant:      body.variant,
      baseImage:    body.baseImage,
      baseMime:     body.baseMime,
    });

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    console.error('[api/generate]', err.message);
    res.status(status).json({ success: false, error: err.message });
  }
};

// Permitir payloads grandes (selfie en base64 ~ varios MB)
module.exports.config = {
  api: { bodyParser: { sizeLimit: '12mb' } },
};

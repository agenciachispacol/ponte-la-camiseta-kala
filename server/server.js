/**
 * server.js — Servidor Express para desarrollo LOCAL.
 *
 * En producción se usa la función serverless de Vercel (api/generate.js),
 * pero ambos comparten la misma lógica en handler.js.
 *
 * Endpoints:
 *   POST /api/generate   → JSON { selfie(base64), selfieMime, genero, altura, peso }
 *   GET  /api/health     → healthcheck
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { handleGenerate } = require('./handler');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// ──────────────────────────────────────────────────────────
// POST /api/generate
// ──────────────────────────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  try {
    const result = await handleGenerate({
      genero:       req.body.genero,
      altura:       req.body.altura,
      peso:         req.body.peso,
      selfieBase64: req.body.selfie,
      selfieMime:   req.body.selfieMime,
      mode:         req.body.mode,
      provider:     req.body.provider,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    console.error('[SERVER] /api/generate:', err.message);
    res.status(status).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/health
// ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:   'ok',
    provider: process.env.AI_PROVIDER || 'gemini',
    demo:     process.env.DEMO_MODE === 'true',
    model:    (process.env.AI_PROVIDER || 'gemini') === 'openai' ? 'gpt-image-2' : 'gemini-3-pro-image',
  });
});

// SPA fallback
app.use((_, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🔵 KALA AI Campaign (dev) en http://localhost:${PORT}`);
  console.log(`   Provider  : ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`   Demo mode : ${process.env.DEMO_MODE}`);
});

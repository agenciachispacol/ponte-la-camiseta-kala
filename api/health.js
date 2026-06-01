/**
 * api/health.js — Diagnóstico de configuración en producción.
 * NO expone las API keys, solo indica si están presentes y el estado.
 * Visitar: https://<tu-dominio>/api/health
 */

'use strict';

module.exports = (req, res) => {
  res.status(200).json({
    status:    'ok',
    demo:      process.env.DEMO_MODE === 'true',
    provider:  process.env.AI_PROVIDER || 'gemini',
    hasGemini: !!process.env.GEMINI_API_KEY,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    time:      new Date().toISOString(),
  });
};

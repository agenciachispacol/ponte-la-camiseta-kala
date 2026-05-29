/**
 * server.js — Backend Express para PONTE LA CAMISETA KALA
 *
 * Endpoints:
 *   POST /api/generate   → recibe selfie + datos físicos, devuelve imagen
 *   GET  /api/health     → healthcheck
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express  = require('express');
const cors     = require('cors');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');

const { construirPromptFinal } = require('./promptBuilder');
const { generatePortrait }     = require('./aiClient');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Carpeta de uploads ─────────────────────────────────────
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Multer (subida de selfie) ──────────────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename:    (_, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `selfie_${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB máx
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imágenes.'));
    }
    cb(null, true);
  },
});

// ──────────────────────────────────────────────────────────
// POST /api/generate
// ──────────────────────────────────────────────────────────
app.post('/api/generate', upload.single('selfie'), async (req, res) => {
  const selfieFile = req.file;

  try {
    // ── Validar inputs ──────────────────────────────────
    if (!selfieFile) {
      return res.status(400).json({ error: 'Se requiere una foto (campo "selfie").' });
    }

    const genero = req.body.genero;
    const altura = parseFloat(req.body.altura);
    const peso   = parseFloat(req.body.peso);

    if (!genero || !['Hombre', 'Mujer'].includes(genero)) {
      return res.status(400).json({ error: 'Género inválido. Usa "Hombre" o "Mujer".' });
    }
    if (isNaN(altura) || altura < 100 || altura > 250) {
      return res.status(400).json({ error: 'Altura inválida (100-250 cm).' });
    }
    if (isNaN(peso) || peso < 30 || peso > 300) {
      return res.status(400).json({ error: 'Peso inválido (30-300 kg).' });
    }

    console.log(`\n[SERVER] ── Nueva solicitud ──`);
    console.log(`[SERVER] Género: ${genero} | Altura: ${altura}cm | Peso: ${peso}kg`);
    console.log(`[SERVER] Selfie: ${selfieFile.filename}`);

    // ── Modo Demo ───────────────────────────────────────
    if (process.env.DEMO_MODE === 'true') {
      console.log('[SERVER] DEMO MODE activo — devolviendo placeholder.');
      await new Promise(r => setTimeout(r, 3000)); // simular delay de IA

      // Demo: retornar una imagen de placeholder pública
      return res.json({
        success:    true,
        demo:       true,
        imageUrl:   'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=768&q=80',
        metadata:   { genero, altura, peso },
        message:    'Demo mode. Conecta tu API key para generación real.',
      });
    }

    // ── Construir prompts ────────────────────────────────
    const { positivePrompt, negativePrompt, metadata } = construirPromptFinal({
      genero, altura, peso,
    });

    console.log(`[SERVER] Complexión: ${metadata.complexion} (ratio ${metadata.ratio})`);

    // ── Llamar a la API de IA ────────────────────────────
    const imageResult = await generatePortrait({
      positivePrompt,
      negativePrompt,
      imagePath: selfieFile.path,
    });

    // ── Procesar resultado y devolver ────────────────────
    if (imageResult.type === 'url') {
      return res.json({
        success:  true,
        imageUrl: imageResult.url,
        metadata,
      });
    }

    if (imageResult.type === 'base64') {
      // Guardar imagen generada en disco y devolver como URL local
      const outputName = `result_${uuidv4()}.jpg`;
      const outputPath = path.join(UPLOAD_DIR, outputName);
      fs.writeFileSync(outputPath, Buffer.from(imageResult.data, 'base64'));

      return res.json({
        success:  true,
        imageUrl: `/api/image/${outputName}`,
        metadata,
      });
    }

    throw new Error('Resultado de IA desconocido.');

  } catch (err) {
    console.error('[SERVER] Error en /api/generate:', err.message);
    return res.status(500).json({
      error:   'Error al generar la imagen.',
      details: err.message,
    });
  } finally {
    // Limpiar selfie temporal después de 5 minutos
    if (selfieFile?.path) {
      setTimeout(() => {
        try { fs.unlinkSync(selfieFile.path); } catch (_) {}
      }, 5 * 60 * 1000);
    }
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/image/:filename — Servir imágenes generadas
// ──────────────────────────────────────────────────────────
app.get('/api/image/:filename', (req, res) => {
  const filename = path.basename(req.params.filename); // sanitize
  const filePath = path.join(UPLOAD_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Imagen no encontrada.' });
  }

  res.sendFile(filePath);
});

// ──────────────────────────────────────────────────────────
// GET /api/health
// ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:   'ok',
    provider: process.env.AI_PROVIDER || 'gemini',
    demo:     process.env.DEMO_MODE === 'true',
    models: {
      vision:    process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
      image:     process.env.GEMINI_IMAGE_MODEL  || 'imagen-4',
      openai:    process.env.OPENAI_IMAGE_MODEL  || 'gpt-image-2',
    },
  });
});

// ── 404 fallback → servir index.html (SPA) ────────────────
app.use((_, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── Iniciar servidor ───────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟡 KALA AI Campaign Server running on http://localhost:${PORT}`);
  console.log(`   Provider  : ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`   Demo mode : ${process.env.DEMO_MODE}`);
  console.log(`   Image mdl : ${process.env.GEMINI_IMAGE_MODEL || 'imagen-4'} / ${process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'}`);
});

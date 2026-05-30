/**
 * promptBuilder.js
 * Constructor dinámico de prompts para la campaña PONTE LA CAMISETA KALA.
 * Traduce datos físicos numéricos a descripciones visuales para Gemini / OpenAI.
 */

'use strict';

// ─────────────────────────────────────────────
// PROMPT BASE MAESTRO (KALA)
// {SECCION_BODY} es reemplazado dinámicamente
// ─────────────────────────────────────────────
const PROMPT_BASE = `
TASK: This is a PHOTO EDIT, not a new portrait. Take the EXACT person shown in the FACE
REFERENCE photo and place them in a football stadium wearing the KALA jersey.

#1 RULE — IDENTITY LOCK: The face and identity MUST stay IDENTICAL to the FACE REFERENCE
photo. Keep the same facial features, exact face shape and bone structure, same eyes, nose,
mouth and jawline, same skin tone, same hair, same approximate age and the same person's
look. The result must be unmistakably the SAME individual — as if this real person posed for
the photo. DO NOT beautify, slim the face, change age, swap to a different or "ideal" face,
or turn them into a model. Preserve their real, recognizable face above everything else.

FRAMING: Upper-body / chest-up portrait. The head and face fill a large portion of the frame
and are sharp, well lit and fully recognizable. The KALA jersey logo stays visible on the
chest. The person holds the ball up near the chest or shoulder so it remains in frame.

SETTING: Packed nighttime football stadium, Colombia, dramatic stadium floodlights,
electric green pitch in the background, crowd blurred in cool blue bokeh, subtle haze,
cinematic atmosphere, sky deep blue-black with stadium glow.

JERSEY: Dress the person in the official KALA jersey from the JERSEY REFERENCE image —
a clean WHITE performance jersey with a navy-blue "kala" wordmark across the chest and a
small navy "k" logo on the upper right chest, V-neck with subtle navy trim. Reproduce the
jersey design, colors and logo placement EXACTLY. Real fabric texture, natural fit, not CGI.

BALL: The person holds the official match ball from the BALL REFERENCE image — an adidas
TRIONDA ball, white base with vivid multicolor panels (red, green, blue). Held up near the
chest or shoulder so it stays in frame. Reproduce its pattern and colors EXACTLY.

{SECCION_BODY}

POSE: Confident, proud, natural athlete stance. A real person proud of their team, not a
fashion model pose.

LIGHTING & QUALITY: Cinematic stadium lighting, soft key light on the face so it stays clearly
recognizable, gentle rim light. Ultra-realistic photograph, natural skin texture with visible
pores, no plastic/over-smoothed skin, correct hand anatomy, photojournalistic quality.

FINAL AND MOST IMPORTANT INSTRUCTION: The generated face MUST be the SAME person as the FACE
REFERENCE image — copy their real face faithfully (same proportions, features and expression
character), fully recognizable as that individual. Facial likeness to the reference photo
takes priority over pose, lighting and style.
`.trim();

// ─────────────────────────────────────────────
// NEGATIVOS BASE (siempre incluidos)
// ─────────────────────────────────────────────
const NEGATIVE_BASE = [
  'different person', 'different face', 'changed identity', 'face swap',
  'beautified face', 'idealized face', 'younger face', 'older face', 'model face',
  'generic face', 'unrecognizable', 'altered facial features',
  'CGI', 'illustration', 'cartoon', 'animation', 'painting', 'drawing', 'render',
  'AI look', 'plastic skin', 'smooth skin', 'uncanny valley', 'beauty filter',
  'distorted face', 'deformed face', 'extra limbs', 'missing fingers',
  'bad anatomy', 'wrong anatomy', 'blurry face', 'low resolution',
  'watermark', 'text overlay', 'signature', 'logo overlay',
  'generic jersey', 'wrong jersey', 'wrong logo', 'misspelled logo',
  'yellow jersey', 'black jersey', 'striped jersey', 'plain ball', 'wrong ball colors',
  'overexposed', 'underexposed', 'flat lighting', 'studio background',
  'white background', 'cut out background', 'fake stadium',
];

// ─────────────────────────────────────────────
// LÓGICA DE COMPLEXIÓN (basada en IMC)
//
// IMC = peso / (altura_m)^2  → estándar real de contextura.
// 6 niveles por género + descriptor de estatura/frame.
// Los umbrales siguen las franjas médicas de IMC pero con
// más granularidad para mayor fidelidad visual.
// ─────────────────────────────────────────────

/** Calcula el índice de masa corporal. */
function calcularIMC(altura, peso) {
  const m = altura / 100;
  return peso / (m * m);
}

/** Descriptor de estatura según género (cm). */
function frameEstatura(genero, altura) {
  const esHombre = genero === 'Hombre';
  if (esHombre) {
    if (altura < 165) return 'short stature, compact frame';
    if (altura < 178) return 'average height';
    if (altura < 188) return 'tall, long-limbed frame';
    return 'very tall, towering frame';
  }
  if (altura < 158) return 'short stature, petite frame';
  if (altura < 170) return 'average height';
  if (altura < 178) return 'tall, long-limbed frame';
  return 'very tall stature';
}

// Tabla de 6 niveles por IMC. min es inclusivo; el último cubre el resto.
const TIERS_HOMBRE = [
  { max: 17.5, label: 'Muy delgado',
    desc: 'Very lean, slender frame. Narrow shoulders, thin arms and legs, minimal body mass, visible slimness. The jersey hangs loosely on a thin frame.',
    neg: ['overweight', 'heavy', 'muscular', 'broad shoulders', 'thick torso', 'belly'] },
  { max: 21,   label: 'Delgado',
    desc: 'Slim, lean build. Lean torso, average-width shoulders, slim arms and legs, naturally light frame, flat stomach without muscle definition.',
    neg: ['overweight', 'fat', 'bulky', 'muscular', 'bodybuilder', 'wide torso'] },
  { max: 25,   label: 'Promedio / Atlético',
    desc: 'Average everyday build. Balanced chest and torso, normal neck thickness, proportionate shoulders and arms, lightly toned but not athletic-defined.',
    neg: ['obese', 'six pack abs', 'bodybuilder physique', 'anorexic thin', 'superhero physique'] },
  { max: 28,   label: 'Sólido / Fornido',
    desc: 'Solid, sturdy build. Broader chest and torso, slightly thicker neck, a bit of midsection softness, strong everyday frame carrying some extra weight naturally.',
    neg: ['slim', 'lean', 'six pack abs', 'skinny', 'bodybuilder', 'model physique'] },
  { max: 32,   label: 'Robusto / Corpulento',
    desc: 'Heavy-set stocky build. Broad torso, thick neck, wide shoulders, clearly visible belly volume, sturdy legs, full-figured larger body. The jersey fits snugly over a bigger body.',
    neg: ['slim', 'lean body', 'athletic build', 'six pack abs', 'muscular', 'model-like', 'ripped'] },
  { max: Infinity, label: 'Muy corpulento',
    desc: 'Large, plus-size build. Very broad and heavy torso, thick neck and arms, prominent rounded belly, big legs, authentically large body. The jersey stretches over a big frame.',
    neg: ['slim', 'lean', 'athletic', 'muscular', 'average build', 'model-like'] },
];

const TIERS_MUJER = [
  { max: 17.5, label: 'Muy delgada',
    desc: 'Very slim, delicate frame. Narrow shoulders and hips, thin limbs, minimal curves, fine slender silhouette.',
    neg: ['overweight', 'curvy', 'wide hips', 'heavy', 'plus size', 'muscular'] },
  { max: 21,   label: 'Delgada / Estilizada',
    desc: 'Slim, slender build. Lean figure, defined waist, narrow hips, light frame, subtle natural curves.',
    neg: ['overweight', 'fat', 'plus size', 'bulky', 'wide hips', 'muscular'] },
  { max: 25,   label: 'Promedio / Atlética',
    desc: 'Average, balanced figure. Toned but natural, moderate curves, proportionate shoulders and hips, everyday healthy build.',
    neg: ['obese', 'anorexic', 'bodybuilder', 'extreme muscles', 'runway-model thin'] },
  { max: 28,   label: 'Con curvas',
    desc: 'Soft curvy build. Fuller chest and hips, rounded softer waistline, feminine curves carrying some extra weight naturally.',
    neg: ['slim', 'skinny', 'flat stomach', 'wasp waist', 'fitness model', 'athletic'] },
  { max: 32,   label: 'Robusta / Curvy',
    desc: 'Full-figured curvy build. Rounded shoulders, full chest, softer abdomen, wide hips and thighs, authentic plus-size proportions. The jersey fits over a fuller body.',
    neg: ['slim', 'thin', 'model thin', 'supermodel', 'wasp waist', 'flat stomach', 'athletic'] },
  { max: Infinity, label: 'Plus / Voluminosa',
    desc: 'Large plus-size build. Very full figure, broad soft torso, large chest, wide hips and thighs, rounded belly, authentically big body.',
    neg: ['slim', 'thin', 'average build', 'athletic', 'model-like', 'fit'] },
];

/**
 * @param {string} genero  - "Hombre" | "Mujer"
 * @param {number} altura  - cm
 * @param {number} peso    - kg
 * @returns {{ bodyDescription, negativeAddons, label, imc }}
 */
function determinarComplexion(genero, altura, peso) {
  const imc   = calcularIMC(altura, peso);
  const frame = frameEstatura(genero, altura);
  const tiers = genero === 'Mujer' ? TIERS_MUJER : TIERS_HOMBRE;
  const sexo  = genero === 'Mujer' ? 'Female' : 'Male';

  const tier = tiers.find(t => imc < t.max) || tiers[tiers.length - 1];

  const bodyDescription =
    `${sexo}, ${altura}cm tall, ${peso}kg (BMI ${imc.toFixed(1)}), ${frame}. ` +
    `${tier.desc} Real, authentic ${sexo.toLowerCase()} body proportions — not idealized.`;

  return {
    bodyDescription,
    negativeAddons: tier.neg,
    label: tier.label,
    imc: Number(imc.toFixed(1)),
  };
}

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────

/**
 * Construye el prompt positivo y negativo listos para la API de IA.
 *
 * @param {object} params
 * @param {string} params.genero   "Hombre" | "Mujer"
 * @param {number} params.altura   cm
 * @param {number} params.peso     kg
 * @returns {{ positivePrompt: string, negativePrompt: string, metadata: object }}
 */
function construirPromptFinal({ genero, altura, peso }) {
  const { bodyDescription, negativeAddons, label, imc } = determinarComplexion(genero, altura, peso);

  const seccionBody = `BODY: ${bodyDescription}`;
  const positivePrompt = PROMPT_BASE.replace('{SECCION_BODY}', seccionBody);
  const negativePrompt = [...NEGATIVE_BASE, ...negativeAddons].join(', ');

  return {
    positivePrompt,
    negativePrompt,
    metadata: {
      genero,
      altura,
      peso,
      imc,
      complexion: label,
    },
  };
}

/**
 * Devuelve el label de complexión para mostrar en frontend.
 * (llamada rápida sin construir el prompt completo)
 */
function getComplexionLabel(genero, altura, peso) {
  return determinarComplexion(genero, altura, peso).label;
}

module.exports = { construirPromptFinal, getComplexionLabel };

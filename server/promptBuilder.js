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
Ultra-realistic sports photography portrait.
Camera: Sony A7R IV, 85mm f/1.8, shallow depth of field.
Award-winning photojournalistic quality, 8K resolution, grain-free.

SETTING: Packed nighttime football stadium, Colombia, dramatic stadium floodlights
casting sharp shadows on the person, electric green pitch visible background,
crowd blurred in cool blue bokeh, subtle pyrotechnic smoke effects, cinematic atmosphere,
sky deep blue-black with stadium glow.

JERSEY: Wearing the official KALA football jersey shown in the JERSEY REFERENCE image —
a clean WHITE performance jersey with a navy-blue "kala" wordmark across the chest and a
small navy "k" logo on the upper right chest, V-neck collar with subtle navy trim, modern
athletic cut with tonal white-on-white diagonal panel texture. Reproduce the jersey design,
colors, logo placement and proportions EXACTLY as in the reference image. Authentic fabric
texture and natural fit according to body type. The jersey looks real and worn, not CGI.

BALL: Holding the official match football shown in the BALL REFERENCE image — an adidas
TRIONDA FIFA World Cup ball, white base with vivid multicolor panels (red, green, blue) and
the adidas three-stripe and FIFA marks. Held in hands at waist height or casually under one
arm. Reproduce the ball pattern and colors EXACTLY as in the reference image, with realistic
panel texture and stadium light reflections.

{SECCION_BODY}

POSE: Confident, proud athlete stance, three-quarter body view angle, 
natural and relaxed posture that matches the body type authentically. 
Not a model pose — a real person proud of their team.

LIGHTING: Professional three-point lighting — key light from stadium floodlights 
above at 45°, soft fill from pitch green reflection below, strong rim light from 
stadium arc lights behind creating athlete halo effect. Dramatic, cinematic.

FACE: Highly detailed photorealistic face. Exact skin texture, pores visible, 
natural expression — confident slight smile. Eyes sharp and clear.

TECHNICAL: Photorealistic, no AI artifacts, anatomically correct proportions, 
natural fabric physics and wrinkles, correct hand anatomy, authentic stadium atmosphere.
`.trim();

// ─────────────────────────────────────────────
// NEGATIVOS BASE (siempre incluidos)
// ─────────────────────────────────────────────
const NEGATIVE_BASE = [
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
// LÓGICA DE COMPLEXIÓN
// ─────────────────────────────────────────────

/**
 * @param {string} genero  - "Hombre" | "Mujer"
 * @param {number} altura  - cm
 * @param {number} peso    - kg
 * @returns {{ bodyDescription: string, negativeAddons: string[], label: string }}
 */
function determinarComplexion(genero, altura, peso) {
  const ratio = peso / altura;
  let bodyDescription = '';
  let negativeAddons = [];
  let label = '';

  if (genero === 'Hombre') {
    if (ratio > 0.55) {
      label = 'Robusto / Corpulento';
      bodyDescription =
        `Male, ${altura}cm tall, ${peso}kg. ` +
        'Natural heavy-set stocky build. Broad chest and torso, thick neck, wide shoulders, ' +
        'visible abdominal volume, sturdy legs, full-figured body. ' +
        'Real person with a larger frame. The jersey fits snugly on a bigger body. ' +
        'DO NOT make him slim, athletic, lean, muscular, or model-like. ' +
        'His body is authentically large and natural.';
      negativeAddons = ['slim', 'lean body', 'six pack abs', 'bodybuilder physique',
        'muscular definition', 'athletic build', 'male model physique', 'ripped'];

    } else if (ratio < 0.40) {
      label = 'Delgado / Ectomorfo';
      bodyDescription =
        `Male, ${altura}cm tall, ${peso}kg. ` +
        'Natural slim ectomorphic build. Lean torso, defined neck, average-width shoulders, ' +
        'thin arms and legs, lightweight naturally thin frame. ' +
        'The jersey hangs slightly on a slim frame. ' +
        'DO NOT make him heavy, bulky, overweight, or muscular.';
      negativeAddons = ['overweight', 'heavy', 'fat', 'chubby', 'bulky', 'wide torso',
        'thick neck', 'broad shoulders', 'muscular'];

    } else {
      label = 'Atlético / Medio';
      bodyDescription =
        `Male, ${altura}cm tall, ${peso}kg. ` +
        'Natural average-athletic build. Balanced chest and torso, normal neck thickness, ' +
        'proportionate shoulders and arms, moderately toned everyday physique. ' +
        'DO NOT make him extremely muscular, overweight, or model-thin.';
      negativeAddons = ['extreme bodybuilder muscles', 'obese', 'morbidly overweight',
        'anorexic thin', 'superhero physique'];
    }

  } else if (genero === 'Mujer') {
    if (ratio > 0.50) {
      label = 'Robusta / Curvy';
      bodyDescription =
        `Female, ${altura}cm tall, ${peso}kg. ` +
        'Natural full-figured curvy build. Rounded shoulders, fuller chest, ' +
        'softer abdominal area, wider hips and thighs, authentic plus-size proportions. ' +
        'Real woman with a larger frame. The jersey fits naturally on a fuller body. ' +
        'DO NOT make her slim, thin, or model-like.';
      negativeAddons = ['slim', 'skinny', 'model thin', 'supermodel', 'wasp waist',
        'athletic', 'fitness model', 'flat stomach'];

    } else if (ratio < 0.38) {
      label = 'Delgada / Estilizada';
      bodyDescription =
        `Female, ${altura}cm tall, ${peso}kg. ` +
        'Natural slim petite build. Lean figure, defined waist, narrow hips, ' +
        'lightweight naturally slender frame. ' +
        'DO NOT make her heavy, overweight, or bulky.';
      negativeAddons = ['overweight', 'heavy', 'fat', 'chubby', 'plus size',
        'wide hips', 'muscular', 'bulky'];

    } else {
      label = 'Atlética / Media';
      bodyDescription =
        `Female, ${altura}cm tall, ${peso}kg. ` +
        'Natural average athletic build. Toned figure, balanced proportions, ' +
        'moderate curves, fit without being extreme. ' +
        'DO NOT make her extremely muscular, overweight, or runway-model thin.';
      negativeAddons = ['extreme muscles', 'overweight', 'obese', 'anorexic',
        'bodybuilder', 'very muscular'];
    }

  } else {
    label = 'Neutral';
    bodyDescription =
      `Person, ${altura}cm tall, ${peso}kg. Natural realistic body proportions.`;
  }

  return { bodyDescription, negativeAddons, label };
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
  const { bodyDescription, negativeAddons, label } = determinarComplexion(genero, altura, peso);

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
      ratio: (peso / altura).toFixed(3),
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

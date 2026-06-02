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

#1 RULE — IDENTITY (keep the person EXACTLY, whoever they are): Reproduce the real person's
face and body with maximum fidelity. This rule is UNIVERSAL — it applies to ANY person, of ANY
body type, age, skin tone, gender or look. Copy EXACTLY, whatever the reference shows:
- the exact face shape and width, and the exact amount of facial fat — keep thin faces thin and
  heavy/round/chubby faces heavy and round (NEVER slim or chisel a fuller face);
- the exact eye shape AND eye color — light or dark, never change it;
- the exact nose, mouth, lips, jawline, chin, eyebrows, skin tone, texture and any moles/marks;
- the exact hairstyle and hair length — short/buzzed/faded or long/curly, never add or remove
  hair, never change the cut;
- the exact facial hair (beard/goatee/stubble/none) and the person's real age and weight.
NEVER beautify, slim, smooth, rejuvenate, symmetrize, age or idealize, and NEVER turn the
person into a generic athlete or model. The output must be unmistakably the SAME real person —
recognizable at a glance. Facial likeness is the #1 priority.

ROLE OF EACH REFERENCE IMAGE: The FACE REFERENCE image is the REAL PERSON — take ONLY the face
and body from it. The JERSEY REFERENCE and BALL REFERENCE images are PRODUCT designs only —
copy the jersey design/logo and the ball pattern from them, but do NOT take any face, head,
hair, body or person from those product images.

FRAMING: Chest-up shot. The face is large and sharp (key for the likeness), AND the KALA logo
on the chest plus the ball are both clearly visible in the frame.

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

COHESION (avoid a pasted / cut-out look): Render everything as ONE single real photograph.
RE-LIGHT the face and skin to match the stadium floodlights — cool blue rim light from behind,
warm key light from above — so the face is NOT brighter, flatter or a different color than the
body and background. Match white balance, color temperature and contrast across face, jersey
and scene. Cast realistic contact shadows from the body onto the surroundings and matching
shadows on the face. Apply the SAME subtle film grain and color grade over the entire frame.
No hard edges or halo around the head or hair, no sticker/cut-out effect, no seams where the
face meets the neck — the person must look genuinely photographed in that stadium.

FINAL AND MOST IMPORTANT INSTRUCTION: Before finishing, compare the generated face with the
FACE REFERENCE photo — they MUST look like the SAME real person, near-identical. If in doubt,
copy the reference face more closely. Facial likeness beats everything else (pose, lighting,
jersey, ball, background). A perfect stadium photo with the wrong face is a FAILURE.
`.trim();

// ─────────────────────────────────────────────
// NEGATIVOS BASE (siempre incluidos)
// ─────────────────────────────────────────────
const NEGATIVE_BASE = [
  'different person', 'different face', 'changed identity', 'face swap',
  'beautified face', 'idealized face', 'younger face', 'older face', 'model face',
  'generic face', 'unrecognizable', 'altered facial features',
  'slimmer face', 'slimmed face', 'thinner face', 'chiseled jaw', 'sharp jawline',
  'defined cheekbones', 'athletic face', 'handsome model', 'changed face shape',
  'darker eyes', 'changed eye color',
  'CGI', 'illustration', 'cartoon', 'animation', 'painting', 'drawing', 'render',
  'AI look', 'plastic skin', 'smooth skin', 'uncanny valley', 'beauty filter',
  'pasted face', 'cut-out', 'sticker effect', 'photo collage', 'floating head',
  'halo around head', 'mismatched lighting', 'green screen', 'visible seams',
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

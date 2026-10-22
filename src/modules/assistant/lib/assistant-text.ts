/** Mismas reglas que lib/assistant-text.ts móvil: solo negritas marcadas con **texto**. */
export type AssistantTextSegment = { text: string; bold: boolean };

export function parseBoldSegments(text: string): AssistantTextSegment[] {
  const segments: AssistantTextSegment[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex), bold: false });
  return segments.length > 0 ? segments : [{ text, bold: false }];
}

/** Texto para copiar una respuesta: sin los ** de las negritas. */
export function textForClipboard(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
}

/** Preguntas iniciales del chat vacío (móvil: SUGGESTIONS). */
export const ASSISTANT_STARTER_SUGGESTIONS = [
  "¿Qué puedes hacer?",
  "¿Cuánto gasté este mes?",
  "¿Cuánto voy a tener en 6 meses?",
  "¿Qué me falta registrar?",
] as const;

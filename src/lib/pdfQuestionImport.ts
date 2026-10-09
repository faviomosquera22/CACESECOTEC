import type { OptionLetter, Question } from "@/lib/database.types";
export const PDF_MAX_BYTES = 4 * 1024 * 1024;
export const PDF_MAX_PAGES = 80;
export const PDF_MAX_QUESTIONS = 300;
export type PdfLine = { text: string; page: number; marked: boolean; bold: boolean };
export type PdfCandidate = {
  index: number; number: string; page: number; question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string; option_e: string;
  correct_option: OptionLetter | ""; explanation: string; evidence: string; issues: string[]; duplicate?: boolean;
};
export const optionLetters = ["A", "B", "C", "D", "E"] as const;
export function normalizedQuestionText(text: string) {
  return text.normalize("NFKC").toLocaleLowerCase("es").replace(/\s+/g," ").replace(/[.!?]+$/," ").trim();
}
export function questionIdentity(question: Pick<Question,"question_text"|"option_a"|"option_b"|"option_c"|"option_d"> & { option_e?: string }) {
  return JSON.stringify([normalizedQuestionText(question.question_text), ...[question.option_a,question.option_b,question.option_c,question.option_d,question.option_e ?? ""].filter(Boolean).map(normalizedQuestionText).sort()]);
}
export function validateImportedQuestion(input: unknown): Omit<Question,"id"> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Pregunta inválida.");
  const body = input as Record<string,unknown>;
  const texts: Record<string,string> = {};
  for (const key of ["question_text","option_a","option_b","option_c","option_d","option_e","explanation"]) {
    const value = body[key] ?? "";
    if (typeof value !== "string" || value.length > (key.startsWith("option_") ? 3000 : 12000)) throw new Error("El texto de una pregunta supera el límite permitido.");
    texts[key] = value.trim();
  }
  if (texts.question_text.length < 8) throw new Error("Completa el enunciado.");
  const options = optionLetters.map(letter => texts[`option_${letter.toLowerCase()}`]);
  const available = options.filter(Boolean);
  if (available.length < 3 || !options.slice(0,available.length).every(Boolean)) throw new Error("Se requieren entre 3 y 5 opciones consecutivas (A, B, C…). No inventes alternativas faltantes.");
  if (new Set(available.map(normalizedQuestionText)).size !== available.length) throw new Error("Hay opciones repetidas.");
  const correct = optionLetters.find(letter => letter === body.correct_option);
  if (!correct || !texts[`option_${correct.toLowerCase()}`]) throw new Error("Selecciona una respuesta correcta entre las opciones existentes.");
  return { question_text:texts.question_text,option_a:texts.option_a,option_b:texts.option_b,option_c:texts.option_c,option_d:texts.option_d,option_e:texts.option_e,correct_option:correct,explanation:texts.explanation || null, category:null,difficulty:"Media",created_at:null, ...(available.length === 3 ? {source_format:"partial-options" as const} : {}) };
}

export function parseQuestionLines(lines: PdfLine[]): PdfCandidate[] {
  type Draft = { candidate: PdfCandidate; option: OptionLetter | null; explicit: Set<string>; bold: Set<OptionLetter>; marked: Set<OptionLetter>; explanation: boolean };
  const drafts: Draft[] = [];
  let current: Draft | null = null;
  let answerSection = false;
  const keys = new Map<string,Set<string>>();
  for (const line of lines) {
    const text = line.text.trim();
    if (!text || /^p[aá]gina\s+\d+(?:\s+de\s+\d+)?$/i.test(text) || /^\d+$/.test(text)) continue;
    if (/^(?:clave|claves|solucionario|respuestas)(?:\s+(?:de\s+)?(?:respuestas|correctas))?\s*:?$/i.test(text)) { answerSection=true; current=null; continue; }
    if (answerSection) {
      for (const match of text.matchAll(/(?:^|\s)(\d{1,4})\s*[.):\-]?\s*([A-E])(?=\s|$|[,;])/gi)) {
        const set = keys.get(match[1]) ?? new Set(); set.add(match[2].toUpperCase()); keys.set(match[1],set);
      }
      continue;
    }
    const explicit = text.match(/^(?:respuesta(?:\s+correcta)?|clave|correcta)\s*[:=\-]\s*(.+)$/i);
    if (explicit && current) { current.explicit.add(explicit[1].trim()); current.option=null; continue; }
    const start = text.match(/^(?:(?:pregunta|reactivo)\s*)?(\d{1,4})\s*[.)\-:]\s+(.+)$/i);
    if (start) {
      const candidate: PdfCandidate = {index:drafts.length,number:start[1],page:line.page,question_text:start[2],option_a:"",option_b:"",option_c:"",option_d:"",option_e:"",correct_option:"",explanation:"",evidence:"",issues:[]};
      current = {candidate,option:null,explicit:new Set(),bold:new Set(),marked:new Set(),explanation:false}; drafts.push(current);
      if (drafts.length > PDF_MAX_QUESTIONS) throw new Error(`El PDF supera ${PDF_MAX_QUESTIONS} preguntas. Divídelo en archivos más pequeños.`);
      continue;
    }
    if (!current) continue;
    const option = text.match(/^([A-E])\s*[.)\-:]\s+(.+)$/i);
    if (option) {
      const letter=option[1].toUpperCase() as OptionLetter;
      const key=`option_${letter.toLowerCase()}` as "option_a";
      if (current.candidate[key]) current.candidate.issues.push(`La opción ${letter} aparece más de una vez; revisa la separación de preguntas.`);
      current.candidate[key] = [current.candidate[key],option[2]].filter(Boolean).join(" ");
      current.option=letter; current.explanation=false;
      if (line.marked) current.marked.add(letter);
      if (line.bold) current.bold.add(letter);
    } else if (/^(?:explicaci[oó]n|justificaci[oó]n|argumentaci[oó]n)\s*:/i.test(text)) {
      current.explanation=true; current.option=null; current.candidate.explanation=text.replace(/^[^:]+:\s*/,"");
    } else if (current.explanation) current.candidate.explanation += " " + text;
    else if (current.option) {
      current.candidate[`option_${current.option.toLowerCase()}` as "option_a"] += " " + text;
      if (line.marked) current.marked.add(current.option);
      // A continuation alone in bold may be emphasis within a distractor. Only full option lines count.
    } else current.candidate.question_text += " " + text;
  }
  const numberCounts=new Map<string,number>();
  for (const {candidate} of drafts) numberCounts.set(candidate.number,(numberCounts.get(candidate.number) ?? 0)+1);
  return drafts.map(draft => {
    const {candidate:q}=draft;
    const signals=new Set<OptionLetter>();
    for (const explicit of draft.explicit) {
      const letter=explicit.match(/^([A-E])(?:\b|[.)])/i)?.[1].toUpperCase() as OptionLetter | undefined;
      const matched=letter ?? optionLetters.find(key => normalizedQuestionText(q[`option_${key.toLowerCase()}` as "option_a"])===normalizedQuestionText(explicit));
      if (matched) signals.add(matched); else q.issues.push("La clave escrita no coincide con las opciones.");
    }
    if (numberCounts.get(q.number)===1) for (const key of keys.get(q.number) ?? []) signals.add(key as OptionLetter);
    else if (keys.has(q.number)) q.issues.push("La numeración se repite; no se puede asignar la clave final de forma segura.");
    for (const key of draft.marked) signals.add(key);
    const available=optionLetters.filter(key => q[`option_${key.toLowerCase()}` as "option_a"]);
    if (available.some(key => /\s[A-E]\s*[.)]\s+\S/i.test(q[`option_${key.toLowerCase()}` as "option_a"]))) q.issues.push("Hay varias alternativas en una misma línea. Revisa y separa las opciones antes de importar.");
    if (draft.bold.size > 0 && draft.bold.size < available.length) for (const key of draft.bold) signals.add(key);
    if (signals.size===1) { q.correct_option=[...signals][0]; q.evidence=draft.marked.size ? "Subrayado o resaltado" : draft.bold.size===1 ? "Negrita" : "Clave escrita"; }
    else q.issues.push(signals.size ? "Se detectaron marcas o claves contradictorias. Selecciona la correcta." : "No se identificó una única respuesta correcta. Selecciónala antes de importar.");
    try { validateImportedQuestion(q); } catch(error) { q.issues.push((error as Error).message); }
    if (/\b(?:figura|imagen|gr[aá]fico|tabla)\s+(?:adjunt[ao]|siguiente|mostrad[ao])\b/i.test(q.question_text)) q.issues.push("El enunciado depende de una imagen o tabla que no se importará. Excluye la pregunta o completa el enunciado.");
    return q;
  });
}

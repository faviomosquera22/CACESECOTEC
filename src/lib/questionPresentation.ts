import relationPresentation from "@/data/questionRelationPresentation.json";
import presentationOverrides from "@/data/questionPresentationOverrides.json";

export type QuestionListItem = { label: string; text: string };
export type QuestionPresentation = {
  introduction: string;
  groups: { title: string; items: QuestionListItem[] }[];
};

const exactPresentations = new Map<string, QuestionPresentation>(
  [relationPresentation, ...presentationOverrides].map((presentation) => [presentation.sourceText, presentation]),
);

function isCompleteSequence(labels: string[]) {
  return labels.length >= 2 && labels.every((label, index) => {
    const value = /^\d+$/.test(label) ? Number(label) : label.toLowerCase().charCodeAt(0) - 96;
    return value === index + 1;
  });
}

/** Presentation only: never changes stored wording, options, or grading. */
export function getQuestionPresentation(text: string): QuestionPresentation | null {
  // Reconstruct reviewed PDF tables only when the complete source text matches.
  // Never apply an old reconstruction over a teacher's edited wording.
  const exact = exactPresentations.get(text);
  if (exact) return exact;

  const allMarkers = [...text.matchAll(/(?:^|\s)([1-9]\d?|[a-zA-Z])(?:[.)]|[-–])(?=\s)/g)];
  const numbers = allMarkers.filter((marker) => /^\d+$/.test(marker[1]));
  const letters = allMarkers.filter((marker) => /^[a-z]$/i.test(marker[1]));
  const numericSequence = isCompleteSequence(numbers.map((marker) => marker[1]));
  const letterSequence = isCompleteSequence(letters.map((marker) => marker[1]));
  // A vaccine name such as "Hepatitis B." is part of an item, not a new list.
  // Validate each marker family independently before considering two columns.
  const markers = numericSequence && letterSequence ? allMarkers
    : numericSequence ? numbers : letterSequence ? letters : [];
  if (markers.length < 2) return null;
  const first = markers[0];
  const introduction = text.slice(0, first.index).trim();
  // Avoid treating clinical measurements and ordinary prose as an enumeration.
  const explicitListInstruction = /(?:identifi|seleccion|señal|orden|relacion|consider|siguient|enumer|indiqu|escoj|elij|marqu)/i.test(introduction);
  if (introduction && !/[:?？]\s*$/.test(introduction)
    && !(explicitListInstruction && /\.\s*$/.test(introduction))) return null;

  // Partially recognized relationship tables need review, not a guessed layout.
  if (/relacion|correspond|asoci|emparej/i.test(introduction)
    && numbers.length >= 2 && letters.length >= 2
    && !(numericSequence && letterSequence)) return null;

  const groups: QuestionPresentation["groups"] = [];
  let previousFamily = "";
  for (let index = 0; index < markers.length; index++) {
    const marker = markers[index];
    const label = marker[1];
    const family = /^\d+$/.test(label) ? "number" : "letter";
    if (family !== previousFamily) {
      if (groups.length === 2) return null;
      groups.push({ title: family === "number" ? "Elementos" : "Descripciones", items: [] });
      previousFamily = family;
    }
    const itemText = text.slice(marker.index! + marker[0].length, markers[index + 1]?.index ?? text.length).trim();
    if (!itemText) return null;
    groups[groups.length - 1].items.push({ label, text: itemText });
  }

  for (const group of groups) {
    // Require a complete sequence starting at 1/a, with no duplicates or gaps.
    if (!isCompleteSequence(group.items.map(({ label }) => label))) return null;
  }
  if (groups.length === 2 && !/relacion|correspond|asoci|emparej/i.test(introduction)) return null;
  return { introduction, groups };
}

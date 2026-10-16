import relationPresentation from "@/data/questionRelationPresentation.json";

export type QuestionListItem = { label: string; text: string };
export type QuestionPresentation = {
  introduction: string;
  groups: { title: string; items: QuestionListItem[] }[];
};

/** Presentation only: never changes stored wording, options, or grading. */
export function getQuestionPresentation(text: string): QuestionPresentation | null {
  // A PDF table was extracted across columns. Apply its reconstructed layout
  // only to the exact source text; teacher edits must take precedence.
  if (text === relationPresentation.sourceText) return relationPresentation;

  const markers = [...text.matchAll(/(?:^|\s)([1-9]\d?|[a-hA-H])[.)]\s+/g)];
  if (markers.length < 2) return null;
  const first = markers[0];
  const introduction = text.slice(0, first.index).trim();
  // Avoid treating clinical measurements and ordinary prose as an enumeration.
  if (introduction && !/[:?？]\s*$/.test(introduction)) return null;

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
    const values = group.items.map(({ label }) => /^\d+$/.test(label) ? Number(label) : label.toLowerCase().charCodeAt(0) - 96);
    if (values.length < 2 || values.some((value, index) => value !== index + 1)) return null;
  }
  if (groups.length === 2 && !/relacion|correspond|asoci|emparej/i.test(introduction)) return null;
  return { introduction, groups };
}

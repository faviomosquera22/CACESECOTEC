import { getQuestionPresentation } from "@/lib/questionPresentation";

type QuestionStatementProps = {
  text: string;
  heading?: "h2" | "h4";
  prefix?: string;
};

export function QuestionStatement({ text, heading: Heading = "h2", prefix = "" }: QuestionStatementProps) {
  const presentation = getQuestionPresentation(text);
  const headingClass = Heading === "h2"
    ? "text-xl font-semibold leading-8 text-slate-950"
    : "text-base font-semibold leading-7 text-slate-950";

  if (!presentation) {
    return <Heading className={`${headingClass} whitespace-pre-line break-words`}>{prefix}{text}</Heading>;
  }

  return (
    <div className="min-w-0 space-y-5">
      <Heading className={headingClass}>{prefix}{presentation.introduction || "Considere los siguientes elementos:"}</Heading>
      <div className={`grid gap-4 ${presentation.groups.length === 2 ? "md:grid-cols-2" : ""}`}>
        {presentation.groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60">
            {presentation.groups.length === 2 ? (
              <p className="border-b border-slate-200 bg-slate-100/80 px-4 py-3 text-sm font-semibold text-slate-700">{group.title}</p>
            ) : null}
            <ul className="divide-y divide-slate-200/80">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-start gap-3 p-4">
                  <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-1 text-sm font-semibold text-slate-700">{item.label}</span>
                  <span className="min-w-0 whitespace-pre-line break-words text-base font-normal leading-7 text-slate-700">{item.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

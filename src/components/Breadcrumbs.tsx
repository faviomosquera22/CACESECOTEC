import Link from "next/link";
import { ChevronRight } from "lucide-react";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
};

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-2 text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="font-semibold text-slate-500 transition hover:text-sky-700"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={
                  isLast ? "font-semibold text-slate-950" : "text-slate-500"
                }
              >
                {item.label}
              </span>
            )}
            {!isLast ? (
              <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden="true" />
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

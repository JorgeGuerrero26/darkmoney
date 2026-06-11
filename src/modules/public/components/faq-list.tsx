import { ChevronDown } from "lucide-react";

import type { FaqItem } from "../lib/plans-data";

type FaqListProps = {
  items: FaqItem[];
};

export function FaqList({ items }: FaqListProps) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <details
          className="glass-panel-soft group rounded-[22px] transition hover:border-white/15"
          key={item.q}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-semibold text-ink">{item.q}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-storm transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="px-6 pb-5 text-sm leading-7 text-storm">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

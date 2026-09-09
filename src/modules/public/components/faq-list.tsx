import { ChevronDown } from "lucide-react";

import type { FaqItem } from "../lib/plans-data";

type FaqListProps = {
  items: FaqItem[];
};

export function FaqList({ items }: FaqListProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#f4f1ec]/[0.08] bg-[#141312]">
      {items.map((item) => (
        <details
          className="group border-b border-[#f4f1ec]/[0.07] last:border-b-0"
          key={item.q}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 transition hover:bg-[#f4f1ec]/[0.025] sm:px-6 [&::-webkit-details-marker]:hidden">
            <span className="font-public-display text-[15px] font-semibold text-[#f4f1ec]">
              {item.q}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-[#8e877c] transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <p className="max-w-[68ch] px-5 pb-5 text-[13.5px] leading-[1.6] text-[#a39c90] sm:px-6">
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}

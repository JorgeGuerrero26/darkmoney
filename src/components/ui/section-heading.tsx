import type { ReactNode } from "react";

type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  /** Elementos a la derecha del título (InfoTip, acciones, badges). */
  accessory?: ReactNode;
  className?: string;
};

export function SectionHeading({
  title,
  eyebrow,
  description,
  accessory,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {eyebrow ? (
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-pine/80">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex items-center gap-2.5">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink sm:text-2xl">
          {title}
        </h2>
        {accessory}
      </div>
      {description ? <p className="text-sm leading-6 text-storm">{description}</p> : null}
    </div>
  );
}

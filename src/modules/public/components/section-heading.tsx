type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: SectionHeadingProps) {
  const alignment = align === "center" ? "items-center text-center" : "items-start text-left";

  return (
    <div className={`flex max-w-2xl flex-col gap-4 ${alignment} ${align === "center" ? "mx-auto" : ""}`}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/80">{eyebrow}</p>
      ) : null}
      <h2 className="text-balance font-display text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="text-balance text-base leading-8 text-storm">{description}</p>
      ) : null}
    </div>
  );
}

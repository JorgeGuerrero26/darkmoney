import { useRef, useState } from "react";
import { createPortal } from "react-dom";

type TooltipState = { visible: boolean; top: number; left: number; width: number };

export function TruncatedDescription({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<TooltipState>({ visible: false, top: 0, left: 0, width: 0 });

  function handleMouseEnter() {
    const el = spanRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const rect = el.getBoundingClientRect();
    setTip({ visible: true, top: rect.bottom + 10, left: rect.left, width: rect.width });
  }

  function handleMouseLeave() {
    setTip((s) => ({ ...s, visible: false }));
  }

  return (
    <>
      <span
        ref={spanRef}
        className={`block truncate ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {text}
      </span>
      {tip.visible
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[9999] rounded-[16px] border px-3.5 py-2.5 shadow-[0_24px_64px_rgba(0,0,0,0.72),0_0_0_1px_rgba(107,228,197,0.06)]"
              style={{
                top: tip.top,
                left: tip.left,
                minWidth: Math.max(tip.width, 200),
                maxWidth: Math.min(tip.width + 80, 360),
                background:
                  "linear-gradient(160deg, rgba(14,21,33,0.98) 0%, rgba(9,14,22,0.99) 100%)",
                borderColor: "rgba(107,228,197,0.16)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              <div
                className="mb-2 h-px w-6 rounded-full"
                style={{ background: "rgba(107,228,197,0.35)" }}
              />
              <p className="text-[0.72rem] leading-relaxed text-storm/90">{text}</p>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

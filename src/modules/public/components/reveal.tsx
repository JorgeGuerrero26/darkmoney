import type { CSSProperties, ReactNode } from "react";

import { useInView } from "../../../hooks/use-in-view";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export function Reveal({ children, className = "", delay = 0 }: RevealProps) {
  const { ref, isInView } = useInView<HTMLDivElement>();

  const style: CSSProperties | undefined =
    delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <div
      className={`reveal ${isInView ? "reveal-visible" : ""} ${className}`}
      ref={ref}
      style={style}
    >
      {children}
    </div>
  );
}

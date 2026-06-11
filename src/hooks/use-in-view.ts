import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

type UseInViewOptions = {
  once?: boolean;
  rootMargin?: string;
  threshold?: number;
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useInView<T extends HTMLElement>({
  once = true,
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.1,
}: UseInViewOptions = {}): { ref: RefObject<T>; isInView: boolean } {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(
    () => typeof IntersectionObserver === "undefined" || prefersReducedMotion(),
  );

  useEffect(() => {
    const element = ref.current;

    if (!element || isInView) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setIsInView(true);

            if (once) {
              observer.disconnect();
            }
          } else if (!once) {
            setIsInView(false);
          }
        }
      },
      { rootMargin, threshold },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [once, rootMargin, threshold, isInView]);

  return { ref, isInView };
}

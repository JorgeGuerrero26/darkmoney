import { useEffect, useRef } from "react";

/**
 * Cierra UI flotante al pulsar fuera del contenedor (`ref`). Usa fase de captura para que
 * modales que hacen `stopPropagation` en burbuja no impidan detectar el clic.
 */
export function useOutsidePointerClose(isOpen: boolean, onClose: () => void, closeOnEscape = false) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const root = containerRef.current;
      if (!root) {
        return;
      }
      const target = event.target as Node | null;
      if (target && root.contains(target)) {
        return;
      }
      onCloseRef.current();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    if (closeOnEscape) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      if (closeOnEscape) {
        document.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, [isOpen, closeOnEscape]);

  return containerRef;
}

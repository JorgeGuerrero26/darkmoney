import type { ReactNode } from "react";

/** Zona scrolleable del Modal: úsala entre ModalHeader y ModalFooter. */
export function ModalBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`min-h-0 flex-1 overflow-y-auto px-6 py-5 ${className}`}>{children}</div>;
}

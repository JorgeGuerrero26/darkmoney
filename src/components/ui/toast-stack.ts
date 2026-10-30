export type StackItem = { id: string; tone: string; title: string; description: string; isLeaving: boolean; action?: unknown; count?: number };

export function appendToast<T extends StackItem>(items: T[], next: T): T[] {
  const last = items[items.length - 1];
  if (next.tone === "success" && !next.action && last && !last.isLeaving && last.tone === "success" && !last.action && last.title === next.title && last.description === next.description) {
    return [...items.slice(0, -1), { ...next, count: (last.count ?? 1) + 1 }];
  }
  return [...items, next];
}

export function visibleStack<T extends StackItem>(items: T[]): T[] {
  return items.filter((item) => !item.isLeaving).slice(-2).reverse();
}

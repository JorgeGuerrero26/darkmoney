import type { CategoryKind, CategoryOverview } from "../../../types/domain";

export function categoryParentCandidates(categories: CategoryOverview[], kind: CategoryKind, categoryId?: number) {
  const excluded = new Set(categoryId == null ? [] : [categoryId]);
  // Reject the entire descendant tree, not just direct children, to prevent cycles.
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of categories) if (item.parentId != null && excluded.has(item.parentId) && !excluded.has(item.id)) {
      excluded.add(item.id); changed = true;
    }
  }
  return categories.filter((item) => !excluded.has(item.id) && !item.isSystem && (item.kind === kind || item.kind === "both" || kind === "both"));
}

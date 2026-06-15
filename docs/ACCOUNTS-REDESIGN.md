# Accounts Redesign Standard

This note documents the module pattern introduced in `/app/accounts` so it can be reused by
other DarkMoney modules without copying page-level complexity.

## Product Standard

- Keep the module focused on the user's operating job: find the account, understand its balance,
  know whether it affects net worth, and take action.
- Start with a compact header, one contextual line, and an `InfoTip`; avoid permanent explanatory
  blocks that compete with data.
- Put actionable metrics above controls: net worth total, active accounts, excluded accounts,
  archived accounts, currencies, and largest account.
- Default to table view for operations. Keep list and grid for visual review.
- Export only the current filtered result set, and do not include private/free-text notes by default.

## Architecture Standard

- Page files should orchestrate data, mutations, URL state, selection, and modal ownership.
- Keep domain constants and formatters in `lib/`.
- Keep URL and editor state in hooks.
- Keep visible UI in module components: summary, toolbar, views, editor, and confirmations.
- Shared controls are preferred over local controls:
  - `Modal`, `ModalHeader`, `ModalBody`, `ModalFooter`
  - `FormField`, `Input`, `Textarea`
  - `SearchablePicker`
  - `Pagination`
  - `ViewSelector`, `ColumnPicker`
  - `DataState`

## UX Standard

- Persist shareable filters in URL: `q`, `type`, `status`, `currency`, `view`, `page`.
- Reset `page=1` when search/filter/view changes.
- Use `pageSize=50` for client-side pagination until server pagination is needed.
- Support specific empty states: no workspace, load error, no accounts, no filtered results,
  and no archived results.
- Destructive flows must be separated:
  - archive/reactivate is reversible and uses a confirmation modal;
  - permanent delete remains behind a strong confirmation and undo window.

## Responsive Standard

- No horizontal scroll except inside the table wrapper.
- Internal grids use `auto-fit` / `minmax(min(100%, ...), 1fr)` instead of wide fixed column counts.
- Buttons and icon targets stay at least 44px tall in touch-heavy surfaces.
- Badges and balances must wrap instead of overlapping.
- Searchable picker dropdowns must be opaque and rendered through the shared portal picker.

## Data And Security Notes

- Frontend authorization is UX only. Supabase/RLS remains the source of access control.
- Mutations remain scoped by `workspace_id`.
- CSV export respects active filters and excludes notes by default.
- `accounts.notes` is supported because the column already exists in the data dictionary; no
  migration was introduced for this redesign.

## QA Checklist

- 390x844: create account, open type/currency/icon pickers, filter, switch view, archive, export.
- Laptop with sidebar: sticky toolbar, modal viewport fit, table contained horizontal scroll.
- Desktop wide: summary and cards do not stretch awkwardly.
- Keyboard: open and close modal, tab through fields, use picker search, cancel and submit.
- Data stress: long account name, large balance, multiple currencies, archived account, excluded
  net worth account.
- Error states: no workspace, query error, no accounts, no results.

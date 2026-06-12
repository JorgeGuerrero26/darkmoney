# DarkMoney — Sistema de diseño y manual de estandarización

> Manual para estandarizar los módulos restantes (accounts, categories, budgets, contacts,
> obligations, subscriptions, recurring-income, notifications, settings) siguiendo lo ya
> aplicado en **dashboard** y **movements**. Léelo completo antes de migrar un módulo.

---

## 1. Principios

1. **Mobile-first.** Diseña primero para ~375px y escala con `sm:`/`lg:`. Nada de scroll
   horizontal forzado, ni grids de 2+ columnas en base, ni botones menores a 44px de alto
   en móvil. Cada pantalla se verifica también a 390×844.
2. **Menos texto.** Ningún párrafo explicativo permanente. Todo texto de ayuda va en un
   `InfoTip` (popover) o en el sistema de ayuda detallada del módulo. Si una descripción
   supera una línea, es un InfoTip.
3. **Jerarquía.** Una página tiene UN dato/acción protagonista. Los KPIs principales son
   grandes (`font-display text-4xl+`); lo secundario es compacto. Sin jerarquía no hay diseño.
4. **Divulgación progresiva.** Formularios: lo esencial visible, lo avanzado plegado en
   "Más opciones" (ver editor de movimientos). Crear algo común nunca debe requerir ver
   más de ~6 campos.
5. **Una acción primaria por vista.** El botón primario (bg-ink) aparece una sola vez por
   contexto; el resto son secondary/ghost.

## 2. Tokens

### Colores semánticos
| Token | Hex | Uso |
|---|---|---|
| `canvas` | #05070b | fondo base |
| `shell` | #0f141b | superficies (modales, sidebar) |
| `ink` | #f5f7fb | texto principal |
| `storm` | #96a2b5 | texto secundario |
| `pine` | #6be4c5 | acento principal, positivo/ingreso, estados activos |
| `ember` | #8ea5ff | info, transferencias, secundario |
| `gold` | #d7be7b | premium/atención suave, filtros activos |
| `rosewood` | #ff8f9e | peligro, gasto, errores |

Botones rápidos semánticos: gasto = rosewood, ingreso = pine, transferencia = ember
(ver header del app-shell).

### Tipografía
- `font-display` (Outfit): títulos y cifras. Títulos de página `text-2xl`, de sección
  `text-xl sm:text-2xl`, KPIs hero `text-4xl sm:text-5xl`, todo con `tracking-[-0.02em]`+.
- `font-body` (Manrope): resto.
- Eyebrows: `text-[0.6rem]–[0.65rem] font-semibold uppercase tracking-[0.22em] text-pine/80`
  (o `text-storm/50` para grupos de nav).

### Radios y espaciado
- Cards grandes/modales: `rounded-[28px]` · cards medianas: `rounded-[24px]` ·
  controles/inputs: `rounded-2xl` · pills: `rounded-full`.
- Página: `flex flex-col gap-6`. Interior de cards: `p-4 sm:p-6`.

### Z-index map (respetar SIEMPRE)
`sidebar/shell 30` < `popovers (InfoTip, pickers) 80` < `modales 90` < `tour spotlight 94`
< `tour card 95` < `toasts`. El SearchablePicker usa portal con `z-9999` interno.

## 3. Anatomía de página estándar

```tsx
<div className="flex flex-col gap-6 pb-8">
  {/* 1. Encabezado compacto: eyebrow + título + InfoTip + resumen de una línea */}
  <div>
    <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-pine/80">Módulo</p>
    <div className="mt-1 flex items-center gap-2.5">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.02em]">Título corto</h2>
      <InfoTip ariaLabel="Sobre esta sección">Texto que antes era un párrafo.</InfoTip>
    </div>
    <p className="mt-1 text-xs text-storm">resumen contextual de UNA línea</p>
  </div>

  {/* 2. Barra de controles sticky (si la página tiene filtros) */}
  <div className="glass-panel sticky top-2 z-30 rounded-2xl px-3 py-2">
    <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <SegmentedControl variant="pill" ... />
      <div className="ml-auto flex shrink-0 items-center gap-1.5">{/* acciones */}</div>
    </div>
  </div>

  {/* 3. Contenido en cards con reveal */}
  {/* 4. Estados vacíos con <DataState> + acción de salida */}
  {/* 5. <Pagination> si la lista puede crecer */}
</div>
```

Referencias reales: `src/modules/dashboard/pages/dashboard-page.tsx` (header + barra sticky
+ hero KPIs) y `src/modules/movements/pages/movements-page.tsx` (filtros en URL + paginación).

## 4. Catálogo de componentes compartidos (`src/components/ui/`)

| Componente | Cuándo usarlo |
|---|---|
| `Modal` + `ModalHeader/Body/Footer` | TODO diálogo nuevo. Overlay, Escape, focus-trap, scroll-lock y max-height móvil resueltos. Nunca dupliques un overlay a mano. |
| `FormField` | Label + hint + error de cualquier campo. Reemplaza los *Field locales. |
| `Input` / `Textarea` / `Select` (`fields.tsx`) | Inputs estilizados sobre `.field-dark`. |
| `SearchablePicker` | Cualquier select con búsqueda. Soporta acción "+ crear inline" (`onAction`), teclado, portal anti-clipping. Reemplaza pickers locales. |
| `SegmentedControl` | Opciones excluyentes. `variant="pill"` (barras compactas) o `"card"` (con helper). |
| `InfoTip` | TODO texto de ayuda. `onOpenDetail` enlaza a ayuda profunda (ej. dashboard-metric-help). |
| `SectionHeading` | Título de sección dentro de una página. |
| `Pagination` | Listas que pueden superar ~50 ítems (client-side slice, ver movements). |
| `DataState` | Estados vacíos/error/ok, siempre con `action` de salida. |
| `StatusBadge` | Etiquetas de estado (5 tonos). No usar para texto largo. |
| `MetricCard` / `SurfaceCard` | KPI con icono / contenedor de sección con acción. |
| `DeleteConfirmDialog`, `UnsavedChangesDialog`, `toast-provider`, `bulk-action-bar`, `column-picker`, `view-selector`, `table-column-filter-menu` | Igual que antes; ya consistentes. |

## 5. Recetas antes → después

1. **Párrafo explicativo visible → InfoTip.** Borra el bloque, añade
   `<InfoTip title="...">texto</InfoTip>` junto al título. (Hecho en dashboard: "QUÉ HACEN
   LOS FILTROS").
2. **Picker local → SearchablePicker.** Las props coinciden (`value/onChange/options/
   placeholderLabel/placeholderDescription/queryPlaceholder/emptyMessage` + `onAction`).
   Puedes importar con alias para no tocar call sites:
   `import { SearchablePicker as QuickPicker } from ".../searchable-picker"` (hecho en
   quick-movement-dialog).
3. **Dialog manual → Modal.** Sustituye overlay+card propios por `<Modal onClose size>` y
   mueve título a `ModalHeader`, acciones a `ModalFooter`, contenido a `ModalBody`.
4. **Formulario kilométrico → divulgación progresiva.** Esenciales arriba; resto dentro de
   `{showAdvanced ? ... : null}` con botón "Más opciones" (hecho en movement-editor-dialog).
5. **Filtros en estado local → URL.** `useSearchParams` como única fuente de verdad,
   omitiendo defaults para URLs limpias; cambiar filtros resetea `page` (ver
   movements-page, función `writeFiltersToParams`).
6. **Lista completa en memoria → Pagination.** Slice client-side de 50; la selección masiva
   se mantiene sobre el conjunto filtrado completo.

## 6. Do / Don't

- ✅ `data-tour="..."` en el botón "crear" principal de cada módulo (lo usa el tour).
- ✅ `animate-rise-in` para entradas de página; `reveal`/`useInView` para secciones al scroll.
- ✅ `prefers-reduced-motion` ya está cubierto por las clases globales — úsalas, no inventes keyframes inline.
- ❌ NO crear constantes de clase locales tipo `xFieldClassName` — usa los componentes de `fields.tsx`.
- ❌ NO `min-w-[Npx]` + `overflow-x-auto` para gráficas: SVG fluido con `viewBox` + `w-full h-auto` (ver `LineChartSvg`).
- ❌ NO tocar claves de localStorage existentes ni `services/queries/workspace-data.ts` en re-skins.
- ❌ NO títulos de página `text-3xl+` ni descripciones de 2+ líneas bajo el título.

## 7. Checklist de migración por módulo

Para cada módulo (accounts, categories, budgets, contacts, obligations, subscriptions,
recurring-income, notifications, settings):

- [ ] 1. Header compacto (anatomía §3) — sin párrafo permanente.
- [ ] 2. Textos de ayuda → InfoTip.
- [ ] 3. Pickers/inputs/fields locales → compartidos (`SearchablePicker`, `FormField`, `fields.tsx`).
- [ ] 4. Diálogos → `Modal` base.
- [ ] 5. Formulario de crear/editar con divulgación progresiva (esencial ≤6 campos).
- [ ] 6. Filtros persistidos en URL (si la página filtra).
- [ ] 7. `Pagination` si la lista puede superar 50 ítems.
- [ ] 8. Estados vacíos con `DataState` + acción.
- [ ] 9. Revisión a 390px: sin overflow horizontal, táctiles ≥44px, una columna.
- [ ] 10. `npm run build` verde + QA visual (desktop y móvil) antes de cerrar.

## 8. Accesibilidad y movimiento

- Modales: `aria-modal`, focus-trap (`use-focus-trap`), Escape cierra, foco restaurado al cerrar.
- Popovers: cierre por outside-click y Escape (`useOutsidePointerClose`).
- Listas interactivas: `role="listbox"`/`option`, navegación con flechas + Enter.
- Animaciones: solo CSS (`rise-in`, `fade-in`, `reveal`, `chart-draw`), todas con guard de
  `prefers-reduced-motion` en `src/styles/index.css`.
- El spotlight del tour NUNCA debe bloquear el elemento destacado (`pointer-events-none` +
  sombra de recorte). Si añades pasos al tour, mantén ese patrón.

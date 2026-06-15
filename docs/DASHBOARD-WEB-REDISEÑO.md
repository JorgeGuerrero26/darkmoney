# Rediseño del dashboard web — "Aprovechar el ancho" (Fase C)

> **Estado: PARCIALMENTE EJECUTADO.** Pasos 1-3 implementados en
> [`dashboard-page.tsx`](../src/modules/dashboard/pages/dashboard-page.tsx); paso 4 omitido
> por decisión (alto riesgo sobre secciones que ya funcionan, poca ganancia adicional).
>
> Decisión del usuario (ya tomada): el dashboard web **no** debe replicar las pestañas del
> móvil; debe aprovechar el ancho de pantalla grande con un hero claro, un desglose del
> cierre de mes, y secciones reveladas progresivamente.

## Estado de implementación

| Paso | Descripción | Estado |
|------|-------------|--------|
| 1 | Hero en banda ancha de 3 KPIs (`md:grid-cols-2 2xl:grid-cols-3`) | ✅ Hecho |
| 2 | Score de salud sube al hero como 3er KPI; los 4 indicadores pasan a bloque propio (`2xl:grid-cols-4`) | ✅ Hecho |
| 3 | Waterfall "De dónde sale el cierre de mes" con `buildMonthProjection` | ✅ Hecho |
| 4 | Reorganizar todas las secciones inferiores a grid de 12 columnas + `reveal` avanzado | ⏸️ Omitido (decisión) |
| 5 | QA: typecheck + build verdes. Verificación visual delegada al usuario (dashboard tras login) | ✅ Estático |

Verificación: `tsc -b` y `npm run build` verdes tras los cambios. La verificación visual en
runtime quedó a cargo del usuario (el dashboard está tras `RequireAuth` y no hay sesión de
prueba para el navegador headless).

## 1. Punto de partida (qué hay hoy)

El dashboard vive en [`src/modules/dashboard/pages/dashboard-page.tsx`](../src/modules/dashboard/pages/dashboard-page.tsx)
(~4900 líneas). Ya existen, y se reutilizan:

- **Hero KPIs**: Patrimonio + Ahorro del período, en `grid md:grid-cols-2` (línea ~2017).
- **Panel de IA** "Tu situación explicada" ([`DashboardAiSummaryPanel`](../src/modules/dashboard/components/dashboard-ai-summary-panel.tsx)).
- **Salud financiera**: score 0-100 + 4 indicadores, vía `buildHealthScore` de `@darkmoney/shared/health` (línea ~1104 / banner ~2074). **Ya unificado con el móvil (Fase B).**
- Secciones de cierre de mes / proyección, cashflow, desglose de cuentas, obligaciones, etc.
- Helpers de UI reutilizables: `InfoTip`, `SectionHeading`, `DashboardKpiHelpWrap`,
  `DeltaBadge`, `DashboardHelpTrigger`, tokens Tailwind (pine/ember/gold/rosewood/ink/storm/void/shell).

**Problema a resolver:** casi todos los grids son `md:grid-cols-2` o `xl:grid-cols-3` —
pensados para una columna estrecha (herencia mental del móvil). En monitores anchos el
contenido queda centrado y desaprovecha el espacio; el usuario no tiene una lectura clara
de "¿cómo voy este mes y de dónde sale ese número?".

## 2. Principios

1. **Una pregunta arriba, grande**: "¿Cómo voy este mes?" respondida de un vistazo
   (patrimonio + ahorro + score de salud), sin scroll.
2. **El cierre de mes es explicable**: mostrar *de dónde sale* el saldo proyectado
   (patrimonio actual + comprometido entrante − comprometido saliente + proyección variable),
   no solo el número final.
3. **Aprovechar el ancho real**: layout de 12 columnas en `2xl`, no replicar las 6 pestañas
   del móvil. Lo importante ocupa más; lo secundario se revela bajo demanda.
4. **Revelado progresivo**: lo esencial siempre visible; el detalle (desgloses, históricos,
   indicadores avanzados) detrás de secciones colapsables/`reveal`.
5. **Paridad numérica intacta**: ningún número cambia su cálculo. Esto es **layout y
   jerarquía**, no lógica financiera. La capa `@darkmoney/shared` no se toca.

## 3. Estructura propuesta (de arriba a abajo)

### 3.1 Hero "¿Cómo voy este mes?" (siempre visible, sin scroll)

Banda superior a todo el ancho, en `2xl:grid-cols-[1.4fr_1fr_1fr]`:

```
┌─────────────────────────────┬──────────────────┬──────────────────┐
│  PATRIMONIO                  │  AHORRO PERÍODO  │  SALUD           │
│  S/ 12,480        ▲ +2.8%    │  S/ 2,140  ▲     │   ╭───╮          │
│  Dinero total · líquido …    │  vs mes anterior │   │ 81│ /100     │
│                              │                  │   ╰───╯ headline │
└─────────────────────────────┴──────────────────┴──────────────────┘
```

- Reutiliza los `DashboardKpiHelpWrap` actuales (Patrimonio, Ahorro) + el banner de salud
  ya existente, recolocados en una sola banda ancha en lugar de apilados.
- El score de salud (0-100) sube al hero como tercer KPI; los 4 sub-indicadores con barras
  se mueven al desglose (3.3) detrás de un `reveal`.

### 3.2 Panel de IA — ancho completo, debajo del hero

`DashboardAiSummaryPanel` ocupa el ancho completo bajo el hero (no en grid de 2). Es la
lectura en lenguaje natural de lo que el hero muestra en números.

### 3.3 Desglose del cierre de mes (la sección nueva clave)

Un solo bloque ancho que **explica visualmente cómo se llega al saldo estimado de fin de mes**:

```
Saldo hoy            +  Entra comprometido  −  Sale comprometido  ±  Proyección variable  =  Cierre estimado
S/ 12,480               + S/ 4,200              − S/ 1,950             − S/ 800                 S/ 13,930
[████████████████]      [▓▓▓▓▓]                 [▒▒▒]                 [░░]                    [══════════════]
```

- Barra de cascada (waterfall) horizontal aprovechando el ancho.
- Alimentado por `buildMonthProjection` (`committedInflow`, `committedOutflow`,
  `variableIncomeProjection`, `variableExpenseProjection`, `expectedBalance`) — datos que
  **ya se calculan** y están en el smoke de paridad. Cero lógica nueva.
- Debajo, en `reveal`: los 4 sub-indicadores de salud con barras + el detalle de obligaciones
  que componen lo comprometido.

### 3.4 Secciones progresivas (grid de 12 columnas en 2xl)

El resto de widgets se reorganiza en un grid ancho, agrupado por intención, no en pestañas:

- **Flujo y tendencia** (cashflow diario + proyección): ancho, ocupa 8/12.
- **Cuentas** (desglose por cuenta/tipo): 4/12 al lado del flujo.
- **Compromisos** (obligaciones por cobrar/pagar, suscripciones): fila de 2 columnas.
- **Avanzado / aprendizaje** (readiness, review inbox, indicadores N2/N3): detrás de un
  `reveal` "Ver análisis avanzado" — visible solo si el usuario lo pide.

Cada grupo usa `SectionHeading` + `InfoTip` ya existentes. El control de visibilidad de
widgets (`isWidgetVisible`) se mantiene tal cual.

## 4. Responsive

- `< md`: una columna, orden = hero apilado → IA → cierre de mes → resto (igual que hoy).
- `md–xl`: 2 columnas donde tenga sentido.
- `2xl+`: el layout ancho de 12 columnas descrito arriba entra en juego.

No se introducen pestañas en ningún breakpoint. El móvil mantiene su navegación propia
(este documento es solo web).

## 5. Qué NO cambia

- Ningún cálculo financiero. `@darkmoney/shared` intacto; los smokes de paridad siguen verdes.
- El componente de IA, su backend y su límite de 1/día.
- El sistema de visibilidad de widgets ni los help triggers.
- La unificación de salud de la Fase B.

## 6. Orden de implementación sugerido (cuando se ejecute)

1. Extraer el hero a un componente propio y recolocarlo en banda ancha (bajo riesgo, visual).
2. Subir el score de salud al hero; mover sus 4 indicadores al desglose.
3. Construir el bloque waterfall de cierre de mes con los datos de `buildMonthProjection`.
4. Reorganizar los widgets restantes al grid de 12 columnas + `reveal` para lo avanzado.
5. Pasada de QA responsive en los 3 breakpoints + captura de pantalla de verificación.

## 7. Pendientes relacionados (fuera de esta fase)

- ✅ **Paridad real de `liquidMoney` en móvil** — RESUELTO. El móvil ahora suma solo dinero
  líquido (cash/bank/savings, no archivado) igual que la web, y el smoke de paridad deriva
  `liquidMoney` de los tipos de cuenta para probar la regla.

- **Unificar `aggregations.ts` / `types.ts` del móvil con `@darkmoney/shared`** — deuda
  consciente, NO unificada. Razón: a diferencia de `health.ts`/`currency.ts` (copias puras,
  ya reemplazadas por re-exports del paquete), estos archivos del móvil **no son copias**:
  - Tienen lógica propia que el paquete no expone: `pctChange`, `sortMovementsRecentFirst`,
    `movementPreviewActionLabel`, `buildExchangeRateMap`, y los tipos `DashboardChartDay` /
    `DashboardMovementRow`.
  - Usan `date-fns` directamente (el paquete reimplementa las fechas en `date-utils`).
  - Tienen firmas/nombres adaptados al móvil (`ConversionCtx` vs `ParityConversionCtx`,
    `convertAmt`/`resolveRate` como wrappers).

  Las funciones núcleo (`isIncome`, `isExpense`, `incomeAmt`, `inRange`...) sí coinciden en
  lógica con el paquete y **ya producen los mismos números** (verificado por el smoke de
  paridad). Unificarlas implicaría migrar el tipo `DashboardMovementRow` → `ParityMovement`
  propagándolo por todo el dashboard móvil: refactor grande, alto riesgo (sin emulador para
  probar el arranque), beneficio bajo. Se deja documentado para abordarlo solo si el
  mantenimiento de la duplicación se vuelve un problema real.

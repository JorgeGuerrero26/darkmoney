# DarkMoney — Backlog de mejoras futuras

> Ideas evaluadas y diseñadas a alto nivel, pendientes de priorizar. Las ideas de IA
> requieren backend (Supabase Edge Functions); **la API key de DeepSeek jamás va en el
> frontend**.

---

## 1. Chatbot financiero con DeepSeek ("pregúntale a tu dinero")

**Objetivo:** consultas en lenguaje natural sobre los datos del workspace:
"¿en qué comida gasté ayer?", "¿cuánto le debo a Juan?", "¿voy mejor que el mes pasado?".

**Arquitectura segura (obligatoria):**
1. **Supabase Edge Function `ai-chat`** como proxy:
   - La key de DeepSeek vive en `supabase secrets` (`DEEPSEEK_API_KEY`), nunca en `VITE_*`.
   - Verifica el JWT del usuario (`Authorization: Bearer`) y deriva el `user_id`.
   - Consulta los datos con el cliente de Supabase **del usuario** (RLS aplicada): nunca con service role para datos.
   - Rate limiting por usuario (ej. 20 mensajes/día Free, 200 Pro) en una tabla `ai_usage`.
2. **Function calling / tools** expuestas al modelo (DeepSeek soporta tool-calls estilo OpenAI):
   - `get_period_totals(from, to)` → ingresos/gastos/neto.
   - `get_movements(filters)` → movimientos filtrados por fecha/categoría/cuenta (límite 50).
   - `get_top_categories(period)`, `get_obligations_summary()`, `get_upcoming_commitments(days)`.
   - El modelo NUNCA recibe el snapshot completo; solo respuestas de tools (privacidad + tokens).
3. **Streaming SSE** desde la Edge Function al cliente para respuesta progresiva.
4. **UI:** botón flotante (esquina inferior derecha, no choca con el tour) que abre un panel
   con el `Modal` base variante lateral; historial por sesión (no persistir conversaciones
   sensibles por defecto); disclaimer "no es asesoría financiera".

**Esfuerzo estimado:** 1 Edge Function + 5 tools + panel UI ≈ proyecto mediano independiente.

## 2. IA por módulo (ideas concretas)

| Módulo | Idea | Cómo |
|---|---|---|
| Movimientos | **Auto-categorización** al crear: sugerir categoría según descripción/contraparte | Few-shot con los últimos N movimientos categorizados del usuario vía Edge Function; aceptar con un tap |
| Movimientos | Detección de duplicados mejorada (hoy es heurística) | Embeddings o reglas + LLM solo en casos ambiguos |
| Dashboard | **Resumen mensual narrado** ("Este mes gastaste 12% más en comida...") | Tool get_period_totals + top categorías → párrafo generado, cacheado por mes |
| Notificaciones | Alertas redactadas en lenguaje natural y accionables | Plantilla + LLM para el copy, trigger ya existente |
| Presupuestos | Presupuestos sugeridos según patrón histórico de 3 meses | Cálculo local + redacción LLM opcional |
| Suscripciones | Detección de suscripciones a partir de movimientos recurrentes similares | Heurística local primero; LLM para nombrarlas |
| Recibos | OCR de comprobantes (foto → monto/fecha/comercio precargados) | DeepSeek-VL u OCR externo vía Edge Function |

## 3. Otras mejoras de producto

- **Export por filtro de URL:** el CSV de movimientos ya respeta filtros; añadir export Excel y "copiar enlace de esta vista".
- **Plantillas de movimientos:** "gasto frecuente" guardado (taxi, almuerzo) con 1 tap desde el quick dialog.
- **PWA:** manifest + service worker para instalar en el teléfono; atajos de app (Nuevo gasto).
- **Cache persistente de react-query** (localStorage) para arranque instantáneo offline-first.
- **Migrar módulos restantes** al sistema de diseño siguiendo `docs/DESIGN-SYSTEM.md` (checklist §7). Orden sugerido: accounts → categories → contacts → subscriptions → budgets → obligations → recurring-income → notifications → settings.
- **Comprimir `public/banner-darkmoney.png`** (2.2MB) o eliminarlo si las páginas de invitación se rediseñan.
- **Tests E2E con Playwright** para los flujos críticos (login, crear movimiento, tour) usando `storageState` guardado.

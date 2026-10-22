# Paridad de recursos — correcciones del 30 de septiembre de 2026

## Alcance y criterio

Referencia: código local de `C:/Users/Adrian/Documents/DarkMoneyApp`. Destino web: `C:/Users/Adrian/Documents/DarkMoney`. Una coincidencia visual no certifica igualdad financiera. Se verifican dirección, moneda, estado, fechas y origen de los datos por separado.

No se crearon, editaron, cobraron, pagaron ni eliminaron registros del espacio real. Las pruebas de escritura usan clientes simulados. La comprobación del navegador abrió un borrador y lo descartó sin guardar.

## Correcciones verificadas

| Área | Corrección | Evidencia |
| --- | --- | --- |
| Contactos y Categorías web | Cobros de créditos leen monto y cuenta destino; los pagos leen origen. Los importes sin conversión no se relabelan como moneda base. | `scripts/test-catalog-parity.mjs`: cobro de 50, pago de 20, moneda extranjera con/sin conversión y cero convertido. |
| Contactos web | Deudas canceladas fuera de exposición; filtros de tipos combinables con Fijados; búsqueda por tipo; enlace WhatsApp; importes programados activos. | Pruebas puras y navegador: Persona + Servicio conservan ambas selecciones y muestran seis contactos en lugar de sustituir el filtro. |
| Categorías web | Padres compatibles, no del sistema y sin ciclos; guardia contra doble envío. | Pruebas de padres, exclusión de descendientes y selección por tipo. |
| Gráficos web | Doce meses y agrupación en America/Lima. La serie y los subtotales agregados omiten importes no convertibles con aviso; el detalle conserva su moneda original. | Pruebas del límite de mes a las 05:00 UTC; navegador con doce meses visibles en Contactos. |
| Tarjetas web | Corte, pago y límite opcionales en creación/edición, snapshot, detalle, lista y CSV; limpieza al cambiar a otro tipo. | Validación y ejecución de ambos cuerpos reales de mutación sobre cliente simulado; navegador confirma los tres campos sin guardar. |
| Sincronización web | Un coordinador para los ocho módulos: eventos, foco, reconexión y respaldo cada 60 segundos cuando hay datos activos con más de 30 segundos. Invalidaciones locales incluyen los catálogos. | `scripts/test-workspace-sync.mjs`: alcance por espacio, eventos agrupados, solicitudes en curso, desconexión, fallos y limpieza. |
| Contactos móvil | Snapshot usa `v_counterparty_summary` para métricas históricas, roles y actividad; no inicializa todos los contactos con métricas financieras ficticias en cero. | `DarkMoneyApp/scripts/test-counterparty-snapshot.mjs`, comprobación de tipos móvil. |
| Fijados web | La consulta del overview lee `is_pinned`, además del snapshot. | Aserción sobre la consulta real en la prueba de catálogos. |
| Cierre de mes web | Los compromisos de la proyección mensual se cortan al fin del mes, igual que el modelo móvil; las ventanas de próximos 7/15/30 días conservan su propio alcance. | Pruebas de fin de mes, mes de 31 días, cuotas, estados y conversión ausente; ambas suites `test:parity` pasan con la misma referencia. |

Los cálculos web de análisis de Contactos y Categorías están basados en movimientos aplicados, con un movimiento por registro y sin sumas entre monedas no convertidas. La barra por mes representa el importe comparable en la moneda base; no convierte mediante una tasa inventada.

## Pruebas

- Web: `npx tsc -b`, `npm run build`, suites existentes de movimientos, paridad, suscripciones, ingresos fijos, presupuestos, plan de pagos y fechas.
- Nuevas: `npm run test:catalog-parity`, `npm run test:workspace-sync`.
- Móvil: `npm run typecheck`, `node scripts/test-counterparty-snapshot.mjs`, `npm run test:parity`.
- `git diff --check` por unidad de trabajo.

La prueba general móvil detectó una referencia obsoleta: los compromisos de los próximos 30 días se confundían con los del mes. Se contrastó con `buildMonthProjectionModel` móvil, se corrigió el punto de entrada web y se actualizaron únicamente los tres resultados afectados de ambas copias de la referencia. En el fixture de junio, el comprometido por entrar baja de 2066.666667 a 1000, por salir de 207.323333 a 100.656667 y el cierre de 7002.143333 a 6042.143333. No son cifras del espacio real. Ambas suites vuelven a pasar; las otras métricas no cambiaron.

## Seguimiento del 2 de octubre de 2026

**Historial de Categorías cerrado en código local.** El snapshot y las actualizaciones selectivas móviles paginan el historial aplicado completo, sin cortar a dos años o 1000 filas. El conteo registrado del overview también pagina en ambos clientes e incluye todos los estados, mientras los importes cuentan solo aplicados. El modelo móvil separa total histórico y últimos doce meses; el promedio mensual usa únicamente esos doce meses y el corte America/Lima. Los cobros leen destino y los pagos origen. La carga de historiales de Suscripciones utiliza la misma paginación.

**Monedas de Contactos cerradas en los caminos corregidos.** El flujo móvil se calcula desde su historial aplicado completo, no desde escalares de la vista que no acreditan conversión. Los pendientes y compromisos activos se convierten desde monto/moneda originales usando tasas persistidas. Los importes sin tasa se mantienen separados por moneda, y no alimentan netos ni porcentajes completos. No se confía en el antiguo campo de obligación que copiaba el monto nativo como si fuera base. Detalle, señales de lista y CSV consumen esta regla; el CSV web también usa la exposición normalizada, no el escalar sin moneda de la vista. Las vistas permanecen útiles para conteos y roles.

La actualización tras crear un movimiento, pagar una suscripción o volver a primer plano incluye el historial de Contactos. El parche inmediato de caché añade monto, dirección, moneda y conversión a los tres historiales. Se renovó la versión de caché persistido para no hidratar estructuras antiguas. Si falla una página, no se certifica un total parcial: se avisa de historial no disponible sin bloquear los datos básicos del espacio. Si los créditos/deudas diferidos no han cargado, no se exportan ceros ficticios.

Evidencia local adicional:

- Móvil: `npm run test:catalog-money`: 1501 filas, datos de 2020, fallo de página, fechas al límite de mes, conversiones presentes/ausentes, canceladas, cobros, pagos y parche de caché; comparación de las implementaciones reales de ambos clientes en el checkout local.
- Móvil: `npm run typecheck:catalogs`, `npm run typecheck` y 26 pruebas de `workspace-loading-errors.test.ts` pasan. Durante el trabajo, la comprobación global detectó errores transitorios de una edición simultánea en `ObligationAnalyticsModal.tsx`; la última ejecución global pasó. No se sustituyó esa comprobación por la parcial ni se modificó ese trabajo.
- Web: `npm run build`, `npm run test:catalog-parity` y `npm run test:parity` pasan. Móvil: `npm run test:parity` también pasa.
- No se midió el tiempo de carga con un espacio de decenas de miles de movimientos. El historial ahora es completo y paginado, pero el tamaño total del caché puede crecer.

## Suscripciones y Notificaciones — seguimiento del 2 de octubre

La comparación con los módulos móviles actuales cerró estas diferencias en la web:

- **Suscripciones:** detalle en filas compactas con fecha inicial/final, aviso, cuenta, categoría, registro automático, notas y fijado; barra fija de Editar y Registrar pago, con acciones secundarias en el menú. La lista distingue activas, pausadas y canceladas sin prometer cobros de una cancelada. La cadencia visible respeta `intervalCount` y el último día del mes.
- **Notificaciones:** búsqueda combinable con prioridad, tipo y lectura; selección de guardadas, lectura/no lectura por lote, eliminación confirmada con deshacer y restauración visual ante error. La lista abre en Todas, agrupada por fecha. Las prioridades se contrastan con las constantes reales del checkout móvil.
- **Fuentes de la bandeja:** los conteos de lectura corresponden a las notificaciones persistidas del usuario, incluidas las archivadas. Los recordatorios calculados solo en web se muestran en Avisos web; no se suman a los conteos compartidos. Las invitaciones pendientes conservan acceso en Piden algo.
- **Destinos:** el snapshot lee `related_entity_id` y `payload`; los avisos dejan de abrir siempre la propia bandeja. Suscripciones, Cuentas, Créditos y deudas y Presupuestos pueden abrir el recurso cargado desde un enlace interno, sin guardar borradores. Los enlaces de invitación usan su token; se ignoran URLs arbitrarias del payload.

Verificación: `npx tsc -b`, `npm run build`, `npm run test:notification-parity`, `npm run test:subscription-parity` y `npm run test:parity` pasan. Las escrituras de lectura se probaron con cliente simulado, incluyendo alcance por usuario e IDs, duplicados, selección vacía e indisponibilidad de red. En el navegador se comprobaron búsqueda + tipo, selección sin ejecutar acciones, diseño del detalle de Suscripciones y apertura del registro Sergio Teclado desde una notificación ya leída. No se marcaron nuevas lecturas ni se eliminaron registros reales.

## Cierre del 9 de octubre de 2026

- **Estado de Suscripciones:** cuando el historial no deja cobros pendientes y el puntero de próximo cobro quedó atrás, ambos clientes anuncian la siguiente fecha real (la cadencia rodada hasta hoy) y sus días; ya no dicen "Al día" con una fecha pasada. Web: `subscription-standing.ts`; móvil: `subscriptionStanding.ts`.
- **Total mensual:** ambos clientes aplican `intervalCount` (cada 2 meses = la mitad), tratan la cadencia personalizada como días y solo suman suscripciones activas con conversión válida o ya en moneda base. Las demás se cuentan aparte ("N sin conversión no suman"). El menú Más móvil dejó de sumar montos nativos de distintas monedas. El costo anual móvil de cadencia personalizada pasó de ×12 a días.
- **Invitaciones:** el móvil clasificaba `obligation_share_invite` como Obligaciones; ahora es Invitaciones, igual que web.
- Pruebas: `npm run test:subscription-parity`, `test:notification-parity`, `test:parity`, `npx tsc -b`, `npm run build` (web); jest de `features/subscriptions` y `features/notifications` y `npm run typecheck` (móvil). Sin cambios en registros reales.

Pendiente de esta revisión:

- Los enlaces avanzados de Notificaciones aún no reproducen todos los destinos móviles: solicitud/evento concreto de una obligación, formulario de movimiento detectado, filtros de fecha/categoría de alertas y día concreto del resumen. Abrir el recurso correcto es solo el primer nivel.
- El indicador de la campana web cuenta solicitudes que piden acción, mientras la bandeja muestra lectura de guardadas. No se certificó equivalencia de ese indicador con el móvil ni se cambió su regla en esta unidad.

## Auditoría web contra el móvil actual — 22 de octubre de 2026

Se revisaron los commits móviles del 14 al 21 de octubre y el estado del formulario de obligaciones. Solo se modificó la web; el móvil se usó como referencia de solo lectura.

**Cerrado en web:**

- **Plan de pagos: día de cobro.** El móvil guarda `payDay` (1–31 o fin de mes) en el plan. La web lo ignoraba al calcular cuotas, y al guardar una deuda desde web lo borraba. Ahora la web lo lee, calcula las mismas fechas y lo conserva al guardar; uno inválido se rechaza. El editor del plan tiene el selector «Día de cobro». Afecta detalle, cobertura, proyección y calendario del dashboard.
- **Plan al editar una deuda que creció.** El editor muestra y valida el calendario sobre la deuda de hoy (`effectivePlanSchedule`), igual que el detalle y la proyección; antes usaba el monto de apertura.
- **Crear obligación como el móvil.** «Cómo nació» es obligatorio y sale vacío; se ofrecen los mismos orígenes del móvil, incluido «Pagué por alguien» (`paid_for_other`, saca dinero al crear), y ya no «Manual» ni el impacto inicial elegible. «Total que te devolverán / devolverás» reemplaza la tasa escrita: la diferencia se registra como aumento «Interés pactado» sin mover cuentas, la tasa resulta informativa y el plan reparte el total. El estado no se elige al crear. «Cuenta de abonos» pasa a «Cuenta habitual».
- **Origen `paid_for_other` en lectura.** Las deudas compartidas con ese origen hacían fallar la lectura web, y las propias se rotulaban con otro origen. Ahora se leen y se nombran bien; un origen desconocido se muestra como tal.
- **Pago de suscripción.** Se paga el cobro más antiguo sin pagar (no una fecha por delante del historial), la fecha propuesta es hoy si el cobro ya venció, y el movimiento lleva la misma `client_dedupe_key` del móvil, así que un reenvío no lo duplica.
- **Asistente.** Las tarjetas para corregir o borrar un gasto o ingreso (`movementChanges`) ya se muestran y solo se aplican tras confirmar. Antes de escribir se relee el movimiento y se exige el mismo «antes»; se escribe solo lo que cambia y se verifica la respuesta. También se añadieron las negritas, Copiar sin asteriscos, las preguntas iniciales, las sugerencias de seguimiento y Reintentar.
- **Detecciones por correo.** Un fallo de red al volver a verificar PRO no bloquea si el acceso ya se confirmó en la sesión (el servidor vuelve a exigir PRO al registrar).
- **Pendientes anteriores revisados.** Los destinos de Notificaciones ya cubren solicitud/evento de obligación, detección, filtros y día del resumen. La campana web cuenta todas las notificaciones no leídas del usuario con la misma regla que el móvil.

**Diferencias que se dejan a propósito:**

- Modo sin conexión, cifrado local y avisos de «necesita internet»: son propios del teléfono.
- Respuesta en vivo y lectura en voz alta frase por frase: dependen del modo `stream` del servidor. La web usa la respuesta completa, que el servidor mantiene; ya tenía «Cancelar consulta».
- Rediseño visual de la hoja de cambios de capital del móvil: no cambia reglas.

**Evidencia:** `npx tsc -b`, `npm run build` y todas las suites `test:*`. Nuevas o ampliadas: `test:obligation-plan` (144 comparaciones de `payDay`, 35 de interés pactado y 9 del calendario efectivo contra el código móvil real), `test:obligation-write-guards` (interés tras crear, fallo sin recrear, total menor y origen vacío), `test:subscription-parity`, `test:subscription-permissions`, `test:assistant-movement-change` (nueva), `test:assistant-drafts` y `test:detected-movement-parity`. Clientes simulados; no se tocaron registros reales.

## Pendientes; no declarar paridad total

1. **Integración en dispositivos:** no se ejecutó guardar/cobrar/pagar con dos clientes reales ni pruebas multiusuario. El usuario no dispone de un espacio de pruebas. Las pruebas locales no certifican esas operaciones contra RLS, Storage o una red real.
2. **Distribución:** la corrección del código móvil no fue publicada por OTA ni instalada en el teléfono. No se modificaron publicaciones de Realtime ni migraciones del servidor; el respaldo web cubre publicaciones incompletas, pero no demuestra entrega instantánea de todos los eventos.
3. **Cambios futuros del móvil:** esta auditoría cubre el checkout móvil al 21 de octubre. Lo que se agregue después requiere otra comparación.

La equivalencia de fuentes se comprobó en el código local, no contra el estado de una versión móvil instalada. Los cambios preexistentes de configuración local, archivos temporales de Supabase y respaldos móviles se conservaron fuera de los commits.

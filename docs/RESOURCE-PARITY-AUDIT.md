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

## Pendientes; no declarar paridad total

1. **Integración en dispositivos:** no se ejecutó guardar/cobrar/pagar con dos clientes reales ni pruebas multiusuario. El usuario no dispone de un espacio de pruebas. Las pruebas locales no certifican esas operaciones contra RLS, Storage o una red real.
2. **Distribución:** la corrección del código móvil no fue publicada por OTA ni instalada en el teléfono. No se modificaron publicaciones de Realtime ni migraciones del servidor; el respaldo web cubre publicaciones incompletas, pero no demuestra entrega instantánea de todos los eventos.
3. **Diseño reciente:** aún debe compararse el diseño móvil actualizado de Suscripciones y Notificaciones con web. Las modificaciones móviles simultáneas en otros módulos se preservaron fuera de estos commits.

La equivalencia de fuentes se comprobó en el código local, no contra el estado de una versión móvil instalada. Los cambios preexistentes de configuración local, archivos temporales de Supabase y respaldos móviles se conservaron fuera de los commits.

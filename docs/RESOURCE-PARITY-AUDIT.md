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

## Pendientes; no declarar paridad total

1. **Alcance de históricos de Categorías:** el snapshot móvil todavía limita el conjunto analítico a dos años y 1000 movimientos; web conserva el historial completo. Los doce meses de presentación coinciden, pero los totales históricos pueden diferir con suficientes registros o datos antiguos. No se truncó la web para esconder esa diferencia.
2. **Monedas del análisis móvil de Contactos:** las métricas históricas ahora proceden de la vista existente, pero sus escalares no sustituyen la verificación de conversión y desglose por moneda que realiza la web. Debe cerrarse la definición común antes de certificar totales multi-moneda.
3. **Integración en dispositivos:** no se ejecutó guardar/cobrar/pagar con dos clientes reales ni pruebas multiusuario. El usuario no dispone de un espacio de pruebas. Las pruebas locales no certifican esas operaciones contra RLS, Storage o una red real.
4. **Distribución:** la corrección del código móvil no fue publicada por OTA ni instalada en el teléfono. No se modificaron publicaciones de Realtime ni migraciones del servidor; el respaldo web cubre publicaciones incompletas, pero no demuestra entrega instantánea de todos los eventos.

La equivalencia de fuentes se comprobó en el código local, no contra el estado de una versión móvil instalada. Los cambios preexistentes de configuración local, archivos temporales de Supabase y respaldos móviles se conservaron fuera de los commits.

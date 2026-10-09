# Notificaciones: campana y destinos avanzados

Fecha: 9 de octubre de 2026. Continuación de `RESOURCE-PARITY-AUDIT.md`.
Esta nota no reemplaza las correcciones anteriores de Suscripciones e Invitaciones.

## Implementado

- **Campana:** ambos clientes cuentan notificaciones persistidas con `status !== "read"`, no solicitudes que piden acción ni la ausencia de `read_at`. Web usa la consulta paginada completa de la bandeja. Móvil usa el conteo exacto del servidor y solo recurre a las filas cargadas si ese conteo todavía no está disponible. El indicador compacto muestra `9+`; el conteo real no se pierde.
- **Alertas de Movimientos:** enlaces internos controlados, con fecha, tipo y categoría por ID según el aviso. La categoría exacta se conserva al paginar o cambiar otros filtros, y se puede quitar. Los límites del mes y del día se calculan en hora de Perú. Un cobro duplicado con día válido abre ese día; un resumen mensual conserva sus límites originales.
- **Resumen diario:** abre un diálogo con los movimientos aplicados del día indicado en `todayKey`, no el día de lectura. Está conectado a ambas ramas del dashboard. El enlace a Movimientos conserva fecha y estado. Los importes se muestran en su moneda original; el diálogo no suma monedas distintas.
- **Obligaciones:** una solicitud de abono pendiente abre su revisión, sin confirmarla. Las solicitudes de edición/eliminación llevan a su fila pendiente. Los avisos de eventos abren el registro y enfocan su historial; los compartidos abren la pestaña Historial. Se comprueba que la solicitud pertenezca a la obligación indicada. Si ya fue resuelta, se abre el registro; si no existe en el espacio cargado, se informa. Un evento ausente no impide consultar el historial restante.
- **Presupuesto finalizado:** `duplicateFrom` prepara el formulario del siguiente período con la regla existente de duplicación, sin llamar a una mutación desde el enlace.

## Verificación realizada

- Web: `npm run build` (incluye `tsc -b`), `test:notification-parity`, `test:subscription-parity` y `test:parity` pasan.
- Móvil: `npm run typecheck` y los tres casos de la nueva suite `notificationCounts.test.ts` pasan. No se ejecutó la suite Jest completa en esta continuación.
- Pruebas puras: fechas imposibles, cambio de mes UTC/Perú, filtros de alertas, día histórico, IDs inválidos, solicitudes resueltas o de otra obligación, recursos compartidos y borradores de presupuestos sin mutaciones. Las pruebas de escritura de bandeja usan un cliente simulado.
- Navegador de web: bandeja y título de campana coinciden en **32 sin leer**. El diálogo del **30 de septiembre de 2026** muestra cinco movimientos; su enlace abre los mismos cinco, en estado Aplicado, por **S/ 27.50** de salidas.
- No se marcaron avisos ni se guardaron, cobraron, pagaron o eliminaron registros reales en las pruebas. No se abrió Presupuestos en la cuenta real: esa página contiene una renovación automática preexistente que puede escribir períodos al montarse.

## Pendiente: no hay paridad total

1. **Movimientos detectados:** web todavía no tiene el flujo canónico de revisión/confirmación del móvil. Abrir la lista no equivale a revisar una sugerencia. Deben verificarse reconciliación, deduplicación y lectura diferida hasta resolverla.
2. **Asistente:** falta el destino de `assistant_insight` y revisar el contrato de los resúmenes de IA. No se implementó un envío automático de prompts.
3. **Espacio del aviso:** no se añadió cambio automático de espacio. Los destinos usan los recursos del espacio activo; falta resolver avisos de otro espacio con permisos y estados de carga/error explícitos.
4. **Historial/detalle:** el nuevo resumen diario permite consultar el día, pero no reproduce todos los subtotales y grupos del DaySheet móvil. Las solicitudes y eventos se probaron con reglas puras; faltan pruebas de interfaz con casos reales o fixtures de integración.
5. **Validación entre dispositivos:** guardar/cobrar/pagar, concurrencia, fallos del servidor, notificaciones push y actualización OTA siguen sin probarse. El código móvil corregido no se publicó al teléfono.

## Límites

Los commits de esta continuación separan campana y navegación. Se conservaron las ediciones previas no confirmadas de Suscripciones, la auditoría principal y otros archivos ajenos. Las pruebas pasando cubren los casos enumerados, no certifican por sí solas la paridad de todos los módulos ni todos los tipos de aviso.

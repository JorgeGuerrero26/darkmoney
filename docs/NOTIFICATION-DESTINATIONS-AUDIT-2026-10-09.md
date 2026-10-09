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

1. **Movimientos detectados:** registro simple implementado. Deshacer el registro está preparado en código en ambos clientes y probado localmente, pero requiere desplegar `202610090002_detected_movement_undo.sql`. Siguen pendientes crear divisiones en web, aprendizaje personal específico, verificación IA de duplicados y las acciones avanzadas/masivas del inbox móvil. No se declara paridad completa de detecciones.
2. **Asistente:** falta el destino de `assistant_insight` y revisar el contrato de los resúmenes de IA. No se implementó un envío automático de prompts.
3. **Espacio del aviso:** no se añadió cambio automático de espacio. Los destinos usan los recursos del espacio activo; falta resolver avisos de otro espacio con permisos y estados de carga/error explícitos.
4. **Historial/detalle:** el nuevo resumen diario permite consultar el día, pero no reproduce todos los subtotales y grupos del DaySheet móvil. Las solicitudes y eventos se probaron con reglas puras; faltan pruebas de interfaz con casos reales o fixtures de integración.
5. **Validación entre dispositivos:** guardar/cobrar/pagar, concurrencia, fallos del servidor, notificaciones push y actualización OTA siguen sin probarse. El código móvil corregido no se publicó al teléfono.

## Límites

Los commits de esta continuación separan campana y navegación. Se conservaron las ediciones previas no confirmadas de Suscripciones, la auditoría principal y otros archivos ajenos. Las pruebas pasando cubren los casos enumerados, no certifican por sí solas la paridad de todos los módulos ni todos los tipos de aviso.

## Continuación: revisión de movimientos detectados en web

- Los avisos individuales abren la detección por ID; el aviso de pendientes abre una lista canónica del espacio activo. El `payload.status` es solo una foto del aviso, no decide si se puede registrar.
- Al cerrar una revisión abierta desde Pendientes se vuelve a esa lista; una abierta directamente desde un aviso vuelve a Avisos. Se conserva el resto de parámetros y no se aceptan URLs de retorno arbitrarias. Android/iOS no se modificaron en este cambio web.
- Se reutiliza `QuickMovementDialog`: monto, cuenta y saldo después, tipo, destino Detalles, fecha, comprobante y las sugerencias existentes de Movimientos. No hay un segundo formulario con un diseño diferente.
- Los borradores siguen las reglas conservadoras del móvil: cuenta explícita del comprobante/configuración antes que un default; solo una cuenta compatible permite autoselección; no se inventa un destino de transferencia. No se cambia la moneda del importe detectado al escoger la cuenta.
- Abrir/cerrar desde bandeja o campana no marca leído el aviso de una detección. Registrar, confirmar que era el mismo movimiento u omitir sí intenta marcar sus avisos relacionados. Si ese cambio de lectura falla, no convierte un registro guardado en un fallo financiero.
- Antes de registrar se consulta el estado actual, el permiso PRO de correo y `reconcile_detected_movements`. Sin conciliación no se guarda. Se usa la misma clave `suggestion:<id>` y metadatos que móvil. El trigger de registro simple resuelve la sugerencia; se conserva el cierre compatible si hace falta confirmar el estado posteriormente.
- Un candidato incierto exige elegir «Es el mismo movimiento» o permitir guardar otro. Cambiar datos del borrador invalida esa autorización. No se usa solo el monto para resolver duplicados.
- La omisión requiere confirmación, usa actualización condicional y puede deshacerse en la revisión. Deshacer una omisión no cambia por sí solo el estado de lectura ni toca un saldo.
- La lista usa paginación completa y filtra `pending/needs_review` independientemente de la lectura del aviso. Las claves y lecturas incluyen usuario y espacio. Un ID de otro espacio no abre ni modifica esa detección.

### Pruebas y límites de esta continuación

`test:detected-movement-parity` compara 16 casos contra `buildDetectionDraft` del código real de DarkMoneyApp. Verifica usuario/espacio, cuenta archivada, moneda, transferencia, cambio de día en Perú, borradores con husos distintos, lectura diferida, omisión/deshacer, permisos PRO, actualización concurrente, lista de más de 500 filas, conciliación fallida y reintento con la clave móvil. Los clientes y escrituras son simulados; no se confirma con ello el locking real de Postgres.

Pasaron `npm run build` (incluye `tsc -b`), `test:detected-movement-parity`, `test:notification-parity`, `test:movement-save`, `test:subscription-parity` y `test:parity`. También se prueban los retornos desde Pendientes y desde un aviso directo, conservando parámetros y descartando orígenes arbitrarios. No se ejecutaron typecheck ni Jest del proyecto móvil en esta continuación: sus archivos no se modificaron, y la comparación usa su función pura real.

No se abrió una detección real durante esta prueba: la conciliación puede actualizar el estado canónico en el servidor incluso sin crear movimientos. Falta verificar interfaz y concurrencia con fixtures de integración o un espacio de pruebas. El flujo requiere los contratos del servidor presentes en DarkMoneyApp (`202610070002_detected_movement_resolution.sql` y `202610090001_detected_movement_reconciliation.sql`); no se desplegaron migraciones ni se comprobó aquí su estado remoto.

## Continuación: deshacer el registro completo

- Hallazgo móvil: deshacer borraba solo el primer movimiento y reabría la detección mediante otra petición. En una división quedaban partes aplicadas; un fallo entre peticiones podía dejar un estado inconsistente.
- Ambos clientes llaman a la misma RPC y usan un contrato puro idéntico. Web reutiliza la acción Deshacer existente después del registro y ofrece confirmación desde una detección registrada. Móvil sustituye el borrado seguido de actualización por una única transacción.
- Se captura el espacio y movimiento originales. Un aviso conservado tras cambiar de espacio no elimina un registro del espacio nuevo. El ID esperado impide deshacer una inscripción posterior de la detección.
- La RPC respeta RLS (`security invoker`) y verifica propietario, membresía, Aplicado, procedencia, claves y PRO por correo. Borra todas las partes de una división completa, no solo la primera; un fallo revierte borrados y estado. Los locks siguen el orden movimiento → detección.
- Por seguridad se rechazan grupos incompletos/contaminados, partes sueltas fuera del grupo, ediciones, vínculos a obligaciones, comprobantes y referencias de otras detecciones. El helper de solo lectura consulta referencias ocultas por RLS sin exponer datos del otro usuario. Estos casos requieren revisión desde Movimientos, no un borrado parcial.
- `metadata.registrationUndo` permite confirmar un reintento después de perder la respuesta. El estado de lectura/archivo y el payload de los avisos no se cambian. Consultas financieras y de detecciones se invalidan incluso ante una respuesta incierta; los fallos no usan un fallback de delete/update.
- No se activó aún crear divisiones detectadas en web: la vía móvil actual registra las partes secuencialmente. Falta cerrar un contrato de lote seguro antes de habilitar esa misma superficie.

### Validación y despliegue pendiente

- `test:detected-movement-undo` ejecuta la migración real en [Postgres en memoria mediante PGlite](https://pglite.dev/docs/), con fixtures de RLS, FK, divisiones, rechazos, permisos, fallos a mitad de operación y reintentos. Compara byte a byte el SQL y el contrato puro de ambos repositorios. No lee credenciales ni abre conexiones remotas.
- Pasaron build/TypeScript web, `test:detected-movement-parity`, `test:notification-parity`, `test:movement-save`, `test:parity` y el test SQL. Typecheck móvil y 19 pruebas Jest en dos suites de detecciones pasaron; no se ejecutó Jest completo.
- PGlite tiene una sola conexión: estas pruebas no certifican contención real entre dos sesiones, triggers completos del entorno desplegado ni la interfaz en teléfonos. No se guardaron o borraron registros reales.
- Se añadió PGlite solo como dependencia de desarrollo. `npm audit` informa 20 vulnerabilidades en otras dependencias (ninguna atribuida a PGlite); no se aplicaron actualizaciones automáticas fuera del alcance de esta unidad.
- La migración está en ambos repositorios, documentada en sus diccionarios. El diccionario móvil está ignorado por Git; se conserva localmente y la nota pública está en `DarkMoneyApp/docs/DETECTED-MOVEMENT-UNDO-2026-10-09.md`, sin forzar la publicación del diccionario privado.
- **No desplegado:** el servidor requiere aplicar una sola vez `202610090002_detected_movement_undo.sql`, con los contratos previos de detecciones. Hasta entonces Deshacer informa que falta la migración y no elimina movimientos. Móvil también requiere publicar su actualización; no se hizo OTA. No hay paridad total.

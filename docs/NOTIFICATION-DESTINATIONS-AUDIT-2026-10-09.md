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

1. **Movimientos detectados:** registro simple implementado. Deshacer el registro está implementado en ambos clientes, probado localmente y con `202610090002_detected_movement_undo.sql` desplegada. La OTA móvil está disponible desde el 11 de octubre; falta verificar recepción y uso entre dispositivos. Omitir una fila, Omitir todos, Deshacer, aprendizaje personal y verificación IA de duplicados en web se implementaron el 13 de octubre. Siguen pendientes crear divisiones en web, corregir las diferencias verificadas de fecha/búsqueda/conteos del comprobador móvil y el resto de herramientas avanzadas del inbox móvil. No se declara paridad completa de detecciones.
2. **Asistente:** falta el destino de `assistant_insight` y revisar el contrato de los resúmenes de IA. No se implementó un envío automático de prompts.
3. **Espacio del aviso:** no se añadió cambio automático de espacio. Los destinos usan los recursos del espacio activo; falta resolver avisos de otro espacio con permisos y estados de carga/error explícitos.
4. **Historial/detalle:** el nuevo resumen diario permite consultar el día, pero no reproduce todos los subtotales y grupos del DaySheet móvil. Las solicitudes y eventos se probaron con reglas puras; faltan pruebas de interfaz con casos reales o fixtures de integración.
5. **Validación entre dispositivos:** guardar/cobrar/pagar, concurrencia, fallos del servidor y notificaciones push siguen sin probarse. El código móvil corregido está publicado por OTA, pero su recepción y ejecución en el teléfono no se han confirmado.

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

### Validación local

- `test:detected-movement-undo` ejecuta la migración real en [Postgres en memoria mediante PGlite](https://pglite.dev/docs/), con fixtures de RLS, FK, divisiones, rechazos, permisos, fallos a mitad de operación y reintentos. Compara byte a byte el SQL y el contrato puro de ambos repositorios. No lee credenciales ni abre conexiones remotas.
- Pasaron build/TypeScript web, `test:detected-movement-parity`, `test:notification-parity`, `test:movement-save`, `test:parity` y el test SQL. Typecheck móvil y 19 pruebas Jest en dos suites de detecciones pasaron; no se ejecutó Jest completo.
- PGlite tiene una sola conexión: estas pruebas no certifican contención real entre dos sesiones, triggers completos del entorno desplegado ni la interfaz en teléfonos. No se guardaron o borraron registros reales.
- Se añadió PGlite solo como dependencia de desarrollo. `npm audit` informa 20 vulnerabilidades en otras dependencias (ninguna atribuida a PGlite); no se aplicaron actualizaciones automáticas fuera del alcance de esta unidad.
- La migración está en ambos repositorios, documentada en sus diccionarios. El diccionario móvil está ignorado por Git; se conserva localmente y la nota pública está en `DarkMoneyApp/docs/DETECTED-MOVEMENT-UNDO-2026-10-09.md`, sin forzar la publicación del diccionario privado.
- Al cerrar la implementación inicial, la migración aún no se había desplegado. El despliegue posterior autorizado se documenta abajo; móvil sigue sin actualización OTA y no hay paridad total.

### Despliegue autorizado: 9 de octubre de 2026

- Se aplicó únicamente `202610090002_detected_movement_undo.sql` al proyecto enlazado compartido por web y móvil. Se usó un directorio temporal con el historial remoto y solo esta migración nueva: el dry-run mostró exactamente ese archivo. No se incluyeron las migraciones locales pendientes de Suscripciones e Ingresos fijos ni se reparó el historial remoto.
- Antes del despliegue se comprobaron las columnas requeridas, los contratos previos de membresía, PRO y conciliación, RLS activo y los triggers existentes. La función PRO admite `auth.uid()` como argumento por defecto.
- Después se verificó la entrada `202610090002 / detected_movement_undo` en el historial, sus seis sentencias y que los cuerpos de ambas funciones coinciden con el SQL local de los dos repositorios. Una segunda simulación indicó que el directorio aislado ya estaba al día; eso no significa que todas las migraciones locales de web estén desplegadas.
- Se confirmó `security invoker` para Deshacer, `security definer` solo para el helper de lectura, `search_path` vacío en ambos, ejecución permitida a `authenticated` y denegada a `anon` y PUBLIC.
- Las comprobaciones remotas fueron lecturas de esquema, permisos e historial, sin invocar Deshacer ni acceder a registros financieros. La migración define funciones y permisos; no ejecuta borrados o registros por sí misma.
- Sigue pendiente la validación con fixtures de integración, contención entre dos sesiones y dispositivos reales. No se publicó OTA. El teléfono con el cliente anterior no incorpora el nuevo flujo atómico por desplegar solo SQL.

### Actualización móvil disponible: 11 de octubre de 2026

- Se publicaron Deshacer y el conteo completo de la campana desde una copia aislada, sin las ediciones locales en curso. Typecheck, cinco pruebas del validador OTA y 88 casos en diez suites móviles pasaron. Se actualizó un mock desfasado del hook de revisión y se probaron Deshacer tras cambiar de espacio y el fallo después de cerrar la revisión.
- Una publicación concurrente del Asistente y su corrección de errores de revisión incluía estos commits. Se dejó de publicar la versión anterior para no reemplazar esos cambios; se comprobó la disponibilidad de la versión posterior en los tres runtimes: 1.0.10, 1.0.9 y 1.0.8, para iOS y Android.
- Los seis paquetes servidos por Expo conservan 63 recursos y 32 fuentes. Sus bundles de código pasan la verificación SHA-256 del manifiesto y contienen la RPC de Deshacer. No se invocó esa RPC en producción ni se alteraron registros financieros.
- En la comprobación agregada de logs aún no había arranques registrados con esos seis IDs. Publicado no significa instalado ni probado en el teléfono. La prueba entre dispositivos y los demás pendientes de paridad continúan abiertos.
- Grupos finales y detalle de la publicación en `DarkMoneyApp/docs/DETECTED-MOVEMENT-UNDO-2026-10-09.md`. Los paquetes de la copia aislada se retiraron; se conservan los commits y las OTAs publicadas.
- Comprobación final: TypeScript web y móvil pasan; las diez suites móviles ejecutadas por rutas explícitas pasan 90 casos sobre la versión actual. No se ejecutó Jest completo ni una prueba financiera real entre dispositivos.

## Continuación: omisiones de la lista web, 13 de octubre de 2026

- La lista usa las mismas acciones funcionales del móvil: Omitir una detección, Omitir todos con confirmación y Deshacer. En escritorio la acción de fila tiene etiqueta visible; no se añadió un gesto móvil obligatorio ni una tarjeta anidada.
- La confirmación captura las detecciones que se estaban mostrando. Un refresco posterior no amplía el conjunto. Cancelar o Escape no envían ninguna escritura. Un bloqueo inmediato evita dos solicitudes antes del siguiente render.
- Omitir todos conserva los avisos y su estado de lectura. Omitir una fila intenta marcar su aviso leído, igual que móvil; un fallo de lectura no revierte la omisión ya guardada. No se crean o borran movimientos ni se cambian saldos.
- Las actualizaciones filtran usuario, espacio, IDs, estado original y ausencia de movimiento vinculado. Se comprueba PRO para correos. Los lotes se limitan a 250 para que el servidor no recorte los IDs devueltos; se informa de fallos parciales o registros que cambiaron. Ante una respuesta incierta, se pide actualizar antes de reintentar y no se promete que no haya ocurrido una escritura.
- Solo se ofrece Deshacer para cambios confirmados. Recupera el estado original, incluido `needs_review`, con una condición sobre el estado omitido y su `updated_at`. No reabre una detección registrada después, vinculada o modificada desde la omisión. Deshacer no cambia la lectura de los avisos.
- La acción conserva su espacio original y sobrevive a cerrar la lista. Si se cambia de espacio, no escribe desde el aviso antiguo. La confirmación se reinicia al cambiar usuario/espacio. Deshacer espera si hay otra omisión en curso, en lugar de perder la acción del aviso. La caché de pendientes solo se modifica con filas confirmadas y luego se vuelve a consultar.

### Pruebas de esta unidad

- `test:detected-movement-parity`: siete escenarios adicionales con cliente Supabase simulado (llegadas posteriores, registro concurrente, Deshacer antiguo, recuperación de `needs_review`, otros usuarios/espacios, fallos parciales, PRO, lectura fallida y 501 filas). También extrae y ejecuta `mapSuggestion` y la función real `useDetectedMovementOmissionsMutation` del código móvil, con hooks/cliente simulados, para comparar omitir/recuperar y lectura. No verifica su UI ni la caché móvil completa.
- `test:detection-inbox-ui`: renderiza el componente web, Modal y botones reales con React/JSDOM; simula consultas, mutaciones, avisos y cola de Deshacer. Verifica confirmación congelada, Escape, pulsaciones repetidas, recuperación después del desmontaje y bloqueo al cambiar de espacio. JSDOM se obtiene del entorno Jest móvil ya instalado; esta prueba requiere el repositorio móvil vecino, igual que la comparación de paridad. No se añadieron dependencias de producción.
- Pasaron `npm run build`, `test:notification-parity`, `test:detected-movement-undo`, `test:detected-movement-parity`, `test:detection-inbox-ui` y `test:parity`. No se abrieron detecciones reales: la consulta preexistente de pendientes ejecuta conciliación y puede actualizar estados canónicos.
- No se modificó ni publicó código móvil, no se desplegó SQL y se preservó el trabajo offline y las ediciones de Suscripciones en curso. Sigue pendiente la verificación visual en navegador, el servidor real y dos dispositivos; no hay paridad total.

## Continuación: aprendizaje personal en revisión web, 13 de octubre de 2026

- Web replica la función pura de historial del móvil: reconoce variantes del comercio, exige repetición y coherencia para hábitos, respeta correcciones recientes y reconoce referencias bancarias confirmadas. No usa importes ni tipos de cambio para adivinar cuentas.
- Las consultas se limitan al usuario y espacio: movimientos aplicados del propio autor, sin ediciones de otro miembro, y detecciones resueltas del mismo usuario. Los registros antiguos sin autor solo se admiten si se verifica un espacio personal con ese propietario como único miembro. Si falla esa verificación no se atribuyen registros antiguos. Las referencias de conciliación automática, omitidas o sin movimiento vivo no aportan evidencia.
- El formulario compartido recibe propuestas tardías sin remontarse ni reiniciar monto, descripción o fecha. Una elección manual, incluida dejar cuenta/categoría/destino vacío, tiene prioridad. Al desaparecer evidencia se retira la selección automática según la misma regla móvil; una referencia bancaria desconocida no se reemplaza por el default de la app.
- Se muestra «Según tus movimientos anteriores» solo si un valor coincide con la propuesta y no fue elegido manualmente. Un fallo de consulta se informa y permite reintentar o seguir con selección manual. Al guardar se conserva `detectionLearning` con la descripción/tipo/banco originales, las referencias y los campos elegidos manualmente; abrir el formulario no escribe aprendizaje ni movimientos.
- Hallazgo de la prueba: el selector de destino de una transferencia detectada reutilizaba la restricción de moneda del origen. Ahora el origen conserva la moneda detectada y el destino admite otra moneda, excluyendo el mismo origen. Al proponer/cambiar la pareja se usa la tasa persistida más reciente (directa, inversa o vía moneda base); sin tasa no se inventa un importe de llegada. Editar el monto conserva la tasa, sin recalcularla desde un importe ya redondeado. Las cuentas/categorías archivadas o incompatibles no se proponen.
- El historial se consulta de nuevo al abrir/enfocar la revisión, se refresca cada minuto mientras está habilitado y se invalida al resolver una detección o modificar recursos del espacio. No se añadió una consulta canónica de conciliación nueva ni un nuevo endpoint.

### Pruebas y límites

- `test:detection-learning` ejecuta las 15 pruebas puras originales del móvil contra cada implementación (30 ejecuciones), compara 135 combinaciones con `applyPersonalProposal` real y 16 conversiones con `resolveExchangeRate` real. También compara las consultas y sus filtros con `fetchDetectionLearning` móvil, incluidas autoría, editor, espacio compartido, legacy y fallos de lectura.
- Renderiza el `QuickMovementDialog` real, con hooks de red y selectores/paneles secundarios simulados: llegada tardía, retractación, elección manual igual al default, campos vacíos, categoría manual, comprobante desconocido, moneda incompatible, transferencia y cambio de importe, conflicto origen/destino, metadata de guardado y formulario ordinario sin aprendizaje de detecciones. No certifica el diseño de los selectores simulados ni la interfaz móvil.
- Pasaron `npm run build` (incluye TypeScript), `test:detection-learning`, `test:movement-save`, `test:detected-movement-parity`, `test:detection-inbox-ui`, `test:detected-movement-undo`, `test:notification-parity` y `test:parity`. El test usa JSDOM/Jest y código de referencia del repositorio móvil vecino, sin nuevas dependencias.
- No se modificó móvil, no se publicaron OTA ni migraciones, y no se abrió ni guardó una detección real. Falta la verificación visual con fixtures, políticas/datos del servidor real y dos dispositivos. Aprendizaje personal implementado y probado localmente no equivale a paridad total.

## Continuación: verificación IA de duplicados en web, 13 de octubre de 2026

- Se integró el contrato existente `movement-duplicate-ai-check`, sin crear ni desplegar otra función. Solo se invoca al pedir Guardar, si existe una coincidencia y el acceso PRO local está habilitado; el endpoint conserva su validación de acceso y cuota. Abrir la revisión no consulta esta IA. El cuerpo usa los mismos campos que la revisión móvil, incluida la descripción original y los conteos del día.
- Se siguió el hook móvil actual, no el helper headless antiguo: únicamente `distinct` deja continuar el guardado que ya pidió el usuario. `duplicate`, `skipped`, `unknown`, fallo de red, respuesta inválida o timeout dejan la decisión manual, sin omitir ni cerrar automáticamente. Se conserva «Es el mismo movimiento», «Es otro; permitir guardar» y se añade «Ver movimiento». Un fallo de consulta del ledger bloquea Guardar; no se interpreta como ausencia de duplicados.
- El candidato ya no depende de las últimas 50 filas del snapshot. La consulta usa cuenta, tipo, importe, Aplicado y espacio del movimiento; se pagina en bloques de 500 y respeta el día de Perú. Ingresos usan la cuenta/importe de destino y las transferencias verifican ambos lados. Un candidato incierto de conciliación también debe cumplir ese contrato financiero.
- Las señales de detección se limitan al mismo usuario, espacio, moneda, tipo y día, excluyendo omitidas y duplicadas. Los tres conteos salen de `COUNT exact` del servidor, incluido el número de registradas; no dependen de las filas devueltas. Una consulta fallida o evidencia inconsistente deja revisión manual, en vez de enviar conteos ficticios a la IA.
- El timeout de IA es de 8 segundos, con cancelación y limpieza del temporizador. Editar el borrador o salir/cambiar el alcance cancela la comprobación. La autorización «Es otro» está ligada tanto al borrador como al candidato concreto; no autoriza otra coincidencia que aparezca después. Tras `distinct` se vuelve a leer el candidato; el store vuelve a leer la versión canónica de la detección antes de crear. Estos controles no sustituyen una transacción ni prueban locking entre dispositivos.

### Hallazgos móviles que no se copiaron a web — siguen pendientes

`DarkMoneyApp/services/queries/notification-detection.ts` sigue usando el día UTC en `findPossibleDuplicateMovement` y `countSameDayDetectionSignals`, a diferencia de la conciliación SQL y las listas en hora de Perú. La comparación reproduce el caso de un movimiento a las 23:50 de Perú que web encuentra y esa consulta móvil no encuentra. También limita la búsqueda a 10 candidatos antes de comparar descripción, no comprueba el segundo lado de una transferencia en esa búsqueda y suma señales sin filtrar moneda/tipo/estado. El número de registradas se calcula desde las filas devueltas, por lo que puede truncarse si el servidor limita el resultado. Los errores de los conteos no se comprueban en ese helper móvil.

No se modificaron esos archivos móviles en esta unidad ni se publicó OTA. Por estas diferencias verificadas no se puede marcar paridad total del comprobador, aunque web ya tenga la misma función IA y decisión manual del móvil. Deben corregirse y probarse como una unidad móvil separada, preservando su refactor offline en curso.

### Pruebas y límites

- `test:detection-duplicates` extrae y ejecuta las funciones reales móviles de búsqueda, conteos y llamada IA; compara el parser, los veredictos y el cuerpo del endpoint para casos coincidentes. Reproduce explícitamente el defecto UTC en vez de ocultarlo con una referencia reescrita.
- Cliente simulado: candidato después de 510 filas, 1,105 registradas, señales de otras monedas/usuarios/espacios/estados, ingresos, transferencias, permisos antiguos, falta de PRO, fallos, timeout, respuesta tardía, cancelación, candidato editado y detección resuelta/editada durante la espera. Renderiza la revisión web real y su mutación React Query con formulario y límites de red simulados, incluidas la autorización manual y la cancelación por edición/desmontaje.
- Pasaron TypeScript/build, `test:detection-duplicates`, `test:detection-learning`, `test:detected-movement-parity`, `test:detection-inbox-ui`, `test:detected-movement-undo`, `test:notification-parity`, `test:movement-save` y `test:parity`. No se añadieron dependencias; la prueba requiere el repositorio móvil vecino con su JSDOM instalado.
- No se invocó la IA real ni se abrió la bandeja real, no se guardaron movimientos ni se modificaron avisos, y no se desplegó SQL/funciones ni OTA. La cuota/acceso y el estado remoto del endpoint no se verificaron en producción. Siguen pendientes el navegador con fixtures, contención real y dos dispositivos.

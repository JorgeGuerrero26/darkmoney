# Continuación exclusiva de web — 14 de octubre de 2026

El usuario delegó móvil a otro desarrollador. Esta continuación no modifica ese repositorio ni despliega SQL/OTA/web. Las pruebas financieras son locales con fixtures.

## Suscripciones: cierre del trabajo local

- El detalle consume `subscriptionStandingCopy`: sin cobros pendientes no anuncia una fecha vencida junto a «Al día»; calcula próxima fecha, días y etiqueta coherente. Con ocurrencias pendientes usa sus importes; sin historial conserva la estimación por cadencia. Pausadas/canceladas mantienen su estado.
- El resumen del filtro consume `summarizeSubscriptionsMonthly`: solo activas, frecuencia e `intervalCount`, personalizada por días y conversión válida a moneda base. Las que carecen de tasa no suman y se declaran aparte, sin relabelar moneda nativa.
- `test:subscription-parity` prueba casos de estado/fecha y compara 30 combinaciones de frecuencia/intervalo más resúmenes mixtos con las funciones móviles reales, sin importaciones nativas ni escrituras móviles. También pasan recibos de suscripción y TypeScript web.
- Los cambios se cierran como unidad de Suscripciones, no como paridad total de toda la aplicación.

## IA de coincidencias divididas

- Se mantiene el endpoint y el contrato móvil `movement-duplicate-ai-check`, sin modificarlo ni desplegarlo. Al revisar su fuente, se confirmó que consume la evidencia del cliente y no recalcula sus propios conteos de filas.
- La web suministra candidato por cabecera/total nativo y `sameDayMatchingMovements` como número de recibos completos del mismo total, no número de partes. Los otros dos conteos siguen siendo señales canónicas exactas, acotadas por usuario/espacio/tipo/moneda/día.
- Solo PRO y con candidato/evidencia válidos llama IA. Error/límite/veredicto desconocido exige confirmación manual. Un `distinct` obliga a releer grupos completos y comparar huella antes del registro atómico. No se consumió DeepSeek real en las pruebas.
- Las pruebas de división web añaden veredictos, totales/conteos enviados, evidencia fallida y una parte modificada durante IA. La regresión del comprobador simple conserva sus pruebas móviles reales y timeout/cancelación.

## Asistente y resumen IA

- Ruta real `/app/assistant`, navegación y destino de `assistant_insight` mediante `noticeId` y lectura canónica por usuario. Ignora URLs y parámetros arbitrarios de preguntas. El aviso prepara el texto pero nunca envía automáticamente el prompt; los avisos antiguos no identifican espacio y exigen selección explícita.
- Consulta manual al contrato `assistant-chat`, PRO y contexto/historial acotados como servidor móvil (4000 caracteres de pregunta, 16 turnos, 3000 caracteres por turno). Doble envío bloqueado, cancelación y respuestas antiguas no invaden otro espacio/usuario. El servidor mantiene la cuota y las herramientas de preferencias personales; no se invocó en pruebas.
- Evidencia abre movimientos internos. Borradores se muestran como sugerencias **sin registrar**, con enlace al módulo para revisión manual: no se ejecutan comandos ni herramientas provenientes de la respuesta. La conversación web es efímera; no hay voz ni gestión/persistencia de múltiples chats equivalente a móvil en esta unidad.
- Explicaciones del dashboard aisladas por usuario/espacio/moneda. El caché antiguo solo preserva uso diario, no entrega su texto en otro contexto. Petición cancelable y validación de respuesta; las tardías no contaminan el caché nuevo.
- El resumen distingue saldo líquido convertible de patrimonio, declara conversiones ausentes e indicadores no disponibles en vez de inventarlos. **Nueva diferencia verificada:** el móvil actual usa proyección de caja líquida y su motor nuevo; web aún calcula el cierre desde patrimonio. El payload declara `projectionBasis: net_worth`. No se certifica equivalencia de esa aritmética ni se cambia el motor móvil. Hace falta portar/auditar el motor actual del dashboard como otra unidad.
- `test:web-assistant` ejecuta página/servicio/contrato reales con I/O simulado, selección/enviar explícitos, alcance canónico, historial, borradores/evidencia, caché y respuesta tardía. Sin consumo de cuota IA ni consultas financieras remotas.

## Solicitudes y eventos de créditos/deudas

- Se extrae el flujo real de apertura a `useObligationNotificationOpening`, usado por la página: espera snapshot/lecturas correctas, mantiene el enlace ante error, consume una apertura una sola vez, valida recurso/solicitud/evento y no acepta acciones al enfocar.
- Los formularios reales de abonos y solicitudes de editar/eliminar usan un bloqueo inmediato de confirmación y muestran errores conservando edición/motivo. Los seis callbacks de página ya propagan el fallo, en vez de resolver y hacer cerrar el formulario. Rechazan sesión/espacio y recurso que dejó de pertenecer al contexto.
- Registrar movimiento exige cuenta activa del espacio y moneda; la inexistencia de cuentas no se transforma automáticamente en «sin movimiento». El usuario puede optar explícitamente por no registrarlo. Solicitudes ajenas/resueltas no abren el formulario de aceptación. Las listas de revisión usan líneas y colores neutros, sin tarjetas anidadas ni bordes azules/ámbar.
- `test:obligation-notification-ui` ejecuta hook de apertura, formularios y callbacks originales extraídos de la página (solo transporte simulado): espera/error, espacio/snapshot antiguo, solicitudes inexistentes, abono/edición/eliminación, foco sin aceptar, fallo y reintento, dos clics, motivo de rechazo y cuenta inválida sin fallback silencioso. No monta el dashboard financiero entero de la página ni prueba RLS/servidor/dispositivos.

## Pendientes de entrega y alcance

La entrega de SQL sigue coordinada con móvil y no se publicó web. Faltan servidor/dispositivos, no autorizados para operaciones financieras en esta ejecución. El motor actual de proyección móvil requiere nueva auditoría/port web, y las herramientas avanzadas de Asistente no tienen paridad completa. Estas unidades cierran los cambios concretos descritos, no la paridad total de toda la aplicación.

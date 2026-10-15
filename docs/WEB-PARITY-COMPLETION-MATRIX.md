# Cierre de paridad web — seguimiento activo

Objetivo completo: paridad funcional/financiera de web con los módulos móviles tratados en esta auditoría. No basta que compile ni que coincidan dos capturas. No se modifica móvil (tiene otro responsable), no se despliega SQL ni se usan registros remotos para pruebas sin nueva autorización.

## Estado al 15 de octubre de 2026

| Área / requisito | Evidencia disponible | Trabajo o gate todavía abierto |
| --- | --- | --- |
| Movimientos: fechas, tipos, importes, formularios, IA de categoría, comprobantes y divisiones detectadas | Suites de guardado, sugerencias, detección/duplicados/división, enlaces de notificaciones. Cambios previos en commits locales. | Auditar que todos los caminos actuales consuman esas reglas; RPC/vistas nuevas siguen sin despliegue coordinado. |
| Cuentas, Créditos/deudas, Suscripciones, Ingresos fijos, Presupuestos, Categorías, Contactos | Suites específicas locales y auditorías anteriores. Solicitudes y cobertura del plan se revalidaron contra callbacks/SQL móviles. | Revisar contratos actuales por módulo, no inferir cobertura total desde una suite parcial. Servidor/dispositivos no probados. |
| Notificaciones, campana y destinos avanzados | Pruebas de destinos, día, solicitudes, gating y UI locales; sin consumir bandeja real. | Consolidar auditoría por cada tipo de aviso y camino de acción. |
| Dashboard: caja, cierre, ventanas, salud | `test:dashboard-cashflow`, `test:dashboard-health`, callbacks móviles reales y paneles conectados a Inicio. | Diferencias móviles documentadas (custom, tarjeta FX, perspectiva compartida, paginación); falta validar entrega real. |
| Dashboard: concentración y estacionalidad | Modelo/panel nuevos; `test:dashboard-readings` ejecuta selectores y callbacks móviles. | Resto del dashboard avanzado por inventariar: Historial anual/factores, patrones/anomalías/sugerencias, horizonte de flujo/escenarios/optimización y explicaciones por pestaña. No se considera cerrado todo Dashboard. |
| Asistente: consulta, evidencia, avisos, límites, aislamiento y conversaciones | Página/servicio/contrato reales en `test:web-assistant`; IA de Inicio explícita en `test:dashboard-health`; modelo móvil y página real en `test:assistant-chats`; revisión de ingreso/gasto/transferencia en `test:assistant-drafts`. | Formularios de pagos, presupuesto, crédito/deuda y recurrentes; capacidades de voz. Movimientos ya tiene formulario prellenado, confirmación y resultado recordado durante el chat actual. |
| Configuración y formularios compartidos | Rediseños previos. | Revisión final del alcance, preferencias y permisos actuales contra móvil. |
| Entrega | Commits locales por unidad; compilación y pruebas de código. | Publicación web/SQL coordinada con móvil, versión instalada y pruebas multiusuario/Storage/red real. No autorizadas aquí para operaciones financieras. |

## Concentración y estacionalidad

- Se consume el historial nativo completo/paginado, no importes de gráficos relabelados. HHI usa participaciones de salidas aplicadas por categoría del mes actual, con mismos umbrales y orden de desempate que el selector móvil. Las conversiones ausentes impiden calcular un porcentaje sobre una parte del total.
- La lectura estacional conserva el contrato móvil: mes actual hasta hoy frente al mismo mes completo del año anterior. La pantalla declara las fechas y la diferencia de duración. No afirma «mejoró» por gastar menos en medio mes.
- Se necesitan tres movimientos **aplicados de flujo real** del mes anterior de referencia; registros anulados, planeados o correcciones no acreditan historial. Es más estricto que el callback móvil, que cuenta filas antes de comprobar estado. Sin referencia/FX no se presenta delta.
- `test:dashboard-readings` compara selectores/callbacks originales, HHI y umbrales, cortes, fechas bisiestas, ausencia de datos, registros no aplicados, conversiones faltantes y panel real en JSDOM. No prueba navegador real ni servidor.

La matriz se mantiene abierta hasta verificar cada requisito. Los informes cronológicos (`RESOURCE-PARITY-AUDIT`, `WEB-PARITY-CLOSURE`, `WEB-CASHFLOW-FINDINGS`, `WEB-HEALTH-PARITY`) aportan casos y límites, no certifican por sí solos el estado de producción.

## Conversaciones del Asistente

Se porta el modelo puro móvil (20 conversaciones, 40 mensajes de texto por conversación, título automático/personalizado, búsqueda sin tildes, renombrado sin alterar orden y eliminación). La persistencia web usa una clave por usuario y espacio; no se mezclan contextos. Reabrir/seleccionar restaura solo texto y rol, nunca evidencia ni borradores financieros. Abrir un aviso prepara una conversación nueva y no lo envía automáticamente.

La página incorpora listado, búsqueda, editor de nombre y eliminación confirmada que no borra registros financieros. Una lectura corrupta se conserva sin sobrescribir; si el navegador bloquea guardado se avisa y la sesión sigue en memoria. Cancelar una pregunta libera la interfaz y una respuesta tardía no invade otro usuario, espacio, chat o consulta.

`test:assistant-chats` compara funciones móviles reales y ejecuta hook/panel/página web: límites, títulos, persistencia, restauración solo de texto, búsqueda, renombrado, confirmación de eliminación, almacenamiento roto/bloqueado, reintento y cancelación. El transporte de IA está simulado; no hay cuota ni dinero reales. Se añade a `test:web-assistant`. Esto cierra conversaciones, no herramientas de borradores ni voz ni todo el Asistente.

## Borradores de Movimientos del Asistente

Ingreso, gasto y transferencia abren el **mismo `QuickMovementDialog`** utilizado por Movimientos, con datos prellenados y guardado explícito. La IA no elige IDs ni ejecuta URLs: los nombres se resuelven de forma exacta, única y sobre cuentas activas del espacio y moneda actuales. Las ambigüedades quedan sin asignar. Una fecha futura respecto al calendario de Lima empieza como planeada. Los pagos de suscripciones/deudas conservan su destino específico y aún no se consideran herramientas de registro implementadas.

La identidad de registro es estable por propuesta/turno, no un hash global que suprima dos gastos legítimamente iguales. Un doble envío se comparte; tras un error de red solo se reintenta el mismo registro con la misma clave. No se permite modificar una instrucción de resultado incierto ni confundir un `AbortError.code` con rechazo SQL. Una confirmación incluye ID y los importes **editados y guardados**, distintos de los propuestos. Guardado/descartado/sin confirmar se incorporan al siguiente contexto del chat sin perderse por truncamiento del texto. Se mantiene la restauración solo de texto: las acciones no reaparecen al reabrir el chat.

`test:assistant-drafts` ejecuta la página, la revisión y el formulario compartido reales con I/O ficticia: prellenado, resolución y fechas, no guardado automático, envío duplicado, cambio de importe, ingreso/transferencia, fallo de comprobante sin repetir el movimiento, rechazo/resultado incierto, reapertura con la identidad original, cambios de usuario/espacio/Pro y refresco sin perder campos. No verifica servidor, Storage, RLS ni un navegador/dispositivo real. No se modificó móvil.

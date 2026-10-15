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
| Asistente: consulta, evidencia, avisos, límites y aislamiento | Página/servicio/contrato reales en `test:web-assistant`; IA de Inicio explícita en `test:dashboard-health`. | Varias conversaciones persistentes, nombres/búsqueda/eliminación, formularios prellenados y confirmación de borradores, resultado recordado por turno y capacidades de voz. |
| Configuración y formularios compartidos | Rediseños previos. | Revisión final del alcance, preferencias y permisos actuales contra móvil. |
| Entrega | Commits locales por unidad; compilación y pruebas de código. | Publicación web/SQL coordinada con móvil, versión instalada y pruebas multiusuario/Storage/red real. No autorizadas aquí para operaciones financieras. |

## Concentración y estacionalidad

- Se consume el historial nativo completo/paginado, no importes de gráficos relabelados. HHI usa participaciones de salidas aplicadas por categoría del mes actual, con mismos umbrales y orden de desempate que el selector móvil. Las conversiones ausentes impiden calcular un porcentaje sobre una parte del total.
- La lectura estacional conserva el contrato móvil: mes actual hasta hoy frente al mismo mes completo del año anterior. La pantalla declara las fechas y la diferencia de duración. No afirma «mejoró» por gastar menos en medio mes.
- Se necesitan tres movimientos **aplicados de flujo real** del mes anterior de referencia; registros anulados, planeados o correcciones no acreditan historial. Es más estricto que el callback móvil, que cuenta filas antes de comprobar estado. Sin referencia/FX no se presenta delta.
- `test:dashboard-readings` compara selectores/callbacks originales, HHI y umbrales, cortes, fechas bisiestas, ausencia de datos, registros no aplicados, conversiones faltantes y panel real en JSDOM. No prueba navegador real ni servidor.

La matriz se mantiene abierta hasta verificar cada requisito. Los informes cronológicos (`RESOURCE-PARITY-AUDIT`, `WEB-PARITY-CLOSURE`, `WEB-CASHFLOW-FINDINGS`, `WEB-HEALTH-PARITY`) aportan casos y límites, no certifican por sí solos el estado de producción.

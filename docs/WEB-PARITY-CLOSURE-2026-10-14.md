# Continuación exclusiva de web — 14 de octubre de 2026

El usuario delegó móvil a otro desarrollador. Esta continuación no modifica ese repositorio ni despliega SQL/OTA/web. Las pruebas financieras son locales con fixtures.

## Suscripciones: cierre del trabajo local

- El detalle consume `subscriptionStandingCopy`: sin cobros pendientes no anuncia una fecha vencida junto a «Al día»; calcula próxima fecha, días y etiqueta coherente. Con ocurrencias pendientes usa sus importes; sin historial conserva la estimación por cadencia. Pausadas/canceladas mantienen su estado.
- El resumen del filtro consume `summarizeSubscriptionsMonthly`: solo activas, frecuencia e `intervalCount`, personalizada por días y conversión válida a moneda base. Las que carecen de tasa no suman y se declaran aparte, sin relabelar moneda nativa.
- `test:subscription-parity` prueba casos de estado/fecha y compara 30 combinaciones de frecuencia/intervalo más resúmenes mixtos con las funciones móviles reales, sin importaciones nativas ni escrituras móviles. También pasan recibos de suscripción y TypeScript web.
- Los cambios se cierran como unidad de Suscripciones, no como paridad total de toda la aplicación.

## Pendientes de esta continuación

Asistente (`assistant_insight`, contexto y resúmenes), pruebas reales de interfaz de solicitudes/eventos y comprobación IA de recibos divididos. Entrega de SQL sigue coordinada con móvil; falta integración y validación remota/dispositivos, no autorizadas en esta ejecución.

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

## Pendientes de esta continuación

Asistente (`assistant_insight`, contexto y resúmenes) y pruebas reales de interfaz de solicitudes/eventos. Entrega de SQL sigue coordinada con móvil; falta integración y validación remota/dispositivos, no autorizadas en esta ejecución. La sección nueva de IA actualiza el límite de confirmación manual del informe anterior; no certifica el servidor desplegado ni paridad total de toda la bandeja.

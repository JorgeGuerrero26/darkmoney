# Salud del dashboard web — 15 de octubre de 2026

Continuación exclusiva de web. Fuente móvil consultada en modo lectura, HEAD local `9f0c2ecb`. Sin publicación, SQL, OTA, consumo real de IA ni operaciones financieras remotas.

## Qué queda implementado

- `buildDashboardHealth` consume movimientos nativos del snapshot web paginado, seis meses terminados y el mes en curso por separado. Los ajustes y las descripciones antiguas «Corrección · …» no cuentan como ingresos ni gastos.
- La nota compartida de salud recibe ingreso/neto medios de meses completos con actividad y la caja líquida del motor de proyección. Ya no depende del selector semanal/mensual del gráfico.
- Ahorro histórico = ahorro total / ingreso total, no media simple de porcentajes. Un mes con gasto y sin ingresos también reduce el total. La cifra actual aparece aparte; no entra en la media de meses terminados.
- Reserva = caja / gasto mensual medio histórico; si ese gasto es cero usa últimos 30 días. La lectura adicional con compromisos usa salidas del calendario 30 días. **Salud usa gasto medio real; proyección usa mediana discrecional con exclusiones: son definiciones distintas, identificadas en pantalla.**
- Estabilidad de ingresos: CV de seis meses completos, incluidos meses en cero, y mínimo tres meses con ingresos. Mismos umbrales que el callback móvil.
- Cobros resueltos: obligaciones desde la perspectiva del usuario, con vencimiento en los últimos 30 días y estado `paid` / total con vencimiento en esa ventana. Es conteo de registros, **no porcentaje del monto cobrado ni prueba de puntualidad**.
- Deuda/ingreso = saldo pendiente de obligaciones activas por pagar / ingreso mensual medio histórico. No se presenta como porcentaje de cuota mensual. Las ayudas se actualizan y los textos de umbrales ya no dicen «más de 20%» cuando el valor es 10%, ni «más de seis meses» para tres meses.
- El panel real de Inicio incorpora filas de reserva, ahorro, estabilidad, deuda, vencimientos y cobros, con tabla de meses verificable. Reemplaza la antigua tarjeta de reserva; no añade una copia de ese dato.
- Datos ausentes o no convertibles no generan nota favorable por defecto. La falta de historial, ingreso o referencia de gasto oculta la nota. Los indicadores afectados por FX se dejan sin valorar y se explica qué falta. Una lectura fallida de obligaciones compartidas no se interpreta como «sin deuda» o «sin cobros».

## IA visible y contexto coherente

La página retornaba la vista actual antes del bloque antiguo de IA, dejándolo inaccesible. Se comparte el mismo panel entre ambas ramas y se ofrece en Inicio bajo «Explicar mi situación con IA», solo con acceso Pro confirmado.

Abrir el desplegable o cambiar tono no envía nada. Solo Generar llama al endpoint existente; el servidor mantiene autenticación/cuota/Pro. El panel no registra movimientos. Se retiraron luces, degradados y bordes de color decorativos: superficie y controles neutros del sistema actual.

El payload envía reserva, cobros y estabilidad reales cuando están disponibles, ahorro actual en `savingsRatePct` y media histórica en `savingsAveragePct`. Declara conversiones e indicadores desconocidos como tales, sin convertirlos en cero. El mes actual sin conversión no produce un `monthStatus` inventado. Se versiona el caché de texto para descartar interpretaciones del motor de salud anterior, conservando el contador diario de uso.

## Diferencia deliberada de perspectiva

En el móvil actual, el callback de `healthInputs` filtra `direction === payable`, dirección guardada desde el dueño, incluso en compartidas. Su propia proyección y su eficiencia de cobros sí usan `obligationViewerDirection`.

Web usa esa misma perspectiva en los tres. Caso de prueba: deuda propia S/ 600, crédito compartido de S/ 200 que el invitado debe pagar y deuda compartida de S/ 300 que el invitado debe cobrar. Web cuenta S/ 800 por pagar; el callback móvil real cuenta S/ 900. No se cambió móvil ni se copió esa inversión para aparentar paridad.

La ausencia de referencia también se declara de forma más estricta: sin gasto no se muestra «0 días / Corto», y sin ingresos/referencia no se presenta una nota calculada con los mejores supuestos neutrales del paquete compartido.

## Pruebas y límites

`test:dashboard-health` ejecuta los callbacks `useMemo` originales extraídos de `AdvancedDashboard.tsx`, con reloj e I/O locales, y los helpers móviles reales. Compara base, ahorro histórico/actual/tendencia, reserva/compromisos, estabilidad, cobros e inputs de nota; prueba aparte la corrección de perspectiva compartida.

Cubre huecos, correcciones, estados, movimientos futuros, mes sin ingreso, media ponderada, FX directo/inverso/ausente, lecturas pendientes/fallidas, texto de umbrales y panel real en JSDOM. Ejecuta también el handler original de Generar de la página con transporte simulado, incluido bloqueo sin Pro/sin datos, y el panel real: abrir/renderizar no genera consulta, Generar sí, y cuota/datos incompletos deshabilitan el envío. `test:web-assistant` conserva el aislamiento del caché y prueba los campos nuevos sin IA real.

No es prueba visual en navegador ni validación servidor/dispositivos. No se certifica paridad total: quedan la concentración/estacionalidad y otros análisis avanzados del dashboard, herramientas avanzadas del Asistente, entrega coordinada de SQL y pruebas remotas previamente excluidas por el usuario. Siguen vigentes las diferencias documentadas del calendario en `WEB-CASHFLOW-FINDINGS-2026-10-15.md`.

Verificación de cierre: pasan `npm run build` (TypeScript y Vite), `test:dashboard-health`, `test:dashboard-cashflow`, `test:web-assistant`, `check:dashboard-help`, `test:workspace-sync`, `test:notification-destination`, `test:notification-day` y `test:parity`. El smoke antiguo de paridad no sustituye las nuevas comparaciones del código realmente conectado. Solo aviso no bloqueante de Browserslist antiguo; no se actualizaron dependencias en esta unidad.

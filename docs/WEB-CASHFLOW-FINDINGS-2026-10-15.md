# Dashboard web: calendario de caja — 15 de octubre de 2026

Trabajo exclusivo de web. Sin cambios en fuente móvil, migraciones, datos financieros reales ni publicación.

## Cambio implementado

La web usaba el modelo instalado de `@darkmoney/shared` desde patrimonio y extrapolación variable. El dashboard móvil actual usa `features/dashboard/hooks/useCashflowProjection.ts` y `features/projection/lib/cashflow-calendar.ts`.

La web ahora adapta ese calendario y lo consume en el cierre de mes y las ventanas 7/15/30:

- Caja inicial: cuentas banco, efectivo y ahorros activas, incluso si no suman patrimonio. Inversiones y tarjetas no son caja.
- Historial: seis meses terminados desde el snapshot web paginado completo. Mediana, no promedio; excluye movimientos de suscripciones, pagos/aperturas de obligaciones, compras únicas y cargos de tarjeta del gasto habitual en efectivo. La categoría aporta su tipo por defecto salvo tipo explícito del movimiento.
- Agenda: frecuencia/intervalo/fin de suscripciones e ingresos, cambios de monto programados, cuotas pendientes con pagos reales, obligaciones compartidas desde la perspectiva del invitado, pagos de tarjeta y movimientos planificados con efecto en caja. Los traspasos entre cuentas líquidas no cambian la caja.
- El gasto habitual se prorratea por los días restantes. No se extrapola un ingreso variable inexistente. Las ventanas de compromisos excluyen ese gasto sin fecha, como móvil.
- El detalle, formulario de cobro y proyección web usan el mismo `coverPlan`. Se corrigió su separación por mes inicial del plan: pagos anteriores reducen el principal; no adelantan cuotas pactadas después. La cobertura conserva la fecha del pago que cierra cada cuota.
- El panel incluye las cuatro partes de la suma, las líneas programadas/estimadas y los seis totales históricos. Los importes no convertibles se excluyen con aviso.
- Compras únicas y cambios de ingreso se leen paginados, por espacio, con cancelación y error explícito. Mientras esa lectura o la de obligaciones compartidas falla, no se presenta una cifra de cierre parcial ni se consulta IA. Actualizaciones invalidan este contexto.
- IA recibe base `liquid_cash`, cierre y delta contra esa misma caja. Las explicaciones guardadas antes del cambio de motor no se reutilizan; se conserva el contador diario de uso.
- Se añadió `date-fns` 3.6.0 (la versión local móvil) para no aproximar sus bordes de calendario con helpers distintos.

## Diferencias deliberadas que debe revisar el responsable móvil

No se copia un defecto financiero para obtener igualdad artificial. Estas excepciones impiden certificar igualdad total con el móvil actual:

1. **Cadencia personalizada:** `cashflow-calendar.ts:advance` móvil cae en meses para `custom`; el registro de suscripciones usa días. Caso local: desde 15/10, cada 7 días, web proyecta 15, 22 y 29/10; calendario móvil solo 15/10. Web usa días, coherente con su propio formulario.
2. **Tarjetas en otra moneda:** el hook móvil calcula `typicalMonthlySpend` por tarjeta con `expenseAmt` (ya convertido a moneda visible) y el calendario vuelve a convertirlo desde `card.currencyCode`. Caso local: cargos típicos de USD 60 con USD→PEN 3.7 deben dar S/ 222, no S/ 821.40. Web pasa la mediana de cargos en moneda nativa y convierte una sola vez al generar la línea. El pago de deuda actual también conserva moneda nativa.
3. **Cobertura del historial:** la query móvil de seis meses leída no pagina; el snapshot web sí. No se introdujo el límite de filas de Supabase en web. Con más filas que el límite del servidor ambos historiales podrían diferir; hace falta verificar/corregir el cliente móvil con su responsable.

La referencia es el código local leído en esta sesión; el otro desarrollador sigue avanzando. Su HEAD local consultado durante las pruebas fue `9f0c2ecb`. Esto no certifica el binario publicado ni el servidor.

## Verificación local y límites

`test:dashboard-cashflow` ejecuta motores reales web/móvil con fixtures: 31 comparaciones de las reglas equivalentes (cadencias, intervalos, horizontes, mes corto/bisiesto, cuotas, conversiones, fin de cadencia), helpers de caja/historial/traspasos y cobertura de plan. También compara las listas/ventanas móviles reales. Prueba aparte las dos correcciones deliberadas: no se presentan como casos de paridad.

Ejecuta el adaptador web real y el hook móvil actual (solo se sustituyen las constantes del módulo de queries). Ese caso reproduce caja/mediana/cierre actual iguales y demuestra la doble conversión del pago típico de tarjeta del mes siguiente. También cubre paginación/cancelación/errores/alcance del servicio y panel real en JSDOM. `test:web-assistant` comprueba además que el caché del motor anterior no se muestra. Las pruebas no consumen IA ni escriben dinero. No equivalen a prueba entre dispositivos ni a inspección visual del navegador.

Siguen pendientes indicadores avanzados de salud, herramientas avanzadas del asistente, entrega coordinada de SQL y comprobación servidor/dispositivos. No se certifica paridad total de web.

Verificación final de esta unidad: `npm run build` (incluye `tsc -b`), `test:dashboard-cashflow`, `test:web-assistant`, `test:workspace-sync`, `check:dashboard-help`, `test:obligation-plan`, `test:obligation-notification-ui`, `test:shared-obligations`, `test:subscription-parity` y `test:notification-parity` pasan. También pasó `test:parity` (smoke del paquete compartido anterior; no sustituye la prueba nueva del calendario conectado a pantalla). Aviso no bloqueante de Browserslist desactualizado; no se actualizó la base en esta unidad.

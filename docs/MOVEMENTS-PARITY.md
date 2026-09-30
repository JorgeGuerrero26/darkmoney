# Movimientos: cierre de sugerencias y análisis

Verificación: 30 de septiembre de 2026. Referencia local: `DarkMoneyApp`.

## Cambios cerrados en este bloque

- Contrapartes: coincidencia por nombre y similitud de palabras, exclusión de contactos archivados y propuesta de comercio nuevo. Se usa la descripción limpiada, igual que en el formulario móvil.
- Descripción: los 15 patrones de comercios/servicios, eliminación de ruido bancario, niveles de confianza y condición de visibilidad son los del móvil. Una limpieza local fuerte evita llamar a IA; una respuesta válida de IA no se descarta por el antiguo umbral web de 0.65.
- Cuenta: puede proponer sustituir una cuenta elegida. Aprende de los últimos 300 movimientos aplicados, exige dos usos de la contraparte y no propone la cuenta ya elegida. Este mapa conserva el registro editado, igual que el móvil.
- Recurrencia: mismos intervalos de fecha redondeados, similitud de montos, palabras, confianza y descarte de cargos/ingresos fijos activos parecidos por moneda y contraparte/categoría/nombre. La sugerencia se ofrece al crear, no al editar.
- Duplicados y monto inusual: misma normalización, puntuación, mediana, severidad y razones. El historial excluye el registro editado después de seleccionar los 300 aplicados. La explicación de IA recibe los registros relacionados aunque queden fuera de sus 30 movimientos más recientes.
- Integración: categoría y riesgo conservan el texto original; contraparte y recurrencia reciben el texto limpiado. Las respuestas antiguas no se muestran para otros datos ni al desactivar Pro.

Las funciones puras portadas indican su archivo equivalente del móvil. La prueba diferencial carga esos archivos de referencia, no otro resultado generado por la web.

## Verificación reproducible

```powershell
npm run build
npm run test:movement-save
node scripts/test-movement-category-parity.mjs --mobile-reference C:/Users/Adrian/Documents/DarkMoneyApp
npm run test:movement-suggestions -- --mobile-reference C:/Users/Adrian/Documents/DarkMoneyApp
```

Resultados: 74 casos comparativos de contactos, limpieza, cuentas, recurrencia y riesgo; 13 casos comparativos de categoría. También se prueban los adaptadores de historial, reintentos idempotentes y los hooks reales con temporizadores y respuestas de IA simuladas. No se escriben registros ni se consume IA real.

## Regresiones de los demás módulos

Pasaron `test:parity`, `test:subscription-parity`, `test:recurring-income-parity`, `test:budget-parity` y `test:obligation-plan`.

Estas pruebas cubren cálculos y reglas concretas, no certifican por sí solas todos los recorridos de interfaz. En particular:

- Cuentas: el snapshot usa `v_account_balances`; las pruebas de cálculos no sustituyen comprobar todos los flujos de edición/archivo en ambos clientes.
- Suscripciones e ingresos fijos: se verifican vencimientos, frecuencias y reglas locales; no se ejecutaron cobros/llegadas reales en este bloque.
- Presupuestos: se verifican periodos, alcance, zona horaria, contribuciones y exportación; no se hizo una auditoría nueva de todos sus controles.
- Créditos y deudas: se verifica el plan de pago; no se probaron invitaciones entre dos usuarios ni aprobaciones de pagos reales.
- Categorías y contactos: hay cambios previos fuera de este bloque, conservados sin modificar ni incluir en el commit. No existe una certificación global de paridad de estos dos módulos en estas pruebas.

Para certificar paridad total de extremo a extremo faltaría una ejecución coordinada en web y móvil, con el mismo espacio, usuario y filtros, y pruebas de escritura controladas fuera del espacio financiero real. Tampoco se garantiza que dos llamadas independientes a DeepSeek produzcan texto idéntico; sí se alinearon las reglas locales, los umbrales y el contexto descritos arriba.

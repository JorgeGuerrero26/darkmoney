# Corrección y coordinación con móvil

14 de octubre de 2026. Este documento actualiza el traspaso anterior, sin editar el repositorio móvil.

## Versiones: renombrado necesario en ambos clientes

Web ya renumeró sus archivos y referencias:

| Nombre anterior | Nombre nuevo |
|---|---|
| `202610140001_subscription_split_receipts.sql` | `202610150001_subscription_split_receipts.sql` |
| `202610140002_detected_split_links.sql` | `202610150002_detected_split_links.sql` |

El responsable móvil debe renombrar sus dos copias igual y actualizar la dependencia comentada al inicio de la segunda. No renombrar ni reemplazar `202610140001_sync_obligations.sql`, informada como aplicada. No ejecutar `migration repair` ni un `db push` global para resolver esta colisión.

Los números nuevos estaban libres en ambos árboles locales al revisar, no se consultó el historial remoto. Confirmarlos también con el registro desplegado antes de liberar. `202610130002_detected_movement_split.sql` sigue siendo dependencia no desplegada; un cambio de nombre no instala ninguna función ni vista.

## Prueba roja: corrección propuesta al responsable móvil

Reproducida localmente: `npx jest --runInBand --runTestsByPath __tests__/workspace-loading-errors.test.ts` termina con 25 casos correctos y uno fallido. La fila 99 del caso `refreshSnapshotDomains` omite el espacio; las consultas refrescan el 7.

Cambiar únicamente el fixture en `__tests__/workspace-loading-errors.test.ts`:

```diff
           {
             id: 99,
+            workspace_id: 7,
             category_id: 4,
             subscription_id: 8,
```

No quitar la validación de `workspace_id` de `catalog-history.ts` o `subscription-payment-rows.ts`: impediría detectar historiales ajenos/incompatibles. La prueba debe devolver los campos que selecciona la consulta real. El desarrollador móvil debe aplicar y probar el cambio; este agente no modificó la prueba ni certifica su CI.

## Verificación de esta corrección

- `npm run test:offline-e2e`, ejecutado en el checkout móvil actual sin editar fuentes: **36 casos, 11 suites, pasan**. Usa SQLite en memoria/PGlite y las migraciones offline reales con fixtures; no servidor ni teléfonos reales. Compila artefactos de prueba locales en `.tmp/offline-tests`. No integra las migraciones nuevas de división ni sustituye la prueba roja de historial/caché.
- Web: pruebas de división atómica, formulario real de división y sincronización de recibos agrupados pasan después de renumerar. La última compara cuerpos SQL con las copias móviles antiguas y anuncia explícitamente que aún requieren renombrado.
- `scripts/check-migration-versions.mjs` comprueba versiones únicas en web y que los dos números nuevos no colisionen con otro nombre en el árbol móvil local. No inspecciona ni modifica historial remoto.
- No se declara CI móvil verde ni se realizó publicación SQL/OTA/web. La propuesta de fixture no se aplicó en móvil.

## Estado y publicación

- HEAD móvil local observado ahora: `8e733236`. El HEAD `fbd95221` era el observado al redactar el informe anterior, no una instrucción de publicar ese SHA antiguo.
- Los tres archivos de historial/caché/snapshot de recibos agrupados pertenecen al commit `e96733a9`; al revisar no estaban sin commit. Hay otras ediciones móviles en curso, que no se tocan.
- Nueva integración web en `cf6b8ea`: formulario y comprobador de grupos implementados localmente. Los SQL nuevos no se han desplegado; si falta la RPC, la web falla sin fallback por partes.
- El formulario móvil antiguo sigue secuencial. **No desplegar el trigger nuevo** antes de adaptar el formulario y coordinar compatibilidad con clientes instalados. Deshacer es un contrato previo distinto; su publicación histórica no significa que la creación atómica de divisiones esté desplegada.
- Publicar solo desde copia limpia, SHA/CI aprobados y runtime compatible. No registrar operaciones financieras reales para verificar esta entrega: la autorización actual sigue limitada a pruebas locales.

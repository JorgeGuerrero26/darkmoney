# Deep links (Universal Links / App Links)

Estos archivos deben servirse en **el mismo host** que los enlaces del correo, por ejemplo:

- `https://darkmoney.company/share/obligations/{token}`
- `https://darkmoney.company/share/workspaces/{token}`

## URLs obligatorias en producción

| Qué | URL |
|-----|-----|
| Invitación crédito/deuda (correo + web) | `https://darkmoney.company/share/obligations/{token}` |
| Invitación workspace | `https://darkmoney.company/share/workspaces/{token}` |
| AASA (iOS) | `https://darkmoney.company/.well-known/apple-app-site-association` |
| Digital Asset Links (Android) | `https://darkmoney.company/.well-known/assetlinks.json` |

## Antes de publicar

1. **`apple-app-site-association`**: sustituir `REPLACE_TEAM_ID` y `REPLACE_BUNDLE_ID` (ej. `ABC123XYZ.com.darkmoney.app`) con los valores del equipo iOS.
2. **`assetlinks.json`**: sustituir `REPLACE_PACKAGE_NAME` y los `sha256_cert_fingerprints` por los del keystore de release (y opcionalmente debug).
3. **HTTPS** sin redirecciones en cadena para la ruta `/.well-known/*`.
4. **Content-Type**: iOS exige `application/json` para el AASA; en `vercel.json` ya hay reglas si despliegas en Vercel.

Tras cambiar el AASA o `assetlinks.json`, iOS/Android pueden tardar en refrescar caché.

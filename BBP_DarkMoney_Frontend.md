# BBP del Proyecto - DarkMoney Frontend

**Documento base funcional, tecnico y de implementacion para el frontend**  
**Version:** 2.0  
**Estado:** Listo para iniciar diseno, arquitectura y desarrollo  
**Documento relacionado:** [DATABASE_DICTIONARY.md](c:\Users\Adrian\Documents\DarkMoney\DATABASE_DICTIONARY.md)

---

## 0. Proposito del documento

Este documento funciona como blueprint oficial del frontend de DarkMoney. Su objetivo es que el proyecto pueda arrancar sin ambiguedades y que el equipo de producto, diseno, frontend y QA comparta el mismo entendimiento sobre:

- que se va a construir;
- como se organiza la experiencia del usuario;
- como se conectara el frontend con Supabase;
- cuales son las reglas funcionales que no deben romperse;
- que modulos entran al MVP;
- como se debe estructurar la implementacion tecnica.

No es solo un documento de vision. Tambien es una guia de ejecucion.

---

## 1. Resumen ejecutivo

DarkMoney sera una aplicacion financiera personal y colaborativa centrada en workspaces. Cada usuario tendra un workspace personal y podra participar en workspaces compartidos con pareja, familia o socios. Dentro de cada workspace podra gestionar cuentas, movimientos, presupuestos, suscripciones, creditos, deudas, actividad compartida y notificaciones.

El frontend debe ofrecer una experiencia:

- clara para personas no tecnicas;
- lo bastante rapida para registrar movimientos en segundos;
- segura respecto a permisos y visibilidad;
- preparada para tiempo real en cuentas y workspaces compartidos;
- escalable para crecer luego a PWA y app movil.

### Definicion corta del producto

| Aspecto | Definicion |
|---|---|
| Tipo de producto | Aplicacion de finanzas personales y colaborativas |
| Modelo mental | Workspace financiero activo + modulos operativos |
| Plataforma inicial | Web responsive |
| Backend | Supabase: Auth, Postgres, Realtime, Storage y RPC |
| Frontend | React + Vite + TypeScript |
| Objetivo del MVP | Operar finanzas personales y compartidas con cuentas, movimientos, obligaciones, suscripciones y actividad |

---

## 2. Vision del producto

DarkMoney no debe sentirse como una hoja Excel disfrazada ni como un ERP pesado. Debe sentirse como una herramienta moderna de control financiero cotidiano, con operaciones simples, feedback inmediato y colaboracion real.

La experiencia principal debe responder a estas preguntas del usuario:

- cuanto dinero tengo y en que cuentas;
- en que estoy gastando;
- que debo y que me deben;
- que pagos vienen pronto;
- que paso en mi espacio compartido;
- quien hizo que dentro de una cuenta o workspace compartido.

---

## 3. Objetivos del producto

### 3.1 Objetivos de negocio

- Centralizar finanzas personales y compartidas en una sola herramienta.
- Reducir friccion para registrar movimientos y revisar saldos.
- Convertir workspaces compartidos en un diferencial del producto.
- Sentar una base solida para futuras funciones premium.

### 3.2 Objetivos de experiencia

- Registrar un gasto o ingreso en menos de 20 segundos.
- Entender el estado financiero del workspace en menos de 10 segundos desde el dashboard.
- Identificar rapidamente si algo es personal o compartido.
- Hacer confiable la colaboracion entre miembros sin duplicidad ni confusion.

### 3.3 Objetivos tecnicos

- Mantener una arquitectura modular y escalable.
- Evitar mezclar logica de negocio critica en multiples componentes.
- Respetar siempre el `workspace_id` como contexto central.
- Preparar el terreno para RLS, Realtime y RPC.

---

## 4. No objetivos por ahora

Para evitar sobredisenar el MVP, estas capacidades no son prioridad inmediata:

- importacion bancaria automatica;
- OCR de comprobantes;
- conciliacion bancaria avanzada;
- adjuntos por movimiento;
- presupuestos inteligentes con IA;
- marketplace de integraciones;
- app movil nativa separada.

Pueden existir en el roadmap, pero no deben bloquear el arranque del frontend.

---

## 5. Contexto actual del proyecto

- Ya existe un modelo de base de datos en Supabase con soporte para workspaces personales y compartidos.
- El diccionario de datos esta documentado en [DATABASE_DICTIONARY.md](c:\Users\Adrian\Documents\DarkMoney\DATABASE_DICTIONARY.md).
- El sistema usa PostgreSQL y esta pensado para seguridad via RLS.
- La propiedad logica de casi toda entidad de negocio se define por `workspace_id`.
- El frontend parte desde cero.

### Implicaciones directas para frontend

- No se debe modelar la aplicacion como si todo perteneciera solo al usuario.
- El selector de workspace es una pieza estructural, no accesoria.
- Toda vista y toda query debe estar scopeada al workspace activo.
- La experiencia multiusuario debe contemplarse desde el primer diseno.

---

## 6. Alcance del MVP

### 6.1 Incluye

- autenticacion;
- onboarding inicial;
- selector de workspace;
- dashboard principal;
- cuentas;
- movimientos;
- creditos y deudas;
- suscripciones;
- centro de notificaciones basico;
- feed de actividad;
- configuracion de perfil y preferencias;
- gestion basica de workspaces y miembros;
- responsive real en movil y desktop.

### 6.2 Puede entrar si el tiempo lo permite

- presupuestos con progreso;
- invitaciones por correo con estado;
- categorias y contrapartes desde UI completa;
- recordatorios mas detallados;
- calendarios enriquecidos.

### 6.3 Fuera del MVP

- importaciones masivas;
- reportes exportables complejos;
- automatizaciones avanzadas;
- push nativo;
- archivos adjuntos.

---

## 7. Supuestos y restricciones

### 7.1 Supuestos

- Habra politicas RLS o al menos una estrategia clara para proteger datos por workspace.
- El backend puede exponer vistas y RPC para simplificar calculos complejos.
- El producto iniciara en espanol.
- El equipo aceptara usar Supabase Auth como base de identidad.

### 7.2 Restricciones

- El frontend no debe conectarse con credenciales directas de Postgres.
- El frontend debe usar `supabase-js` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Las reglas criticas de negocio no deben quedar duplicadas en muchos formularios.
- Las operaciones sensibles deben poder migrarse a RPC o Edge Functions.

### 7.3 Regla de seguridad importante

Aunque exista una conexion Postgres documentada para administracion o desarrollo, el frontend publico nunca debe usar:

- host de Postgres;
- usuario `postgres`;
- password de base de datos.

El cliente web debe usar unicamente:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

---

## 8. Principios de producto y UX

- **Claridad primero:** el usuario debe entender rapidamente en que workspace esta y que efecto tendra cada accion.
- **Velocidad de captura:** registrar un gasto, ingreso o transferencia debe ser simple.
- **Colaboracion visible:** cuando una cuenta es compartida, eso debe verse claramente.
- **Contexto persistente:** el workspace activo debe estar siempre visible.
- **Consistencia:** mismos patrones de filtros, estados, badges, modales y tablas.
- **Feedback inmediato:** toda mutation debe reflejar cambios en la UI lo antes posible.
- **Trazabilidad:** cuando algo cambie, debe poder saberse quien lo hizo y cuando.

---

## 9. Conceptos de dominio que el frontend debe respetar

| Concepto | Significado | Implicacion en UI |
|---|---|---|
| `workspace` | Espacio financiero logico personal o compartido | Toda la app opera sobre un workspace activo |
| `workspace_member` | Usuario miembro de un workspace con rol | Define que puede ver y editar |
| `account` | Cuenta financiera del workspace | Se presenta con saldo, moneda, tipo y estado |
| `movement` | Evento que afecta saldos | Se registra rapido y actualiza resumenes |
| `obligation` | Credito o deuda | Se visualiza con progreso y eventos |
| `subscription` | Pago recurrente | Se ve en lista, detalle y calendario |
| `notification` | Alerta personal | No es compartida, pero puede referenciar algo del workspace |
| `activity_log` | Feed compartido del workspace | Muestra acciones recientes y autoria |

### Regla estructural clave

En DarkMoney, la propiedad visible de los datos no esta definida por `user_id` sino por `workspace_id`. Esto debe guiar:

- las rutas;
- los filtros;
- el cache;
- los listeners realtime;
- la logica de permisos;
- los breadcrumbs;
- el copy de la interfaz.

---

## 10. Usuarios y roles

### 10.1 Tipos de usuario

- **Usuario individual:** maneja solo sus finanzas personales.
- **Usuario colaborativo:** participa en uno o mas workspaces compartidos.
- **Administrador del workspace:** organiza miembros, cuentas y configuracion.

### 10.2 Roles reales del modelo

El frontend debe alinearse con los roles del esquema:

| Rol | Alcance esperado en UI |
|---|---|
| `owner` | Control total del workspace, miembros y configuracion |
| `admin` | Gestion operativa amplia y apoyo de administracion |
| `member` | Puede operar y editar segun reglas del workspace |
| `viewer` | Solo lectura o acciones muy limitadas |

### 10.3 Matriz base de permisos

| Accion | owner | admin | member | viewer |
|---|---|---|---|---|
| Ver dashboard | Si | Si | Si | Si |
| Ver cuentas del workspace | Si | Si | Si | Si |
| Crear cuenta | Si | Si | Si | No |
| Editar cuenta | Si | Si | Si | No |
| Archivar cuenta | Si | Si | Si | No |
| Registrar movimiento | Si | Si | Si | No |
| Editar movimiento | Si | Si | Si | No |
| Ver obligaciones | Si | Si | Si | Si |
| Registrar pago de obligacion | Si | Si | Si | No |
| Crear suscripcion | Si | Si | Si | No |
| Gestionar miembros | Si | Si | No | No |
| Cambiar configuracion del workspace | Si | Si | No | No |

### 10.4 Reglas UX por rol

- Un `viewer` debe poder navegar, filtrar y entender datos, pero no ver CTAs de escritura.
- Si una accion esta bloqueada por permisos, la UI debe ocultarla o deshabilitarla con explicacion.
- Nunca confiar solo en el frontend para seguridad. El frontend solo acompana a RLS.

---

## 11. Arquitectura de informacion

### 11.1 Shell principal

El producto debe estructurarse sobre un `AppShell` con:

- sidebar principal;
- topbar con selector de workspace;
- buscador global futuro;
- centro de notificaciones;
- area central de contenido;
- panel lateral opcional de actividad en desktop.

### 11.2 Navegacion principal sugerida

- Dashboard
- Cuentas
- Movimientos
- Creditos y deudas
- Suscripciones
- Notificaciones
- Configuracion

### 11.3 Reglas de navegacion

- El workspace activo debe ser visible en topbar.
- Cambiar de workspace debe refrescar el contexto completo.
- Si una ruta apunta a un recurso fuera del workspace activo, debe redirigir o mostrar error controlado.
- En movil, el shell puede usar drawer o bottom navigation segun la densidad final del diseno.

---

## 12. Mapa de rutas sugerido

| Ruta | Pantalla | Objetivo |
|---|---|---|
| `/auth/login` | Login | Ingreso al sistema |
| `/auth/register` | Registro | Alta de usuario |
| `/auth/recovery` | Recuperar acceso | Reset de password |
| `/onboarding` | Setup inicial | Completar perfil y preferencias |
| `/app` | Dashboard | Resumen del workspace activo |
| `/app/accounts` | Lista de cuentas | Consultar y gestionar cuentas |
| `/app/accounts/:id` | Detalle de cuenta | Ver saldo, movimientos y notas |
| `/app/movements` | Lista de movimientos | Explorar ledger filtrado |
| `/app/movements/new` | Nuevo movimiento | Flujo dedicado o modal expandido |
| `/app/obligations` | Lista de obligaciones | Ver creditos y deudas |
| `/app/obligations/:id` | Detalle de obligacion | Progreso, timeline y pagos |
| `/app/subscriptions` | Lista y calendario | Gestion recurrente |
| `/app/subscriptions/:id` | Detalle de suscripcion | Ocurrencias, pagos y configuracion |
| `/app/notifications` | Centro de notificaciones | Alertas personales |
| `/app/settings/profile` | Perfil | Datos del usuario |
| `/app/settings/workspaces` | Workspaces | Gestion del contexto |
| `/app/settings/members` | Miembros | Roles e invitaciones |
| `/app/settings/categories` | Categorias | Catalogo por workspace |
| `/app/settings/counterparties` | Contrapartes | Personas, empresas, bancos |

---

## 13. Modulos funcionales y detalle de implementacion

## 13.1 Autenticacion

### Objetivo

Permitir registro, inicio de sesion, recuperacion de clave y persistencia de sesion usando Supabase Auth.

### Requisitos funcionales

- login por email y password;
- registro por email y password;
- logout seguro;
- recuperar password;
- mantener sesion activa;
- redirigir al onboarding si el perfil esta incompleto.

### Requisitos de UI

- formularios simples y confiables;
- loading claro;
- mensajes de error entendibles;
- modo desktop y movil impecable;
- enlaces visibles a registro y recuperacion.

### Datos involucrados

- `auth.users` de Supabase;
- `profiles`;
- `workspace_members`;
- `workspaces`.

### Estados UI

- cargando sesion;
- sin sesion;
- sesion activa;
- sesion expirada;
- error de autenticacion;
- pending email verification si se habilita.

### Criterios de aceptacion

- el usuario puede autenticarse y caer en el contexto correcto;
- si es su primer ingreso, ve onboarding;
- si ya tiene perfil y workspace, entra al dashboard;
- la recarga de pagina mantiene la sesion.

---

## 13.2 Onboarding

### Objetivo

Completar la informacion minima necesaria para operar el producto.

### Campos minimos

- `full_name`
- `base_currency_code`
- `timezone`

### Resultado esperado

- perfil completado;
- workspace personal disponible;
- workspace por defecto identificado;
- usuario redirigido a dashboard.

### Consideraciones

- si el trigger de bootstrap ya crea workspace personal, el frontend solo debe confirmarlo y tomarlo como activo;
- si no existe por algun error, debe mostrarse error controlado y opcion de reintento.

---

## 13.3 Dashboard

### Objetivo

Mostrar la salud general del workspace activo y servir como punto de entrada a las acciones frecuentes.

### Bloques principales

- resumen de balances;
- tarjetas de cuentas destacadas;
- ingresos vs gastos por periodo;
- ultimos movimientos;
- obligaciones proximas o relevantes;
- suscripciones proximas;
- feed de actividad compartida;
- quick actions.

### Fuentes de datos ideales

- `v_workspace_balances`
- `v_account_balances`
- `movements`
- `v_subscription_upcoming`
- `v_obligation_summary`
- `activity_log`

### Acciones desde dashboard

- nuevo gasto;
- nuevo ingreso;
- nueva transferencia;
- nueva cuenta;
- registrar pago de obligacion;
- pagar suscripcion;
- cambiar periodo de analisis.

### Estados de interfaz

- skeleton inicial;
- dashboard vacio con CTA;
- datos parciales disponibles;
- error recuperable por widget.

### Criterios de aceptacion

- al entrar al dashboard el usuario ve datos del workspace activo solamente;
- el cambio de workspace refresca todos los widgets;
- un movimiento nuevo actualiza balance y actividad sin recarga completa.

---

## 13.4 Cuentas

### Objetivo

Administrar cuentas financieras del workspace.

### Vista lista de cuentas

Debe permitir:

- ver nombre, tipo, moneda, saldo, estado y ultima actividad;
- filtrar por tipo, moneda y estado;
- ordenar por saldo, nombre o actividad;
- archivar y editar segun permisos.

### Vista detalle de cuenta

Debe incluir:

- encabezado con nombre, tipo, moneda y badges;
- saldo actual;
- historial de movimientos relacionados;
- resumen mensual o corto;
- notas;
- miembros visibles si aplica como cuenta compartida por workspace.

### Formulario de cuenta

Campos:

- `name`
- `type`
- `currency_code`
- `opening_balance`
- `include_in_net_worth`
- `color`
- `icon`
- `notes`
- `sort_order`

### Validaciones sugeridas

- `name` obligatorio;
- `type` obligatorio;
- `currency_code` obligatorio;
- `opening_balance` numerico valido;
- `sort_order` entero.

### Criterios de aceptacion

- crear una cuenta la vuelve visible inmediatamente en el listado;
- editarla actualiza su detalle y sus tarjetas relacionadas;
- archivar una cuenta la remueve de vistas activas sin borrarla.

---

## 13.5 Movimientos

### Objetivo

Gestionar el libro mayor operativo de gastos, ingresos, transferencias, pagos de suscripciones y pagos de obligaciones.

### Vista lista

Debe permitir:

- filtros por fecha;
- filtro por cuenta;
- filtro por categoria;
- filtro por contraparte;
- filtro por tipo;
- filtro por estado;
- filtro por workspace activo;
- paginacion o scroll virtual si el volumen crece.

### Tipos de movimiento

- `expense`
- `income`
- `transfer`
- `subscription_payment`
- `obligation_opening`
- `obligation_payment`
- `refund`
- `adjustment`

### Formularios

#### Gasto

Campos minimos:

- cuenta origen;
- monto;
- categoria;
- fecha;
- descripcion;
- contraparte opcional;
- notas opcionales.

#### Ingreso

Campos minimos:

- cuenta destino;
- monto;
- categoria;
- fecha;
- descripcion;
- contraparte opcional.

#### Transferencia

Campos minimos:

- cuenta origen;
- cuenta destino;
- monto origen;
- monto destino si hay cambio de moneda;
- fecha;
- descripcion.

### Reglas funcionales

- un gasto reduce una cuenta origen;
- un ingreso aumenta una cuenta destino;
- una transferencia hace ambas cosas;
- para dashboards y balances deben contarse solo `posted`, salvo override explicito;
- si existe `fx_rate`, la UI debe mostrar ambas monedas y montos con claridad.

### Estados especiales

- `planned`
- `pending`
- `posted`
- `voided`

### Criterios de aceptacion

- al guardar un gasto, el saldo de la cuenta cambia y el dashboard se refresca;
- al registrar una transferencia, ambas cuentas reflejan el cambio;
- el usuario puede anular un movimiento sin eliminar trazabilidad.

---

## 13.6 Creditos y deudas

### Objetivo

Permitir gestionar obligaciones activas del workspace con visualizacion clara de progreso, pagos y saldo pendiente.

### Clasificacion principal

- `receivable`: me deben;
- `payable`: yo debo.

### Fuentes de datos ideales

- `obligations`
- `obligation_events`
- `v_obligation_summary`
- `movements` relacionados

### Vista lista

Debe mostrar:

- titulo;
- contraparte;
- tipo;
- estado;
- monto principal;
- saldo pendiente;
- porcentaje de avance;
- proxima cuota o fecha clave.

### Vista detalle

Debe incluir:

- header con datos principales;
- timeline de eventos;
- resumen financiero;
- cuotas planeadas y realizadas;
- boton de registrar pago;
- relacion con movimientos si existen.

### Formulario de obligacion

Campos:

- `direction`
- `origin_type`
- `status`
- `title`
- `counterparty_id`
- `settlement_account_id`
- `currency_code`
- `principal_amount`
- `start_date`
- `due_date`
- `installment_amount`
- `installment_count`
- `interest_rate`
- `description`
- `notes`

### Registrar pago

Debe permitir:

- monto pagado;
- fecha;
- cuenta asociada si aplica;
- descripcion;
- notas;
- generar movimiento asociado cuando corresponda.

### Criterios de aceptacion

- registrar un pago actualiza progreso, saldo pendiente y actividad;
- el detalle deja claro si es credito o deuda;
- los eventos se muestran en orden cronologico y con montos consistentes.

---

## 13.7 Suscripciones

### Objetivo

Administrar pagos recurrentes y sus vencimientos.

### Fuentes de datos

- `subscriptions`
- `subscription_occurrences`
- `movements`
- `v_subscription_upcoming`

### Vista lista

Debe mostrar:

- nombre;
- proveedor;
- monto;
- frecuencia;
- proxima fecha;
- estado;
- cuenta asociada.

### Vista calendario

Debe mostrar:

- vencimientos por dia;
- vencidas;
- pagadas;
- reprogramadas o omitidas.

### Formulario de suscripcion

Campos:

- `name`
- `vendor_party_id`
- `account_id`
- `category_id`
- `currency_code`
- `amount`
- `frequency`
- `interval_count`
- `day_of_month`
- `day_of_week`
- `start_date`
- `next_due_date`
- `end_date`
- `status`
- `auto_create_movement`
- `remind_days_before`
- `description`
- `notes`

### Acciones sobre ocurrencias

- pagar;
- omitir;
- cancelar;
- reprogramar;
- abrir movimiento relacionado.

### Criterios de aceptacion

- una suscripcion puede crearse y verse en lista y calendario;
- pagar una ocurrencia puede crear o vincular un movimiento;
- la siguiente fecha debe reflejarse coherentemente en UI.

---

## 13.8 Notificaciones

### Objetivo

Centralizar alertas personales relevantes.

### Datos

- `notifications`
- `notification_preferences`

### Tipos de notificacion esperados

- gasto compartido registrado;
- vencimiento de suscripcion;
- pago registrado;
- invitacion a workspace;
- recordatorio financiero relevante.

### UI esperada

- badge contador;
- lista ordenada por fecha;
- filtros por estado;
- marcar como leida;
- abrir entidad relacionada cuando exista.

### Criterios de aceptacion

- el usuario puede ver sus alertas y marcar lectura;
- nunca se muestran notificaciones de otro usuario;
- el panel puede coexistir como pagina y como drawer en desktop.

---

## 13.9 Feed de actividad

### Objetivo

Mostrar actividad compartida del workspace para colaboracion y auditoria ligera.

### Datos

- `activity_log`

### Ejemplos de eventos

- se creo un movimiento;
- se edito una cuenta;
- se registro un pago;
- se agrego un miembro;
- se actualizo una suscripcion.

### UI esperada

- avatar o identidad minima del actor;
- texto legible;
- timestamp relativo y absoluto;
- enlace a la entidad afectada si existe.

### Criterios de aceptacion

- la actividad se limita al workspace activo;
- los eventos nuevos pueden aparecer en tiempo real;
- el feed debe ser util incluso si el usuario no entiende detalles tecnicos.

---

## 13.10 Configuracion

### Secciones minimas

- Perfil
- Preferencias
- Workspaces
- Miembros
- Categorias
- Contrapartes

### Perfil

Campos:

- nombre completo;
- moneda base;
- timezone.

### Preferencias

Campos:

- in-app enabled;
- push enabled;
- email enabled.

### Workspaces

Debe permitir:

- ver workspaces disponibles;
- cambiar workspace por defecto;
- editar nombre o descripcion si tiene permisos;
- archivar si aplica y se decide soportarlo en MVP tardio.

### Miembros

Debe permitir:

- ver miembros por rol;
- cambiar rol si se autoriza;
- invitar usuarios;
- revocar o remover segun permisos y reglas futuras.

### Categorias y contrapartes

Catalogos operativos para alimentar formularios de movimientos, obligaciones y suscripciones.

---

## 14. Reglas de negocio que el frontend debe respetar

### 14.1 Regla general de contexto

Toda operacion se ejecuta dentro del `workspace_id` activo. No mezclar datos de varios workspaces en una sola pantalla salvo una funcionalidad futura explicitamente diseniada para eso.

### 14.2 Regla de saldos

Los saldos visibles deben basarse en la logica del backend o en vistas calculadas confiables. El frontend puede hacer actualizaciones optimistas, pero no inventar la verdad final.

### 14.3 Regla de obligaciones

No toda obligacion genera un impacto inicial en cuenta. La UI debe contemplar que:

- prestamos de dinero si pueden impactar cuenta en apertura;
- compras o ventas financiadas pueden no hacerlo;
- pagos posteriores si pueden impactar una cuenta de liquidacion.

### 14.4 Regla de suscripciones

Una ocurrencia pagada debe poder vincularse a un movimiento. Si la creacion automatica no esta lista en backend, la UI debe soportar un flujo manual claro.

### 14.5 Regla de permisos

Si el usuario no tiene rol adecuado:

- no puede editar;
- no puede crear;
- no puede ver acciones de administracion;
- no puede recibir una falsa impresion de que la accion se guardara.

### 14.6 Regla de estados operativos

Los estados `planned`, `pending`, `posted` y `voided` deben presentarse consistentemente en badges, filtros y copy.

---

## 15. Modelo de datos de frontend recomendado

El frontend no necesita exponer todas las columnas de cada tabla en todas las pantallas. Conviene trabajar con DTOs o view models por modulo.

### 15.1 Entidades minimas del cliente

| Modelo de frontend | Fuente principal |
|---|---|
| `CurrentUser` | `profiles` + sesion auth |
| `ActiveWorkspace` | `workspaces` + `workspace_members` |
| `AccountSummary` | `accounts` + `v_account_balances` |
| `MovementRecord` | `movements` + joins ligeros |
| `ObligationSummary` | `obligations` + `v_obligation_summary` |
| `SubscriptionSummary` | `subscriptions` + `v_subscription_upcoming` |
| `NotificationItem` | `notifications` |
| `ActivityItem` | `activity_log` |

### 15.2 Ejemplo de interfaces conceptuales

```ts
type ActiveWorkspace = {
  id: number;
  name: string;
  kind: "personal" | "shared";
  role: "owner" | "admin" | "member" | "viewer";
  isDefaultWorkspace: boolean;
  baseCurrencyCode: string | null;
};

type AccountSummary = {
  id: number;
  workspaceId: number;
  name: string;
  type: string;
  currencyCode: string;
  currentBalance: number;
  isArchived: boolean;
  includeInNetWorth: boolean;
  color: string | null;
  icon: string | null;
};

type MovementRecord = {
  id: number;
  workspaceId: number;
  movementType: string;
  status: string;
  occurredAt: string;
  description: string;
  sourceAccountId: number | null;
  destinationAccountId: number | null;
  sourceAmount: number | null;
  destinationAmount: number | null;
  categoryId: number | null;
  counterpartyId: number | null;
};
```

---

## 16. Arquitectura frontend recomendada

### 16.1 Stack

| Capa | Recomendacion |
|---|---|
| Runtime | React 18 |
| Bundler | Vite |
| Lenguaje | TypeScript |
| Estilos | Tailwind CSS |
| UI kit | shadcn/ui o libreria ligera equivalente |
| Router | React Router |
| Data fetching | TanStack Query |
| Estado global | Zustand |
| Formularios | React Hook Form + Zod |
| Fechas | date-fns |
| Graficos | Recharts |
| Backend client | `@supabase/supabase-js` |
| Testing unitario | Vitest |
| Testing de componentes | React Testing Library |
| E2E | Playwright |

### 16.2 Estructura sugerida de carpetas

```text
src/
  app/
    providers/
    router/
    layouts/
    guards/
  modules/
    auth/
      components/
      pages/
      hooks/
      schemas/
      services/
    dashboard/
    accounts/
    movements/
    obligations/
    subscriptions/
    notifications/
    settings/
  components/
    ui/
    shared/
  services/
    supabase/
    queries/
    mutations/
    realtime/
    rpc/
  stores/
  lib/
    formatting/
    dates/
    money/
    permissions/
  types/
  styles/
```

### 16.3 Principios de arquitectura

- separar modulos por dominio;
- separar componentes de pagina de componentes reutilizables;
- centralizar acceso a datos;
- centralizar permisos;
- centralizar formatters;
- minimizar logica de negocio duplicada en componentes visuales.

---

## 17. Integracion con Supabase

### 17.1 Variables de entorno del frontend

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

### 17.2 Cliente base

El cliente Supabase debe:

- inicializarse una sola vez;
- persistir sesion;
- refrescar tokens automaticamente;
- integrarse con React Query.

### 17.3 Politica de acceso a datos

- queries simples pueden ir directas a tablas o vistas;
- calculos complejos deben moverse a vistas o RPC;
- mutaciones sensibles deben considerar RPC si la regla es compleja;
- toda suscripcion realtime debe estar scopeada al workspace.

### 17.4 Tablas y vistas prioritarias para consumo

- `profiles`
- `workspaces`
- `workspace_members`
- `accounts`
- `movements`
- `obligations`
- `obligation_events`
- `subscriptions`
- `subscription_occurrences`
- `notifications`
- `activity_log`
- `v_user_workspaces`
- `v_account_balances`
- `v_obligation_summary`
- `v_subscription_upcoming`
- `v_workspace_balances`

---

## 18. Estrategia de queries, cache y sincronizacion

### 18.1 Query keys sugeridas

```ts
[
  "session",
  "profile",
  "workspaces",
  "workspace", workspaceId,
  "dashboard", workspaceId, period,
  "accounts", workspaceId, filters,
  "account", accountId,
  "movements", workspaceId, filters,
  "obligations", workspaceId, filters,
  "obligation", obligationId,
  "subscriptions", workspaceId, filters,
  "subscription", subscriptionId,
  "notifications",
  "activity", workspaceId
]
```

### 18.2 Estrategia de invalidacion

- al crear movimiento: invalidar dashboard, cuentas relacionadas, movimientos y actividad;
- al editar cuenta: invalidar lista de cuentas, detalle y dashboard;
- al registrar pago de obligacion: invalidar obligacion, resumenes y actividad;
- al pagar suscripcion: invalidar suscripciones, dashboard y movimientos si aplica;
- al cambiar workspace activo: limpiar o separar cache por workspace.

### 18.3 Actualizacion optimista

Se recomienda solo donde el riesgo sea bajo:

- marcar notificacion leida;
- archivado simple de cuenta;
- small edits de catalogos.

Para operaciones financieras, preferir:

- loading corto;
- revalidacion inmediata;
- optimistic UI solo si la regla esta muy controlada.

---

## 19. Realtime

### 19.1 Donde aporta valor real

- dashboard;
- detalle de cuenta;
- lista de movimientos;
- feed de actividad;
- notificaciones.

### 19.2 Eventos prioritarios

| Evento | Origen | Impacto |
|---|---|---|
| Nuevo movimiento | `movements` | actualizar saldo, listas y feed |
| Movimiento editado/anulado | `movements` | recalcular balance visible |
| Nuevo evento de obligacion | `obligation_events` | actualizar progreso |
| Cambio de suscripcion u ocurrencia | `subscriptions` / `subscription_occurrences` | refrescar calendario y alertas |
| Nueva notificacion | `notifications` | badge y panel |
| Nueva actividad | `activity_log` | feed visible |

### 19.3 Regla tecnica

Cada canal realtime debe estar scopeado por `workspace_id` cuando corresponda. Nunca abrir listeners globales innecesarios.

---

## 20. Formularios y validaciones

### 20.1 Principios

- validacion inmediata pero no agresiva;
- mensajes claros y en espanol;
- defaults inteligentes;
- soporte impecable en movil;
- navegacion por teclado.

### 20.2 Librerias

- React Hook Form
- Zod

### 20.3 Reglas generales

- montos siempre numericos;
- fechas validas;
- selects obligatorios bien indicados;
- texto libre con limites razonables;
- estados por defecto definidos;
- prevenir doble submit.

### 20.4 UX recomendada en formularios financieros

- mostrar moneda junto al monto;
- mostrar impacto esperado antes de guardar si aplica;
- confirmar transferencias con resumen final;
- al registrar pagos, indicar claramente si se creara un movimiento asociado.

---

## 21. Estados de UI y manejo de errores

Cada modulo debe contemplar explicitamente:

- `loading`
- `empty`
- `error`
- `success`
- `partial`
- `forbidden`

### Reglas

- no dejar pantallas vacias sin explicacion;
- no depender solo de toasts;
- si el error bloquea una accion financiera, el mensaje debe ser claro;
- si el error es por permisos, mostrar copy especifico;
- si el workspace no existe o no es accesible, redirigir a uno valido.

---

## 22. Lineamientos de UX/UI

### 22.1 Estilo deseado

- moderno;
- claro;
- sobrio;
- confiable;
- sin aspecto de ERP pesado;
- sin caer en minimalismo vacio que esconda acciones importantes.

### 22.2 Identidad visual sugerida

- color base sobrio con acentos de exito, alerta y deuda;
- cards limpias;
- jerarquia tipografica fuerte;
- indicadores claros de personal vs compartido;
- tablas potentes en desktop y tarjetas usables en movil.

### 22.3 Reglas visuales clave

- el badge de workspace compartido debe ser consistente;
- los estados `posted`, `pending`, `paid`, `overdue` deben tener codigo visual estable;
- el dinero debe tener formato consistente segun moneda;
- las CTAs primarias no deben perderse.

### 22.4 Componentes base sugeridos

- `AppShell`
- `WorkspaceSwitcher`
- `QuickActionBar`
- `BalanceCard`
- `AccountCard`
- `AccountList`
- `MovementTable`
- `MovementForm`
- `ObligationCard`
- `ObligationTimeline`
- `SubscriptionCalendar`
- `NotificationDrawer`
- `ActivityFeed`
- `EmptyState`
- `SectionHeader`
- `ConfirmationDialog`

---

## 23. Accesibilidad y responsive

### 23.1 Requisitos minimos

- labels correctos;
- foco visible;
- contraste suficiente;
- navegacion por teclado;
- estados no comunicados solo por color;
- modales accesibles;
- tablas adaptadas o transformadas en cards en movil.

### 23.2 Breakpoints sugeridos

- movil: 360 a 767 px
- tablet: 768 a 1023 px
- desktop: 1024 px en adelante

### 23.3 Reglas responsive

- formularios criticos deben funcionar bien en una sola columna;
- acciones frecuentes deben seguir siendo visibles en movil;
- el dashboard debe reorganizar widgets sin perder prioridad;
- el detalle de cuenta y obligacion debe degradar con dignidad.

---

## 24. Testing y calidad

### 24.1 Tipos de pruebas

- unitarias para utils, permisos y formatters;
- integracion para formularios y hooks;
- E2E para flows criticos;
- smoke tests por modulo.

### 24.2 Flujos E2E prioritarios

- login y onboarding;
- crear cuenta;
- registrar gasto;
- registrar transferencia;
- crear obligacion;
- registrar pago de obligacion;
- crear suscripcion;
- cambiar workspace;
- leer notificaciones.

### 24.3 Definition of done por feature

- UI implementada;
- estados de carga y error cubiertos;
- permisos aplicados;
- responsive validado;
- tests minimos agregados;
- queries y mutaciones funcionando con datos reales o mocks confiables.

---

## 25. Observabilidad y metricas

No es obligatorio en el dia uno, pero conviene dejar espacio para:

- eventos de producto;
- errores de cliente;
- performance basica;
- medicion de uso por modulo.

### Eventos recomendados

- workspace_changed
- account_created
- movement_created
- obligation_payment_registered
- subscription_paid
- notification_opened

---

## 26. Roadmap de implementacion

### Fase 1 - Foundation

- setup del proyecto;
- theming base;
- AppShell;
- auth;
- session management;
- workspace switcher;
- layout responsive;
- proveedores globales.

### Fase 2 - Finanzas nucleo

- dashboard;
- cuentas;
- movimientos;
- formularios principales;
- filtros y estados basicos.

### Fase 3 - Colaboracion

- feed de actividad;
- miembros;
- indicadores de compartido;
- realtime en movimientos y actividad.

### Fase 4 - Obligaciones

- lista;
- detalle;
- timeline;
- pago;
- integracion con movimientos.

### Fase 5 - Suscripciones y alertas

- lista y calendario;
- ocurrencias;
- pagos;
- notificaciones basicas.

### Fase 6 - Hardening

- testing;
- performance;
- accesibilidad;
- polish visual;
- preparacion para despliegue.

---

## 27. Dependencias backend recomendadas para destrabar al frontend

Para que el frontend avance con menos friccion, conviene definir cuanto antes:

- politicas RLS por `workspace_members`;
- vistas finales para balances y dashboards;
- RPC para operaciones complejas;
- estrategia de invitaciones a workspace;
- convencion definitiva para activity feed;
- si las suscripciones generan ocurrencias automaticas en backend o no.

### RPC o vistas recomendadas

- `rpc_create_movement`
- `rpc_register_obligation_payment`
- `rpc_mark_subscription_occurrence_paid`
- `rpc_switch_default_workspace`
- `v_dashboard_summary`

Si estos nombres cambian no importa; lo importante es acordar las capacidades.

---

## 28. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigacion |
|---|---|---|
| RLS aun no definida | alto | no asumir seguridad solo en frontend |
| Logica financiera distribuida | alto | centralizar en RPC o servicios |
| Realtime mal scopeado | medio | listeners por workspace |
| Formularios demasiado complejos | medio | empezar por flujos guiados |
| Dashboard con demasiadas queries | medio | usar vistas agregadas y carga progresiva |
| Permisos inconsistentes | alto | helper central de permisos |

---

## 29. Checklist de arranque del proyecto

- aprobar stack tecnico;
- crear proyecto React + Vite + TypeScript;
- configurar Tailwind;
- instalar `supabase-js`, React Query, Zustand, React Hook Form y Zod;
- definir estructura base de carpetas;
- implementar cliente Supabase;
- crear auth provider;
- crear shell base;
- crear store de workspace activo;
- modelar query keys;
- implementar layout responsive;
- conectar onboarding con `profiles`;
- conectar listado de workspaces;
- arrancar dashboard y cuentas.

---

## 30. Criterios de aceptacion del MVP frontend

- un usuario puede registrarse e iniciar sesion;
- puede completar onboarding;
- puede entrar a su workspace personal;
- puede cambiar entre workspaces disponibles;
- puede crear cuentas y ver saldo;
- puede registrar gasto, ingreso y transferencia;
- puede ver movimientos filtrados;
- puede gestionar creditos y deudas basicas;
- puede gestionar suscripciones basicas;
- puede ver actividad y notificaciones;
- no ve datos de workspaces ajenos;
- la experiencia es usable en desktop y movil.

---

## 31. Decisiones recomendadas para arrancar ya

- usar React + Vite + TypeScript;
- usar Supabase Auth desde el dia uno;
- tratar `workspace_id` como contexto central del frontend;
- usar TanStack Query para toda data remota;
- usar Zustand solo para estado de interfaz y contexto global;
- empezar por auth, shell, workspaces, cuentas y movimientos;
- dejar la logica financiera sensible lista para migrar a RPC.

---

## 32. Nota final para el frontend developer

Este documento debe leerse junto con [DATABASE_DICTIONARY.md](c:\Users\Adrian\Documents\DarkMoney\DATABASE_DICTIONARY.md). La base de datos ya define gran parte del modelo conceptual, pero el frontend necesita traducirlo a una experiencia mas simple y operable.

La prioridad no es mostrar todas las tablas. La prioridad es construir un producto financiero claro, confiable y rapido, donde el usuario siempre sepa:

- donde esta;
- que dinero tiene;
- que accion esta haciendo;
- a quien afecta;
- y que cambio produjo.

Si una regla de negocio empieza a crecer demasiado en el cliente, debe moverse a backend o RPC antes de que el frontend se vuelva fragil.

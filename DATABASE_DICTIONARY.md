# DarkMoney Database Dictionary

Documento base de referencia para la base de datos de **DarkMoney** sobre **PostgreSQL / Supabase**.

Fuente principal: [Diccionaro DarkMoney.txt](c:\Users\Adrian\Documents\DarkMoney\Diccionaro%20DarkMoney.txt)

## 1. Descripcion general

Este esquema esta orientado a finanzas personales y compartidas. Soporta:

- Workspaces personales y compartidos
- Cuentas colaborativas
- Movimientos financieros
- Presupuestos
- Creditos y deudas
- Suscripciones recurrentes
- Notificaciones y actividad compartida

### Resumen funcional

- Cada usuario trabaja con un `workspace` personal.
- Un `workspace shared` permite que varios usuarios compartan cuentas, movimientos y presupuestos.
- Los permisos se controlan mediante `workspace_members`.
- `notifications` es personal por usuario.
- `activity_log` es compartido por workspace.

## 2. Conexion a la base de datos

### Datos de conexion

| Campo | Valor |
|---|---|
| Host | `db.cawrdzrcipgibcoefltr.supabase.co` |
| Port | `5432` |
| Database | `postgres` |
| User | `postgres` |
| Password | `Jordimauyjanet27` |

### Connection string

```txt
postgresql://postgres:Jordimauyjanet27@db.cawrdzrcipgibcoefltr.supabase.co:5432/postgres
```

### Ejemplo con psql

```bash
psql "postgresql://postgres:Jordimauyjanet27@db.cawrdzrcipgibcoefltr.supabase.co:5432/postgres"
```

### Ejemplo en Node.js con `pg`

```js
import pg from "pg";

const { Client } = pg;

const client = new Client({
  host: "db.cawrdzrcipgibcoefltr.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Jordimauyjanet27",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("Conexion OK");
await client.end();
```

### Ejemplo con variables de entorno

```env
DB_HOST=db.cawrdzrcipgibcoefltr.supabase.co
DB_PORT=5432
DB_NAME=postgres
DB_USER=postgres
DB_PASSWORD=Jordimauyjanet27
DATABASE_URL=postgresql://postgres:Jordimauyjanet27@db.cawrdzrcipgibcoefltr.supabase.co:5432/postgres
```

### Nota de seguridad

La clave fue compartida directamente en este proyecto. Se recomienda moverla a variables de entorno y rotarla si ya fue usada en archivos compartidos o chats.

## 3. Principios del modelo colaborativo

- Cada usuario debe tener un workspace personal.
- El trigger `trg_profiles_bootstrap_workspace` crea ese workspace automaticamente al insertar el perfil.
- Cuentas, categorias, presupuestos, obligaciones, suscripciones y movimientos pertenecen a un `workspace`.
- Las acciones colaborativas se resuelven por membresia del workspace.
- Las notificaciones siguen siendo personales.
- `activity_log` funciona como feed y auditoria ligera.
- Para exponer esta base directamente desde Supabase al frontend, faltan politicas RLS basadas en `workspace_members`.

### Nota de migracion

En las tablas colaborativas el antiguo `user_id` se renombra a `created_by_user_id`. La propiedad logica pasa a estar en `workspace_id`.

## 4. Tipos enumerados

### `account_type`

| Valor | Descripcion |
|---|---|
| `cash` | Efectivo |
| `bank` | Cuenta bancaria |
| `savings` | Cuenta de ahorros |
| `credit_card` | Tarjeta de credito |
| `investment` | Cuenta de inversion |
| `loan_wallet` | Cartera de prestamos |
| `other` | Otro tipo |

### `party_type`

| Valor | Descripcion |
|---|---|
| `person` | Persona |
| `company` | Empresa |
| `merchant` | Comercio o vendedor |
| `service` | Proveedor de servicio |
| `bank` | Banco |
| `other` | Otro |

### `category_kind`

| Valor | Descripcion |
|---|---|
| `expense` | Categoria de gasto |
| `income` | Categoria de ingreso |
| `both` | Aplica a ambos |

### `movement_type`

| Valor | Descripcion |
|---|---|
| `expense` | Gasto |
| `income` | Ingreso |
| `transfer` | Transferencia entre cuentas |
| `subscription_payment` | Pago de suscripcion |
| `obligation_opening` | Apertura de credito o deuda |
| `obligation_payment` | Pago ligado a credito o deuda |
| `refund` | Reembolso |
| `adjustment` | Ajuste manual |

### `movement_status`

| Valor | Descripcion |
|---|---|
| `planned` | Planeado |
| `pending` | Pendiente |
| `posted` | Aplicado o confirmado |
| `voided` | Anulado |

### `obligation_direction`

| Valor | Descripcion |
|---|---|
| `receivable` | Me deben dinero |
| `payable` | Yo debo dinero |

### `obligation_origin_type`

| Valor | Descripcion |
|---|---|
| `cash_loan` | Prestamo de dinero |
| `sale_financed` | Venta a cuotas |
| `purchase_financed` | Compra a cuotas |
| `manual` | Registro manual |

### `obligation_status`

| Valor | Descripcion |
|---|---|
| `draft` | Borrador |
| `active` | Activo |
| `paid` | Liquidado |
| `cancelled` | Cancelado |
| `defaulted` | Incumplido |

### `obligation_event_type`

| Valor | Descripcion |
|---|---|
| `opening` | Apertura del monto original |
| `payment` | Pago o abono |
| `interest` | Interes |
| `fee` | Cargo adicional |
| `discount` | Descuento |
| `adjustment` | Ajuste |
| `writeoff` | Condonacion o castigo |

### `subscription_frequency`

| Valor | Descripcion |
|---|---|
| `daily` | Diaria |
| `weekly` | Semanal |
| `monthly` | Mensual |
| `quarterly` | Trimestral |
| `yearly` | Anual |
| `custom` | Personalizada |

### `subscription_status`

| Valor | Descripcion |
|---|---|
| `active` | Activa |
| `paused` | Pausada |
| `cancelled` | Cancelada |

### `subscription_occurrence_status`

| Valor | Descripcion |
|---|---|
| `scheduled` | Programada |
| `paid` | Pagada |
| `skipped` | Omitida |
| `cancelled` | Cancelada |
| `overdue` | Vencida |

### `notification_channel`

| Valor | Descripcion |
|---|---|
| `in_app` | Dentro de la aplicacion |
| `push` | Push movil o navegador |
| `email` | Correo |

### `notification_status`

| Valor | Descripcion |
|---|---|
| `pending` | Pendiente |
| `sent` | Enviada |
| `read` | Leida |
| `failed` | Fallida |

### `workspace_kind`

| Valor | Descripcion |
|---|---|
| `personal` | Workspace personal del usuario |
| `shared` | Workspace compartido entre varios miembros |

### `workspace_role`

| Valor | Descripcion |
|---|---|
| `owner` | Propietario |
| `admin` | Administrador |
| `member` | Miembro con edicion |
| `viewer` | Solo lectura |

### `workspace_invitation_status`

| Valor | Descripcion |
|---|---|
| `pending` | Pendiente |
| `accepted` | Aceptada |
| `declined` | Rechazada |
| `expired` | Expirada |
| `revoked` | Revocada |

## 5. Diccionario de tablas

### `profiles`

Perfil del usuario autenticado. Referencia funcional a `auth.users`.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `uuid` | No | Identificador del usuario. FK a `auth.users(id)` |
| `full_name` | `text` | Si | Nombre completo del usuario |
| `base_currency_code` | `char(3)` | No | Moneda base del usuario |
| `timezone` | `text` | No | Zona horaria preferida |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `currencies`

Catalogo de monedas disponibles.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `code` | `char(3)` | No | Codigo ISO de moneda |
| `name` | `text` | No | Nombre de la moneda |
| `symbol` | `text` | No | Simbolo visible |
| `decimals` | `smallint` | No | Cantidad de decimales soportados |
| `is_active` | `boolean` | No | Indica si sigue disponible |
| `created_at` | `timestamptz` | No | Fecha de creacion |

### `workspaces`

Espacio financiero logico personal o compartido.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador del workspace |
| `owner_user_id` | `uuid` | No | Usuario creador o propietario principal |
| `name` | `text` | No | Nombre visible del workspace |
| `kind` | `workspace_kind` | No | Tipo de workspace |
| `base_currency_code` | `char(3)` | Si | Moneda base preferida |
| `description` | `text` | Si | Descripcion funcional |
| `is_archived` | `boolean` | No | Indica si esta archivado |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `workspace_members`

Relacion de pertenencia entre usuarios y workspaces.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `workspace_id` | `bigint` | No | Workspace al que pertenece el usuario |
| `user_id` | `uuid` | No | Usuario miembro |
| `role` | `workspace_role` | No | Rol dentro del workspace |
| `is_default_workspace` | `boolean` | No | Marca el workspace por defecto |
| `joined_at` | `timestamptz` | No | Fecha de incorporacion |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `workspace_invitations`

Invitaciones para sumar miembros a un workspace compartido.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador de la invitacion |
| `workspace_id` | `bigint` | No | Workspace al que se invita |
| `invited_email` | `text` | No | Correo del invitado |
| `invited_by_user_id` | `uuid` | No | Usuario que envia la invitacion |
| `role` | `workspace_role` | No | Rol sugerido |
| `status` | `workspace_invitation_status` | No | Estado de la invitacion |
| `note` | `text` | Si | Nota adicional |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `accounts`

Cuentas financieras pertenecientes a un workspace.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador de la cuenta |
| `workspace_id` | `bigint` | No | Workspace dueno de la cuenta |
| `created_by_user_id` | `uuid` | Si | Usuario que creo la cuenta |
| `updated_by_user_id` | `uuid` | Si | Ultimo usuario que la modifico |
| `name` | `text` | No | Nombre de la cuenta |
| `type` | `account_type` | No | Tipo de cuenta |
| `currency_code` | `char(3)` | No | Moneda de la cuenta |
| `opening_balance` | `numeric(14,2)` | No | Saldo inicial |
| `include_in_net_worth` | `boolean` | No | Participa en patrimonio neto |
| `color` | `text` | Si | Color visual |
| `icon` | `text` | Si | Icono visual |
| `notes` | `text` | Si | Notas libres |
| `sort_order` | `integer` | No | Orden de visualizacion |
| `is_archived` | `boolean` | No | Estado archivado o activo |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `counterparties`

Personas, empresas, bancos o servicios vinculados a movimientos y obligaciones.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador de la contraparte |
| `workspace_id` | `bigint` | No | Workspace al que pertenece |
| `created_by_user_id` | `uuid` | Si | Usuario creador |
| `updated_by_user_id` | `uuid` | Si | Ultimo usuario editor |
| `name` | `text` | No | Nombre de la contraparte |
| `type` | `party_type` | No | Tipo de contraparte |
| `phone` | `text` | Si | Telefono de contacto |
| `email` | `text` | Si | Correo de contacto |
| `document_number` | `text` | Si | Documento o identificador externo |
| `notes` | `text` | Si | Observaciones |
| `is_archived` | `boolean` | No | Estado archivado o activo |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `categories`

Categorias de ingresos y gastos por workspace.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador de la categoria |
| `workspace_id` | `bigint` | No | Workspace propietario |
| `created_by_user_id` | `uuid` | Si | Usuario creador |
| `updated_by_user_id` | `uuid` | Si | Ultimo usuario editor |
| `name` | `text` | No | Nombre de la categoria |
| `kind` | `category_kind` | No | Tipo de categoria |
| `parent_id` | `bigint` | Si | Categoria padre |
| `color` | `text` | Si | Color visual |
| `icon` | `text` | Si | Icono visual |
| `sort_order` | `integer` | No | Orden de visualizacion |
| `is_system` | `boolean` | No | Categoria del sistema o del usuario |
| `is_active` | `boolean` | No | Estado activo o inactivo |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `budgets`

Presupuestos por periodo.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador del presupuesto |
| `workspace_id` | `bigint` | No | Workspace al que pertenece |
| `created_by_user_id` | `uuid` | Si | Usuario creador |
| `updated_by_user_id` | `uuid` | Si | Ultimo usuario editor |
| `name` | `text` | No | Nombre del presupuesto |
| `period_start` | `date` | No | Fecha inicial del periodo |
| `period_end` | `date` | No | Fecha final del periodo |
| `currency_code` | `char(3)` | No | Moneda del presupuesto |
| `category_id` | `bigint` | Si | Categoria asociada |
| `account_id` | `bigint` | Si | Cuenta asociada |
| `limit_amount` | `numeric(14,2)` | No | Monto maximo permitido |
| `rollover_enabled` | `boolean` | No | Traslada saldo al siguiente periodo |
| `alert_percent` | `numeric(5,2)` | No | Porcentaje para alertas |
| `notes` | `text` | Si | Notas |
| `is_active` | `boolean` | No | Estado del presupuesto |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `obligations`

Tabla central para creditos y deudas.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador de la obligacion |
| `workspace_id` | `bigint` | No | Workspace dueno de la obligacion |
| `created_by_user_id` | `uuid` | Si | Usuario creador |
| `updated_by_user_id` | `uuid` | Si | Ultimo usuario editor |
| `direction` | `obligation_direction` | No | Indica si me deben o yo debo |
| `origin_type` | `obligation_origin_type` | No | Origen del credito o deuda |
| `status` | `obligation_status` | No | Estado actual |
| `title` | `text` | No | Nombre del credito o deuda |
| `counterparty_id` | `bigint` | No | Persona o entidad relacionada |
| `settlement_account_id` | `bigint` | Si | Cuenta usada para pagos |
| `currency_code` | `char(3)` | No | Moneda principal |
| `principal_amount` | `numeric(14,2)` | No | Monto base |
| `start_date` | `date` | No | Fecha de inicio |
| `due_date` | `date` | Si | Fecha objetivo de cierre |
| `installment_amount` | `numeric(14,2)` | Si | Monto sugerido por cuota |
| `installment_count` | `integer` | Si | Cantidad planificada de cuotas |
| `interest_rate` | `numeric(8,4)` | Si | Tasa de interes opcional |
| `description` | `text` | Si | Descripcion funcional |
| `notes` | `text` | Si | Notas libres |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `obligation_events`

Detalle historico de eventos sobre una obligacion.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador del evento |
| `obligation_id` | `bigint` | No | Obligacion afectada |
| `event_type` | `obligation_event_type` | No | Tipo de evento |
| `event_date` | `date` | No | Fecha del evento |
| `amount` | `numeric(14,2)` | No | Monto del evento |
| `installment_no` | `integer` | Si | Numero de cuota |
| `description` | `text` | Si | Descripcion corta |
| `notes` | `text` | Si | Notas ampliadas |
| `movement_id` | `bigint` | Si | Movimiento financiero asociado |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `subscriptions`

Definicion de suscripciones o pagos recurrentes.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador de la suscripcion |
| `workspace_id` | `bigint` | No | Workspace al que pertenece |
| `created_by_user_id` | `uuid` | Si | Usuario creador |
| `updated_by_user_id` | `uuid` | Si | Ultimo usuario editor |
| `name` | `text` | No | Nombre visible |
| `vendor_party_id` | `bigint` | Si | Proveedor o contraparte |
| `account_id` | `bigint` | Si | Cuenta desde la cual se paga |
| `category_id` | `bigint` | Si | Categoria contable |
| `currency_code` | `char(3)` | No | Moneda |
| `amount` | `numeric(14,2)` | No | Monto esperado |
| `frequency` | `subscription_frequency` | No | Frecuencia principal |
| `interval_count` | `integer` | No | Intervalo multiplicador |
| `day_of_month` | `smallint` | Si | Dia del mes |
| `day_of_week` | `smallint` | Si | Dia de la semana |
| `start_date` | `date` | No | Fecha de inicio |
| `next_due_date` | `date` | No | Proximo vencimiento calculado |
| `end_date` | `date` | Si | Fecha final opcional |
| `status` | `subscription_status` | No | Estado de la suscripcion |
| `auto_create_movement` | `boolean` | No | Permite generar movimiento automatico |
| `remind_days_before` | `integer` | No | Anticipacion de recordatorio |
| `description` | `text` | Si | Descripcion |
| `notes` | `text` | Si | Notas |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `subscription_occurrences`

Detalle puntual por vencimiento de suscripciones.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador de la ocurrencia |
| `subscription_id` | `bigint` | No | Suscripcion madre |
| `due_date` | `date` | No | Fecha de vencimiento |
| `expected_amount` | `numeric(14,2)` | No | Monto esperado |
| `status` | `subscription_occurrence_status` | No | Estado de la ocurrencia |
| `movement_id` | `bigint` | Si | Movimiento pagado relacionado |
| `paid_at` | `timestamptz` | Si | Fecha y hora de pago |
| `notes` | `text` | Si | Notas del caso puntual |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `movements`

Libro mayor operativo del sistema.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador del movimiento |
| `workspace_id` | `bigint` | No | Workspace al que pertenece |
| `created_by_user_id` | `uuid` | Si | Usuario que registro el movimiento |
| `updated_by_user_id` | `uuid` | Si | Ultimo usuario que lo modifico |
| `movement_type` | `movement_type` | No | Tipo de movimiento |
| `status` | `movement_status` | No | Estado operativo |
| `occurred_at` | `timestamptz` | No | Fecha y hora efectiva |
| `description` | `text` | No | Descripcion corta |
| `notes` | `text` | Si | Observaciones ampliadas |
| `source_account_id` | `bigint` | Si | Cuenta origen |
| `source_amount` | `numeric(14,2)` | Si | Monto salido |
| `destination_account_id` | `bigint` | Si | Cuenta destino |
| `destination_amount` | `numeric(14,2)` | Si | Monto ingresado |
| `fx_rate` | `numeric(18,8)` | Si | Tipo de cambio aplicado |
| `category_id` | `bigint` | Si | Categoria contable |
| `counterparty_id` | `bigint` | Si | Contraparte relacionada |
| `obligation_id` | `bigint` | Si | Obligacion relacionada |
| `subscription_id` | `bigint` | Si | Suscripcion relacionada |
| `metadata` | `jsonb` | No | Datos adicionales en JSON |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `notification_preferences`

Preferencias personales de notificacion.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `user_id` | `uuid` | No | Usuario dueno de las preferencias |
| `in_app_enabled` | `boolean` | No | Permite notificaciones en app |
| `push_enabled` | `boolean` | No | Permite push |
| `email_enabled` | `boolean` | No | Permite correo |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `notifications`

Bandeja de notificaciones por usuario.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador de la notificacion |
| `user_id` | `uuid` | No | Usuario destinatario |
| `channel` | `notification_channel` | No | Canal de envio |
| `status` | `notification_status` | No | Estado de la notificacion |
| `title` | `text` | No | Titulo visible |
| `body` | `text` | No | Contenido o mensaje |
| `scheduled_for` | `timestamptz` | No | Fecha y hora programada |
| `sent_at` | `timestamptz` | Si | Fecha y hora real de envio |
| `read_at` | `timestamptz` | Si | Fecha y hora de lectura |
| `related_entity_type` | `text` | Si | Tipo de entidad relacionada |
| `related_entity_id` | `bigint` | Si | ID de la entidad relacionada |
| `payload` | `jsonb` | No | Informacion adicional JSON |
| `created_at` | `timestamptz` | No | Fecha de creacion |
| `updated_at` | `timestamptz` | No | Fecha de actualizacion |

### `activity_log`

Historial compartido de acciones dentro de un workspace.

| Campo | Tipo | Nulo | Descripcion |
|---|---|---|---|
| `id` | `bigint` | No | Identificador del evento |
| `workspace_id` | `bigint` | No | Workspace donde ocurrio la accion |
| `actor_user_id` | `uuid` | Si | Usuario que ejecuto la accion |
| `entity_type` | `text` | No | Tipo de entidad afectada |
| `entity_id` | `bigint` | Si | ID de la entidad afectada |
| `action` | `text` | No | Accion resumida |
| `description` | `text` | No | Descripcion legible |
| `payload` | `jsonb` | No | Metadatos estructurados |
| `created_at` | `timestamptz` | No | Fecha de creacion del evento |

## 6. Vistas de apoyo

| Vista | Descripcion |
|---|---|
| `v_user_workspaces` | Lista los workspaces a los que pertenece cada usuario, con rol y marca de workspace por defecto |
| `v_account_balances` | Calcula el saldo actual por cuenta usando opening_balance + entradas - salidas |
| `v_obligation_summary` | Resume principal, pagos, extras, descuentos, saldo pendiente y porcentaje de avance |
| `v_budget_progress` | Calcula gasto ejecutado, saldo remanente y porcentaje usado de cada presupuesto |
| `v_subscription_upcoming` | Lista vencimientos proximos o vencidos con cuenta, categoria y proveedor |
| `v_workspace_balances` | Totaliza saldos por workspace y moneda |

## 7. Reglas funcionales recomendadas

- Un usuario puede pertenecer a varios workspaces: el personal y uno o mas compartidos.
- Una cuenta compartida se implementa como una cuenta dentro de un `workspace shared`.
- Si dos miembros pertenecen al mismo workspace, ambos deben ver movimientos, presupuestos y suscripciones de ese workspace.
- Los creditos y deudas pueden ser personales o compartidos segun el workspace.
- Las notificaciones por gasto compartido deben generarse por usuario destinatario en `notifications`, usando `activity_log` y/o `movements`.
- La seguridad de acceso debe cerrarse con politicas RLS basadas en `workspace_members` y no solo en `created_by_user_id`.

## 8. Siguiente paso sugerido

Lo siguiente mas recomendable es documentar o implementar:

- Politicas RLS por `workspace_members`
- Relaciones FK explicitas entre tablas
- Indices recomendados
- Funciones SQL para reglas criticas del negocio
- Diagrama entidad-relacion

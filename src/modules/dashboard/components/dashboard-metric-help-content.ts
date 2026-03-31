/**
 * Textos de ayuda para indicadores del dashboard (simple y avanzado).
 * Las claves coinciden con los `metricId` pasados a DashboardHelpTrigger / DashboardKpiHelpWrap.
 */

import {
  DASHBOARD_HELP_SIMPLE_WORDS,
  type DashboardMetricSimpleWords,
} from "./dashboard-metric-help-simple";

export type { DashboardMetricSimpleWords } from "./dashboard-metric-help-simple";

export type DashboardMetricChart =
  | "monthly-net-bars"
  | "income-expense-bars"
  | "savings-capacity"
  | "category-compare"
  | null;

export type DashboardMetricArticle = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  example?: string;
  chart?: DashboardMetricChart;
  /** Si existe, sustituye la entrada automática de `DASHBOARD_HELP_SIMPLE_WORDS` para este id. */
  simpleWords?: DashboardMetricSimpleWords;
};

export type DashboardMetricHelpResolved = DashboardMetricArticle & {
  simpleWords: DashboardMetricSimpleWords;
};

const a = (article: DashboardMetricArticle): DashboardMetricArticle => article;

export const DASHBOARD_METRIC_HELP: Record<string, DashboardMetricArticle> = {
  panel_control: a({
    title: "Panel de control del dashboard",
    paragraphs: [
      "Aquí eliges la densidad de información: vista simple (solo lo esencial) o avanzada (widgets extra como riesgo, monedas, suscripciones y aprendizaje).",
      "También puedes mostrar u ocultar cada widget. La preferencia se guarda en tu navegador para que al volver veas el mismo tablero.",
    ],
    bullets: [
      "Simple: menos bloques, lectura más rápida.",
      "Vista avanzada: más profundidad operativa y señales.",
      "Restaurar todo: vuelve a mostrar todos los widgets del modo activo.",
    ],
  }),

  kpi_total_money: a({
    title: "Dinero total",
    paragraphs: [
      "Suma del saldo actual de tus cuentas activas que cuentan para tu patrimonio, convertidas a la moneda de visualización que elegiste arriba (por ejemplo PEN o USD).",
      "No es “efectivo en el bolsillo” ni “lo que puedes gastar hoy”: incluye ahorros y cuentas que quizá no toques a corto plazo.",
    ],
    example:
      "Tienes S/ 2 000 en débito y S/ 8 000 en una cuenta de ahorros → Dinero total ≈ S/ 10 000 en la vista global.",
  }),

  kpi_receivable: a({
    title: "Te deben",
    paragraphs: [
      "Total de lo que aún te deben terceros según tus créditos y cuentas por cobrar registradas (préstamos que diste, ventas a plazos, etc.), convertido a la moneda de visualización.",
      "Es dinero que esperas cobrar, pero que todavía no entró a tus cuentas.",
    ],
    example: "Un cliente debe dos cuotas de S/ 300 → “Te deben” suma al menos S/ 600 hasta que registres el cobro.",
  }),

  kpi_payable: a({
    title: "Debes",
    paragraphs: [
      "Total de lo que aún debes pagar según deudas y obligaciones vivas en el sistema, en moneda de visualización.",
      "Sirve para no subestimar compromisos futuros cuando miras solo el saldo de la cuenta.",
    ],
    example: "Tarjeta y préstamo con saldo pendiente S/ 1 200 + S/ 800 → “Debes” refleja ese compromiso agregado.",
  }),

  kpi_period_savings: a({
    title: "Ahorro del período",
    paragraphs: [
      "Resultado neto del período seleccionado (Hoy / Semana / Mes / Últimos 30 días): ingresos aplicados menos gastos aplicados, sin contar transferencias internas como ingreso o gasto.",
      "Si es positivo, en ese corte ganaste más de lo que gastaste; si es negativo, hubo déficit.",
      "La franja bajo el valor resume la variación porcentual frente al período de referencia (misma etiqueta que el comparativo arriba).",
    ],
    example: "Ingresos S/ 5 000, gastos S/ 4 200 → ahorro del período S/ 800.",
  }),

  kpi_income: a({
    title: "Ingresos",
    paragraphs: [
      "Suma de entradas reales registradas en el período (sueldos, cobros, reembolsos tratados como ingreso, etc.), en moneda de visualización.",
      "Las transferencias entre tus propias cuentas no suelen sumar aquí para no inflar artificialmente los ingresos.",
    ],
  }),

  kpi_expense: a({
    title: "Gastos",
    paragraphs: [
      "Suma de salidas de dinero del período: compras, servicios, pagos de deudas como gasto, etc.",
      "Te permite comparar con el período anterior con la etiqueta de variación junto al número.",
    ],
  }),

  kpi_real_free_money: a({
    title: "Dinero libre real",
    paragraphs: [
      "Aproximación de cuánta liquidez te queda después de considerar pagos que vienen en las próximas semanas (compromisos cercanos).",
      "Es más conservador que “Dinero total” porque descuenta presión inmediata sobre la caja.",
    ],
    example: "Saldo visible alto pero muchos vencimientos en 15 días → el dinero libre real puede ser menor que el saldo en cuenta.",
  }),

  kpi_avg_daily_spend: a({
    title: "Promedio diario (gasto)",
    paragraphs: [
      "Gasto total del período dividido entre la cantidad de días del corte. Sirve de ritmo: si gastas de más unos días, el promedio sube.",
    ],
    example: "En 30 días gastaste S/ 1 500 → promedio diario ≈ S/ 50.",
  }),

  kpi_active_subscriptions: a({
    title: "Suscripciones activas",
    paragraphs: [
      "Cantidad de suscripciones marcadas como activas y el costo mensual aproximado que calculamos a partir de ellas.",
      "Útil para ver el peso de lo recurrente frente a gastos one-shot.",
    ],
  }),

  kpi_upcoming_payments: a({
    title: "Pagos próximos",
    paragraphs: [
      "Monto agregado de compromisos (cuotas, suscripciones u obligaciones) que vencen en la ventana cercana que usa el dashboard.",
      "Te ayuda a dimensionar la salida de efectivo antes de que ocurra.",
    ],
  }),

  kpi_overdue: a({
    title: "Vencido",
    paragraphs: [
      "Suma de montos en obligaciones que ya pasaron su fecha o están en situación vencida según tus registros.",
      "Prioridad operativa: conviene revisar esas partidas y registrar pagos o acuerdos.",
    ],
  }),

  kpi_transferred: a({
    title: "Transferido",
    paragraphs: [
      "Total movido entre tus propias cuentas en el período (transferencias internas).",
      "No es gasto ni ingreso “nuevo”: reorganiza dónde está el dinero. Aun así importa para ver actividad y flujo entre cuentas.",
    ],
  }),

  adv_net_worth: a({
    title: "Patrimonio neto ampliado",
    paragraphs: [
      "Una foto amplia: dinero en cuentas (según lo que cuentas como patrimonio) más lo que te deben, menos lo que tú debes.",
      "Es distinto del saldo bancario aislado: incorpora cuentas por cobrar y por pagar.",
    ],
    example: "Caja S/ 10 000, te deben S/ 2 000, debes S/ 5 000 → patrimonio neto ampliado ≈ S/ 7 000.",
  }),

  adv_liquidity: a({
    title: "Liquidez disponible",
    paragraphs: [
      "Dinero en perfiles que consideramos listos para usar: efectivo, bancos operativos y ahorros líquidos, según cómo clasificaste tus cuentas.",
    ],
  }),

  adv_cash: a({
    title: "Efectivo",
    paragraphs: [
      "Saldos en cuentas tipo efectivo / billetera que definiste en el sistema. Concentra lo que físicamente o en prepago sueles tener a mano.",
    ],
  }),

  adv_bank: a({
    title: "Bancos",
    paragraphs: [
      "Saldos en cuentas bancarias activas incluidas en tu vista. Es el núcleo operativo para débitos, transferencias y domiciliaciones.",
    ],
  }),

  adv_savings: a({
    title: "Ahorros",
    paragraphs: [
      "Saldos en cuentas marcadas como ahorro. Puede incluir reservas que no quieras gastar en el día a día.",
    ],
  }),

  adv_projected_cash_30: a({
    title: "Caja proyectada (30 días)",
    paragraphs: [
      "Estimación de saldo líquido dentro de unos 30 días tomando entradas y salidas esperadas según compromisos y movimientos programados que el sistema conoce.",
      "Es una guía, no un pronóstico perfecto: si faltan datos, la proyección se aparta de la realidad.",
    ],
  }),

  shared_portfolio: a({
    title: "Cartera compartida contigo",
    paragraphs: [
      "Obligaciones que otro usuario compartió contigo en solo lectura. No se mezclan con los KPI principales del workspace para que no confundas “tuyo” con “visto por compartido”.",
    ],
  }),

  shared_principal: a({
    title: "Principal compartido",
    paragraphs: [
      "Saldo base agregado de esos registros compartidos. Representa la magnitud de lo que estás observando del lado del otro usuario.",
    ],
  }),

  shared_pending: a({
    title: "Pendiente compartido",
    paragraphs: [
      "Exposición viva aún no saldada dentro de la cartera compartida: lo que sigue “abierto” en esos créditos/deudas.",
    ],
  }),

  shared_receivable: a({
    title: "Créditos compartidos",
    paragraphs: [
      "Desde la perspectiva del propietario del registro: dinero que aún le deben a él/ella. Tú lo ves como contexto, no como activo propio.",
    ],
  }),

  shared_payable: a({
    title: "Deudas compartidas",
    paragraphs: [
      "Compromisos de pago que el propietario del registro aún debe a terceros. Te sirve para entender presión ajena, no para sumar a tu deuda personal automáticamente.",
    ],
  }),

  adv_avg_weekly_spend: a({
    title: "Gasto semanal medio",
    paragraphs: [
      "Gasto del período dividido entre el número de semanas que cubre el corte. Complementa el promedio diario con una escala que mucha gente usa para presupuestar.",
    ],
    example: "Gasto del mes S/ 2 800 en ~4,3 semanas → ~S/ 650 por semana.",
  }),

  adv_avg_monthly_savings: a({
    title: "Ahorro mensual medio",
    paragraphs: [
      "Promedio del resultado neto (ingresos − gastos) de cada mes que aparece en tu “Pulso mensual” (hasta los últimos seis meses con datos).",
      "La frase “Capacidad actual X%” NO es el promedio de esos meses: es otra métrica del período que estás comparando arriba (Hoy/Semana/Mes…).",
    ],
    bullets: [
      "Ahorro mensual medio = media de los “net” mensuales del pulso.",
      "Capacidad de ahorro % = ahorro del período seleccionado ÷ ingresos del mismo período (si no hay ingresos, no tiene sentido y puede mostrarse 0%).",
    ],
    example:
      "Enero +S/ 100, febrero +S/ 200, marzo −S/ 50 → promedio ≈ S/ 83/mes. Si este mes ingresaste S/ 4 000 y ahorraste S/ 640, la capacidad actual es 16%.",
    chart: "monthly-net-bars",
  }),

  adv_savings_capacity: a({
    title: "Capacidad de ahorro (porcentaje)",
    paragraphs: [
      "Indica qué parte de tus ingresos del período actual quedó como ahorro neto: (Ingresos − Gastos) ÷ Ingresos, expresado en porcentaje.",
      "Si gastas más de lo que ingresas, el porcentaje puede ser negativo o mostrarse como 0% en la interfaz según el cálculo.",
    ],
    example: "Ingresos S/ 4 000, gastos S/ 3 360 → ahorro S/ 640 → capacidad 16%.",
    chart: "savings-capacity",
  }),

  adv_top_account: a({
    title: "Cuenta con mayor saldo",
    paragraphs: [
      "La cuenta activa con más dinero hoy y qué fracción representa del total visible. Detecta concentración de riesgo (todo en un solo lugar).",
    ],
  }),

  adv_bottom_account: a({
    title: "Cuenta con menor saldo",
    paragraphs: [
      "El extremo inferior entre tus cuentas activas con saldo. Útil si quieres equilibrar buffers o detectar cuentas casi vacías.",
    ],
  }),

  adv_latest_income: a({
    title: "Último ingreso",
    paragraphs: [
      "El movimiento de ingreso o reembolso aplicado más reciente con su monto y fecha. Atajo mental para “qué entró último”.",
    ],
  }),

  adv_latest_movement: a({
    title: "Último movimiento",
    paragraphs: [
      "El último movimiento aplicado sin filtrar solo ingresos: puede ser gasto, transferencia, etc. Ver la etiqueta de tipo junto al monto.",
    ],
  }),

  widget_savings_trend: a({
    title: "Cronológicos del período",
    paragraphs: [
      "Curvas día a día dentro del período elegido. Puedes alternar entre ahorro neto, gastos acumulados, ingresos acumulados y transferencias acumuladas.",
      "La línea comparativa usa el día homólogo del período anterior para ver si el ritmo mejora o empeora.",
    ],
    bullets: [
      "Toca un día para ver movimientos concretos que lo explican.",
      "Transferencias mueven dinero entre cuentas; no siempre implican gasto del mundo real.",
    ],
  }),

  widget_period_radar: a({
    title: "Radar del período",
    paragraphs: [
      "Resumen ejecutivo: categoría que más pesa ahora, cómo era antes, dónde hay “fuga” respecto al período previo y qué día defendiste mejor tu caja.",
    ],
  }),

  radar_top_category: a({
    title: "Categoría más pesada ahora",
    paragraphs: [
      "Donde se fue la mayor parte de tu gasto del período actual. El porcentaje es la participación sobre tu gasto total del corte.",
    ],
    chart: "category-compare",
  }),

  radar_prev_category: a({
    title: "La que más pesaba antes",
    paragraphs: [
      "Referencia del período anterior (el que comparas arriba). Sirve para ver si cambiaste hábitos: lo que dominaba antes puede haber bajado o subido.",
    ],
  }),

  radar_opportunity: a({
    title: "Oportunidad más clara",
    paragraphs: [
      "Categoría cuyo gasto creció más en dinero frente al período de referencia. Es una pista de ahorro si ese aumento no era obligatorio.",
    ],
    example: "Comidas fuera subieron S/ 400 vs el mes pasado → oportunidad de recortar ahí.",
  }),

  radar_best_day: a({
    title: "Mejor día de ahorro",
    paragraphs: [
      "El día del período en que el flujo neto diario (ingresos − gastos) fue más favorable. También resume cuántos días fueron positivos y cuál fue el más duro.",
    ],
  }),

  widget_accounts_breakdown: a({
    title: "Dinero por cuenta",
    paragraphs: [
      "Distribución de saldos y cuánta actividad tuvo cada cuenta en el período. La barra muestra participación sobre el total visible.",
      "Puedes ver si una cuenta está incluida o fuera del patrimonio neto según tu configuración.",
    ],
  }),

  widget_receivable_leaders: a({
    title: "Quiénes más te deben",
    paragraphs: [
      "Ranking de contrapartes con mayor saldo por cobrar. Al seleccionar una fila ves montos y títulos que explican esos créditos.",
    ],
  }),

  widget_payable_leaders: a({
    title: "A quiénes más debes",
    paragraphs: [
      "Contrapartes donde concentras mayor deuda pendiente. Ayuda a priorizar negociaciones o pagos.",
    ],
  }),

  widget_category_comparison: a({
    title: "Comparativo por categorías",
    paragraphs: [
      "Para cada categoría con gasto: monto del período actual, monto del período de referencia y la diferencia (delta).",
      "Las barras comparan visualmente magnitudes; el delta numérico dice si gastaste más o menos que antes.",
    ],
    chart: "category-compare",
  }),

  widget_monthly_pulse: a({
    title: "Pulso mensual",
    paragraphs: [
      "Hasta seis meses recientes con ingresos, gastos y resultado neto por mes. Selecciona un mes para ver el detalle en el panel derecho.",
    ],
    bullets: [
      "Barras verdes: entradas del mes.",
      "Barras rojas/naranjas: salidas del mes.",
      "Resultado = entradas − salidas de ese mes.",
    ],
    chart: "monthly-net-bars",
  }),

  widget_budgets: a({
    title: "Presupuestos del período",
    paragraphs: [
      "Topes que definiste para el período vigente: cuánto te queda, cuánto ya consumiste y qué presupuestos van en alerta o excedidos.",
      "El cierre proyectado estima si, al ritmo actual, terminarás por encima del techo.",
    ],
  }),

  budget_ceiling: a({
    title: "Techo activo (presupuestos)",
    paragraphs: [
      "Suma de los límites de todos los presupuestos vigentes en el período. Es el “máximo planeado” de gasto o la referencia contra la que se mide lo consumido.",
    ],
  }),

  budget_consumed: a({
    title: "Consumido (presupuestos)",
    paragraphs: [
      "Cuánto del techo ya se imputó con movimientos del período según las reglas de cada presupuesto (general, por categoría, por cuenta, etc.).",
    ],
  }),

  budget_remaining: a({
    title: "Restante (presupuestos)",
    paragraphs: [
      "Techo menos consumido en agregado. Si es bajo, te queda poco margen antes de rozar el límite.",
    ],
  }),

  budget_at_risk: a({
    title: "En riesgo / excedidos",
    paragraphs: [
      "Cuántos presupuestos están en zona de alerta o ya pasaron el límite. Es un conteo de focos a revisar, no un monto único.",
    ],
  }),

  widget_weekly_pattern: a({
    title: "Ritmo semanal",
    paragraphs: [
      "Agrega ingresos y gastos por día de la semana dentro del período. Sirve para ver si los fines de semana o ciertos días concentran el gasto.",
    ],
    example: "Los sábados siempre en rojo → quizá ahí conviene planificar tope o anticipar compras.",
  }),

  widget_upcoming_recent: a({
    title: "Lo que viene y lo que movió tu período",
    paragraphs: [
      "Columna izquierda: compromisos próximos (cuotas, suscripciones, cobros esperados). Columna derecha: últimos movimientos aplicados que explican el período.",
    ],
  }),

  widget_obligation_watch: a({
    title: "Estado de créditos y deudas",
    paragraphs: [
      "Salud de tu cartera de obligaciones: montos por vencer, vencidos, cobrado y pagado en el corte, y buckets por antigüedad.",
      "Te orienta sobre presión de tesorería y registros que necesitan seguimiento.",
    ],
  }),

  obligation_due_soon: a({
    title: "Por vencer (obligaciones)",
    paragraphs: [
      "Monto de obligaciones que entran en la ventana de “pronto” según el criterio del tablero. Conviente alinearlo con tu calendario de pagos reales.",
    ],
  }),

  obligation_overdue_block: a({
    title: "Vencido (bloque obligaciones)",
    paragraphs: [
      "Mismo concepto que el KPI de vencido pero en el contexto de esta tarjeta operativa: deuda o cuotas con fecha pasada sin cerrar del todo.",
    ],
  }),

  obligation_collected_period: a({
    title: "Cobrado este corte",
    paragraphs: [
      "Dinero de créditos que efectivamente cobraste dentro del período seleccionado. Mide recuperación de cartera en ese intervalo.",
    ],
  }),

  obligation_paid_period: a({
    title: "Pagado este corte",
    paragraphs: [
      "Pagos que aplicaste a deudas en el período. No es “gasto nuevo” necesariamente: reduce pasivo.",
    ],
  }),

  obligation_bucket_due_soon: a({
    title: "Por vencer (detalle de cartera)",
    paragraphs: [
      "Obligaciones con fecha de vencimiento en la ventana próxima que define el sistema. Revisa fechas y montos para planificar pagos o cobros.",
    ],
  }),
  obligation_bucket_overdue_1_30: a({
    title: "Vencido 1-30 días",
    paragraphs: [
      "Compromisos con fecha de vencimiento entre 1 y 30 días en el pasado. Requieren seguimiento para evitar que crezcan intereses o problemas con la contraparte.",
    ],
  }),
  obligation_bucket_overdue_31_60: a({
    title: "Vencido 31-60 días",
    paragraphs: [
      "Deuda o créditos en mora de mediano plazo. Suele indicar presión acumulada: conviene priorizar acuerdos o pagos parciales.",
    ],
  }),
  obligation_bucket_overdue_61_plus: a({
    title: "Vencido 61+ días",
    paragraphs: [
      "Lo más atrasado de tu cartera según fechas. Tanto si debes como si te deben, es la cola que más riesgo operativo suele generar.",
    ],
  }),
  obligation_bucket_on_track: a({
    title: "Al día",
    paragraphs: [
      "Obligaciones vigentes cuya fecha de vencimiento está lo suficientemente lejos o alineada con el calendario; el sistema las considera sin presión inmediata.",
    ],
  }),

  widget_future_flow: a({
    title: "Proyección de flujo futuro",
    paragraphs: [
      "Arriba del detalle por ventana verás la misma lectura de cierre de mes calendario que en Resumen principal: liquidez estimada si se mantiene el ritmo de ingresos y gastos del mes.",
      "Para 7, 15 y 30 días estima entradas y salidas esperadas según compromisos y movimientos programados, y proyecta un saldo después de esas salidas.",
    ],
    bullets: [
      "Si falta información (fechas, montos), la proyección se desvía.",
      "Úsalo como alerta temprana, no como cifra contable exacta.",
    ],
  }),

  future_flow_window: a({
    title: "Ventana de flujo (7 / 15 / 30 días)",
    paragraphs: [
      "Cada bloque suma lo que el sistema espera que entre y salga en ese horizonte y resta del saldo líquido de partida para darte un saldo estimado después.",
      "Los contadores de por cobrar / por pagar indican cuántos compromisos alimentan esa ventana.",
    ],
  }),

  widget_alert_center: a({
    title: "Alertas y anomalías",
    paragraphs: [
      "Señales automáticas: presupuestos tensos, duplicidades posibles, saltos de gasto, etc. El objetivo es decirte dónde mirar primero.",
    ],
  }),

  widget_data_quality: a({
    title: "Calidad de datos",
    paragraphs: [
      "Lista de “deuda técnica” en tus registros: movimientos pendientes, sin categoría, suscripciones sin cuenta, obligaciones sin plan, etc.",
      "Mejor calidad → comparativos y proyecciones más fiables.",
    ],
  }),

  widget_subscriptions_snapshot: a({
    title: "Pulso de suscripciones",
    paragraphs: [
      "Costo mensual recurrente estimado, mix activo/pausado y próximos cobros. Complementa el KPI de suscripciones del resumen superior.",
    ],
  }),

  sub_monthly_cost: a({
    title: "Costo mensual (suscripciones)",
    paragraphs: [
      "Suma aproximada al mes de tus suscripciones activas según montos y periodicidad registrados.",
    ],
  }),

  sub_active_paused: a({
    title: "Activas / pausadas",
    paragraphs: [
      "Conteo de suscripciones en estado activo frente a las pausadas. Las pausadas suelen no sumar al costo mensual hasta que las reactives.",
    ],
  }),

  widget_transfer_snapshot: a({
    title: "Transferencias internas",
    paragraphs: [
      "Cuánto se movió entre cuentas propias en el período y qué rutas (origen → destino) concentran el flujo.",
    ],
  }),

  transfer_total_snapshot: a({
    title: "Transferido (resumen)",
    paragraphs: [
      "Volumen agregado de transferencias internas en el corte. Ver también cantidad de movimientos para ver si son muchos montos chicos o pocos grandes.",
    ],
  }),

  transfer_count_snapshot: a({
    title: "Cantidad de transferencias",
    paragraphs: [
      "Número de transferencias aplicadas en el período. Junto al monto total describe intensidad de movimiento entre cuentas.",
    ],
  }),

  widget_currency_exposure: a({
    title: "Exposición por moneda",
    paragraphs: [
      "Antes de convertir todo a la vista global, muestra cuánto tenías en cada moneda nativa de tus cuentas y qué parte representa del total.",
      "Útil si mezclas PEN y USD y quieres ver riesgo cambiario bruto.",
    ],
  }),

  widget_learning_panel: a({
    title: "Aprendiendo de ti",
    paragraphs: [
      "DarkMoney resume cuánta historia útil tienes, qué tan categorizados están los movimientos y en qué “fase” de lectura estás.",
      "Las fases desbloquean patrones, proyecciones y alertas más finas cuando hay datos suficientes.",
    ],
  }),

  learn_movements_useful: a({
    title: "Movimientos útiles (aprendizaje)",
    paragraphs: [
      "Cantidad de movimientos aplicados que alimentan modelos y comparativas. Más historia estable → más confianza en las señales.",
    ],
  }),

  learn_history_days: a({
    title: "Historial (días)",
    paragraphs: [
      "Amplitud temporal de datos que el sistema considera para aprendizaje. No es solo “tener muchos movimientos en un día”, sino dispersión en el tiempo.",
    ],
  }),

  learn_category_quality: a({
    title: "Calidad de categorías",
    paragraphs: [
      "Porcentaje de movimientos con categoría asignada. Subir este número mejora el comparativo por categorías y el radar.",
    ],
  }),

  learn_confidence: a({
    title: "Confianza actual",
    paragraphs: [
      "Puntuación resumida de qué tan listo está el workspace para insights automáticos. Sube con volumen, categorización y regularidad.",
    ],
  }),

  widget_active_signals: a({
    title: "Señales activas",
    paragraphs: [
      "Patrones ya detectables con tu data: ritmo de gasto, concentraciones, etc. La lista cambia según fase y calidad.",
      "El recuadro dorado sugiere acciones concretas para desbloquear la siguiente fase.",
    ],
  }),

  widget_workspace_collaboration: a({
    title: "Colaboración del workspace",
    paragraphs: [
      "Tipo de workspace (personal vs compartido), tu rol y cuánta actividad humana hubo en el período. En equipos compartidos ayuda a ver si el tablero refleja trabajo conjunto.",
    ],
  }),

  collab_role: a({
    title: "Tu rol",
    paragraphs: [
      "Permisos aproximados en el workspace activo. Determina qué puedes editar o solo ver.",
    ],
  }),

  collab_personal_count: a({
    title: "Workspaces personales",
    paragraphs: [
      "Cuántos entornos personales tienes. No implica cuál está activo, pero da contexto de fragmentación de datos.",
    ],
  }),

  collab_shared_count: a({
    title: "Workspaces compartidos",
    paragraphs: [
      "Cuántos entornos compartidos existen en tu cuenta. El dashboard siempre lee el workspace activo arriba en la app.",
    ],
  }),

  collab_activity_cut: a({
    title: "Actividad del corte",
    paragraphs: [
      "Eventos recientes (movimientos, cambios) atribuibles al período seleccionado en este workspace. Cuenta interacciones, no solo dinero.",
    ],
  }),

  widget_activity_actor: a({
    title: "Actividad por actor",
    paragraphs: [
      "Quién generó más eventos en el período dentro del workspace. En uso solo no verás mucha variedad; en equipos muestra distribución de carga.",
    ],
  }),

  widget_health_center: a({
    title: "Centro de salud financiera",
    paragraphs: [
      "Síntesis de liquidez ajustada, capacidad de ahorro, cobertura de meses con gasto actual, ratio deuda/ingreso y próximos pagos/cobros.",
      "Va de la mano de los KPI inferiores pero los interpreta en un solo relato.",
    ],
  }),

  health_real_liquidity: a({
    title: "Liquidez real (centro de salud)",
    paragraphs: [
      "Coincide con la idea de dinero libre real: cuánta caja queda en términos conservadores frente a obligaciones cercanas.",
    ],
  }),

  health_savings_capacity: a({
    title: "Capacidad de ahorro (centro de salud)",
    paragraphs: [
      "Mismo ratio que en el bloque avanzado: qué fracción de los ingresos del período quedó como ahorro neto. Valores altos indican margen; negativos o cero, tensión.",
    ],
    chart: "savings-capacity",
  }),

  health_coverage_months: a({
    title: "Cobertura mensual",
    paragraphs: [
      "Aproximación de cuántos meses podrías cubrir con tu colchón actual si el gasto reciente se mantuviera. Si no hay gasto o datos, puede mostrarse “Sin dato”.",
    ],
    example: "Liquidez conservadora S/ 9 000 y gasto mensual reciente S/ 3 000 → ~3 meses de cobertura.",
  }),

  health_debt_to_income: a({
    title: "Deuda / ingreso",
    paragraphs: [
      "Relación entre lo que debes (pasivo relevante) y tus ingresos del período. Un ratio alto sugiere que gran parte de lo que entra ya está comprometida con deuda.",
    ],
  }),

  health_next_payable: a({
    title: "Lo próximo a pagar",
    paragraphs: [
      "El compromiso de pago con vencimiento más cercano que el sistema encontró, con monto y fecha.",
    ],
  }),

  health_next_receivable: a({
    title: "Lo próximo a cobrar",
    paragraphs: [
      "El cobro pendiente más cercano: quién te debe y cuándo esperas ese dinero.",
    ],
  }),

  widget_activity_timeline: a({
    title: "Actividad reciente",
    paragraphs: [
      "Feed de eventos del workspace: altas, cambios en cuentas, movimientos relevantes. Es el historial narrativo complementario a los números.",
    ],
  }),

  widget_pro_command_center: a({
    title: "Acciones y foco",
    paragraphs: [
      "Agrupa lo operativo: enlaces a tareas concretas (cobrar, pagar, categorizar, presupuestos), un resumen de entradas y salidas en los próximos 7 días (misma lógica que el flujo futuro pero en formato compacto), una estimación simple de liquidez al cierre del mes calendario y una sola recomendación prioritaria para no saturar.",
      "La bandeja Por revisar (widget aparte) concentra la cola de mantenimiento: categorías, duplicados, metadata, suscripciones y cartera.",
    ],
    bullets: [
      "Las acciones se ordenan por urgencia aproximada; no sustituyen el módulo completo de alertas.",
      "La cierre de mes extrapola el neto diario del mes en curso: es orientativa.",
    ],
  }),

  widget_review_inbox: a({
    title: "Por revisar",
    paragraphs: [
      "Lista accionable de pendientes que ensucian datos o decisiones: movimientos sin categoría, pendientes de aplicar, posibles duplicados de gasto, señales de baja confianza en metadata (p. ej. importaciones), suscripciones activas sin cuenta o con vencimiento pasado, obligaciones sin plan claro, cartera viva sin actividad reciente y compromisos vencidos.",
    ],
    bullets: [
      "Solo aparecen filas con conteo mayor que cero; si todo está en cero, la bandeja muestra estado al día.",
      "Los enlaces llevan a movimientos, suscripciones u obligaciones según el tipo de pendiente.",
    ],
  }),

  dashboard_period_close: a({
    title: "Cierre estimado (mes calendario)",
    paragraphs: [
      "Proyecta la liquidez (efectivo, banco y ahorros) al último día del mes en curso extrapolando el neto diario observado en el mes hasta hoy. No sustituye un flujo de caja formal ni incluye inversiones u otras cuentas fuera de liquidez inmediata.",
    ],
  }),

  dashboard_goal_simple: a({
    title: "Meta de ahorro en resumen",
    paragraphs: [
      "Muestra el avance del neto del mes calendario frente a la meta guardada (Supabase o respaldo local). La edición del monto sigue en el widget Meta y disciplina.",
    ],
  }),

  widget_pro_intelligence_digest: a({
    title: "Insights del período",
    paragraphs: [
      "Resume hasta tres señales del motor de aprendizaje, añade lecturas rápidas (concentración en una cuenta, colchón en días) y lista gastos o categorías que se salieron del patrón frente al período anterior.",
      "La fila “Movimientos por revisar” resume pendientes y sin categoría con enlace a movimientos; el detalle sigue en Calidad de datos.",
    ],
  }),

  widget_pro_goals_strip: a({
    title: "Meta y disciplina",
    paragraphs: [
      "La meta de ahorro neto del mes se guarda en Supabase asociada a tu usuario y al workspace. Compara el neto del mes calendario (movimientos aplicados) con ese tope y muestra cuántos días distintos hubo movimientos aplicados en el mes.",
    ],
    bullets: [
      "Si aún no ejecutaste la migración SQL del repo, la app puede recurrir al almacenamiento local del navegador como respaldo al guardar.",
      "Metas largas (fondo de emergencia, deuda, compra) encajan mejor en una futura entidad de metas más completa.",
    ],
  }),
};

const SIMPLE_FALLBACK: DashboardMetricSimpleWords = {
  paragraphs: [
    "Este bloque muestra un número o mensaje sobre tu dinero en el dashboard.",
    "Todavía estamos completando la explicación más sencilla para este indicador. Leé el texto de arriba: si una palabra suena rara, fijate en el título del bloque en la pantalla principal.",
  ],
};

export function getDashboardMetricHelp(metricId: string): DashboardMetricHelpResolved {
  const found = DASHBOARD_METRIC_HELP[metricId];
  const simple = DASHBOARD_HELP_SIMPLE_WORDS[metricId] ?? SIMPLE_FALLBACK;

  if (found) {
    return {
      ...found,
      simpleWords: found.simpleWords ?? simple,
    };
  }

  return {
    title: "Indicador",
    paragraphs: [
      "Todavía no tenemos una guía detallada para este bloque. Mientras tanto, revisa el subtítulo del widget en el dashboard o la sección correspondiente en la app.",
    ],
    simpleWords: simple,
  };
}

/** Catálogo para documentación: id interno y etiqueta visible. */
export const DASHBOARD_INDICATOR_CATALOG: Array<{
  id: string;
  label: string;
  scope: "simple" | "pro" | "both";
}> = [
  { id: "panel_control", label: "Panel de control del dashboard", scope: "both" },
  { id: "kpi_total_money", label: "Dinero total", scope: "both" },
  { id: "kpi_receivable", label: "Te deben", scope: "both" },
  { id: "kpi_payable", label: "Debes", scope: "both" },
  { id: "kpi_period_savings", label: "Ahorro del período", scope: "both" },
  { id: "kpi_income", label: "Ingresos", scope: "both" },
  { id: "kpi_expense", label: "Gastos", scope: "both" },
  { id: "dashboard_period_close", label: "Cierre estimado (mes calendario)", scope: "both" },
  { id: "dashboard_goal_simple", label: "Meta de ahorro en resumen", scope: "both" },
  { id: "kpi_real_free_money", label: "Dinero libre real", scope: "both" },
  { id: "kpi_avg_daily_spend", label: "Promedio diario", scope: "both" },
  { id: "kpi_active_subscriptions", label: "Suscripciones activas", scope: "both" },
  { id: "kpi_upcoming_payments", label: "Pagos próximos", scope: "both" },
  { id: "kpi_overdue", label: "Vencido", scope: "both" },
  { id: "kpi_transferred", label: "Transferido", scope: "both" },
  { id: "adv_net_worth", label: "Patrimonio neto ampliado", scope: "pro" },
  { id: "adv_liquidity", label: "Liquidez disponible", scope: "pro" },
  { id: "adv_cash", label: "Efectivo", scope: "pro" },
  { id: "adv_bank", label: "Bancos", scope: "pro" },
  { id: "adv_savings", label: "Ahorros", scope: "pro" },
  { id: "adv_projected_cash_30", label: "Caja proyectada 30 días", scope: "pro" },
  { id: "shared_portfolio", label: "Cartera compartida (tarjeta)", scope: "pro" },
  { id: "shared_principal", label: "Principal compartido", scope: "pro" },
  { id: "shared_pending", label: "Pendiente compartido", scope: "pro" },
  { id: "shared_receivable", label: "Créditos compartidos", scope: "pro" },
  { id: "shared_payable", label: "Deudas compartidas", scope: "pro" },
  { id: "adv_avg_weekly_spend", label: "Gasto semanal medio", scope: "pro" },
  { id: "adv_avg_monthly_savings", label: "Ahorro mensual medio", scope: "pro" },
  { id: "adv_savings_capacity", label: "Capacidad de ahorro (%)", scope: "pro" },
  { id: "adv_top_account", label: "Cuenta con mayor saldo", scope: "pro" },
  { id: "adv_bottom_account", label: "Cuenta con menor saldo", scope: "pro" },
  { id: "adv_latest_income", label: "Último ingreso", scope: "pro" },
  { id: "adv_latest_movement", label: "Último movimiento", scope: "pro" },
  { id: "widget_review_inbox", label: "Por revisar (bandeja)", scope: "both" },
  { id: "widget_savings_trend", label: "Cronológicos del período", scope: "both" },
  { id: "widget_period_radar", label: "Radar del período", scope: "pro" },
  { id: "radar_top_category", label: "Radar: categoría más pesada", scope: "pro" },
  { id: "radar_prev_category", label: "Radar: la que más pesaba antes", scope: "pro" },
  { id: "radar_opportunity", label: "Radar: oportunidad más clara", scope: "pro" },
  { id: "radar_best_day", label: "Radar: mejor día de ahorro", scope: "pro" },
  { id: "widget_accounts_breakdown", label: "Dinero por cuenta", scope: "both" },
  { id: "widget_receivable_leaders", label: "Quiénes más te deben", scope: "both" },
  { id: "widget_payable_leaders", label: "A quiénes más debes", scope: "both" },
  { id: "widget_category_comparison", label: "Comparativo por categorías", scope: "both" },
  { id: "widget_monthly_pulse", label: "Pulso mensual", scope: "pro" },
  { id: "widget_budgets", label: "Presupuestos del período", scope: "both" },
  { id: "budget_ceiling", label: "Presupuesto: techo activo", scope: "both" },
  { id: "budget_consumed", label: "Presupuesto: consumido", scope: "both" },
  { id: "budget_remaining", label: "Presupuesto: restante", scope: "both" },
  { id: "budget_at_risk", label: "Presupuesto: en riesgo / excedidos", scope: "both" },
  { id: "widget_weekly_pattern", label: "Ritmo semanal", scope: "pro" },
  { id: "widget_upcoming_recent", label: "Lo que viene / movimientos recientes", scope: "both" },
  { id: "widget_obligation_watch", label: "Estado créditos y deudas", scope: "pro" },
  { id: "obligation_due_soon", label: "Obligaciones: por vencer", scope: "pro" },
  { id: "obligation_overdue_block", label: "Obligaciones: vencido (bloque)", scope: "pro" },
  { id: "obligation_collected_period", label: "Obligaciones: cobrado este corte", scope: "pro" },
  { id: "obligation_paid_period", label: "Obligaciones: pagado este corte", scope: "pro" },
  { id: "obligation_bucket_due_soon", label: "Obligaciones: cubeta por vencer", scope: "pro" },
  { id: "obligation_bucket_overdue_1_30", label: "Obligaciones: vencido 1-30 d", scope: "pro" },
  { id: "obligation_bucket_overdue_31_60", label: "Obligaciones: vencido 31-60 d", scope: "pro" },
  { id: "obligation_bucket_overdue_61_plus", label: "Obligaciones: vencido 61+ d", scope: "pro" },
  { id: "obligation_bucket_on_track", label: "Obligaciones: al día", scope: "pro" },
  { id: "widget_future_flow", label: "Proyección flujo futuro", scope: "pro" },
  { id: "future_flow_window", label: "Flujo: ventana 7/15/30 días", scope: "pro" },
  { id: "widget_alert_center", label: "Alertas y anomalías", scope: "pro" },
  { id: "widget_data_quality", label: "Calidad de datos", scope: "pro" },
  { id: "widget_subscriptions_snapshot", label: "Pulso de suscripciones", scope: "pro" },
  { id: "sub_monthly_cost", label: "Suscripciones: costo mensual", scope: "pro" },
  { id: "sub_active_paused", label: "Suscripciones: activas/pausadas", scope: "pro" },
  { id: "widget_transfer_snapshot", label: "Transferencias internas", scope: "pro" },
  { id: "transfer_total_snapshot", label: "Transferencias: total", scope: "pro" },
  { id: "transfer_count_snapshot", label: "Transferencias: cantidad", scope: "pro" },
  { id: "widget_currency_exposure", label: "Exposición por moneda", scope: "pro" },
  { id: "widget_learning_panel", label: "Aprendiendo de ti", scope: "pro" },
  { id: "learn_movements_useful", label: "Aprendizaje: movimientos útiles", scope: "pro" },
  { id: "learn_history_days", label: "Aprendizaje: historial (días)", scope: "pro" },
  { id: "learn_category_quality", label: "Aprendizaje: calidad categorías", scope: "pro" },
  { id: "learn_confidence", label: "Aprendizaje: confianza actual", scope: "pro" },
  { id: "widget_active_signals", label: "Señales activas", scope: "pro" },
  { id: "widget_workspace_collaboration", label: "Colaboración del workspace", scope: "pro" },
  { id: "collab_role", label: "Colaboración: tu rol", scope: "pro" },
  { id: "collab_personal_count", label: "Colaboración: workspaces personales", scope: "pro" },
  { id: "collab_shared_count", label: "Colaboración: workspaces compartidos", scope: "pro" },
  { id: "collab_activity_cut", label: "Colaboración: actividad del corte", scope: "pro" },
  { id: "widget_activity_actor", label: "Actividad por actor", scope: "pro" },
  { id: "widget_health_center", label: "Centro de salud financiera", scope: "pro" },
  { id: "health_real_liquidity", label: "Salud: liquidez real", scope: "pro" },
  { id: "health_savings_capacity", label: "Salud: capacidad de ahorro", scope: "pro" },
  { id: "health_coverage_months", label: "Salud: cobertura mensual", scope: "pro" },
  { id: "health_debt_to_income", label: "Salud: deuda / ingreso", scope: "pro" },
  { id: "health_next_payable", label: "Salud: próximo a pagar", scope: "pro" },
  { id: "health_next_receivable", label: "Salud: próximo a cobrar", scope: "pro" },
  { id: "widget_activity_timeline", label: "Actividad reciente", scope: "pro" },
  { id: "widget_pro_command_center", label: "Acciones y foco", scope: "pro" },
  { id: "widget_pro_intelligence_digest", label: "Insights del período", scope: "pro" },
  { id: "widget_pro_goals_strip", label: "Meta y disciplina", scope: "pro" },
];

/**
 * Explicaciones en lenguaje muy simple para cada ayuda del dashboard (términos básicos y cómo se calcula).
 * Se combinan en getDashboardMetricHelp; cada clave debe existir en DASHBOARD_METRIC_HELP.
 */

export type DashboardMetricSimpleWords = {
  title?: string;
  paragraphs: string[];
  bullets?: string[];
  example?: string;
};

const S = (x: DashboardMetricSimpleWords): DashboardMetricSimpleWords => x;

export const DASHBOARD_HELP_SIMPLE_WORDS: Record<string, DashboardMetricSimpleWords> = {
  panel_control: S({
    paragraphs: [
      "Este panel es el “mando a distancia” de tu pantalla principal: no cambia tu dinero, solo cambia cuántas cosas ves a la vez.",
      "Vista simple = pocas tarjetas, más fácil de leer. Vista avanzada = más tarjetas con más detalle.",
      "Cada “widget” es un bloque (por ejemplo presupuestos o gráficos). Podés mostrarlo u ocultarlo; la app guarda eso en tu navegador para la próxima vez que entres.",
      "Arriba también están los filtros de categoría y tipo de cuenta: categoría + cuenta (tocás la cuenta en Dinero por cuenta) cambian solo las gráficas de línea y el ritmo semanal; el tipo de cuenta solo achica la lista de cuentas.",
      "Los números grandes del resumen (cuánto tenés, cuánto entró o salió en el período…) no se achican con ese filtro: siguen siendo de todo el período.",
    ],
  }),

  kpi_total_money: S({
    paragraphs: [
      "“Dinero total” es como juntar todo lo que tus cuentas dicen que tenés ahora, en un solo número.",
      "La app suma los saldos de las cuentas que están activas (no las que archivaste). Si tenés varias monedas, las pasa a una sola (la que elegís arriba) para poder sumar.",
    ],
    bullets: [
      "No es solo billetes en la mano: puede incluir ahorros que no pensás gastar esta semana.",
    ],
  }),

  kpi_receivable: S({
    paragraphs: [
      "“Te deben” es plata que alguien te debe según lo que registraste: un préstamo que diste, una venta a plazos, etc.",
      "Todavía no está en tu cuenta hasta que registres el cobro; por eso es distinto del “dinero total”.",
    ],
  }),

  kpi_payable: S({
    paragraphs: [
      "“Debes” es lo que vos todavía tenés que pagar según tus deudas y compromisos cargados en la app.",
      "Sirve para no creer que tenés más plata libre de la que en realidad tenés, porque parte ya está “comprometida”.",
    ],
  }),

  kpi_period_savings: S({
    paragraphs: [
      "“Ahorro del período” responde: en el rango que elegiste arriba (hoy, semana, mes…), ¿te entró más plata de la que salió, o al revés?",
      "Cuenta: ingresos que ya aplicaste menos gastos que ya aplicaste. Las transferencias entre tus cuentas no cuentan como “ganancia” ni como “gasto” del mundo real, para no inflar números.",
    ],
    bullets: [
      "Si el número es positivo: en ese tiempo ganaste más de lo que gastaste.",
      "Si es negativo: gastaste más de lo que entró.",
    ],
  }),

  kpi_income: S({
    paragraphs: [
      "“Ingresos” es la suma de todo lo que marcás como plata que entró en el período: sueldo, cobros, etc.",
      "Es como anotar en un cuaderno cada vez que alguien te deja dinero de verdad en tus cuentas (según lo que registraste).",
    ],
  }),

  kpi_expense: S({
    paragraphs: [
      "“Gastos” es la suma de lo que salió de tus cuentas en el período: compras, servicios, pagos, etc.",
      "La flechita o porcentaje al lado compara con el período anterior: si subió, gastaste más que en la referencia.",
    ],
  }),

  kpi_real_free_money: S({
    paragraphs: [
      "“Dinero libre real” es una idea conservadora: no solo cuánto tenés, sino cuánto te quedaría “cómodo” si en poco tiempo tenés que pagar cosas que ya están en el calendario.",
      "La app resta o considera pagos cercanos; por eso puede ser menor que el saldo que ves en el banco.",
    ],
  }),

  kpi_avg_daily_spend: S({
    paragraphs: [
      "Primero suma todo lo que gastaste en el período. Después divide por la cantidad de días de ese período.",
      "Ejemplo con números fáciles: si en 10 días gastaste S/ 100 en total, el promedio diario es S/ 10 (porque 100 ÷ 10 = 10).",
    ],
  }),

  kpi_active_subscriptions: S({
    paragraphs: [
      "Suscripción = algo que te cobra seguido (streaming, gimnasio, etc.). “Activas” son las que no pausaste ni cancelaste.",
      "El número en soles (o tu moneda) es un “por mes aproximado”: la app convierte cada una a mensual y las suma.",
    ],
  }),

  kpi_recurring_income: S({
    paragraphs: [
      "Ingreso fijo = algo que te llega seguido (sueldo, alquiler cobrado, honorario mensual). “Activos” son los que no pausaste ni cancelaste.",
      "El monto mostrado es un “por mes aproximado”: la app convierte cada uno a mensual y los suma. Es tu base de ingresos garantizada.",
    ],
  }),

  kpi_upcoming_payments: S({
    paragraphs: [
      "Suma lo que tendrías que pagar en los próximos ~30 días según fechas que ya cargaste: cuotas por pagar y próximos cobros de suscripciones activas.",
      "No mete lo que está marcado como “por cobrar” ni los ingresos fijos esperados (eso sería plata que te entraría, no que saldría).",
      "En la lista de la pantalla solo ves unos pocos ítems; el total de la tarjeta suma todos los que entran en esos 30 días.",
    ],
  }),

  kpi_overdue: S({
    paragraphs: [
      "“Vencido” es deuda o cuota tuya (en tu espacio) con fecha que ya pasó y todavía tiene algo pendiente de pagar.",
      "Es una señal de “revisá esto”: registrar el pago, negociar o corregir la fecha.",
    ],
  }),

  kpi_transferred: S({
    paragraphs: [
      "Transferencia = moviste plata de una cuenta tuya a otra cuenta tuya. No ganaste ni perdiste en el mundo: solo cambió de cajón.",
      "Por eso no cuenta como ingreso “nuevo” en el resultado del período, pero sí muestra cuánto te movés entre cuentas.",
    ],
  }),

  kpi_savings_rate: S({
    paragraphs: [
      "El porcentaje responde: de todo lo que te entró en el período, ¿cuánto te quedó después de pagar gastos?",
      "Se hace así: primero restás gastos a ingresos (eso es el “ahorro neto” del período). Después dividís ese resultado por los ingresos y lo pasás a porcentaje.",
      "Si no hubo ingresos o los números no alcanzan, la app muestra “Sin dato”.",
    ],
    example:
      "Entraron S/ 100, gastaste S/ 70 → te quedaron S/ 30. 30 ÷ 100 = 0,30 → 30% de capacidad de ahorro en ese período.",
  }),

  kpi_coverage_months: S({
    paragraphs: [
      "Imaginá cuántos meses podrías “pagar gastos” con la plata líquida que la app cree que tenés, si el gasto del mes se repitiera igual.",
      "No es un pronóstico de la vida real: es un número redondo para ver si tenés colchón o no.",
    ],
    example: "Tenés unos S/ 9 000 listos y gastás unos S/ 3 000 por mes → más o menos 3 meses de cobertura.",
  }),

  kpi_debt_income: S({
    paragraphs: [
      "Compara cuánto debés (deudas y obligaciones que la app cuenta) con cuánto te entró en el período.",
      "Si el porcentaje es alto, mucho de lo que ingresa ya está “comprometido” con deuda.",
    ],
  }),

  adv_net_worth: S({
    paragraphs: [
      "Patrimonio = lo que tenés menos lo que debés, en una foto amplia.",
      "La app hace algo parecido a: dinero en cuentas + lo que te deben − lo que vos debés (según lo registrado).",
    ],
    example: "Tenés S/ 10 000 en cuentas, te deben S/ 2 000 y vos debés S/ 5 000 → algo como S/ 7 000 de “patrimonio neto ampliado”.",
  }),

  adv_liquidity: S({
    paragraphs: [
      "Liquidez = plata que podés usar pronto, sin vender cosas grandes ni esperar mucho.",
      "En el resumen ves el total, cuánto hay en efectivo, banco y ahorro, y también cuánto te “sobra” si restás pagos que se ven venir en un mes.",
    ],
  }),

  adv_cash: S({
    paragraphs: [
      "Es lo que registraste como efectivo o billetera: plata que imaginás tener física o en medios muy inmediatos.",
    ],
  }),

  adv_bank: S({
    paragraphs: [
      "Suma de lo que tenés en cuentas bancarias que cargaste en la app como cuentas de banco.",
    ],
  }),

  adv_savings: S({
    paragraphs: [
      "Cuentas que marcaste como “ahorro”: donde guardás plata que no querés gastar en el día a día.",
    ],
  }),

  adv_projected_cash_30: S({
    paragraphs: [
      "Parte de la plata líquida que tenés hoy y mira qué pagos y cobros “programados” ya cargaste para el mes que viene.",
      "Te da una idea de cómo podría quedar la caja; si falta data, se equivoca como cualquier pronóstico casero.",
    ],
  }),

  shared_portfolio: S({
    paragraphs: [
      "A veces otra persona te “comparte” sus deudas o créditos para que vos solo los veas, sin mezclarlos con los tuyos.",
      "Este bloque muestra eso aparte, para que no sumes por error su deuda como si fuera tuya.",
    ],
  }),

  shared_principal: S({
    paragraphs: [
      "Es el “monto original” sumado de deudas o créditos que otra persona te mostró para que solo los mires.",
      "No es plata tuya: solo te dice qué tan grande era el préstamo o crédito en su mundo.",
    ],
  }),

  shared_pending: S({
    paragraphs: [
      "Lo que falta pagar o cobrar en esos mismos registros compartidos.",
      "Va aparte de tus números propios, para que no los mezcles sin querer.",
    ],
  }),

  shared_receivable: S({
    paragraphs: [
      "Del lado de quien creó el registro: es plata que le deben a esa persona. Vos lo ves para entender, no como tu ingreso automático.",
    ],
  }),

  shared_payable: S({
    paragraphs: [
      "Del lado de quien creó el registro: es plata que esa persona todavía debe. Vos lo ves como contexto.",
    ],
  }),

  adv_avg_weekly_spend: S({
    paragraphs: [
      "Igual que el promedio diario, pero en semanas: se suma el gasto del período y se divide por cuántas semanas cubre ese período.",
      "Ejemplo: si en 2 semanas gastaste S/ 200, el promedio semanal es ~S/ 100.",
    ],
  }),

  adv_avg_monthly_savings: S({
    paragraphs: [
      "“Pulso mensual” es un bloque del dashboard que muestra varios meses seguidos (hasta seis). En cada mes la app suma entradas y salidas y hace una resta.",
      "A esa resta la llamamos “neto del mes” o “net”: es lo que sobra si en ese mes entró más de lo que salió. Si salió más que lo que entró, el neto sale negativo.",
      "“Ahorro mensual medio” toma el neto de cada uno de esos meses del pulso, los suma y divide por cuántos meses son. Eso es un promedio escolar: (mes1 + mes2 + mes3) ÷ 3.",
      "Ese pulso mensual se arma con todos los movimientos; el filtro de categoría de arriba no lo achica.",
      "La frase “Capacidad actual X%” es otra cosa: mira solo el período que elegiste arriba (hoy/semana/mes…). Ahí hace: (ingresos − gastos) ÷ ingresos. Si no hubo ingresos, el porcentaje no tiene sentido y puede verse 0%.",
    ],
    example:
      "Enero te sobraron S/ 100, febrero S/ 200, marzo perdiste S/ 50 → (100+200−50) ÷ 3 = 250 ÷ 3 ≈ S/ 83 por mes de promedio. Si este mes ingresaste S/ 4 000 y te sobraron S/ 640, la capacidad de ahorro de ese mes es 640 ÷ 4000 = 0,16 → 16%.",
  }),

  adv_savings_capacity: S({
    paragraphs: [
      "Te responde: “de cada sol que entró en el período, ¿cuántos centavos me quedaron?”",
      "Cuenta: (todo lo que entró − todo lo que salió de gastos) dividido todo lo que entró, y lo muestra en porcentaje.",
    ],
    example: "Entró S/ 100 y gastaste S/ 84 → te quedaron S/ 16 → 16 de cada 100 → 16%.",
  }),

  adv_top_account: S({
    paragraphs: [
      "La app mira todas tus cuentas activas y encuentra la que tiene más saldo ahora.",
      "También dice qué parte del total representa, para ver si tenés todo en un solo lugar.",
    ],
  }),

  adv_bottom_account: S({
    paragraphs: [
      "Lo opuesto: la cuenta activa con menos saldo (entre las que miramos). Sirve para ver si alguna quedó casi vacía.",
    ],
  }),

  adv_latest_income: S({
    paragraphs: [
      "El último movimiento que la app considera “te entró plata” (según cómo lo registraste), con fecha y monto.",
    ],
  }),

  adv_latest_movement: S({
    paragraphs: [
      "El último movimiento que ya aplicaste, sin importar si fue gasto, ingreso o transferencia.",
    ],
  }),

  widget_savings_trend: S({
    paragraphs: [
      "Un gráfico día por día: podés ver cómo sube o baja lo acumulado (ahorro, gasto, ingreso o transferencias según la pestaña).",
      "La línea “comparación” es el mismo día pero en el período anterior, para ver si hoy vas mejor o peor que antes.",
    ],
  }),

  widget_period_radar: S({
    paragraphs: [
      "Radar = vista rápida con pocas frases grandes: dónde gastás más, qué cambió respecto al período anterior y qué día te fue mejor.",
      "Estos cuatro recuadros miran todo el período que elegiste arriba. No usan el filtro de categoría/cuenta que a veces ves en la franja dorada de otros gráficos.",
    ],
  }),

  radar_top_category: S({
    paragraphs: [
      "Categoría = etiqueta que le ponés al gasto (comida, transporte…). “La más pesada” es donde más plata gastaste en este período.",
      "El porcentaje dice: de todo lo que gastaste, qué parte se fue ahí.",
    ],
  }),

  radar_prev_category: S({
    paragraphs: [
      "Muestra qué categoría dominaba en el período de comparación (por ejemplo el mes pasado). Así ves si cambiaste hábitos.",
    ],
  }),

  radar_opportunity: S({
    paragraphs: [
      "“Oportunidad” acá significa: una categoría en la que gastaste bastante más que en el período anterior.",
      "No es mala palabra: es un lugar donde, si querés ahorrar, podés mirar primero.",
    ],
  }),

  radar_best_day: S({
    paragraphs: [
      "Día a día la app hace: lo que entró − lo que salió. El “mejor día” es cuando esa resta te dio el número más alto.",
    ],
  }),

  widget_accounts_breakdown: S({
    paragraphs: [
      "Parte el “dinero total” en porciones: cuánto está en cada cuenta y qué parte del pastel es cada una.",
      "Si tocás una cuenta, podés prender o apagar un filtro: las otras gráficas de tendencia y el ritmo semanal se quedan solo con movimientos de esa cuenta.",
    ],
  }),

  widget_receivable_leaders: S({
    paragraphs: [
      "Ranking de personas o entidades a las que les prestaste o que te deben: ordenados por quién concentra más monto pendiente.",
    ],
  }),

  widget_payable_leaders: S({
    paragraphs: [
      "Ranking de a quién le debes más plata según tus registros. Ayuda a decidir a quién pagar primero.",
    ],
  }),

  widget_category_comparison: S({
    paragraphs: [
      "Para cada etiqueta de gasto (categoría), compara dos ventanas de tiempo: “ahora” y “antes”.",
      "La diferencia (delta) es una resta simple: gasto de ahora − gasto de antes. Si sale positivo, gastaste más que antes en esa categoría.",
      "Los montos de la tabla siempre son del período completo. Pero si tocás una categoría, ayudás a filtrar otras pantallas: las líneas de tiempo y el ritmo semanal pueden quedarse solo con esa categoría.",
    ],
  }),

  widget_monthly_pulse: S({
    paragraphs: [
      "“Pulso” es solo el nombre del bloque: late mes a mes. Cada columna es un mes.",
      "En cada mes: barra verde ≈ entradas, barra roja/naranja ≈ salidas. El resultado del mes es entradas − salidas (eso es el “neto” de ese mes).",
      "Acá la app usa todos los movimientos juntos; no importa si activaste filtro de categoría arriba para otras gráficas.",
    ],
  }),

  widget_budgets: S({
    paragraphs: [
      "Presupuesto = techo de gasto que te pusiste (por ejemplo “máximo S/ 500 en comida este mes”).",
      "La app mira cuánto ya gastaste de ese techo y si vas en camino de pasarte.",
    ],
  }),

  budget_ceiling: S({
    paragraphs: [
      "Techo = el límite que definiste. Si sumás todos los techos de los presupuestos activos del período, obtenés este número.",
    ],
  }),

  budget_consumed: S({
    paragraphs: [
      "Consumido = cuánto de ese techo ya se “comió” con movimientos reales del período.",
    ],
  }),

  budget_remaining: S({
    paragraphs: [
      "Restante = techo − consumido. Si es chico, te queda poco margen antes de tocar el límite.",
    ],
  }),

  budget_at_risk: S({
    paragraphs: [
      "Cuenta cuántos presupuestos están en alerta o ya pasaron el límite. Es un número de “focos”, no un solo monto.",
    ],
  }),

  widget_weekly_pattern: S({
    paragraphs: [
      "Junta gastos e ingresos por día de la semana: lunes, martes… Así ves si por ejemplo los sábados siempre gastás más.",
      "Si tenés filtro de categoría o cuenta prendido (igual que en el gráfico de líneas), este bloque usa los mismos movimientos recortados.",
    ],
  }),

  widget_upcoming_recent: S({
    paragraphs: [
      "Un lado: lo que se viene en las próximas semanas (suscripciones, cuotas…), mirando desde hoy.",
      "Otro lado: movimientos que ya registraste, para entender qué pasó en el período que comparás arriba.",
    ],
  }),

  widget_obligation_watch: S({
    paragraphs: [
      "Obligación = deuda o crédito que registraste con cuotas y fechas. Este bloque muestra si vas al día, qué está por vencer y qué ya pasó de fecha.",
    ],
  }),

  obligation_due_soon: S({
    paragraphs: [
      "Suma de montos que vencen pronto según las fechas que cargaste. “Pronto” lo define la app con una ventana de días.",
    ],
  }),

  obligation_overdue_block: S({
    paragraphs: [
      "Plata que ya pasó la fecha y todavía figura pendiente en tus registros.",
    ],
  }),

  obligation_collected_period: S({
    paragraphs: [
      "En el período que elegiste arriba, cuánto cobraste de esos créditos (gente que te pagó).",
    ],
  }),

  obligation_paid_period: S({
    paragraphs: [
      "En el período elegido, cuánto pagaste de tus deudas. Baja lo que debés, no es “gasto nuevo” del aire.",
    ],
  }),

  obligation_bucket_due_soon: S({
    paragraphs: [
      "Agrupa obligaciones que entran en la categoría “por vencer pronto” para ver cuántas son y cuánto suman.",
    ],
  }),

  obligation_bucket_overdue_1_30: S({
    paragraphs: [
      "Vencido hace poco (entre 1 y 30 días). Sirve para priorizar antes de que crezca el problema.",
    ],
  }),

  obligation_bucket_overdue_31_60: S({
    paragraphs: [
      "Lleva más tiempo vencido (31 a 60 días). Suele pedir un plan: pagos parciales o acuerdo.",
    ],
  }),

  obligation_bucket_overdue_61_plus: S({
    paragraphs: [
      "Lo más atrasado. Requiere revisión fuerte: es la cola más vieja de la cartera.",
    ],
  }),

  obligation_bucket_on_track: S({
    paragraphs: [
      "Cosas que siguen vivas pero sin apuro inmediato según fechas: todavía no entraron en la zona roja.",
    ],
  }),

  widget_future_flow: S({
    paragraphs: [
      "Mira hacia adelante: suma cobros y pagos que la app ya conoce para los próximos 7, 15 o 30 días.",
      "Arriba repite la idea de “si el mes sigue como va, ¿cuánta caja líquida podrías tener al cerrar el mes?” — es una cuenta aproximada, no un valor contable perfecto.",
    ],
  }),

  future_flow_window: S({
    paragraphs: [
      "Cada tarjeta es un horizonte (por ejemplo 15 días). Resta del saldo líquido de partida lo que espera que salga y suma lo que espera que entre.",
    ],
  }),

  widget_alert_center: S({
    paragraphs: [
      "La app detecta cosas raras o urgentes: mucho gasto de golpe, presupuestos al límite, duplicados posibles, etc.",
      "Es una lista de “mirá acá primero”, no un juicio moral.",
    ],
  }),

  widget_data_quality: S({
    paragraphs: [
      "Cuenta cosas incompletas: movimientos sin categoría, pendientes de aplicar, suscripciones sin cuenta, etc.",
      "Mientras más limpio esté todo, los gráficos y comparaciones se parecen más a la vida real.",
    ],
  }),

  widget_subscriptions_snapshot: S({
    paragraphs: [
      "Resume tus pagos recurrentes: cuántas tenés, cuánto cuestan al mes aproximado y qué viene por cobrar.",
    ],
  }),

  sub_monthly_cost: S({
    paragraphs: [
      "Suma mensual aproximada: la app convierte cada suscripción a “cuánto es al mes” según si paga cada semana, mes, año, etc.",
    ],
  }),

  sub_active_paused: S({
    paragraphs: [
      "Activas = siguen corriendo. Pausadas = las frenaste un tiempo; suelen no sumar al costo hasta que las vuelvas a activar.",
    ],
  }),

  widget_transfer_snapshot: S({
    paragraphs: [
      "Muestra cuánto moviste entre tus cuentas y qué rutas usás más (de cuenta A a cuenta B).",
    ],
  }),

  transfer_total_snapshot: S({
    paragraphs: [
      "Un solo número: todo el volumen transferido en el período.",
    ],
  }),

  transfer_count_snapshot: S({
    paragraphs: [
      "Cuántas transferencias fueron. Muchas chicas vs pocas grandes cuenta distinta historia.",
    ],
  }),

  widget_currency_exposure: S({
    paragraphs: [
      "Si tenés soles, dólares, etc., acá ves cuánto hay en cada moneda antes de convertir todo a una vista única.",
    ],
  }),

  widget_learning_panel: S({
    paragraphs: [
      "La app mira cuántos datos útiles tenés (movimientos, meses distintos, categorías…) y te dice en qué “nivel” de consejos podés confiar.",
      "Con pocos datos, los mensajes son genéricos; con muchos, pueden ser más personalizados.",
    ],
  }),

  learn_movements_useful: S({
    paragraphs: [
      "Cuenta movimientos ya aplicados que sirven para aprender patrones. Más movimientos bien cargados = mejor.",
    ],
  }),

  learn_history_days: S({
    paragraphs: [
      "Mide durante cuántos días distintos tenés historia. No alcanza con tener 100 movimientos el mismo día: hace falta repartirse en el tiempo.",
    ],
  }),

  learn_category_quality: S({
    paragraphs: [
      "Porcentaje de movimientos que tienen categoría. Sin categoría, es más difícil saber en qué se fue la plata.",
    ],
  }),

  learn_confidence: S({
    paragraphs: [
      "Una nota resumida: ¿la app ya “conoce” bastante tu caso para darte mejores pistas? Sube cuando mejorás categorías y cantidad de datos.",
    ],
  }),

  widget_active_signals: S({
    paragraphs: [
      "Patrones que ya se pueden ver con tus números: por ejemplo gastos que se concentran en un día o en una categoría.",
    ],
  }),

  widget_workspace_collaboration: S({
    paragraphs: [
      "Workspace = espacio de trabajo (puede ser solo tuyo o compartido con familia/equipo). Acá ves tu rol y cuánta actividad hubo.",
    ],
  }),

  collab_role: S({
    paragraphs: [
      "Rol = qué podés hacer: algunos pueden editar todo, otros solo mirar. Depende de cómo te invitaron.",
    ],
  }),

  collab_personal_count: S({
    paragraphs: [
      "Cuántos espacios personales tenés en tu cuenta (no implica cuál está abierto ahora).",
    ],
  }),

  collab_shared_count: S({
    paragraphs: [
      "Cuántos espacios compartidos tenés. El dashboard siempre usa el que está seleccionado arriba.",
    ],
  }),

  collab_activity_cut: S({
    paragraphs: [
      "Cuenta eventos (cambios, movimientos registrados) en el período que elegiste. Mide actividad, no solo plata.",
    ],
  }),

  widget_activity_actor: S({
    paragraphs: [
      "En equipos, quién hizo más cosas en el período. Solo vos = casi todo sale a tu nombre.",
    ],
  }),

  widget_health_center: S({
    paragraphs: [
      "Junta varias “notas” sobre tu salud financiera: liquidez, ahorro, cuántos meses cubrís si dejás de ingresar, deuda vs ingreso, próximos pagos.",
      "Esas cuentas miran todo el workspace y el período de arriba; no usan el filtro chico de una sola categoría que a veces prendés para otros gráficos.",
    ],
  }),

  health_real_liquidity: S({
    paragraphs: [
      "Igual idea que “dinero libre real”: plata disponible pensando en lo que se viene.",
    ],
  }),

  health_savings_capacity: S({
    paragraphs: [
      "Misma idea que capacidad de ahorro: de lo que entró, qué parte te quedó. Se expresa en porcentaje.",
    ],
  }),

  health_coverage_months: S({
    paragraphs: [
      "Si gastás más o menos lo mismo cada mes, ¿cuántos meses podrías aguantar con el colchón que tenés hoy?",
      "Cuenta: colchón ÷ gasto mensual reciente (redondeado). Si falta data, puede no mostrarse.",
    ],
  }),

  health_debt_to_income: S({
    paragraphs: [
      "Compara lo que debés (grande) con lo que te entró en el período. Si la deuda es muy grande respecto a lo que entró, la señal es de alerta.",
    ],
  }),

  health_next_payable: S({
    paragraphs: [
      "El próximo pago que la app encontró con fecha: a quién o qué y cuánto.",
    ],
  }),

  health_next_receivable: S({
    paragraphs: [
      "El próximo cobro que deberías recibir según tus registros.",
    ],
  }),

  widget_activity_timeline: S({
    paragraphs: [
      "Lista de cosas que pasaron en el workspace: como un diario de “hoy se creó esto, se cambió aquello”.",
    ],
  }),

  widget_pro_command_center: S({
    paragraphs: [
      "Mezcla tareas con enlaces (ir a pagar, categorizar…), un resumen de la semana próxima y una frase de recomendación.",
      "La bandeja “Por revisar” es otra tarjeta: ahí está la lista de pendientes de mantenimiento.",
    ],
  }),

  widget_review_inbox: S({
    paragraphs: [
      "Es una lista de tareas de limpieza: cosas sin terminar de cargar o que pueden estar mal.",
      "Cada fila te dice cuántos casos hay y te manda al lugar para arreglarlos (movimientos, suscripciones, deudas…).",
    ],
  }),

  dashboard_period_close: S({
    paragraphs: [
      "Mira el mes calendario actual (del 1 al último día del mes). Toma cuánto te sobra o falta por día en promedio hasta hoy y proyecta el último día.",
      "Solo usa cuentas “líquidas” (efectivo, banco, ahorros que la app trata como caja). No es un informe contable oficial.",
    ],
  }),

  dashboard_goal_simple: S({
    paragraphs: [
      "Meta = número que te pusiste como objetivo de ahorro del mes. La app compara con lo que ya pasó en el mes (ingresos − gastos aplicados).",
      "El porcentaje es: cuánto llevás del camino hacia esa meta. Si no hay meta guardada, te indica dónde configurarla (en el widget Meta y disciplina de la vista avanzada).",
    ],
  }),

  widget_pro_intelligence_digest: S({
    paragraphs: [
      "Textos cortos que resumen patrones: qué categoría se disparó, si una cuenta concentra mucho, etc.",
      "“Movimientos por revisar” apunta a cosas sin categoría o pendientes; el detalle fino está en Calidad de datos.",
    ],
  }),

  widget_pro_goals_strip: S({
    paragraphs: [
      "Acá podés escribir cuánto querés ahorrar este mes. La app guarda ese número (en el servidor si ya configuraste la base de datos, o en el navegador como respaldo).",
      "Compara ese número con el resultado del mes (entradas − gastos) y muestra una barra de progreso. La “racha” cuenta días distintos en los que registraste algo.",
    ],
  }),
};

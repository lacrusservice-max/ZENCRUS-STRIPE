/**
 * ACCIONES QUE ZENA PROPONE Y CONFIRMA EL USUARIO — §10
 * ═════════════════════════════════════════════════════
 *
 * El §10 divide las herramientas por riesgo. Las de riesgo alto —«Confirma»—
 * no las ejecuta el backend cuando el modelo las pide: deja una propuesta
 * guardada, la app la pinta con el antes y el después, y se aplica cuando el
 * usuario toca un botón.
 *
 * Hasta ahora las tres que existían escribían directas. Los límites clínicos
 * del §12 ya frenaban lo peligroso —nadie iba a acabar en 800 kcal— pero
 * dentro de lo permitido ZENA cambiaba las calorías de alguien porque una
 * frase le sonó a petición. «Estoy comiendo mucho últimamente» no es «bájame
 * los targets», y la diferencia entre las dos solo la sabe quien la dijo.
 *
 *
 * POR QUÉ EL ANTES IMPORTA MÁS QUE EL DESPUÉS
 * ───────────────────────────────────────────
 * El §10 pide literalmente «2.100 → 1.850 kcal, no solo el valor nuevo». Una
 * tarjeta que dice «tus calorías serán 1.850» obliga a recordar cuántas eran
 * para saber si eso es un ajuste o un despeñadero, y nadie se sabe de memoria
 * sus gramos de grasa. Con las dos cifras al lado, la magnitud del cambio se
 * ve sin pensar — que es exactamente lo que hay que juzgar en dos segundos.
 *
 *
 * QUÉ SE GUARDA Y POR QUÉ ESTÁ REPETIDO
 * ─────────────────────────────────────
 * Cada línea de `cambios` lleva lo que el usuario lee (etiqueta, antes,
 * después) y además `campos`: las claves de `users.goals` que mueve. Parece
 * redundante y no lo es — una línea visible puede mover dos claves, como el
 * objetivo, que escribe `primary` y `main_goal` a la vez. Teniendo las claves
 * dentro de cada línea, aplicar es recorrer y escribir el «después», y
 * deshacer es recorrer y escribir el «antes». No hay una segunda tabla de
 * correspondencias que se pueda desincronizar.
 *
 * `snapshot` guarda aparte el `goals` ENTERO de antes, que es lo que pide el
 * §11 para `plan_versions`. Restaurar, en cambio, solo toca las claves de la
 * acción: si entre la propuesta y el deshacer el usuario cambió a mano otra
 * cosa, devolver el objeto completo se la borraría sin avisar.
 */

import { supabase } from '../config/supabase'
import { logger } from '../config/logger'
import { logAudit } from './auditService'
import {
  perfilClinicoDe, revisarCalorias, revisarProteina, revisarPesoObjetivo,
} from './limitesClinicos'
import { apuntarSenal, evaluarRiesgo } from './cuidado'

/** Cuánto vive una propuesta sin contestar. */
const VIGENCIA_MS = 15 * 60_000

/** Cuánto tiempo se puede deshacer lo ya aplicado. */
const DESHACER_MS = 24 * 60 * 60_000

/**
 * Las herramientas marcadas «Confirma» en el §10.
 *
 * `actualizar_datos_fisicos` NO está aquí a propósito, aunque también escriba:
 * el §10 la marca «Directo» porque apuntar el peso que el usuario acaba de
 * decir en voz alta no es una decisión, es una transcripción. Pedir
 * confirmación para eso convierte el flujo natural —«hoy peso 78»— en dos
 * pasos y enseña al usuario a confirmar sin leer, que es justo lo que arruina
 * las confirmaciones que sí importan.
 */
export const HERRAMIENTAS_QUE_CONFIRMAN = new Set([
  'actualizar_objetivo',
  'actualizar_targets_nutricionales',
  'regenerar_plan',
])

export function requiereConfirmacion(nombre: string | undefined): boolean {
  return Boolean(nombre && HERRAMIENTAS_QUE_CONFIRMAN.has(nombre))
}

// ── Correspondencias de objetivo ──────────────────────────────────────────────
// Viven aquí y no en `aiTools` porque quien las necesita es esto: el único
// sitio que ya escribe el objetivo. Se exportan para que no haya dos copias.

export const OBJETIVO_MAP: Record<string, string> = {
  perder_grasa: 'weight_loss',
  ganar_musculo: 'muscle_gain',
  mantener: 'maintenance',
  recomposicion: 'recomposicion',
  rendimiento: 'performance',
}

export const OBJETIVO_MAIN_GOAL_MAP: Record<string, string> = {
  perder_grasa: 'lose_fat',
  ganar_musculo: 'gain_muscle',
  mantener: 'maintain',
  recomposicion: 'maintain',
  rendimiento: 'maintain',
}

/**
 * Cómo se llama cada objetivo en la tarjeta.
 *
 * ── Por qué hay tres vocabularios y no uno ──────────────────────────────────
 * `goals.primary` no tiene un único juego de valores en producción. El tipo
 * `UserGoal` declara `weight_loss | muscle_gain | maintenance | performance`,
 * que es lo que escribe esta capa; pero el onboarding lleva escribiendo
 * `lose_weight` y `gain_muscle` desde antes, y eso es lo que tienen de verdad
 * TODAS las cuentas que hay hoy.
 *
 * Aquí se aceptan los tres porque el trabajo de este mapa es contarle al
 * usuario qué tenía puesto, y lo que tenía puesto es lo que hay en su fila —
 * no lo que diga el tipo. Con solo el vocabulario declarado, la tarjeta le
 * enseñaría «— → Ganar músculo» a alguien que sí tenía objetivo, que es
 * exactamente la mentira que esta pantalla existe para evitar.
 *
 * ‼️ El desajuste de fondo sigue ahí y no se arregla desde aquí:
 * `mapearObjetivo` en `chatController` tampoco conoce `gain_muscle`, así que
 * cae en 'mantenimiento' y ZENA calcula los macros de estas cuentas como si
 * quisieran mantenerse. Eso mueve los números de todo el mundo y es una
 * decisión aparte.
 */
const OBJETIVO_EN_PANTALLA: Record<string, string> = {
  // El que escribe esta capa.
  weight_loss: 'Perder grasa',
  muscle_gain: 'Ganar músculo',
  maintenance: 'Mantenerme',
  recomposicion: 'Recomposición',
  performance: 'Rendimiento',
  // El que escribe el onboarding, y el que hay en la base.
  lose_weight: 'Perder grasa',
  gain_muscle: 'Ganar músculo',
  maintain: 'Mantenerme',
  lose_fat: 'Perder grasa',
}

/**
 * El objetivo guardado, en palabras.
 *
 * `null` es «no tenía ninguno» y la tarjeta lo pinta como una raya. Un valor
 * que existe pero no sabemos nombrar NO puede colapsar a `null`: se vería
 * igual que no tener objetivo, y son cosas distintas.
 */
export function nombrarObjetivo(guardado: unknown): string | null {
  if (typeof guardado !== 'string' || guardado === '') return null
  return OBJETIVO_EN_PANTALLA[guardado] ?? 'Sin definir'
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Una línea de la tarjeta. `campos` es interno y no viaja a la app. */
export interface Cambio {
  etiqueta: string
  antes: string | number | null
  despues: string | number | null
  unidad?: string
  campos: Record<string, { antes: unknown; despues: unknown }>
}

export interface AccionPendiente {
  id: string
  herramienta: string
  resumen: string
  cambios: Omit<Cambio, 'campos'>[]
  expira_at: string
  /**
   * Debajo de qué mensaje de ZENA va la tarjeta.
   *
   * Vacío en la respuesta al propio mensaje —ahí la app ya sabe dónde está— y
   * lleno al recuperarlas después, que es cuando hace falta para colocarlas.
   */
  message_id?: string | null
}

export type Preparacion =
  | { ok: true; accion: AccionPendiente }
  /** Un rechazo o un «no hay nada que cambiar»: texto que ZENA puede repetir. */
  | { ok: false; motivo: string }

// ── Utilidades ────────────────────────────────────────────────────────────────

async function leerGoals(userId: string): Promise<Record<string, any>> {
  const { data } = await supabase.from('users').select('goals').eq('id', userId).maybeSingle()
  return (data?.goals && typeof data.goals === 'object') ? data.goals : {}
}

async function escribirGoals(userId: string, goals: Record<string, any>): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ goals, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw error
}

/** Sin `campos`: lo que se le manda a la app. */
function paraLaApp(cambios: Cambio[]): Omit<Cambio, 'campos'>[] {
  return cambios.map(({ campos: _campos, ...resto }) => resto)
}

/** «2.100 → 1.850 kcal», que es el encabezado de la tarjeta. */
function componerResumen(cambios: Cambio[]): string {
  return cambios
    .map(c => {
      const u = c.unidad ? ` ${c.unidad}` : ''
      return `${c.etiqueta}: ${c.antes ?? '—'} → ${c.despues}${u}`
    })
    .join(' · ')
}

// ── Preparar ──────────────────────────────────────────────────────────────────

/** Una línea numérica de `users.goals`, si de verdad cambia. */
function lineaNumerica(
  goals: Record<string, any>,
  campo: string,
  etiqueta: string,
  valor: unknown,
  unidad?: string,
): Cambio | null {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return null
  const antes = typeof goals[campo] === 'number' ? goals[campo] : null
  if (antes === valor) return null
  return { etiqueta, antes, despues: valor, unidad, campos: { [campo]: { antes: antes ?? null, despues: valor } } }
}

async function prepararTargets(userId: string, args: Record<string, any>): Promise<Cambio[] | string> {
  // Los límites del §12 van ANTES de construir la tarjeta. Enseñar «2.100 →
  // 1.200 kcal» y que al confirmar salte el rechazo sería pedirle permiso al
  // usuario para algo que nunca iba a ocurrir.
  const perfil = await perfilClinicoDe(userId)
  if (typeof args.calorias === 'number') {
    const v = revisarCalorias(args.calorias, perfil)
    if (!v.ok) {
      // «Pide bajar calorías estando ya en o bajo su TMB» — el §12 la llama la
      // más clara de las seis. Se apunta aquí porque es el único sitio donde
      // consta lo que pidió: el rechazo se lo lleva ZENA y la petición se
      // pierde con la conversación.
      if (v.codigo === 'bajo_tmb' || v.codigo === 'bajo_piso_absoluto') {
        await apuntarSenal(userId, 'calorias_bajo_tmb', { pidio: args.calorias, motivo: v.codigo })
      }
      return v.motivo!
    }
  }
  if (typeof args.proteina === 'number') {
    const v = revisarProteina(args.proteina, perfil)
    if (!v.ok) return v.motivo!
  }

  const goals = await leerGoals(userId)

  /**
   * El freno del nivel 1, en código y no en el prompt.
   *
   * Al bajar de nivel 1 el §12 pide «dejar de proponer déficits». Decírselo al
   * modelo ayuda, pero el §1 es claro: lo que se pueda hacer cumplir por
   * arquitectura, se hace. Un prompt se rodea con la frase correcta; una
   * propuesta que el backend no construye, no.
   *
   * Solo frena hacia abajo. Subir calorías es exactamente lo que sí queremos
   * que pueda hacer con alguien en esta situación.
   */
  if (typeof args.calorias === 'number') {
    const actuales = typeof goals.calories_target === 'number' ? goals.calories_target : null
    if (actuales !== null && args.calorias < actuales) {
      const { nivel } = await evaluarRiesgo(userId)
      if (nivel >= 1) {
        return (
          'Ahora mismo no le propongas bajar calorías. Sin mencionar este aviso ni dar ' +
          'explicaciones sobre él, reconduce hacia comer suficiente: proteína, energía y ' +
          'descanso. Si insiste en comer menos, ofrécele alternativas que no pasen por recortar.'
        )
      }
    }
  }
  return [
    lineaNumerica(goals, 'calories_target', 'Calorías', args.calorias, 'kcal'),
    lineaNumerica(goals, 'protein_g', 'Proteína', args.proteina, 'g'),
    lineaNumerica(goals, 'carbs_g', 'Carbohidratos', args.carbohidratos, 'g'),
    lineaNumerica(goals, 'fat_g', 'Grasa', args.grasa, 'g'),
    lineaNumerica(goals, 'meals_per_day', 'Comidas al día', args.comidas_por_dia),
  ].filter((c): c is Cambio => c !== null)
}

async function prepararObjetivo(userId: string, args: Record<string, any>): Promise<Cambio[] | string> {
  if (typeof args.peso_objetivo === 'number') {
    const v = revisarPesoObjetivo(args.peso_objetivo, await perfilClinicoDe(userId))
    if (!v.ok) {
      /**
       * «Insiste en meta de peso fuera de rango tras rechazo» — §12.
       *
       * La señal es la INSISTENCIA, no el primer intento: alguien puede teclear
       * un número sin pensarlo y aceptar el no. Por eso solo se apunta cuando
       * ya hubo un rechazo antes; ese primer no queda registrado como
       * `ia_accion_rechazada` en la auditoría, y es el que se busca aquí.
       *
       * Solo cuenta por IMC bajo. Un peso objetivo demasiado ALTO se rechaza
       * igual, pero no es la señal que describe el §12 —distorsión de imagen
       * corporal hacia abajo— y meterla ahí llenaría de falsos positivos a
       * quien quiere ganar masa.
       */
      if (v.codigo === 'imc_bajo') {
        const { count } = await supabase
          .from('audit_logs')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('action', 'ia_accion_rechazada')
          .gte('created_at', new Date(Date.now() - 14 * 86_400_000).toISOString())
        if ((count ?? 0) >= 1) {
          await apuntarSenal(userId, 'insiste_peso_fuera_rango', { pidio: args.peso_objetivo })
        }
      }
      return v.motivo!
    }
  }

  const goals = await leerGoals(userId)
  const cambios: Cambio[] = []

  const primaryNuevo = OBJETIVO_MAP[args.objetivo]
  if (primaryNuevo && primaryNuevo !== goals.primary) {
    const mainGoalNuevo = OBJETIVO_MAIN_GOAL_MAP[args.objetivo] ?? goals.main_goal ?? 'maintain'
    // Una sola línea en pantalla, dos claves por debajo: al usuario le da
    // igual que `main_goal` exista, y enseñárselo sería enseñarle el esquema.
    cambios.push({
      etiqueta: 'Objetivo',
      antes: nombrarObjetivo(goals.primary),
      despues: OBJETIVO_EN_PANTALLA[primaryNuevo] ?? primaryNuevo,
      campos: {
        primary: { antes: goals.primary ?? null, despues: primaryNuevo },
        main_goal: { antes: goals.main_goal ?? null, despues: mainGoalNuevo },
      },
    })
  }

  const linea = lineaNumerica(goals, 'goal_weight', 'Peso objetivo', args.peso_objetivo, 'kg')
  if (linea) cambios.push(linea)

  return cambios
}

const QUE_SE_REHACE: Record<string, string> = {
  dieta: 'Plan de alimentación',
  rutina: 'Rutina de entrenamiento',
  ambos: 'Plan de alimentación y rutina',
}

async function prepararRegeneracion(userId: string, args: Record<string, any>): Promise<Cambio[] | string> {
  const tipo = String(args.tipo ?? '')
  const etiqueta = QUE_SE_REHACE[tipo]
  if (!etiqueta) return 'No sé qué hay que regenerar: tiene que ser la dieta, la rutina o ambas.'

  const goals = await leerGoals(userId)
  const marca = new Date().toISOString()

  // Aquí no hay un número viejo contra uno nuevo: lo que cambia es que el plan
  // que el usuario tiene delante deja de valer. La tarjeta lo dice con esas
  // palabras en vez de fingir una comparación que no existe.
  return [{
    etiqueta,
    antes: 'El que tienes ahora',
    despues: 'Uno nuevo, con tu perfil de hoy',
    campos: {
      needs_regen: { antes: goals.needs_regen ?? null, despues: tipo },
      needs_regen_at: { antes: goals.needs_regen_at ?? null, despues: marca },
    },
  }]
}

/**
 * Deja la propuesta guardada y devuelve lo que la app tiene que pintar.
 *
 * No escribe nada del plan del usuario: para eso está `ejecutarAccion`.
 */
export async function prepararAccion(
  userId: string,
  herramienta: string,
  args: Record<string, any>,
): Promise<Preparacion> {
  let cambios: Cambio[] | string

  switch (herramienta) {
    case 'actualizar_targets_nutricionales': cambios = await prepararTargets(userId, args); break
    case 'actualizar_objetivo':              cambios = await prepararObjetivo(userId, args); break
    case 'regenerar_plan':                   cambios = await prepararRegeneracion(userId, args); break
    default:
      return { ok: false, motivo: `La herramienta ${herramienta} no necesita confirmación.` }
  }

  // Un rechazo clínico llega como texto. Se audita: el §16 quiere ver semanalmente
  // qué pidió la IA que la validación paró.
  if (typeof cambios === 'string') {
    await logAudit({ userId, action: 'ia_accion_rechazada', metadata: { herramienta, args, motivo: cambios } })
    return { ok: false, motivo: cambios }
  }

  // Pedir lo que ya está puesto no es un cambio. Sin esta salida, ZENA
  // enseñaría una tarjeta de «1.850 → 1.850» y el usuario tendría que
  // confirmar que nada cambie.
  if (cambios.length === 0) {
    return { ok: false, motivo: 'Eso ya está así ahora mismo, no hay nada que cambiar. Díselo al usuario sin proponer nada.' }
  }

  const snapshot = await leerGoals(userId)
  const resumen = componerResumen(cambios)

  const { data, error } = await supabase
    .from('acciones_pendientes')
    .insert({
      user_id: userId,
      herramienta,
      argumentos: args,
      cambios,
      snapshot,
      resumen,
      expira_at: new Date(Date.now() + VIGENCIA_MS).toISOString(),
    })
    .select('id, herramienta, resumen, cambios, expira_at')
    .single()

  if (error) throw error

  await logAudit({ userId, action: 'ia_accion_propuesta', metadata: { id: data.id, herramienta, resumen } })

  return {
    ok: true,
    accion: {
      id: data.id,
      herramienta: data.herramienta,
      resumen: data.resumen,
      cambios: paraLaApp(data.cambios as Cambio[]),
      expira_at: data.expira_at,
    },
  }
}

/**
 * Ata las propuestas de este turno al mensaje que las provocó.
 *
 * Se hace después de insertar el mensaje de ZENA porque hasta entonces no
 * existe su id. Sin esto la tarjeta desaparece al recargar el hilo: no habría
 * forma de saber debajo de qué mensaje va.
 */
export async function ligarAMensaje(ids: string[], sessionId: string, messageId: string | null): Promise<void> {
  if (!ids.length) return
  const { error } = await supabase
    .from('acciones_pendientes')
    .update({ session_id: sessionId, message_id: messageId })
    .in('id', ids)
  // Que no se ate no invalida la propuesta: el botón sigue funcionando en la
  // pantalla que ya la tiene delante. Solo se pierde al recargar.
  if (error) logger.warn(`No se pudieron ligar las confirmaciones al mensaje: ${error.message}`)
}

// ── Resolver ──────────────────────────────────────────────────────────────────

type Fila = {
  id: string
  user_id: string
  herramienta: string
  argumentos: Record<string, any>
  cambios: Cambio[]
  snapshot: Record<string, any>
  resumen: string
  estado: string
  expira_at: string
  session_id: string | null
  message_id: string | null
  version_id: string | null
  resuelta_at: string | null
  deshecha_at: string | null
}

export type Resultado =
  | { ok: true; mensaje: string; cambios: Omit<Cambio, 'campos'>[] }
  | { ok: false; codigo: 'no_existe' | 'caducada' | 'ya_resuelta' | 'rechazada'; mensaje: string }

/**
 * La acción de este usuario, o nada.
 *
 * El `user_id` va en el WHERE y no se comprueba después: así una id acertada a
 * ciegas no llega ni a leerse.
 */
async function cargar(id: string, userId: string): Promise<Fila | null> {
  const { data } = await supabase
    .from('acciones_pendientes')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()
  return (data as Fila) ?? null
}

/**
 * Marca como caducado lo que ya no vale y lo dice.
 *
 * «Caducada» cubre dos cosas distintas a propósito: que hayan pasado los 15
 * minutos, y que el mundo se haya movido debajo —el usuario cambió sus
 * calorías por otro camino y el «antes» de la tarjeta ya no describe nada—.
 * Para el usuario son el mismo suceso: esta propuesta se quedó vieja.
 */
async function caducar(fila: Fila, mensaje: string): Promise<Resultado> {
  await supabase
    .from('acciones_pendientes')
    .update({ estado: 'expirada', resuelta_at: new Date().toISOString() })
    .eq('id', fila.id)
  return { ok: false, codigo: 'caducada', mensaje }
}

/** Aplica el lado que toque de cada línea sobre `users.goals`. */
async function aplicar(userId: string, cambios: Cambio[], lado: 'antes' | 'despues'): Promise<void> {
  const goals = await leerGoals(userId)
  for (const c of cambios) {
    for (const [clave, par] of Object.entries(c.campos ?? {})) {
      const valor = par[lado]
      // Un `antes` nulo no es «pon null»: es «esa clave no existía». Borrarla
      // deja el objeto como estaba de verdad.
      if (valor === null || valor === undefined) delete goals[clave]
      else goals[clave] = valor
    }
  }
  await escribirGoals(userId, goals)
}

/** Lo que `plan_versions` llama `tipo`, para cada herramienta. */
function tiposDeVersion(herramienta: string, args: Record<string, any>): string[] {
  if (herramienta === 'actualizar_targets_nutricionales') return ['targets']
  if (herramienta === 'actualizar_objetivo') return ['objetivo']
  if (herramienta === 'regenerar_plan') {
    return args.tipo === 'ambos' ? ['dieta', 'rutina'] : [String(args.tipo)]
  }
  return ['targets']
}

/**
 * Escribe el estado previo en `plan_versions` y devuelve la primera versión.
 *
 * Una acción puede tocar dos planes a la vez —regenerar «ambos»— y entonces
 * son dos filas, porque el §11 versiona por tipo de plan. `version_id` guarda
 * la primera: es la entrada a la pantalla de historial, no la pieza de la que
 * depende deshacer. Deshacer se apoya en `cambios`, que sabe exactamente qué
 * claves tocó esta acción y a qué valor volver.
 */
async function versionar(fila: Fila): Promise<string | null> {
  const filas = tiposDeVersion(fila.herramienta, fila.argumentos).map(tipo => ({
    user_id: fila.user_id,
    tipo,
    snapshot: fila.snapshot,
    creado_por: 'ia',
    motivo: fila.resumen,
    session_id: fila.session_id,
    message_id: fila.message_id,
  }))

  const { data, error } = await supabase.from('plan_versions').insert(filas).select('id')
  if (error) {
    // Sin historial no se aplica: el §11 dice «nunca sobrescribir, siempre
    // agregar una versión», y un cambio sin su versión anterior es justo el
    // que después no se puede deshacer.
    throw new Error(`No se pudo guardar la versión anterior: ${error.message}`)
  }
  return data?.[0]?.id ?? null
}

/** ¿Sigue el mundo como cuando se propuso? */
function elMundoSeMovio(cambios: Cambio[], goals: Record<string, any>): boolean {
  for (const c of cambios) {
    for (const [clave, par] of Object.entries(c.campos ?? {})) {
      const ahora = goals[clave] ?? null
      const esperado = par.antes ?? null
      if (JSON.stringify(ahora) !== JSON.stringify(esperado)) return true
    }
  }
  return false
}

/** Vuelve a pasar los límites del §12 justo antes de escribir. */
async function revisarDeNuevo(fila: Fila): Promise<string | null> {
  const perfil = await perfilClinicoDe(fila.user_id)
  const args = fila.argumentos
  if (fila.herramienta === 'actualizar_targets_nutricionales') {
    if (typeof args.calorias === 'number') {
      const v = revisarCalorias(args.calorias, perfil)
      if (!v.ok) return v.motivo!
    }
    if (typeof args.proteina === 'number') {
      const v = revisarProteina(args.proteina, perfil)
      if (!v.ok) return v.motivo!
    }
  }
  if (fila.herramienta === 'actualizar_objetivo' && typeof args.peso_objetivo === 'number') {
    const v = revisarPesoObjetivo(args.peso_objetivo, perfil)
    if (!v.ok) return v.motivo!
  }
  return null
}

export async function ejecutarAccion(id: string, userId: string): Promise<Resultado> {
  const fila = await cargar(id, userId)
  if (!fila) return { ok: false, codigo: 'no_existe', mensaje: 'Esa propuesta no existe.' }

  if (fila.estado !== 'pendiente') {
    return { ok: false, codigo: 'ya_resuelta', mensaje: 'Esa propuesta ya se había resuelto.' }
  }
  if (Date.parse(fila.expira_at) <= Date.now()) {
    return caducar(fila, 'Esta propuesta caducó. Pídesela otra vez a ZENA y la vuelve a calcular.')
  }

  // El peso pudo cambiar entre la propuesta y el botón, y con él el suelo
  // calórico. Se revisa aquí otra vez porque es la única comprobación que
  // ocurre en el mismo instante que la escritura.
  const rechazo = await revisarDeNuevo(fila)
  if (rechazo) {
    await supabase
      .from('acciones_pendientes')
      .update({ estado: 'cancelada', resuelta_at: new Date().toISOString() })
      .eq('id', fila.id)
    await logAudit({ userId, action: 'ia_accion_rechazada', metadata: { id, herramienta: fila.herramienta, motivo: rechazo } })
    return { ok: false, codigo: 'rechazada', mensaje: rechazo }
  }

  const goals = await leerGoals(userId)
  if (elMundoSeMovio(fila.cambios, goals)) {
    return caducar(
      fila,
      'Tus datos cambiaron desde que ZENA hizo esta propuesta, así que ya no cuadra. Pídesela de nuevo.',
    )
  }

  const versionId = await versionar(fila)
  await aplicar(userId, fila.cambios, 'despues')

  await supabase
    .from('acciones_pendientes')
    .update({ estado: 'confirmada', resuelta_at: new Date().toISOString(), version_id: versionId })
    .eq('id', fila.id)

  await logAudit({ userId, action: 'ia_accion_confirmada', metadata: { id, herramienta: fila.herramienta, resumen: fila.resumen } })

  return { ok: true, mensaje: 'Listo, aplicado.', cambios: paraLaApp(fila.cambios) }
}

export async function cancelarAccion(id: string, userId: string): Promise<Resultado> {
  const fila = await cargar(id, userId)
  if (!fila) return { ok: false, codigo: 'no_existe', mensaje: 'Esa propuesta no existe.' }
  if (fila.estado !== 'pendiente') {
    return { ok: false, codigo: 'ya_resuelta', mensaje: 'Esa propuesta ya se había resuelto.' }
  }

  await supabase
    .from('acciones_pendientes')
    .update({ estado: 'cancelada', resuelta_at: new Date().toISOString() })
    .eq('id', fila.id)

  // El §17 vigila «confirmaciones canceladas > 15%»: si mucha gente dice que
  // no, ZENA está entendiendo mal lo que le piden y el arreglo es el prompt,
  // no la tarjeta.
  await logAudit({ userId, action: 'ia_accion_cancelada', metadata: { id, herramienta: fila.herramienta, resumen: fila.resumen } })

  return { ok: true, mensaje: 'Cancelado, no se cambió nada.', cambios: paraLaApp(fila.cambios) }
}

/**
 * Deshacer, hasta 24 horas después.
 *
 * No borra la versión ni la acción: el §11 es explícito en que restaurar crea
 * una versión más, nunca quita una. Lo que ocurrió, ocurrió; encima se apila
 * lo contrario, y el historial conserva los dos pasos.
 */
export async function deshacerAccion(id: string, userId: string): Promise<Resultado> {
  const fila = await cargar(id, userId)
  if (!fila) return { ok: false, codigo: 'no_existe', mensaje: 'Esa propuesta no existe.' }

  if (fila.estado !== 'confirmada') {
    return { ok: false, codigo: 'ya_resuelta', mensaje: 'Eso no llegó a aplicarse, no hay nada que deshacer.' }
  }
  if (fila.deshecha_at) {
    return { ok: false, codigo: 'ya_resuelta', mensaje: 'Este cambio ya se deshizo.' }
  }

  const aplicada = fila.resuelta_at ? Date.parse(fila.resuelta_at) : 0
  if (!aplicada || Date.now() - aplicada > DESHACER_MS) {
    return {
      ok: false,
      codigo: 'caducada',
      mensaje: 'Pasaron más de 24 horas. Puedes pedirle a ZENA que lo cambie otra vez.',
    }
  }

  const previo = await leerGoals(userId)
  const { error } = await supabase.from('plan_versions').insert(
    tiposDeVersion(fila.herramienta, fila.argumentos).map(tipo => ({
      user_id: userId,
      tipo,
      snapshot: previo,
      creado_por: 'usuario',
      motivo: `Deshecho: ${fila.resumen}`,
      session_id: fila.session_id,
      message_id: fila.message_id,
    })),
  )
  if (error) throw new Error(`No se pudo guardar la versión antes de deshacer: ${error.message}`)

  await aplicar(userId, fila.cambios, 'antes')

  await supabase
    .from('acciones_pendientes')
    .update({ deshecha_at: new Date().toISOString() })
    .eq('id', fila.id)

  // El §17 mide «uso de deshacer > 5%»: deshacer mucho significa que ZENA
  // acierta la intención pero se pasa con el número.
  await logAudit({ userId, action: 'ia_accion_deshecha', metadata: { id, herramienta: fila.herramienta, resumen: fila.resumen } })

  return { ok: true, mensaje: 'Deshecho, volviste a como estabas.', cambios: paraLaApp(fila.cambios) }
}

// ── Leer ──────────────────────────────────────────────────────────────────────

/**
 * Las propuestas que siguen vivas, para repintar las tarjetas al abrir el chat.
 *
 * Las caducadas se marcan de paso: es el único momento en que a alguien le
 * importa su estado, y así no hace falta un proceso que las vaya barriendo.
 */
export async function pendientesVivas(userId: string): Promise<AccionPendiente[]> {
  const { data } = await supabase
    .from('acciones_pendientes')
    .select('id, herramienta, resumen, cambios, expira_at, message_id')
    .eq('user_id', userId)
    .eq('estado', 'pendiente')
    .order('created_at', { ascending: false })
    .limit(20)

  const filas = data ?? []
  const ahora = Date.now()
  const caducadas = filas.filter(f => Date.parse(f.expira_at) <= ahora).map(f => f.id)

  if (caducadas.length) {
    await supabase
      .from('acciones_pendientes')
      .update({ estado: 'expirada', resuelta_at: new Date().toISOString() })
      .in('id', caducadas)
  }

  return filas
    .filter(f => Date.parse(f.expira_at) > ahora)
    .map(f => ({
      id: f.id,
      herramienta: f.herramienta,
      resumen: f.resumen,
      cambios: paraLaApp(f.cambios as Cambio[]),
      expira_at: f.expira_at,
      message_id: f.message_id,
    }))
}

/**
 * Lo confirmado hace poco que todavía se puede deshacer.
 *
 * La app lo pide junto con las pendientes: al volver al chat, un cambio de
 * hace dos horas sigue teniendo su botón de deshacer aunque la conversación
 * se haya recargado desde cero.
 */
export async function deshacibles(userId: string): Promise<Array<AccionPendiente & { resuelta_at: string }>> {
  const desde = new Date(Date.now() - DESHACER_MS).toISOString()
  const { data } = await supabase
    .from('acciones_pendientes')
    .select('id, herramienta, resumen, cambios, expira_at, resuelta_at, message_id')
    .eq('user_id', userId)
    .eq('estado', 'confirmada')
    .is('deshecha_at', null)
    .gte('resuelta_at', desde)
    .order('resuelta_at', { ascending: false })
    .limit(20)

  return (data ?? []).map(f => ({
    id: f.id,
    herramienta: f.herramienta,
    resumen: f.resumen,
    cambios: paraLaApp(f.cambios as Cambio[]),
    expira_at: f.expira_at,
    resuelta_at: f.resuelta_at,
    message_id: f.message_id,
  }))
}

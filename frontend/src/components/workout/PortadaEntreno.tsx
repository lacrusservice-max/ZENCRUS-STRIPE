/**
 * ENTRENA · HOY
 * ─────────────
 * La portada de la sección. Es el CENTRO DE MANDO, no un escaparate: quien
 * entra tiene que saber qué hacer sin leer, sin elegir y sin buscar.
 *
 * ── Qué se quitó, y por qué ─────────────────────────────────────────────────
 * Había un bloque llamado «Empieza por aquí» con cuatro entrenamientos sueltos.
 * Eso es una portada de tienda: ofrece opciones a alguien que ya sabe lo que
 * quiere. Y encima la pieza grande proponía un entrenamiento generado al azar,
 * o sea que quien seguía un plan veía en primer lugar algo que NO era su plan.
 * «Mis rutinas» y «Programas» estaban al fondo, después de todo.
 *
 * ── La única pregunta que contesta esta pantalla ────────────────────────────
 * «¿Qué hago hoy?». Y solo hay UNA respuesta a la vez, que decide el servidor
 * en `/workout/today`:
 *
 *   · Dejaste algo a medias  → seguir, y manda sobre todo lo demás.
 *   · Te toca este día       → sus ejercicios, sus series y el botón.
 *   · Ya entrenaste hoy      → lo que hiciste, sin ofrecerte repetirlo.
 *   · No sigues ningún plan  → montar uno, o entrenar suelto hoy.
 *
 * Debajo, y solo debajo, la semana entera como un mapa vertical: qué toca cada
 * día, cuáles están hechos y cuál es hoy. Y después, los accesos.
 *
 * ── Todo lo que se registra aquí viaja solo ─────────────────────────────────
 * Las series que se anotan al entrenar alimentan el historial, las
 * estadísticas y los récords sin que haya que copiarlas a ningún sitio: la
 * sesión es la única fuente y las demás pantallas la consultan.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import { RachaEncendida } from '@/components/racha/RachaEncendida'
import { useRachaDelDia } from '@/hooks/useRachaDelDia'
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native'
import { ImageSourcePropType } from 'react-native'
import { Image } from '@/components/ui/Imagen'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { CabeceraPortada } from '@/components/workout/MenuSeccion'
import { BotonIA } from '@/constants/layout'
import { AnilloSemana } from '@/components/workout/AnilloSemana'
import { HoyGrande } from '@/components/workout/HoyGrande'
import { useEntrenoRegistro, hoyClave } from '@/store/entrenoRegistroStore'
import { MaterialCasa } from '@/components/workout/MaterialCasa'
import { useCasaMaterial, APAREJOS } from '@/store/casaMaterialStore'
import { desajustesDe, sustituir, faltaLo } from '@/features/entreno/reconciliarCasa'
import { Cifra } from '@/components/workout/Charts'
import { Miniatura } from '@/components/workout/Miniatura'
import { NOMBRE_GRUPO } from '@/components/workout/anatomy'
import { useSessionStore } from '@/store/sessionStore'
import {
  getResumen, Resumen,
  kilosCorto, minutosCorto, desdeCuando,
} from '@/services/statsService'
import {
  queTocaHoy, Hoy, DiaDeLaSemana, prescripcion, DIAS_SEMANA,
} from '@/services/programService'
import { recetaDe } from '@/services/quickService'
import { precargarEjercicios } from '@/services/exerciseService'
import { FOTOS, FOTO_MODO, fotoDePrograma } from '@/constants/imagenes'
import { useFotoPortada, BotonFoto, SelectorFoto } from '@/components/workout/fotoPortada'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'

/**
 * Objetivo de sesiones por semana cuando el servidor todavía no ha contestado.
 *
 * Ya NO es el objetivo de verdad: ese lo manda `/workout/today` en `anillo`, y
 * sale de los `days_per_week` de tu inscripción. Un 4 escrito aquí le decía a
 * quien sigue un plan de 3 días que iba corto todas las semanas.
 *
 * Se queda solo como valor de arranque: cuatro, porque por debajo de tres la
 * frecuencia por grupo muscular no da para progresar y por encima de cinco la
 * mayoría no sostiene el ritmo más de un mes.
 */
const OBJETIVO_SEMANA = 4

/**
 * EL LUGAR DONDE SE ENTRENA, Y LO ÚNICO QUE CAMBIA
 * ───────────────────────────────────────────────
 * Gimnasio y casa son la MISMA portada. No se parecen: son la misma, servida
 * dos veces con el lugar ya decidido.
 *
 * Antes «en casa» era una pantalla aparte y mucho más pobre —elegir minutos y
 * zona, y a correr—, mientras el gimnasio tenía el plan, la semana, el anillo,
 * las marcas y el material. Quien entrena en el salón se quedaba sin todo eso
 * por vivir donde vive. Y la de gimnasio, a su vez, generaba entrenamientos con
 * lugar `'todo'`, así que colaba ejercicios de casa en una página de gimnasio.
 *
 * Con esto, lo único que distingue una página de la otra es este parámetro:
 * el título, la fotografía, y el filtro que se arrastra a todo lo que cuelga
 * —biblioteca, historial, planes y el generador rápido—.
 */
export type ModoEntreno = 'gym' | 'home'

/**
 * El ritmo vertical de una portada: el margen de un bloque, su rótulo y el
 * marco de la pieza grande. Compartidos con Running por la misma razón que
 * `Acceso`.
 */
export const ESTILOS_PORTADA = StyleSheet.create({
  bloque: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], gap: Spacing[3] },
  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6 },
  marco: {
    minHeight: 340, borderRadius: 26, overflow: 'hidden',
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: Colors.neon.void,
  },
})

const DEL_MODO: Record<ModoEntreno, { titulo: string; foto: 'gimnasio' | 'casa'; ruta: '/workout/gym' | '/workout/casa' }> = {
  gym: { titulo: 'Gimnasio', foto: 'gimnasio', ruta: '/workout/gym' },
  home: { titulo: 'En casa', foto: 'casa', ruta: '/workout/casa' },
}

export function PortadaEntreno({ modo }: { modo: ModoEntreno }) {
  /**
   * EN CASA SE PREGUNTA QUÉ HAY, PERO NO AQUÍ
   * ──────────────────────────────────────────
   * La primera vez se pregunta DENTRO de «Editar mi semana», como primer paso,
   * porque de esa respuesta sale el plan entero. Abrirlo aquí de golpe al
   * entrar era el defecto: aparecía una vez, no alimentaba nada y no volvía.
   *
   * Esto es solo el acceso para CAMBIARLO, en «Tu material», que es donde uno
   * lo busca cuando compra unas mancuernas.
   */
  const materialCasa = useCasaMaterial()
  const [pidiendoMaterial, setPidiendoMaterial] = useState(false)
  const [sustituyendo, setSustituyendo] = useState(false)

  const suyo = DEL_MODO[modo]
  /* Empezar la rutina cuenta para la racha igual que apuntar una comida: es
     el gesto con el que alguien dice «hoy sí». */
  const rachaDia = useRachaDelDia()
  const racha = {
    ...rachaDia,
    empezar: () => { void rachaDia.registrarGesto('loggedWorkout') },
  }

  const { restaurar } = useSessionStore()

  const [hoy, setHoy] = useState<Hoy | null>(null)
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(true)
  const [refrescando, setRefrescando] = useState(false)

  // `getDias(7)` se cayó de aquí con la tira: el anillo trae su propio reparto
  // de la semana dentro de `/workout/today`. Dejarlo habría sido una petición
  // por cada visita a la portada para alimentar algo que ya no se dibuja.
  const cargar = useCallback(async () => {
    try {
      const [h, r] = await Promise.all([
        queTocaHoy().catch(() => null),
        getResumen(28).catch(() => null),
      ])
      setHoy(h)
      setResumen(r)

      /**
       * Los ejercicios de hoy se piden ANTES de que nadie los toque.
       *
       * En cuanto se sabe qué toca, se traen sus fichas —con la URL firmada del
       * vídeo— en segundo plano. Así, al tocar uno, la pantalla ya lo tiene y el
       * vídeo arranca sin viaje. Es la diferencia entre abrir un ejercicio y
       * esperar a que abra.
       *
       * Sin `await`: la portada no puede quedarse esperando a esto.
       */
      if (h?.dia?.ejercicios?.length) {
        void precargarEjercicios(h.dia.ejercicios.map(e => e.slug))
      }
    } finally {
      setCargando(false)
      setRefrescando(false)
    }
  }, [])

  /** Lo del plan de hoy que ya no cabe en su casa. Vacío mientras no conteste. */
  const desajustes = useMemo(
    () => (modo === 'home' && hoy?.dia
      ? desajustesDe(hoy.dia.ejercicios, materialCasa.tengo, materialCasa.preguntado)
      : []),
    [modo, hoy?.dia, materialCasa.tengo, materialCasa.preguntado],
  )

  useFocusEffect(useCallback(() => {
    void restaurar()
    void cargar()
  }, [restaurar, cargar]))

  /**
   * ¿EL PLAN ACTIVO ES DE ESTE LUGAR?
   *
   * La inscripción es UNA sola y no distingue dónde entrenas: `/workout/today`
   * devuelve tu plan estés en la página que estés. Sin esta comprobación, la
   * portada de casa te manda hacer «press de pierna en máquina» — que es
   * exactamente lo que no tienes en el salón.
   *
   * Cuando el plan no es de aquí, esta página se comporta como si no hubiera
   * plan: ofrece montar uno de este lugar o entrenar suelto hoy. No se dice que
   * «no tienes plan» —lo tienes—, se deja de imponer el que no cabe aquí.
   */
  const planDeAqui = !hoy?.programa || hoy.programa.mode === modo
  /**
   * `planDeAqui` es cierto también cuando NO hay plan ninguno, que es lo que
   * quiere el Hero. Para los textos hace falta lo otro: que haya un plan Y que
   * sea de esta sección. Sin esa distinción, En casa decía «Ahora sigues
   * cesar» —el plan del gimnasio— en una pantalla que no debería saber que
   * existe la otra.
   */
  const hayPlanDeAqui = !!hoy?.programa && hoy.programa.mode === modo


  return (
    <Screen>
      <CabeceraPortada titulo={suyo.titulo} historialHref={`/workout/history?mode=${modo}`} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={() => { setRefrescando(true); void cargar() }}
            tintColor={Colors.neon.w3}
          />
        }
      >
        {cargando ? (
          <View style={s.cargando}><ActivityIndicator color={Colors.neon.red} /></View>
        ) : (
          <>
            {/* ── 1 · QUÉ HAGO HOY ─────────────────────────────────────── */}
            <Animated.View entering={FadeIn.duration(420)} style={s.zonaHero}>
              <Hero hoy={hoy} onEmpezar={racha.empezar} modo={modo} planDeAqui={planDeAqui} />
            </Animated.View>

            {/* ── 2 · TU SEMANA, EN VERTICAL ───────────────────────────── */}
            {hoy?.semana && hoy.programa && planDeAqui && (
              <Animated.View entering={FadeInDown.delay(70).duration(380)} style={s.bloque}>
                <View style={s.seccionFila}>
                  <Text style={s.seccion}>
                    TU SEMANA
                  </Text>
                  <TouchableOpacity onPress={() => router.push('/workout/program/plan')} hitSlop={8}>
                    <Text style={s.enlace}>El plan entero</Text>
                  </TouchableOpacity>
                </View>

                {hoy.semana.esDescarga && (
                  <View style={s.descarga}>
                    <Ionicons name="battery-half-outline" size={15} color={Colors.neon.redCore} />
                    <Text style={s.descargaTxt}>
                      Semana suave: menos series y algo menos de peso. Toca recuperar.
                    </Text>
                  </View>
                )}

                <View style={s.mapa}>
                  {hoy.semana.dias.map((d, i) => (
                    <FilaDia
                      key={d.dia}
                      d={d}
                      ultimo={i === hoy.semana!.dias.length - 1}
                      semana={hoy.semana!.numero}
                    />
                  ))}
                </View>

                {/**
                  * Editar la semana, JUSTO DEBAJO de la semana.
                  *
                  * Estaba enterrado en «Cambiar de plan», dentro de «Tu
                  * material», al final de la pantalla: para mover el jueves al
                  * viernes había que acordarse de que eso vivía ahí. Un plan se
                  * retoca constantemente —cambia el horario, se lesiona uno,
                  * apetece meter otro día— y si retocarlo cuesta encontrarlo, no
                  * se retoca: se abandona. Va pegado a la lista que modifica,
                  * que es donde se te ocurre.
                  */}
                <TouchableOpacity
                  style={s.editarSemana}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    // El lugar viaja: dentro de Gimnasio no se pregunta si es
                    // gimnasio o casa, ya lo sabemos por dónde entró.
                    router.push(hoy.programa?.esMio
                      ? `/workout/program/nuevo?id=${hoy.programa.id}&modo=${modo}`
                      : `/workout/program/nuevo?modo=${modo}`)
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="options-outline" size={16} color={Colors.neon.redCore} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.editarTitulo}>
                      {hoy.programa?.esMio ? 'Editar mi semana' : 'Monta tu propio plan'}
                    </Text>
                    <Text style={s.editarSub}>
                      {hoy.programa?.esMio
                        ? 'Cambia los días, los músculos y los ejercicios'
                        : 'Tus días, tus músculos, tus ejercicios'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={15} color={Colors.neon.w3} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/**
              * Sin plan, aquí no se deja un hueco: se explica qué se está
              * perdiendo y se ofrece montarlo.
              *
              * Este es el sitio donde iría su semana, así que es exactamente
              * donde tiene sentido contarlo. Un espacio vacío no comunica que
              * falta algo, comunica que la app no tiene nada que ofrecer.
              */}
            {/**
              * EL PLAN Y TU CASA, RECONCILIADOS
              * ─────────────────────────────────
              * Cambiar el material y que el plan siga mandando ejercicios que
              * ya no puedes hacer es el fallo que convierte un sistema en un
              * adorno. Se detecta aquí, se cuenta, y el cambio lo pides tú:
              * el plan es tuyo y puede que las mancuernas vuelvan la semana
              * que viene.
              */}
            {modo === 'home' && hoy?.dia && desajustes.length > 0 && (
              <Animated.View entering={FadeInDown.delay(40).duration(380)} style={s.bloque}>
                <TouchableOpacity
                  style={s.montar}
                  disabled={sustituyendo}
                  onPress={async () => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                    setSustituyendo(true)
                    const r = await sustituir(desajustes, materialCasa.tengo)
                    setSustituyendo(false)
                    const ok = r.filter(x => x.resuelto).length
                    const no = r.length - ok
                    Alert.alert(
                      ok > 0 ? 'Plan actualizado' : 'No pude cambiarlos',
                      [
                        ok > 0 ? `Cambié ${ok} ${ok === 1 ? 'ejercicio' : 'ejercicios'} por otros que sí puedes hacer.` : '',
                        no > 0 ? `${no} sin alternativa para tu material: cámbialos tú desde el día.` : '',
                      ].filter(Boolean).join('\n\n'),
                    )
                    void cargar()
                  }}
                  activeOpacity={0.85}
                >
                  <View style={s.montarIcono}>
                    <Ionicons name="swap-horizontal" size={20} color={Colors.neon.redCore} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.montarTitulo}>
                      {desajustes.length} {desajustes.length === 1 ? 'ejercicio no encaja' : 'ejercicios no encajan'} con lo que tienes
                    </Text>
                    <Text style={s.montarSub}>
                      {sustituyendo
                        ? 'Buscando alternativas…'
                        : `Piden ${[...new Set(desajustes.map(d => faltaLo(d.equipment)))].join(' y ')}. Toca y los cambio por otros que sí puedas hacer.`}
                    </Text>
                  </View>
                  {sustituyendo
                    ? <ActivityIndicator color={Colors.neon.w3} />
                    : <Ionicons name="chevron-forward" size={16} color={Colors.neon.w3} />}
                </TouchableOpacity>
              </Animated.View>
            )}

            {hoy && (!hoy.programa || !planDeAqui) && (
              <Animated.View entering={FadeInDown.delay(70).duration(380)} style={s.bloque}>
                <Text style={s.seccion}>TU SEMANA</Text>
                <TouchableOpacity
                  style={s.montar}
                  onPress={() => router.push(`/workout/programs?mode=${modo}`)}
                  activeOpacity={0.85}
                >
                  <View style={s.montarIcono}>
                    <Ionicons name="calendar-outline" size={20} color={Colors.neon.redCore} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {/**
                      * CADA SECCIÓN HABLA SOLO DE SÍ MISMA
                      * ────────────────────────────────────
                      * Antes esto nombraba el plan de la OTRA sección —«cesar es de
                      * gimnasio»— para explicar por qué aquí no había nada. Explicaba
                      * bien y estaba mal: casa no tiene por qué saber que existe el
                      * gimnasio, ni al revés.
                      *
                      * Se dice lo que falta AQUÍ y no se niega nada de fuera. «No
                      * tienes plan de casa» es cierto tengas lo que tengas en otro
                      * sitio; «no sigues ningún plan» sí sería mentira, y encima le
                      * haría pensar a alguien que ha perdido su plan.
                      */}
                    <Text style={s.montarTitulo}>
                      Todavía no tienes plan {modo === 'home' ? 'de casa' : 'de gimnasio'}
                    </Text>
                    <Text style={s.montarSub}>
                      {`Con uno, esta pantalla te dice cada día qué toca ${modo === 'home' ? 'en casa' : 'en el gimnasio'}, cuánto peso poner y cuándo subirlo. Se monta en un toque.`}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.neon.w3} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* ── 3 · CÓMO VA LA SEMANA ────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(130).duration(380)} style={s.bloque}>
              {/* `origen` se fuerza a «defecto» si el plan es de la otra sección:
                  decir «los que pide tu plan» aquí sería citar un plan que en
                  esta pantalla no existe. */}
              <AnilloSemana
                dias={hoy?.anillo?.dias ?? []}
                hoy={hoy?.anillo?.hoy ?? -1}
                hechos={hoy?.anillo?.hechos ?? 0}
                objetivo={hoy?.anillo?.objetivo ?? OBJETIVO_SEMANA}
                origen={hayPlanDeAqui ? (hoy?.anillo?.origen ?? 'defecto') : 'defecto'}
                kcal={hoy?.anillo?.kcal ?? 0}
              />
              <View style={s.cifras}>
                <Cifra valor={String(resumen?.seriesSemana ?? 0)} etiqueta="SERIES" />
                <Cifra valor={kilosCorto(resumen?.volumenSemana ?? 0)} etiqueta="MOVIDOS" />
                <Cifra valor={minutosCorto(resumen?.minutosSemana ?? 0)} etiqueta="TIEMPO" />
              </View>
            </Animated.View>

            {/* ── 4 · TODO LO DEMÁS, A LA VISTA ────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(190).duration(380)} style={[s.bloque, { gap: Spacing[2] }]}>
              <Text style={s.seccion}>TU MATERIAL</Text>

              {modo === 'home' && (
                <Acceso
                  icono="construct-outline"
                  titulo="Qué tengo en casa"
                  sub={
                    materialCasa.tengo.length === 0
                      ? 'Solo peso corporal · toca para añadir material'
                      : APAREJOS.filter(a => materialCasa.tengo.includes(a.id)).map(a => a.nombre).join(' · ')
                  }
                  onPress={() => setPidiendoMaterial(true)}
                />
              )}

              <Acceso
                icono="map-outline"
                titulo={hayPlanDeAqui ? 'Cambiar de plan' : 'Planes de varias semanas'}
                sub={hayPlanDeAqui && hoy?.programa
                  ? `Ahora sigues «${hoy.programa.nombre}»`
                  : `Que alguien decida por ti qué toca cada día ${modo === 'home' ? 'en casa' : 'en el gimnasio'}`}
                onPress={() => router.push(`/workout/programs?mode=${modo}`)}
              />
              <Acceso
                icono="bookmark-outline"
                titulo="Mis rutinas"
                sub="Sesiones que repites, listas de un toque"
                onPress={() => router.push(`/workout/routines?mode=${modo}`)}
              />
              {/* La biblioteca entra ya filtrada por el lugar: en una página de
                  casa, ofrecer los 81 que solo existen en un gimnasio es
                  ofrecer lo que no se puede hacer. */}
              <Acceso
                icono="library-outline"
                titulo={modo === 'gym' ? 'Los ejercicios de gimnasio' : 'Los ejercicios sin material'}
                sub="Con su vídeo, su músculo y cómo se hacen"
                onPress={() => router.push(`/workout/library?place=${modo}`)}
              />
            </Animated.View>
          </>
        )}
      </ScrollView>
      <MaterialCasa abierto={pidiendoMaterial} onCerrar={() => setPidiendoMaterial(false)} />
      <RachaEncendida
        visible={racha.visible}
        dias={racha.dias}
        semana={racha.semana}
        onCerrar={racha.cerrar}
      />
    </Screen>
  )
}

// ── La pieza grande ──────────────────────────────────────────────────────────

/**
 * Lo primero que se ve. UNA sola cosa, la que toque.
 *
 * El orden no es negociable y lo decide el servidor: una sesión a medias manda
 * sobre el día del plan, y el día del plan manda sobre cualquier propuesta
 * suelta. Enseñar dos a la vez obliga a elegir, que es justo lo que esta
 * pantalla viene a evitar.
 */
function Hero({ hoy, onEmpezar, modo, planDeAqui }: {
  hoy: Hoy | null; onEmpezar: () => void; modo: ModoEntreno; planDeAqui: boolean
}) {
  /**
   * TU REGISTRO POR ENCIMA DEL SERVIDOR
   * ───────────────────────────────────
   * `hoy.estado` lo decide el servidor mirando si hay sesiones guardadas. Pero
   * marcar los ejercicios a mano es igual de válido —hay gente que entrena sin
   * anotar serie por serie— y esa marca solo existe aquí.
   *
   * El hook va ANTES del `if (!hoy)` a propósito: llamar hooks detrás de un
   * return condicional rompe el orden entre renders y React se queja.
   */
  const registroDeHoy = useEntrenoRegistro(st => st.dias[hoyClave()])
  const cerradoPorMi = registroDeHoy?.cerradoEn != null

  if (!hoy) return <SinConexion />

  // Una sesión a medias manda SIEMPRE, sea del lugar que sea: lo que está a
  // medio hacer no se esconde por haber cambiado de página.
  if (hoy.estado === 'abierta' && hoy.abierta) return <AMedias s={hoy.abierta} />

  if (!planDeAqui) return <SinPlan modo={modo} />
  // Si TÚ lo has dado por hecho, se pasa a «mañana te toca» aunque el servidor
  // siga creyendo que está pendiente.
  if (cerradoPorMi && (hoy.estado === 'toca' || hoy.estado === 'hecho')) {
    return <YaEstá hoy={hoy} marcados={registroDeHoy?.hechos.length ?? 0} modo={modo} />
  }
  if (hoy.estado === 'toca' && hoy.dia) return <TocaHoy hoy={hoy} onEmpezar={onEmpezar} />
  if (hoy.estado === 'hecho') return <YaEstá hoy={hoy} modo={modo} />
  // Descanso NO es lo mismo que no tener plan, y caía en el mismo sitio: quien
  // había puesto el jueves libre leía «todavía no sigues ningún plan».
  if (hoy.estado === 'descanso') return <Descanso hoy={hoy} />
  return <SinPlan modo={modo} />
}

/**
 * Hoy no toca nada, y eso ES el plan.
 *
 * El descanso no es un hueco: es la mitad de por qué un plan funciona. Así que
 * se dice con las mismas letras que un día de entrenamiento, no con una
 * pantalla apagada que parezca que algo falló.
 *
 * Y si quedaron días atrás, aquí es donde se ofrecen. Es el momento exacto en
 * que sirven: tienes el día libre y algo pendiente que hacer.
 */
function Descanso({ hoy }: { hoy: Hoy }) {
  const pendientes = hoy.semana?.dias.filter(d => d.pendiente) ?? []
  const foto = useFotoPortada(hoy.programa)

  return (
    <View style={h.marco}>
      <Image
        source={foto.fuente}
        style={StyleSheet.absoluteFill} contentFit="cover" transition={280}
      />
      <Velo />
      <BotonFoto onPress={foto.abrir} />
      <SelectorFoto
        abierto={foto.eligiendo} actual={foto.elegida}
        onCerrar={foto.cerrar} onElegir={id => void foto.elegir(id)}
      />
      <View style={h.dentro}>
        <Etiqueta texto="HOY DESCANSAS" tono="hecho" />
        <View style={{ gap: Spacing[3] }}>
          <View>
            <Text style={h.titulo} numberOfLines={2}>Día libre</Text>
            <Text style={h.sub}>
              {pendientes.length > 0
                ? `Lo pusiste tú. Si te apetece mover algo, te quedó ${pendientes.length === 1 ? 'un día' : `${pendientes.length} días`} de esta semana.`
                : 'Lo pusiste tú, y descansar es parte del plan: es cuando el músculo crece.'}
            </Text>
          </View>

          {pendientes.length > 0 && (
            <View style={{ gap: Spacing[2] }}>
              {pendientes.slice(0, 2).map(d => (
                <TouchableOpacity
                  key={d.dia}
                  style={h.botonSec}
                  onPress={() => {
                    void Haptics.selectionAsync()
                    router.push(`/workout/program/day?week=${hoy.semana!.numero}&day=${d.dia}`)
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-forward-circle-outline" size={15} color={Colors.neon.w2} />
                  <Text style={h.botonSecTxt} numberOfLines={1}>
                    Hacer {DIAS_SEMANA[d.diaSemana]?.toLowerCase()}: {d.nombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

/** Dejaste algo abierto. Es lo único que importa hasta que se cierre. */
function AMedias({ s: sesion }: { s: NonNullable<Hoy['abierta']> }) {
  return (
    <View style={h.marco}>
      <Image
        source={FOTOS[FOTO_MODO[sesion.mode] ?? 'gimnasio'].fuente}
        style={StyleSheet.absoluteFill} contentFit="cover" transition={280}
      />
      <Velo />
      <View style={h.dentro}>
        <Etiqueta texto="LO DEJASTE A MEDIAS" tono="aviso" />
        <View style={{ gap: Spacing[3] }}>
          <View>
            <Text style={h.titulo} numberOfLines={2}>{sesion.title}</Text>
            <Text style={h.sub}>
              {sesion.total_sets} {sesion.total_sets === 1 ? 'serie registrada' : 'series registradas'}
              {' · empezado '}{desdeCuando(sesion.started_at)}
            </Text>
          </View>
          {/**
            * Seguir lleva a la FICHA DEL DÍA, no a la pantalla de sesión vieja.
            *
            * Ahí es donde acababa todo el mundo, y con una lista vacía que decía
            * «sin ejercicios todavía» aunque el día tuviera seis: los ejercicios
            * viven en el plan, no en la sesión. El diseño nuevo es la ficha del
            * día con sus ejercicios, cada uno con su pantalla.
            *
            * La pantalla vieja se queda SOLO para lo que de verdad no tiene
            * ficha de día: los entrenamientos sueltos y las rutinas guardadas.
            */}
          <Boton
            texto="Seguir entrenando"
            onPress={() => {
              if (sesion.program_id && sesion.program_week && sesion.program_day) {
                router.push(`/workout/program/day?week=${sesion.program_week}&day=${sesion.program_day}`)
              } else {
                router.push('/workout/active')
              }
            }}
          />
        </View>
      </View>
    </View>
  )
}

/**
 * El día del plan, con sus ejercicios delante.
 *
 * Los ejercicios se enseñan AQUÍ y no detrás de un toque: la pregunta de quien
 * abre la app en el vestuario es «¿qué me toca?», y contestarla con un título
 * obliga a entrar para saberlo.
 */
/**
 * Lo de hoy vive en `HoyGrande`: fotografía a pantalla completa, la foto se
 * puede cambiar, cada ejercicio lleva al suyo y la lista se despliega entera.
 * Aquí solo queda decidir a dónde va «Empezar».
 */
function TocaHoy({ hoy, onEmpezar }: { hoy: Hoy; onEmpezar: () => void }) {
  return (
    <HoyGrande
      hoy={hoy}
      onEmpezar={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
        onEmpezar()
        router.push('/workout/program/day')
      }}
    />
  )
}

/**
 * Ya entrenaste hoy.
 *
 * No se esconde ni se ofrece repetir: se enseña lo hecho. Alguien que ya ha
 * cumplido no necesita que le empujen otra vez, necesita ver que cuenta.
 */
function YaEstá({ hoy, marcados = 0, modo }: { hoy: Hoy; marcados?: number; modo?: ModoEntreno }) {
  const total = hoy.hechasHoy.reduce(
    (a, x) => ({
      series: a.series + (x.total_sets ?? 0),
      volumen: a.volumen + Number(x.total_volume_kg ?? 0),
      minutos: a.minutos + Math.round((x.duration_seconds ?? 0) / 60),
      kcal: a.kcal + (x.calories_kcal ?? 0),
    }),
    { series: 0, volumen: 0, minutos: 0, kcal: 0 },
  )
  const quedaDia = hoy.semana?.dias.some(d => !d.hecho && !d.esHoy)
  const foto = useFotoPortada(hoy.programa)

  /**
   * QUÉ TOCA MAÑANA
   * ───────────────
   * Con lo de hoy cerrado, «HOY YA ESTÁ» deja de ser útil: ya lo sabes, acabas
   * de hacerlo. Lo que se quiere saber a partir de ese momento es qué viene
   * después, para saber si mañana hay que madrugar o se descansa.
   *
   * `diaSemana` va de 0 (lunes) a 6 (domingo), pero `getDay()` de JS empieza en
   * domingo. El `+6 % 7` es esa traducción, y sin ella el plan se enseña
   * corrido un día — que es de los errores más difíciles de ver mirando.
   */
  const hoySemana = (new Date().getDay() + 6) % 7
  const manana = hoy.semana?.dias.find(d => d.diaSemana === (hoySemana + 1) % 7) ?? null

  return (
    <View style={h.marco}>
      <Image
        source={foto.fuente}
        style={StyleSheet.absoluteFill} contentFit="cover" transition={280}
      />
      <Velo />
      <BotonFoto onPress={foto.abrir} />
      <SelectorFoto
        abierto={foto.eligiendo} actual={foto.elegida}
        onCerrar={foto.cerrar} onElegir={id => void foto.elegir(id)}
      />
      <View style={h.dentro}>
        <Etiqueta texto={manana ? "MAÑANA TE TOCA" : "HOY YA ESTÁ · MAÑANA DESCANSAS"} tono="hecho" />

        <View style={{ gap: Spacing[3] }}>
          <View>
            <Text style={h.titulo} numberOfLines={2}>
              {manana ? manana.nombre : (hoy.hechasHoy[0]?.title ?? 'Entrenado')}
            </Text>
            {manana && (
              <Text style={h.sub}>
                {manana.ejercicios} {manana.ejercicios === 1 ? 'ejercicio' : 'ejercicios'} · {manana.series} series
              </Text>
            )}
            {/* Sin sesión anotada, «0 series» sería una mentira fea: se dice
                lo que de verdad hubo, que son ejercicios marcados a mano. */}
            {total.series === 0 && marcados > 0 ? (
              <Text style={h.sub}>
                Hoy marcaste {marcados} {marcados === 1 ? 'ejercicio' : 'ejercicios'}
              </Text>
            ) : (
            <Text style={h.sub}>
              {manana ? 'Hoy hiciste ' : ''}
              {total.series} {total.series === 1 ? 'serie' : 'series'}
              {total.minutos > 0 ? ` · ${minutosCorto(total.minutos)}` : ''}
              {total.volumen > 0 ? ` · ${kilosCorto(total.volumen)}` : ''}
              {/* El gasto solo si hay cifra. Las sesiones de antes del
                  estimador valen null y un «0 kcal» diría una mentira. */}
              {total.kcal > 0 ? ` · ${total.kcal} kcal` : ''}
              {hoy.hechasHoy.length > 1 ? ` · ${hoy.hechasHoy.length} sesiones` : ''}
            </Text>
            )}
          </View>

          <View style={h.acciones}>
            <TouchableOpacity
              style={h.botonSec}
              onPress={() => router.push(modo ? `/workout/history?mode=${modo}` : '/workout/history')}
              activeOpacity={0.85}
            >
              <Ionicons name="time-outline" size={15} color={Colors.neon.w2} />
              <Text style={h.botonSecTxt}>Ver el detalle</Text>
            </TouchableOpacity>

            {/**
              * Sin plan, el segundo botón lleva a montarlo.
              *
              * Antes, quien no seguía nada y ya había entrenado veía «hoy ya
              * está» y NADA MÁS: ni qué toca mañana, ni cómo organizarse. La
              * portada se quedaba muda justo con quien más falta le hace que
              * hable, que es el que aún no tiene plan.
              */}
            {hoy.programa ? (
              quedaDia && (
                <TouchableOpacity
                  style={h.botonSec}
                  onPress={() => router.push('/workout/program/plan')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={15} color={Colors.neon.w2} />
                  <Text style={h.botonSecTxt}>Lo que queda</Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity
                style={h.botonSec}
                onPress={() => router.push(modo ? `/workout/programs?mode=${modo}` : '/workout/programs')}
                activeOpacity={0.85}
              >
                <Ionicons name="map-outline" size={15} color={Colors.neon.w2} />
                <Text style={h.botonSecTxt}>Montar mi plan</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

/**
 * No sigues ningún plan.
 *
 * Es el ÚNICO estado en el que la portada ofrece elegir, porque es el único en
 * el que hay algo que decidir. Dos caminos y no seis: montar el plan —lo que
 * de verdad resuelve el problema— o entrenar hoy sin más, para quien ha abierto
 * la app con la bolsa ya en el hombro.
 */
function SinPlan({ modo }: { modo: ModoEntreno }) {
  return (
    <View style={h.marco}>
      <Image source={FOTOS[DEL_MODO[modo].foto].fuente} style={StyleSheet.absoluteFill} contentFit="cover" transition={280} />
      <Velo />
      <View style={h.dentro}>
        <Etiqueta texto="EMPIEZA POR AQUÍ" tono="hoy" />

        <View style={{ gap: Spacing[3] }}>
          <View>
            <Text style={h.titulo}>Monta tu semana</Text>
            <Text style={h.sub}>
              Elige un plan y la app te dirá qué toca cada día, cuánto peso poner
              y cuándo subirlo. No tendrás que volver a decidir nada.
            </Text>
          </View>

          <Boton texto="Elegir mi plan" onPress={() => router.push(`/workout/programs?mode=${modo}`)} />

          <TouchableOpacity
            style={h.botonSec}
            onPress={() => {
              void Haptics.selectionAsync()
              /* El lugar YA está decidido por la página. Antes iba `'todo'`,
                 y eso metía ejercicios de casa en una sesión de gimnasio. */
              router.push(`/workout/active?quick=${recetaDe('fullbody', 20, modo)}&mode=${modo}`)
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="flash-outline" size={15} color={Colors.neon.w2} />
            <Text style={h.botonSecTxt}>Hoy solo quiero entrenar algo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

function SinConexion() {
  return (
    <View style={[h.marco, { justifyContent: 'center', alignItems: 'center', padding: Spacing[5] }]}>
      <Ionicons name="cloud-offline-outline" size={34} color={Colors.neon.w3} />
      <Text style={[h.sub, { textAlign: 'center', marginTop: Spacing[3] }]}>
        No se pudo cargar tu día. Tira hacia abajo para reintentar — lo que
        entrenes sin conexión se guarda igual.
      </Text>
    </View>
  )
}

// ── El mapa vertical de la semana ────────────────────────────────────────────

/**
 * Un día de la semana, con su estado.
 *
 * Tres FORMAS distintas, no tres colores: tic para lo hecho, aro relleno para
 * hoy y aro vacío para lo que viene. Un rojo y un gris a 12 px son el mismo
 * punto para mucha gente, y aquí saber por dónde vas es todo el contenido.
 */
function FilaDia({ d, ultimo, semana }: { d: DiaDeLaSemana; ultimo: boolean; semana: number }) {
  /**
   * El DÍA DE LA SEMANA en grande y el entrenamiento debajo.
   *
   * Antes esta fila decía «Pecho y tríceps» y nada más, y había que adivinar
   * cuándo tocaba. La lista iba en orden, sí, pero un orden no es una fecha:
   * quien mira el lunes por la mañana quiere leer «LUNES», no contar filas.
   */
  const cuando = DIAS_SEMANA[d.diaSemana] ?? ''

  /**
   * Si es hoy y TÚ lo has cerrado, la fila lo enseña ya — sin esperar a que el
   * servidor se entere. Marcar los ejercicios y que la semana siga diciendo
   * «HOY» pendiente era justo la desconexión que rompía la sensación de que la
   * app lleva el registro.
   */
  const cerradoPorMi = useEntrenoRegistro(st => st.dias[hoyClave()]?.cerradoEn) != null
  const hechoYa = !!d.hecho || (d.esHoy && cerradoPorMi)

  return (
    <TouchableOpacity
      style={m.fila}
      onPress={() => {
        void Haptics.selectionAsync()
        // `esElDeHoy` llega en falso cuando se pide un día por número, así que
        // el dato viaja desde aquí, que es el único sitio que lo sabe seguro.
        router.push(`/workout/program/day?week=${semana}&day=${d.dia}${d.esHoy ? '&hoy=1' : ''}`)
      }}
      activeOpacity={0.8}
    >
      <View style={m.rail}>
        {hechoYa ? (
          <View style={[m.nodo, m.hecho]}>
            <Ionicons name="checkmark" size={12} color={Colors.neon.void} />
          </View>
        ) : d.esHoy ? (
          <View style={[m.nodo, m.hoy]}><View style={m.centro} /></View>
        ) : d.pendiente ? (
          /* Pendiente: aro rojo hueco. Ni tic ni relleno — se distingue por la
             FORMA, no por el color, que a 12 px no basta para mucha gente. */
          <View style={[m.nodo, m.pendiente]} />
        ) : (
          <View style={[m.nodo, m.porHacer]} />
        )}
        {!ultimo && <View style={[m.hilo, hechoYa && m.hiloHecho]} />}
      </View>

      <View style={m.cuerpo}>
        <Text style={[m.cuando, d.esHoy && m.cuandoHoy]}>{cuando.toUpperCase()}</Text>
        <Text style={[m.nombre, !d.esHoy && !hechoYa && { color: Colors.neon.w2 }]}>
          {d.nombre}
        </Text>
        <Text style={m.sub}>
          {d.hecho
            ? `${d.hecho.series} series${d.hecho.volumen > 0 ? ` · ${kilosCorto(d.hecho.volumen)}` : ''}`
            /* Fuera el foco: repetía el músculo que ya está en el nombre y
               dejaba cosas como «Core · 5 ejercicios · 15 series · Core». */
            : `${d.ejercicios} ejercicios · ${d.series} series`}
        </Text>
      </View>

      {/* La pastilla «HOY» se apaga en cuanto lo das por hecho: si no, la fila
          dice a la vez que está hecho y que te toca. */}
      {d.esHoy && !hechoYa && <View style={m.hoyPastilla}><Text style={m.hoyTxt}>HOY</Text></View>}
      {/* Un día que se quedó atrás NO se marca como fallado: se dice que sigue
          disponible, porque hacerlo mañana cuenta igual. */}
      {d.pendiente && (
        <View style={m.pendientePastilla}><Text style={m.pendienteTxt}>PENDIENTE</Text></View>
      )}
      <Ionicons name="chevron-forward" size={15} color={Colors.neon.w4} />
    </TouchableOpacity>
  )
}

// ── Piezas sueltas ───────────────────────────────────────────────────────────

export const Velo = () => (
  <LinearGradient
    colors={['rgba(5,5,5,0.28)', 'rgba(5,5,5,0.80)', 'rgba(5,5,5,0.98)']}
    locations={[0, 0.42, 1]}
    style={StyleSheet.absoluteFill}
    pointerEvents="none"
  />
)

function Etiqueta({ texto, tono }: { texto: string; tono: 'hoy' | 'aviso' | 'hecho' }) {
  return (
    <View style={[
      h.etiqueta,
      tono === 'hoy' && h.etiquetaHoy,
      tono === 'hecho' && h.etiquetaHecho,
    ]}>
      {tono === 'hecho' && <Ionicons name="checkmark" size={11} color={Colors.neon.void} />}
      {tono === 'aviso' && <View style={h.punto} />}
      <Text style={[
        h.etiquetaTxt,
        tono === 'hoy' && { color: '#fff' },
        tono === 'hecho' && { color: Colors.neon.void },
      ]}>{texto}</Text>
    </View>
  )
}

function Boton({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={h.boton}
      onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onPress() }}
      activeOpacity={0.88}
    >
      <Text style={h.botonTxt}>{texto}</Text>
      <View style={h.botonFlecha}>
        <Ionicons name="arrow-forward" size={16} color={Colors.neon.void} />
      </View>
    </TouchableOpacity>
  )
}

/**
 * Fila de acceso del bloque «TU MATERIAL». Exportada porque Running usa las
 * MISMAS: si tuviera unas propias, en el primer retoque una de las dos se
 * quedaría distinta y las tres portadas dejarían de ser la misma sección.
 */
export function Acceso({ icono, titulo, sub, onPress }: {
  icono: keyof typeof Ionicons.glyphMap
  titulo: string
  sub: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={s.acceso} onPress={onPress} activeOpacity={0.85}>
      <View style={s.accesoIcono}>
        <Ionicons name={icono} size={18} color={Colors.neon.w2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.accesoTitulo}>{titulo}</Text>
        <Text style={s.accesoSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.neon.w3} />
    </TouchableOpacity>
  )
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({

  cargando: { paddingVertical: Spacing[8], alignItems: 'center' },
  zonaHero: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4] },
  bloque: { paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], gap: Spacing[3] },

  seccionFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seccion: { fontSize: 10, fontWeight: '800', color: Colors.neon.w3, letterSpacing: 1.6 },
  enlace: { fontSize: 11, fontWeight: '700', color: Colors.neon.red },

  descarga: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[2],
    padding: Spacing[3],
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,92,0,0.28)',
  },
  descargaTxt: { flex: 1, fontSize: 11, color: Colors.neon.w2, lineHeight: 16 },

  mapa: {
    backgroundColor: Colors.neon.pane,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.neon.edge,
    paddingVertical: Spacing[2], paddingHorizontal: Spacing[3],
  },

  /* Discreto a propósito: acompaña a la semana, no compite con «Empezar». */
  editarSemana: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[3], paddingHorizontal: Spacing[4],
    borderRadius: 14,
    backgroundColor: Colors.neon.pane,
    borderWidth: 1, borderColor: Colors.neon.edge,
    marginTop: Spacing[2],
  },
  editarTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  editarSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },

  montar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: 18,
    backgroundColor: Colors.neon.redDim,
    borderWidth: 1, borderColor: 'rgba(255,92,0,0.28)',
  },
  montarIcono: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,92,0,0.16)',
  },
  montarTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.white },
  montarSub: { fontSize: 11, color: Colors.neon.w2, marginTop: 2, lineHeight: 16 },

  cifras: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: 20,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },

  acceso: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    padding: Spacing[4],
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.neon.edge,
  },
  accesoIcono: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  accesoTitulo: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  accesoSub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },
})

const h = StyleSheet.create({
  /**
   * Sin altura fija.
   *
   * La pieza cambia de contenido según el estado —tres ejercicios con nombres
   * largos, o dos líneas de texto— y con un alto fijo el botón se salía por
   * abajo en el caso más lleno. El mínimo garantiza que sigue siendo una
   * portada y no una tarjeta.
   */
  marco: {
    minHeight: 340, borderRadius: 26, overflow: 'hidden',
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: Colors.neon.void,
  },
  dentro: { flex: 1, justifyContent: 'space-between', padding: Spacing[4], gap: Spacing[5] },

  etiqueta: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingHorizontal: Spacing[3], paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  etiquetaHoy: { backgroundColor: Colors.neon.red },
  etiquetaHecho: { backgroundColor: 'rgba(255,255,255,0.94)' },
  etiquetaTxt: { fontSize: 9, fontWeight: '800', color: Colors.neon.void, letterSpacing: 1.1 },
  punto: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.neon.red },

  titulo: { fontSize: 29, fontWeight: '800', color: Colors.neon.white, letterSpacing: -0.8, lineHeight: 33 },
  sub: { fontSize: 12, color: Colors.neon.w2, marginTop: 4, lineHeight: 17 },

  lista: { gap: Spacing[2] },
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  filaNombre: { fontSize: 13, fontWeight: '700', color: Colors.neon.white },
  filaSub: { fontSize: 11, color: Colors.neon.w2, marginTop: 1 },
  mas: { fontSize: 11, color: Colors.neon.w3, fontStyle: 'italic', marginLeft: 50 },

  boton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.neon.white,
    borderRadius: BorderRadius.full,
    paddingLeft: Spacing[5], paddingRight: 5, paddingVertical: 5,
  },
  botonTxt: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.void },
  botonFlecha: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.neon.redCore,
  },

  acciones: { flexDirection: 'row', gap: Spacing[2] },
  botonSec: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing[3],
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  botonSecTxt: { fontSize: 12, fontWeight: '700', color: Colors.neon.w2 },
})

const m = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  // Alto fijo, o el hilo se estiraría con los nombres largos y la línea saldría
  // desigual entre un día y otro.
  rail: { width: 20, height: 54, alignItems: 'center' },
  nodo: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hecho: { backgroundColor: Colors.neon.white },
  hoy: { borderWidth: 2, borderColor: Colors.neon.red, backgroundColor: Colors.neon.redDim },
  centro: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.neon.red },
  porHacer: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' },
  hilo: { flex: 1, width: 2, backgroundColor: 'rgba(255,255,255,0.12)', marginTop: 2 },
  hiloHecho: { backgroundColor: 'rgba(255,255,255,0.30)' },

  cuerpo: { flex: 1, paddingBottom: 2 },
  cuando: {
    fontSize: 9.5, fontWeight: '800', color: Colors.neon.w3,
    letterSpacing: 1.1, marginBottom: 1,
  },
  cuandoHoy: { color: Colors.neon.redSoft },
  nombre: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.white },
  sub: { fontSize: 11, color: Colors.neon.w3, marginTop: 1 },

  pendiente: { borderWidth: 1.5, borderColor: 'rgba(255,92,0,0.55)' },

  hoyPastilla: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neon.red,
  },
  hoyTxt: { fontSize: 8.5, fontWeight: '800', color: '#fff', letterSpacing: 0.8 },

  /* Pendiente va en contorno y no en relleno: es una invitación, no un aviso.
     Con el mismo peso visual que HOY competiría con lo que de verdad toca. */
  pendientePastilla: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: 'rgba(255,92,0,0.55)',
  },
  pendienteTxt: { fontSize: 8.5, fontWeight: '800', color: Colors.neon.redSoft, letterSpacing: 0.8 },
})

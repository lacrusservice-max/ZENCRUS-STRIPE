/**
 * TU RACHA
 * ════════
 * El reactor con todo lo que el historial ya sabe y hasta ahora no se enseñaba:
 * cuándo empezó, qué día llegarás al siguiente hito, qué gestos cuentan hoy,
 * los protectores que te quedan, el calendario con su leyenda, en qué día de la
 * semana fallas y las rachas que tuviste antes.
 *
 * ── De dónde sale cada cosa ─────────────────────────────────────────────────
 * De `getHistory(84)`, que ya existía. Los cuatro bloques derivados —inicio,
 * rachas previas, patrón semanal y fecha del hito— se calculan en
 * `@/utils/analisisRacha`, que son funciones puras y están probadas: un tramo
 * mal contado no daría error, daría un número creíble y falso.
 *
 * ── El color lo manda el hito ───────────────────────────────────────────────
 * Todo lo que va teñido —el reactor, la cifra, la barra, el icono de cabecera—
 * sale de `hitoDe(dias)`. Al cruzar los 100 la pantalla entera pasa a azul sin
 * tocar una línea aquí.
 */

import { useEffect, useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import { useVideoPlayer, VideoView } from 'expo-video'
import { Image } from '@/components/ui/Imagen'
import { Screen, ScreenHeader } from '@/components/ui/Screen'
import { Reactor } from '@/components/racha/Reactor'
import { useStreakStore } from '@/store/streakStore'
import { useAchievementStore } from '@/store/achievementStore'
import { hitoDe, HITOS, type Hito } from '@/constants/hitosRacha'
import {
  inicioDeRacha, rachasPrevias, patronSemanal, diaFlojo,
  fechaDelHito, enLetra, enCorto, type DiaHistorial,
} from '@/utils/analisisRacha'
import { Colors, Spacing } from '@/constants/theme'
import { TabBar } from '@/constants/layout'
import { tocar } from '@/utils/haptica'

const N = Colors.neon
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const NOMBRE_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

export default function RachasScreen() {
  const {
    currentStreak, longestStreak, totalDaysActive,
    getTodayActivity, getHistory, load,
  } = useStreakStore()
  const { streakShields } = useAchievementStore()
  const [historial, setHistorial] = useState<DiaHistorial[]>([])
  const [abierto, setAbierto] = useState<Hito | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    /* `load()` PRIMERO y esperado, no en paralelo. `getHistory` pregunta al
       store si hoy ya cuenta para decidir el estado del día de hoy, y si se
       lanzan a la vez responde con la actividad todavía sin cargar: el día sale
       vacío, la racha parece rota y la cabecera dice «enciéndela hoy» a alguien
       que acaba de encenderla.

       Y el `catch`, porque sin él un fallo de red dejaba la pantalla muda:
       calendario en blanco, sin semana típica y sin rachas anteriores, sin nada
       que explicara por qué. */
    let vivo = true
    void (async () => {
      try {
        await load()
        const h = await getHistory(84)
        if (vivo) setHistorial(h as DiaHistorial[])
      } catch {
        if (vivo) setHistorial([])
      } finally {
        if (vivo) setCargando(false)
      }
    })()
    return () => { vivo = false }
  }, [])

  const hito = useMemo(() => hitoDe(currentStreak), [currentStreak])
  const siguiente = useMemo(
    () => HITOS.slice().reverse().find(h => h.desde > currentStreak) ?? null,
    [currentStreak],
  )
  const faltan = siguiente ? siguiente.desde - currentStreak : 0

  const inicio = useMemo(() => inicioDeRacha(historial), [historial])
  const previas = useMemo(() => rachasPrevias(historial), [historial])
  const patron = useMemo(() => patronSemanal(historial), [historial])
  const flojo = useMemo(() => diaFlojo(patron), [patron])
  const mejorDia = useMemo(
    () => Math.max(0.01, ...patron.filter((v): v is number => v != null)),
    [patron],
  )
  const hoy = getTodayActivity()

  /* El progreso hacia el siguiente hito se mide DENTRO del tramo, no desde
     cero: con 150 días, la barra hacia los 200 debe ir por la mitad, no al
     75 % de la escala completa. */
  const tramoDesde = useMemo(() => {
    const previos = HITOS.slice().reverse().filter(h => h.desde <= currentStreak)
    return previos.length ? previos[previos.length - 1].desde : 0
  }, [currentStreak])
  const avance = siguiente
    ? Math.max(0.015, (currentStreak - tramoDesde) / (siguiente.desde - tramoDesde))
    : 1

  return (
    <Screen>
      <ScreenHeader
        back
        eyebrow="Zencrus · Constancia"
        title="Tu racha"
        subtitle={inicio ? `Empezó el ${enLetra(aFecha(inicio))}` : 'Enciéndela hoy'}
        icon="flame"
        color={hito.neon}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TabBar.scrollInset + 24 }}
      >
        {/* ── El número, con el personaje del hito ── */}
        <Animated.View entering={FadeInDown.duration(460)} style={s.hero}>
          <Retrato hito={hito} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[s.numero, { color: hito.claro }]}>{currentStreak}</Text>
            <Text style={s.unidad}>
              {currentStreak === 1 ? 'DÍA SEGUIDO' : 'DÍAS SEGUIDOS'}
            </Text>
            <View style={s.pastillas}>
              <Pastilla valor={longestStreak} texto="récord" />
              <Pastilla valor={totalDaysActive} texto="totales" />
            </View>
          </View>
        </Animated.View>

        <Rotulo texto="Tu nivel" retraso={80} />
        <View style={s.seccion}>
          <Reactor dias={currentStreak} onHito={h => { tocar(); setAbierto(h) }} />
        </View>

        {/* ── Si sigues así ── */}
        {siguiente && (
          <>
            <Rotulo texto="Si sigues así" retraso={140} />
            <Animated.View entering={FadeInDown.delay(160).duration(420)} style={[s.seccion, s.caja]}>
              <View style={s.llegada}>
                <View style={[s.llegadaIco, { backgroundColor: siguiente.neon + '22', borderColor: siguiente.neon + '4D' }]}>
                  <Text style={{ fontSize: 15 }}>📅</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.llegadaFecha}>{enLetra(fechaDelHito(faltan))}</Text>
                  <Text style={s.llegadaSub}>llegarás a los {siguiente.desde} días</Text>
                </View>
              </View>
              <View style={s.barra}>
                <View style={[s.barraFill, {
                  width: `${Math.round(avance * 100)}%`,
                  backgroundColor: siguiente.neon,
                  shadowColor: siguiente.neon,
                }]} />
              </View>
              <View style={s.barraPie}>
                <Text style={s.barraTxt}>{currentStreak} DE {siguiente.desde}</Text>
                <Text style={s.barraTxt}>FALTAN {faltan} {faltan === 1 ? 'DÍA' : 'DÍAS'}</Text>
              </View>
            </Animated.View>
          </>
        )}

        {/* ── Por qué cuenta hoy ── */}
        <Rotulo texto="Por qué cuenta hoy" retraso={200} />
        <Animated.View entering={FadeInDown.delay(220).duration(420)} style={[s.seccion, s.gestos]}>
          <Gesto icono="🍽" nombre="Comida" hecho={hoy.loggedFood} hito={hito} />
          <Gesto icono="🏋" nombre="Entreno" hecho={hoy.loggedWorkout} hito={hito} />
          <Gesto icono="💬" nombre="Check-in" hecho={hoy.checkInDone} hito={hito} />
        </Animated.View>

        {/* ── Protectores ── */}
        <Rotulo texto="Protectores" retraso={260} />
        <Animated.View entering={FadeInDown.delay(280).duration(420)} style={[s.seccion, s.caja]}>
          <View style={s.escudos}>
            <View style={s.pila}>
              {Array.from({ length: 3 }).map((_, i) => (
                <View key={i} style={[s.escudo, i >= streakShields && s.escudoGastado]}>
                  <Text style={{ fontSize: 12, opacity: i >= streakShields ? 0.4 : 1 }}>🛡</Text>
                </View>
              ))}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.escudoTitulo}>
                {streakShields} {streakShields === 1 ? 'disponible' : 'disponibles'}
              </Text>
              <Text style={s.escudoSub}>
                Salvan un día olvidado y evitan que la racha se rompa.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* ── Calendario ── */}
        <Rotulo texto="Doce semanas" retraso={320} />
        <Animated.View entering={FadeInDown.delay(340).duration(420)} style={[s.seccion, s.caja]}>
          {historial.length > 0
            ? <Calendario historial={historial} hito={hito} />
            : <Text style={s.vacio}>
                {cargando ? 'Cargando tu historial…' : 'Aún no hay historial que enseñar.'}
              </Text>}
        </Animated.View>

        {/* ── Semana típica ── */}
        {patron.some(v => v != null) && (
          <>
            <Rotulo texto="Tu semana típica" retraso={380} />
            <Animated.View entering={FadeInDown.delay(400).duration(420)} style={[s.seccion, s.caja]}>
              <View style={s.patron}>
                {patron.map((v, i) => (
                  <View key={i} style={s.patronCol}>
                    <View style={[
                      s.patronBarra,
                      /* `null` es «no hay datos suficientes», no «cero»: se pinta
                         un tocón gris en vez de una barra a ras, que se leería
                         como que ese día siempre fallas. */
                      /* Relativo al mejor día, no al 100 % absoluto. Con pocas
                         semanas de historial todas las proporciones son bajas y
                         en absoluto salían siete tocones idénticos: el patrón
                         —que es lo único que importa aquí— no se veía. */
                      { height: `${v == null ? 8 : Math.max(10, (v / mejorDia) * 100)}%` },
                      v == null
                        ? s.patronVacio
                        : { backgroundColor: hito.neon, shadowColor: hito.neon },
                    ]} />
                    <Text style={s.patronDia}>{DIAS[i]}</Text>
                  </View>
                ))}
              </View>
              {flojo != null && (
                <Text style={s.patronNota}>
                  Tus rachas se rompen sobre todo en <Text style={s.patronFuerte}>{NOMBRE_DIA[flojo]}</Text>.
                </Text>
              )}
            </Animated.View>
          </>
        )}

        {/* ── Rachas anteriores ── */}
        {previas.length > 0 && (
          <>
            <Rotulo texto="Rachas anteriores" retraso={440} />
            <Animated.View entering={FadeInDown.delay(460).duration(420)} style={[s.seccion, s.caja]}>
              {previas.map((p, i) => (
                <View key={p.inicio} style={[s.previa, i < previas.length - 1 && s.previaBorde]}>
                  <Text style={[s.previaDias, { color: hito.claro }]}>{p.dias}</Text>
                  <View style={s.previaBarra}>
                    <View style={[s.previaFill, {
                      width: `${Math.round((p.dias / Math.max(previas[0].dias, 1)) * 100)}%`,
                      backgroundColor: hito.neon,
                    }]} />
                  </View>
                  <Text style={s.previaFecha}>{enCorto(p.inicio)} – {enCorto(p.fin)}</Text>
                </View>
              ))}
            </Animated.View>
          </>
        )}
      </ScrollView>

      {abierto && <FichaHito hito={abierto} dias={currentStreak} onCerrar={() => setAbierto(null)} />}
    </Screen>
  )
}

// ── Piezas ────────────────────────────────────────────────────────────────────

/** El personaje del hito actual, en redondo. */
/**
 * El personaje, sin espera.
 *
 * El póster —el primer fotograma como imagen— se pinta al momento y el vídeo se
 * monta encima. Antes había uno o dos segundos de agujero negro mientras el
 * reproductor abría el archivo, y en una pantalla que va de celebrar algo, ese
 * hueco es justo lo contrario de lo que se busca.
 *
 * El corte no se ve porque el póster ES el primer fotograma del vídeo.
 */
function Retrato({ hito, tam = 92 }: { hito: Hito; tam?: number }) {
  const player = useVideoPlayer(hito.video, p => { p.loop = true; p.muted = true; p.play() })
  useEffect(() => () => { try { player.pause() } catch { /* ya destruido */ } }, [])
  return (
    <View style={[s.retrato, { width: tam, height: tam, borderRadius: tam / 2, shadowColor: hito.neon, isolation: 'isolate' }]}>
      <Image source={hito.poster} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      <TinteNaranja hito={hito} />
    </View>
  )
}

/**
 * El personaje del primer nivel viene en rojo.
 *
 * Los seis niveles tienen su vídeo de color —blanco, dorado, verde, morado,
 * azul y ROJO— y el rojo es el del nivel 1, el que ve todo el mundo su primer
 * día. Recolorear un `.mp4` pide reexportarlo; mientras tanto se le funde
 * encima el naranja de marca en modo `hue`, que cambia el tono y respeta la luz
 * y la saturación —que es justo lo que mantiene vivas las llamas—.
 *
 * Los otros cinco niveles NO se tocan: su color no es la marca, es su identidad
 * de nivel, y teñirlos los volvería el mismo naranja.
 */
function TinteNaranja({ hito }: { hito: Hito }) {
  if (hito.desde !== 1) return null
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: '#FF5C00', mixBlendMode: 'hue' }]}
    />
  )
}

function Rotulo({ texto, retraso }: { texto: string; retraso: number }) {
  return (
    <Animated.View entering={FadeIn.delay(retraso).duration(400)} style={s.rotuloFila}>
      <Text style={s.rotuloTxt}>{texto.toUpperCase()}</Text>
      <View style={s.rotuloLinea} />
    </Animated.View>
  )
}

function Pastilla({ valor, texto }: { valor: number; texto: string }) {
  return (
    <View style={s.pastilla}>
      <Text style={s.pastillaNum}>{valor}</Text>
      <Text style={s.pastillaTxt}>{texto}</Text>
    </View>
  )
}

function Gesto({ icono, nombre, hecho, hito }: {
  icono: string; nombre: string; hecho: boolean; hito: Hito
}) {
  return (
    <View style={[
      s.gesto,
      hecho && { borderColor: hito.neon + '73', backgroundColor: hito.neon + '1A' },
    ]}>
      <Text style={[s.gestoIco, !hecho && s.gestoApagado]}>{icono}</Text>
      <Text style={s.gestoNombre}>{nombre}</Text>
      <Text style={s.gestoEstado}>{hecho ? 'hecho' : 'pendiente'}</Text>
    </View>
  )
}

/** Doce semanas en columnas de siete, con su leyenda. */
function Calendario({ historial, hito }: { historial: DiaHistorial[]; hito: Hito }) {
  /* El historial viene de hoy hacia atrás; se invierte para que el calendario
     se lea de izquierda (antiguo) a derecha (hoy), como cualquier calendario. */
  const dias = [...historial].reverse()
  const semanas: DiaHistorial[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
  const color = (d: DiaHistorial) =>
    d.status === 'completed' ? hito.neon
      : d.status === 'protected' ? '#2E9BFF8C'
      : d.status === 'future' ? 'rgba(255,255,255,0.02)'
      : 'rgba(255,255,255,0.045)'

  return (
    <View>
      {/* En columnas de siete —una por semana—, como cualquier calendario de
          contribuciones: por filas de doce, un lunes caería en distinta altura
          cada semana y el patrón semanal no se vería. */}
      <View style={s.cal}>
        {semanas.map((sem, i) => (
          <View key={i} style={s.calCol}>
            {sem.map(d => (
              <View key={d.date} style={[s.calDia, { backgroundColor: color(d) }]} />
            ))}
          </View>
        ))}
      </View>
      <View style={s.leyenda}>
        <Leyenda color={hito.neon} texto="completo" />
        <Leyenda color="#2E9BFF8C" texto="protegido" />
        <Leyenda color="rgba(255,255,255,0.045)" texto="en blanco" />
      </View>
    </View>
  )
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <View style={s.leyendaItem}>
      <View style={[s.leyendaCubo, { backgroundColor: color }]} />
      <Text style={s.leyendaTxt}>{texto}</Text>
    </View>
  )
}

/**
 * Qué hay detrás de un hito bloqueado.
 *
 * Cinco marcas sin explicación son cinco misterios, y un premio que no se
 * conoce no tira de nadie. Al tocarlas se dice qué se desbloquea.
 */
function FichaHito({ hito, dias, onCerrar }: { hito: Hito; dias: number; onCerrar: () => void }) {
  const logrado = dias >= hito.desde
  return (
    <Pressable style={s.velo} onPress={onCerrar}>
      <Animated.View entering={FadeInDown.duration(300)} style={[s.ficha, { borderColor: hito.neon + '59' }]}>
        {/* El personaje de ese color, no un punto.
            Lo que se desbloquea ES el vídeo: enseñarlo aquí convierte la ficha
            en un avance de lo que vas a ver, que es lo que de verdad tira. */}
        <Retrato hito={hito} tam={104} />
        <Text style={[s.fichaNum, { color: hito.claro }]}>{hito.desde}</Text>
        <Text style={s.fichaTitulo}>{hito.titulo.toUpperCase()}</Text>
        <Text style={s.fichaTexto}>
          {logrado
            ? 'Conseguido. Este es el color que lleva tu racha ahora mismo.'
            : `Al llegar, ZENA se enciende de este color y la app entera lo toma: el número, el medidor y el icono de la cabecera. Te quedan ${hito.desde - dias} días.`}
        </Text>
        <Pressable style={[s.fichaBoton, { borderColor: hito.neon + '73' }]} onPress={onCerrar}>
          <Text style={[s.fichaBotonTxt, { color: hito.claro }]}>Entendido</Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  )
}

function aFecha(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 4 },
  retrato: {
    overflow: 'hidden', backgroundColor: '#050505',
    shadowOpacity: 0.55, shadowRadius: 26, shadowOffset: { width: 0, height: 0 },
  },
  numero: { fontSize: 50, fontWeight: '900', letterSpacing: -3, lineHeight: 52, fontVariant: ['tabular-nums'] },
  unidad: { fontSize: 8, fontWeight: '800', letterSpacing: 2.4, color: 'rgba(255,255,255,0.4)' },
  pastillas: { flexDirection: 'row', gap: 6, marginTop: 9 },
  pastilla: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1, borderColor: N.edge,
  },
  pastillaNum: { fontSize: 10.5, fontWeight: '900', color: '#fff', fontVariant: ['tabular-nums'] },
  pastillaTxt: { fontSize: 7, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: N.w3 },

  rotuloFila: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, marginTop: 22, marginBottom: 11 },
  rotuloTxt: { fontSize: 9, fontWeight: '900', letterSpacing: 3, color: N.w3 },
  rotuloLinea: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.09)' },

  seccion: { marginHorizontal: 20 },
  caja: {
    backgroundColor: 'rgba(255,255,255,0.024)',
    borderWidth: 1, borderColor: N.edge, borderRadius: 18, padding: 13,
  },

  llegada: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  llegadaIco: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  llegadaFecha: { fontSize: 13.5, fontWeight: '800', color: '#fff', letterSpacing: -0.1 },
  llegadaSub: { fontSize: 10, color: N.w3, marginTop: 1 },
  barra: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: 11, overflow: 'hidden' },
  barraFill: { height: '100%', borderRadius: 3, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  barraPie: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  barraTxt: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5, color: N.w3 },

  gestos: { flexDirection: 'row', gap: 8 },
  gesto: {
    flex: 1, borderRadius: 13, paddingVertical: 11, paddingHorizontal: 6, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.022)', borderWidth: 1, borderColor: N.edge,
  },
  gestoIco: { fontSize: 17 },
  gestoApagado: { opacity: 0.32 },
  gestoNombre: { fontSize: 8, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', color: '#fff', marginTop: 5 },
  gestoEstado: { fontSize: 7, color: N.w3, marginTop: 2 },

  escudos: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  pila: { flexDirection: 'row', gap: 5 },
  escudo: {
    width: 29, height: 33, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(46,155,255,0.16)',
    borderWidth: 1, borderColor: 'rgba(46,155,255,0.42)', borderRadius: 7,
  },
  escudoGastado: { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)' },
  escudoTitulo: { fontSize: 12.5, fontWeight: '800', color: '#fff' },
  escudoSub: { fontSize: 9.5, color: N.w3, marginTop: 1, lineHeight: 14 },

  vacio: { fontSize: 11.5, color: N.w3, textAlign: 'center', paddingVertical: 16 },
  cal: { flexDirection: 'row', gap: 3 },
  calCol: { flex: 1, gap: 3 },
  calDia: { width: '100%', aspectRatio: 1, borderRadius: 2.5 },
  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leyendaCubo: { width: 9, height: 9, borderRadius: 3 },
  leyendaTxt: { fontSize: 7.5, color: N.w3, fontWeight: '600' },

  patron: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 62 },
  patronCol: { flex: 1, alignItems: 'center', gap: 5, height: '100%', justifyContent: 'flex-end' },
  patronBarra: { width: '100%', borderRadius: 4, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  patronVacio: { backgroundColor: 'rgba(255,255,255,0.09)' },
  patronDia: { fontSize: 7.5, fontWeight: '800', color: N.w3 },
  patronNota: { marginTop: 10, fontSize: 9.5, color: N.w2, lineHeight: 14 },
  patronFuerte: { color: '#fff', fontWeight: '700' },

  previa: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  previaBorde: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.045)' },
  previaDias: { fontSize: 13, fontWeight: '900', width: 26, textAlign: 'right', fontVariant: ['tabular-nums'] },
  previaBarra: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  previaFill: { height: '100%', borderRadius: 3 },
  previaFecha: { fontSize: 8, color: N.w3, width: 84, fontWeight: '600', textAlign: 'right' },

  velo: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,5,0.82)', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 100 },
  ficha: {
    width: '100%', maxWidth: 300, borderRadius: 22, padding: 22, alignItems: 'center',
    backgroundColor: '#0D0D10', borderWidth: 1,
  },
  fichaNum: { fontSize: 44, fontWeight: '900', letterSpacing: -2.4, marginTop: 14, fontVariant: ['tabular-nums'] },
  fichaTitulo: { fontSize: 8.5, fontWeight: '900', letterSpacing: 2.6, color: N.w3, marginTop: 2 },
  fichaTexto: { fontSize: 12.5, color: N.w2, textAlign: 'center', lineHeight: 18, marginTop: 13 },
  fichaBoton: { marginTop: 18, height: 42, width: '100%', borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fichaBotonTxt: { fontSize: 12.5, fontWeight: '800' },
})

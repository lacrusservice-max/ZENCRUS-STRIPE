/**
 * CICLO · LA BARRA DE ABAJO
 * ═══════════════════════════════════════════════════════════════════════════
 * Las cinco pestañas del mockup: Inicio · Calendario · Ajustes · Estadísticas
 * · Comunidad.
 *
 * ── Sí, es una segunda barra ───────────────────────────────────────────────
 * ZENCRUS ya tiene la suya abajo. Ésta la sustituye mientras dura el módulo,
 * no se apila encima: dos barras a la vez son 130 px de cromo y en iOS se lee
 * como un error de montaje. La salida hacia Salud está en la cabecera de cada
 * pantalla, no en una sexta pestaña.
 *
 * ── Los iconos hay que TEÑIRLOS ────────────────────────────────────────────
 * Los PNG del mockup vinieron exportados cada uno en el estado en que salía en
 * su pantalla: `ic_nav_inicio` es malva —estaba inactivo— y `ic_nav_calendario`
 * morado —estaba activo—. Pintados tal cual, la barra tendría dos colores a la
 * vez sin que nadie los hubiera elegido. `tintColor` los iguala y deja que el
 * estado lo decida el código.
 *
 * ── El hueco de abajo ──────────────────────────────────────────────────────
 * La barra flota, así que hay que reservarle sitio al final del contenido de
 * cada pantalla o la última tarjeta queda debajo. `ALTO_BARRA` existe para
 * eso, y para que ese número viva en UN sitio.
 */

import { View, Text, Pressable, StyleSheet, Image } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, usePathname } from 'expo-router'
import { ICONO, type NombreIcono } from '@/features/salud/ciclo/iconos'
import { ACENTO, TEXTO, FUENTE, SUP, SOMBRA } from '@/theme/salud/cicloClaro'
import { elegir } from '@/utils/haptica'

interface Pestana {
  ruta: string
  etiqueta: string
  icono: NombreIcono
}

/* El orden es el del mockup, con Ajustes en medio. No es el orden que uno
   elegiría —los ajustes suelen ir al final—, pero cambiarlo movería el pulgar
   de sitio respecto al diseño aprobado. */
const PESTANAS: Pestana[] = [
  { ruta: '/salud/ciclo',               etiqueta: 'Inicio',        icono: 'nav_inicio' },
  { ruta: '/salud/ciclo/calendario',    etiqueta: 'Calendario',    icono: 'nav_calendario' },
  { ruta: '/salud/ciclo/ajustes',       etiqueta: 'Ajustes',       icono: 'nav_ajustes' },
  { ruta: '/salud/ciclo/estadisticas',  etiqueta: 'Estadísticas',  icono: 'nav_estadisticas' },
  { ruta: '/salud/ciclo/comunidad',     etiqueta: 'Comunidad',     icono: 'nav_comunidad' },
]

/** Alto visual de la barra, sin contar el margen de seguridad de abajo. */
export const ALTO_BARRA = 74

export function BarraCiclo() {
  const insets = useSafeAreaInsets()
  const ruta = usePathname()

  return (
    <View style={[s.caja, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {PESTANAS.map(p => {
        /* `/salud/ciclo` es prefijo de todas las demás, así que compararlo con
           `startsWith` dejaría Inicio encendido siempre. Exacta para Inicio,
           prefijo para el resto —que sí tienen pantallas hijas. */
        const activa = p.ruta === '/salud/ciclo'
          ? ruta === '/salud/ciclo'
          : ruta.startsWith(p.ruta)

        return (
          <Pressable
            key={p.ruta}
            onPress={() => {
              if (activa) return
              elegir()
              router.replace(p.ruta as never)
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activa }}
            accessibilityLabel={p.etiqueta}
            style={s.pestana}
          >
            <Image
              source={ICONO[p.icono]}
              style={[s.icono, { tintColor: activa ? ACENTO.morado : INACTIVO }]}
              resizeMode="contain"
            />
            <Text
              style={[s.txt, activa && s.txtOn]}
              numberOfLines={1}
              /* «Estadísticas» no cabe a 12 px en pantallas de 375 pt. Se deja
                 encoger hasta el 80 % en vez de cortarla con puntos suspensivos,
                 que en una etiqueta de pestaña se lee como un fallo. */
              adjustsFontSizeToFit
              minimumFontScale={0.8}
            >
              {p.etiqueta}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const INACTIVO = '#B9A9C6'

const s = StyleSheet.create({
  caja: {
    position: 'absolute', left: 12, right: 12, bottom: 0,
    flexDirection: 'row',
    paddingTop: 12,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    backgroundColor: SUP.tarjeta,
    ...SOMBRA,
    shadowOffset: { width: 0, height: -4 },
  },
  pestana: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 2 },
  icono: { width: 23, height: 23 },
  txt: {
    fontFamily: FUENTE.medio, fontSize: 12,
    color: TEXTO.suave, textAlign: 'center',
  },
  txtOn: { fontFamily: FUENTE.fuerte, color: ACENTO.morado },
})

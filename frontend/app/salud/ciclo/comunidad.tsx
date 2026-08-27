/**
 * CICLO · COMUNIDAD
 * ═══════════════════════════════════════════════════════════════════════════
 * La pantalla 12 del mockup, con una diferencia decidida por Sergio: en vez de
 * un feed de artículos propio, esta pestaña es la puerta a Social — y dentro
 * de Social, a un espacio cerrado al que solo entran mujeres.
 *
 * ── Por qué no se duplica la comunidad ─────────────────────────────────────
 * ZENCRUS ya tiene Social. Un segundo foro dentro del ciclo partiría a la
 * gente en dos sitios donde nadie encuentra a nadie: dos comunidades a medias
 * en vez de una viva.
 *
 * ── El espacio femenino es una promesa, y las promesas se cumplen en el
 *    SERVIDOR ────────────────────────────────────────────────────────────────
 * Esta pantalla enseña la puerta; no es la que decide quién pasa. Un filtro
 * que viva en el móvil se salta con una petición hecha a mano, y lo que hay al
 * otro lado no es un ranking de pesos: es lo que una mujer escribe sobre su
 * cuerpo creyendo que ningún hombre lo va a leer. La comprobación tiene que
 * estar donde no se puede tocar.
 *
 * Ya está: `backend/src/services/circuloFemenino.ts` comprueba el perfil en
 * cada petición y cierra los cinco caminos por los que se llega a una
 * publicación —el muro, el muro de seguidos, el perfil de la autora, el enlace
 * directo y los guardados—.
 */

import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { ALTO_BARRA } from '@/components/salud/ciclo/BarraCiclo'
import { Pantalla, Tarjeta, Azulejo, Icono } from '@/components/salud/ciclo/Claro'
import {
  FONDO, FASE, ACENTO, TEXTO, FUENTE, HUECO, SUP, SOMBRA, RADIO,
} from '@/theme/salud/cicloClaro'
import { elegir } from '@/utils/haptica'
import type { NombreIcono } from '@/features/salud/ciclo/iconos'
import type { Phase } from '@/features/salud/ciclo/fases'

/**
 * Los temas que se abren en Social ya filtrados.
 *
 * Se eligen por fase: en menstrual interesa el dolor y el hierro; en lútea, los
 * antojos y el ánimo. Enseñar los ocho temas siempre sería un índice, no una
 * recomendación.
 */
const TEMAS: Record<Phase, { etiqueta: string; tema: string; icono: NombreIcono; fondo: string }[]> = {
  menstrual: [
    { etiqueta: 'Cólicos y qué alivia de verdad', tema: 'colicos', icono: 'wellness_sintomas', fondo: ACENTO.rojoSuave },
    { etiqueta: 'Hierro en los días de sangrado', tema: 'hierro', icono: 'wellness_nutricion', fondo: ACENTO.verdeSuave },
  ],
  folicular: [
    { etiqueta: 'Subir cargas cuando llega la energía', tema: 'fuerza', icono: 'wellness_entrenamiento', fondo: ACENTO.moradoFondo },
    { etiqueta: 'Comer para sostener el gasto', tema: 'nutricion', icono: 'wellness_nutricion', fondo: ACENTO.verdeSuave },
  ],
  ovulatoria: [
    { etiqueta: 'Días de más energía: qué hacer con ellos', tema: 'energia', icono: 'wellness_energia', fondo: ACENTO.tealSuave },
    { etiqueta: 'Cambios en el deseo', tema: 'libido', icono: 'wellness_salud_corazon', fondo: ACENTO.rosaSuave },
  ],
  lutea: [
    { etiqueta: 'Antojos en la fase lútea: por qué ocurren', tema: 'antojos', icono: 'wellness_nutricion', fondo: ACENTO.verdeSuave },
    { etiqueta: 'Ánimo e irritabilidad antes de la regla', tema: 'animo', icono: 'mood_badge', fondo: ACENTO.naranjaSuave },
  ],
}

export default function ComunidadCiclo() {
  const { prediccion } = useCiclo()
  const fase: Phase = prediccion?.fase ?? 'folicular'
  const temas = TEMAS[fase]

  const abrirSocial = (tema?: string) => {
    elegir()
    router.push(tema
      ? { pathname: '/(tabs)/social', params: { circulo: 'femenino', tema } }
      : { pathname: '/(tabs)/social', params: { circulo: 'femenino' } })
  }

  return (
    <Pantalla fondo={FONDO.comunidad}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: ALTO_BARRA + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.cab}>
          <View style={s.flex}>
            <Text style={s.titulo}>Comunidad</Text>
            <Text style={s.subtitulo}>Un espacio para hablarlo con otras</Text>
          </View>
          <Pressable
            onPress={() => abrirSocial()}
            style={({ pressed }) => [s.buscar, pressed && s.pulsado]}
            accessibilityRole="button"
            accessibilityLabel="Buscar en la comunidad"
          >
            <Icono nombre="community_buscar" tam={21} />
          </Pressable>
        </View>

        {/* ── La puerta al círculo femenino ───────────────────────────────
            Es la tarjeta grande del mockup, en su sitio y con su papel: lo
            primero que se ve y lo único que ocupa el ancho entero. */}
        <Pressable
          onPress={() => abrirSocial()}
          style={({ pressed }) => [s.circulo, pressed && s.pulsado]}
          accessibilityRole="button"
        >
          <View style={s.circuloCab}>
            <Text style={s.etiquetaDestacado}>SOLO MUJERES</Text>
            <Icono nombre="community_marcador" tam={18} style={s.marcador} />
          </View>
          <Icono nombre="community_decorativo" tam={78} style={s.decorativo} />
          <View style={s.circuloPie}>
            <Text style={s.circuloTit}>Círculo femenino</Text>
            <Text style={s.circuloTxt}>
              Lo que se publica aquí no sale de aquí. Los perfiles masculinos no
              ven estas publicaciones ni aparecen en las respuestas.
            </Text>
            <Text style={s.circuloIr}>Entrar ›</Text>
          </View>
        </Pressable>

        {/* ── Temas según la fase ─────────────────────────────────────── */}
        <View style={s.rotuloFila}>
          <Text style={s.rotulo}>Para ti hoy</Text>
          <View style={[s.pildoraFase, { backgroundColor: FASE[fase].celda }]}>
            <Text style={[s.pildoraFaseTxt, { color: FASE[fase].texto }]}>
              fase {FASE[fase].etiqueta}
            </Text>
          </View>
        </View>

        {temas.map(t => (
          <Pressable
            key={t.tema}
            onPress={() => abrirSocial(t.tema)}
            style={({ pressed }) => [s.tema, pressed && s.pulsado]}
            accessibilityRole="button"
          >
            <Azulejo icono={t.icono} fondo={t.fondo} tam={64} icono_tam={28} />
            <View style={s.flex}>
              <Text style={s.temaTit}>{t.etiqueta}</Text>
              <Text style={s.temaPie}>Círculo femenino</Text>
            </View>
          </Pressable>
        ))}

        {/* ── Qué garantiza el círculo, dicho sin adornos ───────────────── */}
        <Tarjeta style={s.aviso}>
          <Azulejo icono="auth_candado" fondo={ACENTO.verdeSuave} tam={40} />
          <View style={s.flex}>
            <Text style={s.avisoTit}>Quién puede leerte aquí</Text>
            <Text style={s.avisoTxt}>
              Solo cuentas con perfil femenino. Lo comprueba el servidor en cada
              petición, así que no basta con tener una versión modificada de la
              app: ni el muro, ni el perfil, ni el enlace directo, ni los
              comentarios enseñan estas publicaciones a nadie más.
            </Text>
          </View>
        </Tarjeta>
      </ScrollView>
    </Pantalla>
  )
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: HUECO.md },
  flex: { flex: 1 },
  pulsado: { opacity: 0.75, transform: [{ scale: 0.99 }] },

  cab: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titulo: {
    fontFamily: FUENTE.titulo, fontSize: 31, color: TEXTO.fuerte, letterSpacing: -0.9,
  },
  subtitulo: { fontFamily: FUENTE.medio, fontSize: 14, color: TEXTO.medio, marginTop: 3 },
  buscar: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: SUP.tarjeta, ...SOMBRA,
  },

  circulo: {
    borderRadius: RADIO.tarjeta, overflow: 'hidden',
    backgroundColor: ACENTO.rosa, ...SOMBRA,
  },
  circuloCab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16,
  },
  etiquetaDestacado: {
    fontFamily: FUENTE.fuerte, fontSize: 11.5, letterSpacing: 1.4,
    color: ACENTO.rosa, backgroundColor: '#FFFFFF',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    overflow: 'hidden',
  },
  marcador: { tintColor: '#FFFFFF' },
  decorativo: {
    alignSelf: 'center', marginVertical: 14, opacity: 0.35, tintColor: '#FFFFFF',
  },
  circuloPie: { backgroundColor: SUP.tarjeta, padding: 18, gap: 6 },
  circuloTit: { fontFamily: FUENTE.titulo, fontSize: 20, color: TEXTO.fuerte },
  circuloTxt: { fontFamily: FUENTE.cuerpo, fontSize: 13.5, lineHeight: 20, color: TEXTO.medio },
  circuloIr: { fontFamily: FUENTE.fuerte, fontSize: 14, color: ACENTO.rosa, marginTop: 2 },

  rotuloFila: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  rotulo: { fontFamily: FUENTE.titulo, fontSize: 19, color: TEXTO.fuerte },
  pildoraFase: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pildoraFaseTxt: { fontFamily: FUENTE.fuerte, fontSize: 12.5 },

  tema: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: RADIO.tarjeta,
    backgroundColor: SUP.tarjeta, ...SOMBRA,
  },
  temaTit: { fontFamily: FUENTE.fuerte, fontSize: 15.5, color: TEXTO.fuerte, lineHeight: 21 },
  temaPie: { fontFamily: FUENTE.cuerpo, fontSize: 12.5, color: TEXTO.suave, marginTop: 3 },

  aviso: { flexDirection: 'row', gap: 13, alignItems: 'flex-start', marginTop: 4 },
  avisoTit: { fontFamily: FUENTE.fuerte, fontSize: 14.5, color: TEXTO.fuerte },
  avisoTxt: {
    fontFamily: FUENTE.cuerpo, fontSize: 13, lineHeight: 19,
    color: TEXTO.medio, marginTop: 4,
  },
})

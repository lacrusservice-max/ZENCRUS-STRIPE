/**
 * CICLO · EL INFORME PARA CONSULTA
 * ═══════════════════════════════════════════════════════════════════════════
 * Genera el PDF que se lleva al médico. Se arma en el teléfono y no sale de
 * él hasta que ella decide compartirlo.
 *
 * ── Antes del botón, lo que va dentro ──────────────────────────────────────
 * La pantalla enseña con cuántos datos se va a construir —cuántos ciclos,
 * cuántos días, cuántas mediciones— antes de generarlo. No es decoración: un
 * informe hecho con dos ciclos y otro hecho con nueve se leen igual de
 * autorizados sobre el papel, y ella tiene que poder decidir si el suyo tiene
 * bastante detrás antes de enseñárselo a alguien.
 *
 * ── El módulo nativo se carga DENTRO del botón ─────────────────────────────
 * `expo-print` importado en la raíz tumbaría la ruta entera en cualquier
 * entorno donde no esté disponible. Cargado dentro de la función, lo que falla
 * es el botón —y se puede contar— en vez de la pantalla.
 */

import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native'
import { router } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { MODO } from '@/features/salud/ciclo/modos'
import { frecuenciaSintomas } from '@/features/salud/ciclo/sintomas'
import { detectarCambioTermico, lecturasValidas } from '@/features/salud/ciclo/temperatura'
import { construirInforme, informeHTML, fechaLarga } from '@/features/salud/ciclo/informe'
import { hoyLocal } from '@/utils/fechas'
import { Pantalla, Tarjeta, Azulejo, BotonPrincipal } from '@/components/salud/ciclo/Claro'
import {
  FONDO, ACENTO, TEXTO, FUENTE, SUP, HUECO,
} from '@/theme/salud/cicloClaro'
import { elegir } from '@/utils/haptica'

export default function InformeCiclo() {
  const nombre = useAuthStore(s => (s.user?.full_name ?? '').trim() || null)
  const logs = useCicloStore(s => s.logs)
  const perfil = useCicloStore(s => s.perfil)
  const { periodos, estadisticas, anomalias } = useCiclo()
  const [generando, setGenerando] = useState(false)

  const hoy = hoyLocal()

  const datos = useMemo(() => {
    const fechas = Object.keys(logs).sort()
    const desde = fechas[0] ?? hoy

    const temperatura = lecturasValidas(fechas
      .map(f => {
        const t = logs[f]?.temperatura_basal as
          { celsius?: number; disturbed?: boolean } | undefined
        return t && typeof t.celsius === 'number'
          ? { fecha: f, celsius: t.celsius, disturbed: t.disturbed ?? false }
          : null
      })
      .filter((x): x is { fecha: string; celsius: number; disturbed: boolean } => x !== null))

    /* Ocho síntomas y no cuatro: en la pantalla de estadísticas cuatro son los
       que caben, pero en un papel que alguien va a leer una sola vez, dejar
       fuera el quinto por espacio es dejar fuera algo que quizá era el motivo
       de la consulta. */
    const sintomas = frecuenciaSintomas(logs, desde, hoy, 8)

    return {
      fechas,
      temperatura,
      sintomas,
      informe: construirInforme({
        hoy,
        nombre,
        modo: MODO[perfil.modo].label,
        anticonceptivo: perfil.anticonceptivo ?? null,
        periodos,
        estadisticas,
        anomalias,
        fechasRegistradas: fechas,
        sintomas: sintomas.top.map(s => ({
          etiqueta: s.etiqueta, dias: s.n, de: sintomas.dias,
        })),
        temperatura,
        cambioTermico: detectarCambioTermico(temperatura),
      }),
    }
  }, [logs, periodos, estadisticas, anomalias, perfil, nombre, hoy])

  const vacio = datos.fechas.length === 0

  const generar = async () => {
    elegir()
    setGenerando(true)
    try {
      const Print = await import('expo-print')
      const Sharing = await import('expo-sharing')

      const { uri } = await Print.printToFileAsync({
        html: informeHTML(datos.informe),
        base64: false,
      })

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Informe de tu ciclo',
          UTI: 'com.adobe.pdf',
        })
      } else {
        Alert.alert('Informe listo', `Se guardó en el teléfono:\n${uri}`)
      }
    } catch {
      /* Sin sonar a fallo del sistema: lo que ella necesita saber es que no lo
         tiene y que puede volver a intentarlo, no qué módulo se rompió. */
      Alert.alert(
        'No se pudo crear el PDF',
        'Vuelve a intentarlo. Si sigue sin salir, puedes exportar tus datos en '
        + 'Ajustes › Tus datos y llevarlos así.',
      )
    } finally {
      setGenerando(false)
    }
  }

  const r = datos.informe.resumen

  return (
    <Pantalla salida={false} fondo={FONDO.registro}>
      <View style={s.cab}>
        <Pressable
          onPress={() => { elegir(); router.back() }}
          style={({ pressed }) => [s.redondo, pressed && s.pulsado]}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Text style={s.flecha}>‹</Text>
        </Pressable>
        <Text style={s.cabTit}>Informe para consulta</Text>
        <View style={s.hueco} />
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.intro}>
          Un PDF con lo que has registrado, ordenado para que alguien lo lea en
          treinta segundos. Se arma aquí, en tu teléfono, y no sale de él hasta
          que tú lo compartas.
        </Text>

        <Tarjeta style={s.tarjeta}>
          <Text style={s.rotulo}>Lo que va dentro</Text>
          <Linea etiqueta="Ciclos completos" valor={String(r.ciclos)} />
          <Linea etiqueta="Días con registro" valor={String(datos.informe.diasRegistrados)} />
          <Linea
            etiqueta="Síntomas distintos"
            valor={String(datos.sintomas.top.length)}
          />
          <Linea
            etiqueta="Mediciones de temperatura"
            valor={String(datos.temperatura.length)}
          />
          {datos.informe.senales.length ? (
            <Linea
              etiqueta="Señales para comentar"
              valor={String(datos.informe.senales.length)}
            />
          ) : null}
          {datos.informe.desde ? (
            <Text style={s.periodo}>
              {`Desde el ${fechaLarga(datos.informe.desde)}.`}
            </Text>
          ) : null}
        </Tarjeta>

        <View style={s.nota}>
          <Azulejo icono="stats_insight" fondo={SUP.tarjeta} tam={38} />
          <View style={s.flex}>
            <Text style={s.notaTit}>Lo que NO lleva</Text>
            <Text style={s.notaTxt}>
              Ninguna predicción. Solo lo que quedó registrado: los días que
              marcaste, los ciclos que salen de ellos y las temperaturas que te
              tomaste. Una fecha estimada impresa junto a las medidas acaba
              leyéndose como un hallazgo, y no lo es.
            </Text>
          </View>
        </View>

        {vacio ? (
          <Text style={s.vacio}>
            Todavía no hay nada que llevar. En cuanto registres unos días, el
            informe se llena solo.
          </Text>
        ) : null}
      </ScrollView>

      <View style={s.pie}>
        <BotonPrincipal
          texto={generando ? 'Creando…' : 'Crear el PDF'}
          onPress={generar}
          desactivado={vacio || generando}
        />
      </View>
    </Pantalla>
  )
}

function Linea({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={s.linea}>
      <Text style={s.lineaEt}>{etiqueta}</Text>
      <Text style={s.lineaVal}>{valor}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },

  cab: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10,
  },
  redondo: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center', backgroundColor: SUP.tarjeta,
  },
  hueco: { width: 46, height: 46 },
  pulsado: { opacity: 0.7 },
  flecha: { fontFamily: FUENTE.titulo, fontSize: 26, color: TEXTO.fuerte, marginTop: -3 },
  cabTit: { flex: 1, textAlign: 'center', fontFamily: FUENTE.titulo, fontSize: 17, color: TEXTO.fuerte },

  scroll: { paddingHorizontal: 20, paddingBottom: 24, gap: HUECO.md },
  intro: {
    fontFamily: FUENTE.cuerpo, fontSize: 14.5, lineHeight: 22, color: TEXTO.medio,
  },

  tarjeta: { gap: 2 },
  rotulo: {
    fontFamily: FUENTE.fuerte, fontSize: 11, letterSpacing: 0.6,
    color: TEXTO.medio, textTransform: 'uppercase', marginBottom: 6,
  },
  linea: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
    paddingVertical: 6,
  },
  lineaEt: { fontFamily: FUENTE.cuerpo, fontSize: 14, color: TEXTO.medio },
  lineaVal: { fontFamily: FUENTE.titulo, fontSize: 17, color: TEXTO.fuerte },
  periodo: {
    fontFamily: FUENTE.cuerpo, fontSize: 12.5, color: TEXTO.suave, marginTop: 6,
  },

  nota: {
    flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20,
    backgroundColor: ACENTO.moradoFondo,
  },
  notaTit: { fontFamily: FUENTE.fuerte, fontSize: 13.5, color: TEXTO.fuerte },
  notaTxt: {
    fontFamily: FUENTE.cuerpo, fontSize: 12.5, lineHeight: 19,
    color: '#5B4B86', marginTop: 4,
  },

  vacio: {
    fontFamily: FUENTE.cuerpo, fontSize: 13.5, lineHeight: 20, color: TEXTO.suave,
  },

  pie: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 8 },
})

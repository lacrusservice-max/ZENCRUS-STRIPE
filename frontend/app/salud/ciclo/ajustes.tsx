/**
 * CICLO · AJUSTES
 * ═══════════════════════════════════════════════════════════════════════════
 * El modo de vida, la privacidad y qué hacer con los datos.
 *
 * ── Las tres cosas que hay aquí, y por qué solo tres ───────────────────────
 * El mockup no trae pantalla de ajustes, así que esta es la de siempre pasada
 * al tema claro. Se ha resistido la tentación de rellenarla: unos ajustes con
 * quince interruptores son unos ajustes que nadie lee, y las decisiones que
 * de verdad cambian algo en este módulo son estas tres.
 *
 * ── «Llevarme mis datos» va ANTES de «borrar» ──────────────────────────────
 * Y el diálogo de borrado ofrece exportar primero. Es un historial
 * reproductivo: quien lo borra suele estar cerrando una etapa, no tirando
 * basura, y merece poder quedárselo.
 */

import { useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, ScrollView, Switch, Share, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useCicloStore } from '@/store/cicloStore'
import { usePrivacyStore } from '@/store/privacyStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { MODOS, MODO, type ModoVida } from '@/features/salud/ciclo/modos'
import { pedirPermisoAvisos, type AjustesAvisos } from '@/features/salud/ciclo/avisos'
import { ALTO_BARRA } from '@/components/salud/ciclo/BarraCiclo'
import { Pantalla, Tarjeta, Azulejo, Chip } from '@/components/salud/ciclo/Claro'
import {
  FONDO, ACENTO, TEXTO, FUENTE, SUP, HUECO, RADIO,
} from '@/theme/salud/cicloClaro'
import { elegir, confirmar } from '@/utils/haptica'

export default function AjustesCiclo() {
  const modoActual = useCicloStore(s => s.perfil.modo)
  const setModo = useCicloStore(s => s.setModo)
  const logs = useCicloStore(s => s.logs)
  const inicios = useCicloStore(s => s.inicios)
  const avisos = useCicloStore(s => s.avisos)
  const setAvisos = useCicloStore(s => s.setAvisos)
  const { modo } = useCiclo()

  /* El permiso se pide al ENCENDER, no al entrar. Preguntarlo nada más abrir
     unos ajustes, sin que nadie lo haya buscado, es la forma más rápida de que
     te lo denieguen para siempre — y en iOS solo se pregunta una vez. */
  const encender = async (patch: Partial<AjustesAvisos>) => {
    if (!(await pedirPermisoAvisos())) {
      Alert.alert(
        'Sin permiso para avisarte',
        'Tu teléfono tiene los avisos de ZENCRUS desactivados. Puedes activarlos '
        + 'en Ajustes › Notificaciones › ZENCRUS.',
      )
      return
    }
    void setAvisos(patch)
  }

  const bloqueo = usePrivacyStore(s => s.menstrualLockEnabled)
  const setBloqueo = usePrivacyStore(s => s.setMenstrualLock)
  const { periodos } = useCiclo()

  const [exportando, setExportando] = useState(false)
  const dias = Object.keys(logs).length

  const exportar = async () => {
    setExportando(true)
    try {
      const contenido = JSON.stringify({
        version: 1,
        exportado: new Date().toISOString(),
        modo: modoActual,
        iniciosDeclarados: inicios,
        periodos: periodos.map(p => ({
          inicio: p.inicio, fin: p.fin,
          diasSangrado: p.diasSangrado, duracionCiclo: p.duracionCiclo,
        })),
        registros: logs,
      }, null, 2)
      await Share.share({ message: contenido, title: 'Mis datos de ciclo · ZENCRUS' })
    } finally {
      setExportando(false)
    }
  }

  const borrar = () => {
    Alert.alert(
      'Borrar todo tu ciclo',
      `Se borrarán ${dias} días de registro y todos tus periodos, en este teléfono y en el servidor. No se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Exportar primero', onPress: () => void exportar() },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            await useCicloStore.getState().borrarTodo()
            confirmar()
            router.back()
          },
        },
      ],
    )
  }

  return (
    <Pantalla fondo={FONDO.ajustes}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: ALTO_BARRA + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.titulo}>Ajustes</Text>

        {/* ── Modo de vida ─────────────────────────────────────────────── */}
        <Text style={s.rotulo}>Tu momento</Text>
        <Text style={s.explica}>
          Cambia qué se te pregunta y qué se predice. En embarazo o sin ciclo no
          se predice nada, porque no habría nada honesto que predecir.
        </Text>
        <View style={s.modos}>
          {MODOS.map((id: ModoVida) => {
            const m = MODO[id]
            const on = modoActual === id
            return (
              <Pressable
                key={id}
                onPress={() => { elegir(); void setModo(id) }}
                style={({ pressed }) => [s.modo, on && s.modoOn, pressed && s.pulsado]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.modoTit, on && s.modoTitOn]}>{m.label}</Text>
                <Text style={[s.modoTxt, on && s.modoTxtOn]}>{m.descripcion}</Text>
              </Pressable>
            )
          })}
        </View>

        {/* ── Avisos ──────────────────────────────────────────────────── */}
        <Text style={s.rotulo}>Avisos</Text>
        <Text style={s.explica}>
          Ninguno suena ni vibra: llegan en silencio, para que no te delaten
          delante de nadie.
        </Text>

        <Tarjeta style={s.tarjeta}>
          <FilaSwitch
            titulo="Texto discreto"
            texto={avisos.discreto
              ? 'En la pantalla bloqueada solo se lee «Tienes algo que revisar». Hay que abrir la app para saber de qué.'
              : 'Se lee el aviso completo en la pantalla bloqueada. Cualquiera que mire el teléfono lo verá.'}
            valor={avisos.discreto}
            onCambio={v => { elegir(); void setAvisos({ discreto: v }) }}
          />
        </Tarjeta>

        <Tarjeta style={s.tarjeta}>
          <FilaSwitch
            titulo="Antes de que te baje"
            texto="Un aviso los días previos al día probable."
            valor={avisos.periodo !== null}
            onCambio={v => {
              elegir()
              if (v) void encender({ periodo: 2 })
              else void setAvisos({ periodo: null })
            }}
          />
          {avisos.periodo !== null ? (
            <View style={s.chips}>
              {[1, 2, 3, 5].map(n => (
                <Chip
                  key={n}
                  texto={n === 1 ? '1 día antes' : `${n} días antes`}
                  activo={avisos.periodo === n}
                  onPress={() => { elegir(); void setAvisos({ periodo: n }) }}
                />
              ))}
            </View>
          ) : null}

          <View style={s.filete} />

          <FilaSwitch
            titulo="Si se retrasa"
            texto="Un aviso si pasa el día probable y no has registrado sangrado."
            valor={avisos.retraso !== null}
            onCambio={v => {
              elegir()
              if (v) void encender({ retraso: 3 })
              else void setAvisos({ retraso: null })
            }}
          />
          {avisos.retraso !== null ? (
            <View style={s.chips}>
              {[2, 3, 5, 7].map(n => (
                <Chip
                  key={n}
                  texto={`${n} días después`}
                  activo={avisos.retraso === n}
                  onPress={() => { elegir(); void setAvisos({ retraso: n }) }}
                />
              ))}
            </View>
          ) : null}

          {/* La ventana fértil solo tiene sentido donde se ovula. En embarazo o
              sin ciclo el interruptor no se enseña, en vez de enseñarlo apagado
              y que parezca que algo va mal. */}
          {modo.ovula ? (
            <>
              <View style={s.filete} />
              <FilaSwitch
                titulo="Cuando empieza tu ventana fértil"
                texto="Es una estimación a partir de tus ciclos. No sirve como método anticonceptivo."
                valor={avisos.fertil}
                onCambio={v => {
                  elegir()
                  if (v) void encender({ fertil: true })
                  else void setAvisos({ fertil: false })
                }}
              />
            </>
          ) : null}

          {avisos.periodo !== null || avisos.retraso !== null || avisos.fertil ? (
            <>
              <View style={s.filete} />
              <Text style={s.filaTit}>¿A qué hora?</Text>
              <View style={s.chips}>
                {['09:00', '13:00', '20:00'].map(h => (
                  <Chip
                    key={h}
                    texto={h}
                    activo={avisos.hora === h}
                    onPress={() => { elegir(); void setAvisos({ hora: h }) }}
                  />
                ))}
              </View>
            </>
          ) : null}
        </Tarjeta>

        <Tarjeta style={s.tarjeta}>
          <FilaSwitch
            titulo="Recordarme registrar"
            texto="Todos los días, para que la predicción tenga con qué mejorar."
            valor={avisos.registro !== null}
            onCambio={v => {
              elegir()
              if (v) void encender({ registro: '21:00' })
              else void setAvisos({ registro: null })
            }}
          />
          {avisos.registro !== null ? (
            <View style={s.chips}>
              {['09:00', '14:00', '21:00', '22:30'].map(h => (
                <Chip
                  key={h}
                  texto={h}
                  activo={avisos.registro === h}
                  onPress={() => { elegir(); void setAvisos({ registro: h }) }}
                />
              ))}
            </View>
          ) : null}

          <View style={s.filete} />

          <FilaSwitch
            titulo="Temperatura basal"
            texto="Se toma antes de levantarte: en cuanto te mueves deja de servir."
            valor={avisos.temperatura !== null}
            onCambio={v => {
              elegir()
              if (v) void encender({ temperatura: '07:00' })
              else void setAvisos({ temperatura: null })
            }}
          />
          {avisos.temperatura !== null ? (
            <View style={s.chips}>
              {['06:00', '06:30', '07:00', '07:30'].map(h => (
                <Chip
                  key={h}
                  texto={h}
                  activo={avisos.temperatura === h}
                  onPress={() => { elegir(); void setAvisos({ temperatura: h }) }}
                />
              ))}
            </View>
          ) : null}
        </Tarjeta>

        {/* ── Privacidad ───────────────────────────────────────────────── */}
        <Text style={s.rotulo}>Privacidad</Text>
        <Text style={s.explica}>
          Estos son los datos más sensibles que guarda ZENCRUS.
        </Text>
        <Tarjeta style={s.tarjeta}>
          <View style={s.fila}>
            <View style={s.flex}>
              <Text style={s.filaTit}>Pedir tu huella o cara al entrar</Text>
              <Text style={s.filaTxt}>
                Se pide cada vez que se abre esta sección, aunque el teléfono ya
                esté desbloqueado.
              </Text>
            </View>
            <Switch
              value={bloqueo}
              onValueChange={v => { elegir(); setBloqueo(v) }}
              trackColor={{ false: '#DCD6E8', true: `${ACENTO.morado}88` }}
              thumbColor={bloqueo ? ACENTO.morado : '#FFFFFF'}
            />
          </View>
          <View style={s.filete} />
          <View style={s.nota}>
            <Azulejo icono="auth_candado" fondo={ACENTO.verdeSuave} tam={38} icono_tam={18} />
            <Text style={s.notaTxt}>
              Este módulo no lleva ningún SDK de analítica de terceros: nada de lo
              que registras aquí se envía a nadie más que a tu propia cuenta.
            </Text>
          </View>
        </Tarjeta>

        {/* ── Tus datos ────────────────────────────────────────────────── */}
        <Text style={s.rotulo}>Tus datos</Text>
        <Tarjeta style={s.tarjeta}>
          {/* El informe va PRIMERO. El JSON es para llevarte tus datos a otro
              sitio; esto es para llevártelos a una consulta, que es lo que de
              verdad se hace con ellos. */}
          <Pressable
            onPress={() => { elegir(); router.push('/salud/ciclo/informe') }}
            disabled={!dias}
            style={({ pressed }) => [s.accion, pressed && s.pulsado, !dias && s.apagada]}
            accessibilityRole="button"
          >
            <Azulejo icono="dashboard_editar" fondo={ACENTO.verdeSuave} tam={40} />
            <View style={s.flex}>
              <Text style={[s.accionTit, { color: ACENTO.verde }]}>
                Informe para consulta
              </Text>
              <Text style={s.filaTxt}>
                Un PDF con lo registrado, ordenado para el médico. Se arma en tu
                teléfono.
              </Text>
            </View>
          </Pressable>

          <View style={s.filete} />

          <Pressable
            onPress={() => void exportar()}
            disabled={exportando || !dias}
            style={({ pressed }) => [s.accion, pressed && s.pulsado, !dias && s.apagada]}
            accessibilityRole="button"
          >
            <Azulejo icono="community_marcador" fondo={ACENTO.moradoFondo} tam={40} />
            <View style={s.flex}>
              <Text style={[s.accionTit, { color: ACENTO.morado }]}>
                {exportando ? 'Preparando…' : 'Llevarme mis datos'}
              </Text>
              <Text style={s.filaTxt}>
                {dias
                  ? `${dias} ${dias === 1 ? 'día registrado' : 'días registrados'} y ${periodos.length} ${periodos.length === 1 ? 'periodo' : 'periodos'}, en JSON.`
                  : 'Todavía no hay nada que exportar.'}
              </Text>
            </View>
          </Pressable>

          <View style={s.filete} />

          <Pressable
            onPress={borrar}
            disabled={!dias}
            style={({ pressed }) => [s.accion, pressed && s.pulsado, !dias && s.apagada]}
            accessibilityRole="button"
          >
            <Azulejo icono="ui_cerrar" fondo={ACENTO.rojoSuave} tam={40} icono_tam={17} />
            <View style={s.flex}>
              <Text style={[s.accionTit, { color: ACENTO.rojo }]}>Borrar todo mi ciclo</Text>
              <Text style={s.filaTxt}>
                Aquí y en el servidor. Sin pedir permiso a nadie y sin poder deshacerse.
              </Text>
            </View>
          </Pressable>
        </Tarjeta>
      </ScrollView>
    </Pantalla>
  )
}

/**
 * Una fila con interruptor.
 *
 * El texto de debajo NO es decorativo: en unos ajustes de esta sección, cada
 * interruptor cambia qué se puede leer en la pantalla bloqueada de alguien.
 * Un rótulo suelto obliga a adivinarlo y se acaba encendiendo a ciegas.
 */
function FilaSwitch({ titulo, texto, valor, onCambio }: {
  titulo: string
  texto: string
  valor: boolean
  onCambio: (v: boolean) => void
}) {
  return (
    <View style={s.fila}>
      <View style={s.flex}>
        <Text style={s.filaTit}>{titulo}</Text>
        <Text style={s.filaTxt}>{texto}</Text>
      </View>
      <Switch
        value={valor}
        onValueChange={onCambio}
        trackColor={{ false: '#DCD6E8', true: `${ACENTO.morado}88` }}
        thumbColor={valor ? ACENTO.morado : '#FFFFFF'}
      />
    </View>
  )
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 14, gap: HUECO.sm },
  flex: { flex: 1 },
  pulsado: { opacity: 0.75 },
  apagada: { opacity: 0.4 },

  titulo: {
    fontFamily: FUENTE.titulo, fontSize: 31, color: TEXTO.fuerte,
    letterSpacing: -0.9, marginBottom: 8,
  },
  rotulo: {
    fontFamily: FUENTE.titulo, fontSize: 18, color: TEXTO.fuerte, marginTop: 16,
  },
  explica: {
    fontFamily: FUENTE.cuerpo, fontSize: 13.5, lineHeight: 20,
    color: TEXTO.medio, marginBottom: 6,
  },

  modos: { gap: 9 },
  modo: {
    borderRadius: 20, padding: 15, gap: 3,
    backgroundColor: SUP.tarjeta,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  modoOn: { borderColor: ACENTO.morado, backgroundColor: ACENTO.moradoFondo },
  modoTit: { fontFamily: FUENTE.fuerte, fontSize: 15.5, color: TEXTO.fuerte },
  modoTitOn: { color: ACENTO.morado },
  modoTxt: { fontFamily: FUENTE.cuerpo, fontSize: 13, color: TEXTO.medio },
  modoTxtOn: { color: '#6656A0' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -2 },
  tarjeta: { gap: 14, padding: 16 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  filaTit: { fontFamily: FUENTE.fuerte, fontSize: 15, color: TEXTO.fuerte },
  filaTxt: {
    fontFamily: FUENTE.cuerpo, fontSize: 12.5, lineHeight: 18,
    color: TEXTO.medio, marginTop: 3,
  },
  filete: { height: 1, backgroundColor: SUP.borde },
  nota: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  notaTxt: {
    flex: 1, fontFamily: FUENTE.cuerpo, fontSize: 12.5, lineHeight: 18,
    color: TEXTO.medio,
  },

  accion: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: RADIO.celda },
  accionTit: { fontFamily: FUENTE.fuerte, fontSize: 15 },
})

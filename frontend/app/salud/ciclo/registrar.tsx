/**
 * CICLO · PANEL DE REGISTRO
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que se abre todos los días durante años. Si tiene fricción, el módulo
 * muere: el objetivo es dejar el día apuntado en menos de tres segundos.
 *
 * ── Los catorce, cada uno con su mando ─────────────────────────────────────
 * La primera versión traía cuatro trackers y cajas grises. Aquí están los
 * catorce y ninguno comparte control por comodidad: ver mandos.tsx.
 *
 * ── Se guarda al tocar ─────────────────────────────────────────────────────
 * No hay botón de «guardar». Cada selección persiste al instante en local y la
 * red va detrás. Un paso menos entre sentir algo y dejarlo escrito, y ningún
 * registro perdido por cerrar la app antes de confirmar.
 *
 * ── Nada nace contestado ───────────────────────────────────────────────────
 * Ninguna escala arranca en el medio. Un panel que naciera relleno guardaría
 * afirmaciones sobre el cuerpo de alguien que esa persona no ha hecho.
 *
 * ── El día se elige ────────────────────────────────────────────────────────
 * Se llega con `?fecha=` desde el calendario, porque casi nadie registra en el
 * momento: se acuerda por la noche, o dos días después. Un panel que solo
 * escribe en «hoy» produce historiales con agujeros.
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  type LayoutChangeEvent,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Seccion, Placa } from '@/components/salud/piezas'
import {
  EscalaSangrado, MapaDolor, EscalaCinco, Etiquetas, Unico, Horas, ListaMedicacion,
} from '@/components/salud/mandos'
import { PadAnimo } from '@/components/salud/PadAnimo'
import { ReglaTemperatura } from '@/components/salud/ReglaTemperatura'
import { useCicloStore } from '@/store/cicloStore'
import { useCiclo } from '@/features/salud/ciclo/useCiclo'
import { trackersDelModo } from '@/features/salud/ciclo/modos'
import { diaLargo } from '@/features/salud/ciclo/formato'
import { TRACKER_KINDS, TRACKER_META, type TrackerKind } from '@/features/salud/trackers'
import { hoyLocal } from '@/utils/fechas'
import { confirmar, elegir } from '@/utils/haptica'
import { base, space, radius, family, type as tipo } from '@/theme/salud/tokens'
import { Screen, ScreenHeader } from '@/components/ui/Screen'

/** El orden del panel: lo que se registra a diario arriba, lo estable abajo. */
const ORDEN: TrackerKind[] = [
  'sangrado', 'dolor', 'animo', 'energia', 'flujo', 'sueno',
  'digestion', 'piel', 'temperatura_basal', 'libido',
  'prueba', 'anticoncepcion', 'medicacion', 'perimenopausia',
]

export default function RegistrarCiclo() {
  const params = useLocalSearchParams<{ fecha?: string; foco?: string }>()
  const fecha = typeof params.fecha === 'string' ? params.fecha : hoyLocal()
  const foco = typeof params.foco === 'string' ? params.foco as TrackerKind : null

  const load = useCicloStore(s => s.load)
  const cargado = useCicloStore(s => s.cargado)
  const registrar = useCicloStore(s => s.registrar)
  const borrar = useCicloStore(s => s.borrar)
  const logs = useCicloStore(s => s.logs)
  const modo = useCicloStore(s => s.perfil.modo)

  const { tema } = useCiclo(fecha)
  const tono = tema.accent
  /* Memoizado porque entra en las dependencias del efecto del foco: sin esto
     `{}` es un objeto nuevo cada render y el efecto se replantea siempre. */
  const dia = useMemo(() => logs[fecha] ?? {}, [logs, fecha])

  const scroll = useRef<ScrollView>(null)
  const posiciones = useRef<Partial<Record<TrackerKind, number>>>({})
  const yaEnfocado = useRef(false)

  useEffect(() => { void load() }, [load])

  /* Al llegar desde un atajo de la portada se baja hasta ese tracker. Solo la
     primera vez: repetirlo pelearía contra el dedo en cada render. */
  useEffect(() => {
    if (!foco || yaEnfocado.current || !cargado) return
    const y = posiciones.current[foco]
    if (y == null) return
    yaEnfocado.current = true
    requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, y - 80), animated: true }))
  }, [foco, cargado, dia])

  const visibles = useMemo(() => {
    const permitidos = new Set(trackersDelModo(modo, [...TRACKER_KINDS]))
    return ORDEN.filter(k => permitidos.has(k))
  }, [modo])

  const guardar = useCallback(async (kind: TrackerKind, value: unknown) => {
    const ok = await registrar(kind as never, value as never, fecha)
    if (ok) confirmar()
  }, [registrar, fecha])

  const quitar = useCallback((kind: TrackerKind) => {
    elegir()
    void borrar(kind, fecha)
  }, [borrar, fecha])

  const medir = (k: TrackerKind) => (e: LayoutChangeEvent) => {
    posiciones.current[k] = e.nativeEvent.layout.y
  }

  if (!cargado) return <Screen tint={tono}><View /></Screen>

  const puestos = Object.keys(dia).length

  return (
    <Screen tint={tono}>
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 90 }}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader
          back
          eyebrow="Zencrus · Ciclo"
          title={fecha === hoyLocal() ? 'Hoy' : diaLargo(fecha)}
          subtitle={
            puestos
              ? `${puestos} ${puestos === 1 ? 'cosa registrada' : 'cosas registradas'}. Se guarda al tocar.`
              : 'Se guarda al tocar. No hay que confirmar nada.'
          }
          icon="ellipse"
          color={tono}
        />

        {visibles.map(k => (
          <View key={k} onLayout={medir(k)}>
            <Bloque
              kind={k}
              tono={tono}
              puesto={k in dia}
              enfocado={foco === k}
              onQuitar={() => quitar(k)}
            >
              <Mando kind={k} dia={dia} tono={tono} guardar={guardar} />
            </Bloque>
          </View>
        ))}

        <View style={s.pie}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [s.listo, { backgroundColor: tono }, pressed && s.pulsado]}
            accessibilityRole="button"
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={s.listoTxt}>Listo</Text>
          </Pressable>
          <Text style={s.pieNota}>Ya está guardado. El botón solo cierra.</Text>
        </View>
      </ScrollView>
    </Screen>
  )
}

// ── El mando de cada tracker ────────────────────────────────────────────────

function Mando({ kind, dia, tono, guardar }: {
  kind: TrackerKind
  dia: Record<string, any>
  tono: string
  guardar: (k: TrackerKind, v: unknown) => void
}) {
  switch (kind) {
    case 'sangrado':
      return (
        <EscalaSangrado
          valor={dia.sangrado?.level ?? null}
          onChange={n => guardar('sangrado', { level: n })}
          tono={tono}
        />
      )

    case 'dolor':
      return (
        <MapaDolor
          tono={tono}
          zonas={Object.fromEntries((dia.dolor?.zones ?? []).map((z: any) => [z.id, z.intensity]))}
          onChange={z => {
            const zones = Object.entries(z).map(([id, intensity]) => ({ id, intensity }))
            if (zones.length) guardar('dolor', { zones })
            else void useCicloStore.getState().borrar('dolor')
          }}
        />
      )

    case 'animo':
      return (
        <PadAnimo
          tono={tono}
          valor={dia.animo ? { valence: dia.animo.valence, arousal: dia.animo.arousal } : null}
          onChange={v => guardar('animo', v)}
        />
      )

    case 'energia':
      return (
        <EscalaCinco
          tono={tono}
          valor={dia.energia?.level ?? null}
          onChange={n => guardar('energia', { level: n })}
          etiquetas={['En reserva', 'Baja', 'Normal', 'Buena', 'A tope']}
        />
      )

    case 'flujo':
      return (
        <View style={s.doble}>
          <Unico
            tono={tono}
            valor={dia.flujo?.texture ?? null}
            onChange={t => guardar('flujo', { ...(dia.flujo ?? {}), texture: t })}
            opciones={[
              { id: 'seco', label: 'Seco' },
              { id: 'pegajoso', label: 'Pegajoso' },
              { id: 'cremoso', label: 'Cremoso' },
              { id: 'acuoso', label: 'Acuoso', nota: 'Se acerca la ovulación.' },
              {
                id: 'clara_huevo', label: 'Clara de huevo',
                // La señal de fertilidad más útil que existe sin analítica.
                nota: 'Elástico y transparente: es la señal de los días más fértiles.',
              },
            ]}
          />
          {dia.flujo?.texture ? (
            <Unico
              tono={tono}
              valor={dia.flujo?.amount ?? null}
              onChange={a => guardar('flujo', { ...dia.flujo, amount: a })}
              opciones={[
                { id: 'poco', label: 'Poco' },
                { id: 'medio', label: 'Medio' },
                { id: 'abundante', label: 'Abundante' },
              ]}
            />
          ) : null}
        </View>
      )

    case 'sueno':
      return (
        <View style={s.doble}>
          <Horas
            tono={tono}
            valor={dia.sueno?.hours ?? null}
            onChange={h => guardar('sueno', { ...(dia.sueno ?? {}), hours: h, source: 'manual' })}
          />
          {dia.sueno?.hours != null ? (
            <Unico
              tono={tono}
              valor={dia.sueno?.quality ?? null}
              onChange={q => guardar('sueno', { ...dia.sueno, quality: q, source: 'manual' })}
              opciones={[
                { id: 'mal', label: 'Mal' },
                { id: 'regular', label: 'Regular' },
                { id: 'bien', label: 'Bien' },
                { id: 'excelente', label: 'Excelente' },
              ]}
              nota="Las horas y la calidad son cosas distintas: ocho horas dando vueltas no son un buen sueño."
            />
          ) : null}
        </View>
      )

    case 'digestion':
      return (
        <Etiquetas
          tono={tono}
          valor={dia.digestion?.tags ?? []}
          onChange={t => t.length ? guardar('digestion', { tags: t }) : void useCicloStore.getState().borrar('digestion')}
          opciones={[
            { id: 'hinchazon', label: 'Hinchazón' },
            { id: 'nauseas', label: 'Náuseas' },
            { id: 'estrenimiento', label: 'Estreñimiento' },
            { id: 'diarrea', label: 'Diarrea' },
            { id: 'gases', label: 'Gases' },
            { id: 'acidez', label: 'Acidez' },
            { id: 'antojos', label: 'Antojos' },
            { id: 'sin_apetito', label: 'Sin apetito' },
          ]}
        />
      )

    case 'piel':
      return (
        <View style={s.doble}>
          <Etiquetas
            tono={tono}
            valor={dia.piel?.tags ?? []}
            onChange={t => t.length ? guardar('piel', { ...(dia.piel ?? {}), tags: t }) : void useCicloStore.getState().borrar('piel')}
            opciones={[
              { id: 'acne', label: 'Acné' },
              { id: 'grasa', label: 'Grasa' },
              { id: 'seca', label: 'Seca' },
              { id: 'sensible', label: 'Sensible' },
              { id: 'normal', label: 'Normal' },
            ]}
          />
          {dia.piel?.tags?.length ? (
            <Etiquetas
              columnas={3}
              tono={tono}
              valor={dia.piel?.zones ?? []}
              onChange={z => guardar('piel', { ...dia.piel, zones: z })}
              opciones={[
                { id: 'frente', label: 'Frente' },
                { id: 'mejillas', label: 'Mejillas' },
                { id: 'menton', label: 'Mentón' },
                { id: 'espalda', label: 'Espalda' },
              ]}
            />
          ) : null}
        </View>
      )

    case 'temperatura_basal':
      return (
        <View style={s.doble}>
          <ReglaTemperatura
            tono={tono}
            valor={dia.temperatura_basal?.celsius ?? null}
            onChange={c => guardar('temperatura_basal', {
              ...(dia.temperatura_basal ?? {}), celsius: c,
            })}
          />
          <Pressable
            onPress={() => guardar('temperatura_basal', {
              ...(dia.temperatura_basal ?? { celsius: 36.5 }),
              disturbed: !dia.temperatura_basal?.disturbed,
            })}
            disabled={!dia.temperatura_basal}
            style={({ pressed }) => [s.check, pressed && s.pulsado, !dia.temperatura_basal && s.apagado]}
            accessibilityRole="switch"
            accessibilityState={{ checked: !!dia.temperatura_basal?.disturbed }}
          >
            <Ionicons
              name={dia.temperatura_basal?.disturbed ? 'checkbox' : 'square-outline'}
              size={18}
              color={dia.temperatura_basal?.disturbed ? tono : base.textLow}
            />
            <Text style={s.checkTxt}>
              Esta no cuenta (fiebre, alcohol, mala noche u otra hora)
            </Text>
          </Pressable>
        </View>
      )

    case 'libido':
      return (
        <View style={s.doble}>
          <EscalaCinco
            tono={tono}
            valor={dia.libido?.desire ?? null}
            onChange={n => guardar('libido', { ...(dia.libido ?? {}), desire: n })}
            etiquetas={['Nada', 'Poca', 'Normal', 'Alta', 'Mucha']}
          />
          <Unico
            tono={tono}
            valor={dia.libido?.activity ?? null}
            onChange={a => guardar('libido', { ...(dia.libido ?? {}), activity: a })}
            opciones={[
              { id: 'ninguna', label: 'Ninguna' },
              { id: 'protegida', label: 'Protegida' },
              { id: 'sin_proteccion', label: 'Sin protección' },
              { id: 'solitaria', label: 'En solitario' },
            ]}
          />
        </View>
      )

    case 'prueba':
      return (
        <View style={s.doble}>
          <Unico
            tono={tono}
            valor={dia.prueba?.type ?? null}
            onChange={t => guardar('prueba', { ...(dia.prueba ?? { result: 'negativo' }), type: t })}
            opciones={[
              { id: 'ovulacion', label: 'Test de ovulación' },
              { id: 'embarazo', label: 'Test de embarazo' },
            ]}
          />
          {dia.prueba?.type ? (
            <Unico
              tono={tono}
              valor={dia.prueba?.result ?? null}
              onChange={r => guardar('prueba', { ...dia.prueba, result: r })}
              opciones={[
                { id: 'positivo', label: 'Positivo' },
                { id: 'negativo', label: 'Negativo' },
                { id: 'invalido', label: 'No válido' },
              ]}
            />
          ) : null}
        </View>
      )

    case 'anticoncepcion':
      return (
        <View style={s.doble}>
          <Unico
            tono={tono}
            valor={dia.anticoncepcion?.method ?? null}
            onChange={m => guardar('anticoncepcion', { ...(dia.anticoncepcion ?? {}), method: m })}
            opciones={[
              { id: 'ninguno', label: 'Ninguno' },
              { id: 'pildora', label: 'Píldora' },
              { id: 'diu_hormonal', label: 'DIU hormonal' },
              { id: 'diu_cobre', label: 'DIU de cobre' },
              { id: 'implante', label: 'Implante' },
              { id: 'inyeccion', label: 'Inyección' },
              { id: 'parche', label: 'Parche' },
              { id: 'anillo', label: 'Anillo' },
              { id: 'barrera', label: 'Barrera' },
              { id: 'natural', label: 'Natural' },
            ]}
          />
          {dia.anticoncepcion?.method && dia.anticoncepcion.method !== 'ninguno' ? (
            <Pressable
              onPress={() => guardar('anticoncepcion', {
                ...dia.anticoncepcion, taken: !dia.anticoncepcion.taken,
              })}
              style={({ pressed }) => [s.check, pressed && s.pulsado]}
              accessibilityRole="switch"
              accessibilityState={{ checked: !!dia.anticoncepcion?.taken }}
            >
              <Ionicons
                name={dia.anticoncepcion?.taken ? 'checkbox' : 'square-outline'}
                size={18}
                color={dia.anticoncepcion?.taken ? tono : base.textLow}
              />
              <Text style={s.checkTxt}>Hoy lo he tomado o lo llevo puesto</Text>
            </Pressable>
          ) : null}
        </View>
      )

    case 'medicacion':
      return (
        <ListaMedicacion
          tono={tono}
          items={dia.medicacion?.items ?? []}
          onChange={items => items.length
            ? guardar('medicacion', { items })
            : void useCicloStore.getState().borrar('medicacion')}
        />
      )

    case 'perimenopausia':
      return (
        <View style={s.doble}>
          <Etiquetas
            tono={tono}
            valor={dia.perimenopausia?.tags ?? []}
            onChange={t => t.length
              ? guardar('perimenopausia', { ...(dia.perimenopausia ?? {}), tags: t })
              : void useCicloStore.getState().borrar('perimenopausia')}
            opciones={[
              { id: 'sofocos', label: 'Sofocos' },
              { id: 'sudores_nocturnos', label: 'Sudores nocturnos' },
              { id: 'sequedad', label: 'Sequedad' },
              { id: 'insomnio', label: 'Insomnio' },
              { id: 'niebla_mental', label: 'Niebla mental' },
              { id: 'palpitaciones', label: 'Palpitaciones' },
              { id: 'cambios_animo', label: 'Cambios de ánimo' },
            ]}
          />
          {dia.perimenopausia?.tags?.length ? (
            <EscalaCinco
              tono={tono}
              valor={dia.perimenopausia?.severity ?? null}
              onChange={n => guardar('perimenopausia', { ...dia.perimenopausia, severity: n })}
              etiquetas={['Apenas', 'Leve', 'Moderado', 'Fuerte', 'Muy fuerte']}
            />
          ) : null}
        </View>
      )

    default:
      return null
  }
}

// ── Bloque ──────────────────────────────────────────────────────────────────

/**
 * Los discretos nacen plegados.
 *
 * No por pudor: porque son los que peor sienta ver en pantalla si alguien mira
 * por encima del hombro, y quien los registra debe poder hacerlo sin que
 * queden expuestos al abrir el panel en el metro.
 */
function Bloque({ kind, tono, puesto, enfocado, onQuitar, children }: {
  kind: TrackerKind
  tono: string
  puesto: boolean
  enfocado: boolean
  onQuitar: () => void
  children: React.ReactNode
}) {
  const meta = TRACKER_META[kind]
  const [abierto, setAbierto] = useState(!meta.discreet || puesto || enfocado)

  return (
    <Seccion
      eyebrow={puesto ? 'Registrado' : undefined}
      titulo={meta.label}
      color={tono}
      right={
        puesto ? (
          <Pressable onPress={onQuitar} hitSlop={10} accessibilityLabel={`Quitar ${meta.label}`}>
            <Ionicons name="close-circle" size={18} color={base.textLow} />
          </Pressable>
        ) : meta.discreet ? (
          <Pressable
            onPress={() => { elegir(); setAbierto(v => !v) }}
            hitSlop={10}
            accessibilityLabel={abierto ? `Ocultar ${meta.label}` : `Mostrar ${meta.label}`}
          >
            <Ionicons name={abierto ? 'eye-off-outline' : 'eye-outline'} size={18} color={base.textLow} />
          </Pressable>
        ) : undefined
      }
    >
      {abierto ? (
        <Placa>{children}</Placa>
      ) : (
        <Pressable
          onPress={() => { elegir(); setAbierto(true) }}
          style={({ pressed }) => [s.plegado, pressed && s.pulsado]}
        >
          <Text style={s.plegadoTxt}>Toca para abrir</Text>
        </Pressable>
      )}
    </Seccion>
  )
}

const s = StyleSheet.create({
  pulsado: { opacity: 0.72 },
  apagado: { opacity: 0.4 },
  doble: { gap: space.md },

  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  checkTxt: { flex: 1, fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textMid },

  plegado: {
    marginTop: space.md, padding: space.md, borderRadius: radius.lg,
    backgroundColor: base.surface1, alignItems: 'center',
  },
  plegadoTxt: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow },

  pie: { marginHorizontal: space.lg, marginTop: space.xl, gap: space.sm },
  listo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    height: 52, borderRadius: radius.xl,
  },
  listoTxt: { fontFamily: family.uiSemi, fontSize: tipo.ui.lg, color: '#fff' },
  pieNota: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow, textAlign: 'center' },
})

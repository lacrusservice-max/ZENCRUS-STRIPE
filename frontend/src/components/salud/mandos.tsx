/**
 * LOS MANDOS DEL REGISTRO
 * ═══════════════════════════════════════════════════════════════════════════
 * Un control por tipo de dato, y ninguno reutilizado por pereza.
 *
 * ── La tentación que este archivo evita ────────────────────────────────────
 * Pintar la misma rejilla de chips para los catorce trackers. Se escribe en la
 * mitad de tiempo y destruye el dato: el dolor tiene zona E intensidad, el
 * sangrado tiene magnitud, la temperatura tiene dos decimales que deciden si
 * se puede confirmar una ovulación. Aplanarlo todo a etiquetas obliga a la
 * usuaria a traducir lo que siente al vocabulario de la app, y lo que se
 * guarda ya no es lo que le pasó.
 *
 * ── Dos reglas que cumplen todos ───────────────────────────────────────────
 * 1. Nada nace contestado. Ninguna escala arranca en el medio, ningún chip
 *    viene marcado. Un formulario que nace relleno se guarda solo, y lo que se
 *    guardaría es una afirmación sobre el cuerpo de alguien que nadie hizo.
 * 2. El color nunca viaja solo. Toda selección se distingue además por forma,
 *    tamaño o texto, porque un 8 % de las personas no distingue esos dos rosas.
 */

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, Pressable, TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { base, space, radius, family, type as tipo, numeric } from '@/theme/salud/tokens'
import { elegir } from '@/utils/haptica'

type IconName = React.ComponentProps<typeof Ionicons>['name']

// ── 1 · Escala de sangrado ──────────────────────────────────────────────────

const SANGRADO = ['Nada', 'Manchado', 'Leve', 'Medio', 'Abundante']

/**
 * La barra crece con el nivel.
 *
 * La intensidad se lee por la altura antes que por el color, así que funciona
 * igual de bien sin distinguir tonos y se entiende de un vistazo desde lejos.
 */
export function EscalaSangrado({ valor, onChange, tono }: {
  valor: number | null; onChange: (n: number) => void; tono: string
}) {
  return (
    <View style={s.gap}>
      <View style={s.barrasFila}>
        {SANGRADO.map((label, i) => {
          /* El relleno acumulado arranca en «Manchado», no en «Nada».
             Al marcar «Medio» se encienden manchado, leve y medio, y «Nada»
             se queda apagado: cero no es una intensidad pequeña, es la
             ausencia de las demás, y pintarlo dentro de la rampa decía que
             sangrar «medio» incluye no sangrar. */
          const activo = valor != null && (valor === 0 ? i === 0 : i >= 1 && i <= valor)
          const elegido = valor === i
          return (
            <Pressable
              key={label}
              onPress={() => { elegir(); onChange(i) }}
              style={s.barraBoton}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: elegido }}
            >
              <View style={[
                s.barra,
                { height: 14 + i * 11, backgroundColor: activo ? tono : base.surface3 },
                elegido && s.barraElegida,
              ]} />
            </Pressable>
          )
        })}
      </View>
      <Etiqueta txt={valor != null ? SANGRADO[valor] : null} />
    </View>
  )
}

// ── 2 · Mapa de dolor ───────────────────────────────────────────────────────

export const ZONAS_DOLOR = [
  { id: 'cabeza', label: 'Cabeza' },
  { id: 'pecho', label: 'Pecho' },
  { id: 'abdomen_bajo', label: 'Vientre' },
  { id: 'ovarios', label: 'Ovarios' },
  { id: 'lumbar', label: 'Lumbar' },
  { id: 'piernas', label: 'Piernas' },
  { id: 'articulaciones', label: 'Articulaciones' },
  { id: 'vulva', label: 'Vulva' },
] as const

/**
 * Zona e intensidad, que es lo que promete el esquema.
 *
 * La versión anterior subía la intensidad de tres en tres con toques
 * sucesivos: rápido de escribir y opaco de usar —había que tocar cuatro veces
 * para llegar a 10 y no había forma de bajar—. Aquí la zona se enciende con un
 * toque y su intensidad se ajusta abajo, con la zona activa siempre a la vista.
 *
 * «Cólicos» a secas no distingue lo molesto de lo incapacitante, y esa
 * diferencia es justo la que sirve para ver un patrón o llevarla a consulta.
 */
export function MapaDolor({ zonas, onChange, tono }: {
  zonas: Record<string, number>
  onChange: (z: Record<string, number>) => void
  tono: string
}) {
  const activas = Object.keys(zonas)
  const [foco, setFoco] = useState<string | null>(activas[0] ?? null)
  const zonaFoco = foco && zonas[foco] != null ? foco : activas[0] ?? null

  const tocar = (id: string) => {
    elegir()
    if (zonas[id] == null) {
      onChange({ ...zonas, [id]: 5 })
      setFoco(id)
    } else if (zonaFoco === id) {
      const n = { ...zonas }
      delete n[id]
      onChange(n)
      setFoco(null)
    } else {
      setFoco(id)
    }
  }

  return (
    <View style={s.gap}>
      <View style={s.rejilla}>
        {ZONAS_DOLOR.map(z => {
          const nivel = zonas[z.id]
          const activo = nivel != null
          const enFoco = zonaFoco === z.id
          return (
            <Pressable
              key={z.id}
              onPress={() => tocar(z.id)}
              style={({ pressed }) => [
                s.zona,
                activo && { backgroundColor: tono },
                enFoco && { borderColor: '#fff', borderWidth: 1.5 },
                pressed && s.pulsado,
              ]}
              accessibilityRole="button"
              accessibilityLabel={activo ? `${z.label}, intensidad ${nivel} de 10` : z.label}
              accessibilityState={{ selected: activo }}
            >
              <Text style={[s.zonaTxt, activo && s.sobreColor]}>{z.label}</Text>
              {activo ? <Text style={s.zonaNivel}>{nivel}</Text> : null}
            </Pressable>
          )
        })}
      </View>

      {zonaFoco ? (
        <View style={s.intensidad}>
          <Text style={s.intensidadCab}>
            Intensidad en {ZONAS_DOLOR.find(z => z.id === zonaFoco)?.label.toLowerCase()}
          </Text>
          <View style={s.diez}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
              const activo = n <= zonas[zonaFoco]
              return (
                <Pressable
                  key={n}
                  onPress={() => { elegir(); onChange({ ...zonas, [zonaFoco]: n }) }}
                  style={s.diezBoton}
                  accessibilityRole="button"
                  accessibilityLabel={`Intensidad ${n}`}
                >
                  <View style={[
                    s.diezBarra,
                    { height: 10 + n * 1.6, backgroundColor: activo ? tono : base.surface3 },
                  ]} />
                </Pressable>
              )
            })}
          </View>
          <Text style={s.intensidadPie}>
            Toca la zona otra vez para quitarla.
          </Text>
        </View>
      ) : (
        <Text style={s.ayuda}>Toca dónde te duele.</Text>
      )}
    </View>
  )
}

// ── 3 · Escala de cinco ─────────────────────────────────────────────────────

export function EscalaCinco({ valor, onChange, tono, etiquetas }: {
  valor: number | null; onChange: (n: number) => void; tono: string; etiquetas: string[]
}) {
  return (
    <View style={s.gap}>
      <View style={s.puntos}>
        {[1, 2, 3, 4, 5].map(n => {
          const activo = valor != null && n <= valor
          return (
            <Pressable
              key={n}
              onPress={() => { elegir(); onChange(n) }}
              style={({ pressed }) => [
                s.punto,
                activo && { backgroundColor: tono },
                valor === n && s.puntoElegido,
                pressed && s.pulsado,
              ]}
              accessibilityRole="button"
              accessibilityLabel={etiquetas[n - 1]}
              accessibilityState={{ selected: valor === n }}
            >
              <Text style={[s.puntoTxt, activo && s.sobreColor]}>{n}</Text>
            </Pressable>
          )
        })}
      </View>
      <Etiqueta txt={valor != null ? etiquetas[valor - 1] : null} />
    </View>
  )
}

// ── 4 · Etiquetas múltiples ─────────────────────────────────────────────────

/**
 * Aquí SÍ toca una rejilla de chips.
 *
 * Digestión, piel o perimenopausia son de verdad conjuntos de etiquetas: no
 * tienen magnitud ni posición, se marcan varias a la vez y ninguna implica a
 * las otras. Usar chips donde el dato es un conjunto no es pereza; usarlos
 * donde el dato tiene magnitud, sí.
 */
export function Etiquetas<T extends string>({ opciones, valor, onChange, tono, columnas = 2 }: {
  opciones: ReadonlyArray<{ id: T; label: string; icono?: IconName }>
  valor: T[]
  onChange: (v: T[]) => void
  tono: string
  columnas?: 2 | 3
}) {
  const alterna = (id: T) => {
    elegir()
    onChange(valor.includes(id) ? valor.filter(v => v !== id) : [...valor, id])
  }
  const ancho = columnas === 3 ? '31.5%' : '48%'

  return (
    <View style={s.rejilla}>
      {opciones.map(o => {
        const activo = valor.includes(o.id)
        return (
          <Pressable
            key={o.id}
            onPress={() => alterna(o.id)}
            style={({ pressed }) => [
              s.tag,
              { width: ancho as `${number}%` },
              activo && { backgroundColor: tono },
              pressed && s.pulsado,
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: activo }}
            accessibilityLabel={o.label}
          >
            {activo ? <Ionicons name="checkmark" size={13} color="#fff" /> : null}
            <Text style={[s.tagTxt, activo && s.sobreColor]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ── 5 · Selección única ─────────────────────────────────────────────────────

export function Unico<T extends string>({ opciones, valor, onChange, tono, nota }: {
  opciones: ReadonlyArray<{ id: T; label: string; nota?: string }>
  valor: T | null
  onChange: (v: T) => void
  tono: string
  nota?: string
}) {
  return (
    <View style={s.gap}>
      <View style={s.rejilla}>
        {opciones.map(o => {
          const activo = valor === o.id
          return (
            <Pressable
              key={o.id}
              onPress={() => { elegir(); onChange(o.id) }}
              style={({ pressed }) => [
                s.tag,
                activo && { backgroundColor: tono },
                pressed && s.pulsado,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              accessibilityLabel={o.label}
            >
              <Text style={[s.tagTxt, activo && s.sobreColor]}>{o.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {valor && opciones.find(o => o.id === valor)?.nota ? (
        <Text style={s.ayuda}>{opciones.find(o => o.id === valor)!.nota}</Text>
      ) : nota ? <Text style={s.ayuda}>{nota}</Text> : null}
    </View>
  )
}

// ── 6 · Horas ───────────────────────────────────────────────────────────────

/**
 * Las horas y la calidad son datos distintos.
 *
 * Ocho horas dando vueltas no son un buen sueño. El resto de la app ya aprendió
 * esa lección —`healthTrackerStore` distingue la calidad declarada de la
 * deducida de la duración— y aquí se mantiene: se piden las dos y ninguna se
 * infiere de la otra.
 */
export function Horas({ valor, onChange, tono }: {
  valor: number | null; onChange: (h: number) => void; tono: string
}) {
  const mover = (d: number) => {
    const base_ = valor ?? 7.5
    const n = Math.max(0, Math.min(16, Math.round((base_ + d) * 2) / 2))
    elegir()
    onChange(n)
  }
  return (
    <View style={s.stepper}>
      <Pressable
        onPress={() => mover(-0.5)}
        style={({ pressed }) => [s.stepBoton, pressed && s.pulsado]}
        accessibilityRole="button"
        accessibilityLabel="Media hora menos"
      >
        <Ionicons name="remove" size={20} color={base.textMid} />
      </Pressable>

      <View style={s.stepLectura}>
        <Text style={[s.stepNumero, valor == null && s.stepVacio, valor != null && { color: tono }]}>
          {valor != null ? valor.toFixed(1).replace('.0', '') : '—'}
        </Text>
        <Text style={s.stepUnidad}>{valor === 1 ? 'hora' : 'horas'}</Text>
      </View>

      <Pressable
        onPress={() => mover(0.5)}
        style={({ pressed }) => [s.stepBoton, pressed && s.pulsado]}
        accessibilityRole="button"
        accessibilityLabel="Media hora más"
      >
        <Ionicons name="add" size={20} color={base.textMid} />
      </Pressable>
    </View>
  )
}

// ── 7 · Lista de medicación ─────────────────────────────────────────────────

/**
 * Texto libre, y con motivo.
 *
 * Un desplegable de medicamentos habría que mantenerlo, quedaría corto el
 * primer día y dejaría fuera al suplemento raro que alguien toma. Aquí lo que
 * importa no es el vademécum: es si HOY se lo tomó, y eso se marca en un toque.
 */
export function ListaMedicacion({ items, onChange, tono }: {
  items: Array<{ name: string; taken: boolean }>
  onChange: (v: Array<{ name: string; taken: boolean }>) => void
  tono: string
}) {
  const [nuevo, setNuevo] = useState('')

  const añadir = () => {
    const n = nuevo.trim()
    if (!n) return
    elegir()
    onChange([...items, { name: n.slice(0, 60), taken: true }])
    setNuevo('')
  }

  return (
    <View style={s.gap}>
      {items.map((it, i) => (
        <View key={`${it.name}-${i}`} style={s.medFila}>
          <Pressable
            onPress={() => {
              elegir()
              onChange(items.map((x, k) => k === i ? { ...x, taken: !x.taken } : x))
            }}
            style={s.medToggle}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: it.taken }}
            accessibilityLabel={`${it.name}, ${it.taken ? 'tomado' : 'sin tomar'}`}
          >
            <Ionicons
              name={it.taken ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={it.taken ? tono : base.textLow}
            />
            <Text style={[s.medTxt, !it.taken && s.medPendiente]}>{it.name}</Text>
          </Pressable>
          <Pressable
            onPress={() => { elegir(); onChange(items.filter((_, k) => k !== i)) }}
            hitSlop={10}
            accessibilityLabel={`Quitar ${it.name}`}
          >
            <Ionicons name="close" size={16} color={base.textLow} />
          </Pressable>
        </View>
      ))}

      <View style={s.medNuevo}>
        <TextInput
          value={nuevo}
          onChangeText={setNuevo}
          onSubmitEditing={añadir}
          placeholder="Añadir medicamento o suplemento"
          placeholderTextColor={base.textLow}
          style={s.medInput}
          returnKeyType="done"
          maxLength={60}
        />
        <Pressable
          onPress={añadir}
          disabled={!nuevo.trim()}
          style={({ pressed }) => [
            s.medAñadir,
            { backgroundColor: nuevo.trim() ? tono : base.surface3 },
            pressed && s.pulsado,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Añadir"
        >
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  )
}

// ── Piezas menores ──────────────────────────────────────────────────────────

function Etiqueta({ txt }: { txt: string | null }) {
  return (
    <Text style={[s.etiquetaValor, !txt && s.sinMarcar]}>
      {txt ?? 'sin marcar'}
    </Text>
  )
}

const s = StyleSheet.create({
  gap: { gap: space.sm + 2 },
  pulsado: { opacity: 0.72 },
  sobreColor: { color: '#fff' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  barrasFila: { flexDirection: 'row', alignItems: 'flex-end', height: 62, gap: space.sm },
  barraBoton: { flex: 1, justifyContent: 'flex-end' },
  barra: { width: '100%', borderRadius: radius.sm },
  barraElegida: { borderWidth: 1.5, borderColor: '#fff' },

  zona: {
    width: '31.5%', paddingVertical: space.md - 2, borderRadius: radius.md,
    alignItems: 'center', backgroundColor: base.surface2,
    borderWidth: 1.5, borderColor: 'transparent', gap: 1,
  },
  zonaTxt: { fontFamily: family.uiMedium, fontSize: tipo.ui.xs, color: base.textMid },
  zonaNivel: { fontFamily: family.dataMedium, fontSize: 11, color: '#fff', ...numeric },

  intensidad: { gap: space.sm, paddingTop: space.sm },
  intensidadCab: { fontFamily: family.uiMedium, fontSize: tipo.ui.xs, color: base.textMid },
  diez: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 30 },
  diezBoton: { flex: 1, justifyContent: 'flex-end' },
  diezBarra: { width: '100%', borderRadius: 2 },
  intensidadPie: { fontFamily: family.ui, fontSize: 10.5, color: base.textLow },

  puntos: { flexDirection: 'row', gap: space.sm },
  punto: {
    flex: 1, height: 44, borderRadius: radius.md, backgroundColor: base.surface2,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'transparent',
  },
  puntoElegido: { borderColor: '#fff' },
  puntoTxt: { fontFamily: family.dataMedium, fontSize: tipo.ui.sm, color: base.textLow, ...numeric },

  tag: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: space.sm + 4, paddingHorizontal: space.sm,
    borderRadius: radius.md, backgroundColor: base.surface2,
  },
  tagTxt: { fontFamily: family.uiMedium, fontSize: tipo.ui.xs, color: base.textMid },

  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBoton: {
    width: 46, height: 46, borderRadius: radius.md, backgroundColor: base.surface2,
    alignItems: 'center', justifyContent: 'center',
  },
  stepLectura: { alignItems: 'center' },
  stepNumero: { fontFamily: family.dataMedium, fontSize: tipo.data.lg, color: base.textHi, ...numeric },
  stepVacio: { color: base.textLow },
  stepUnidad: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow },

  medFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  medToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  medTxt: { flex: 1, fontFamily: family.ui, fontSize: tipo.ui.sm, color: base.textHi },
  medPendiente: { color: base.textMid },
  medNuevo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  medInput: {
    flex: 1, height: 42, borderRadius: radius.md, paddingHorizontal: space.md,
    backgroundColor: base.surface2, color: base.textHi,
    fontFamily: family.ui, fontSize: tipo.ui.sm,
  },
  medAñadir: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },

  etiquetaValor: { fontFamily: family.uiMedium, fontSize: tipo.ui.sm, color: base.textMid, textAlign: 'center' },
  sinMarcar: { fontFamily: family.ui, color: base.textLow, fontStyle: 'italic' },
  ayuda: { fontFamily: family.ui, fontSize: tipo.ui.xs, color: base.textLow },
})

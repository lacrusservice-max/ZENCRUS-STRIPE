import { hoyLocal } from '@/utils/fechas'
import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useNutritionStore } from '@/store/nutritionStore'
import { useEntrenoResumen } from '@/hooks/useEntreno'
import { useHealthStore } from '@/store/healthStore'
import { useStreakStore } from '@/store/streakStore'
import { usePremiumStore } from '@/store/premiumStore'
import {
  sendMessage as coachSend,
  createMessage,
  CoachMessage,
  CoachContext,
} from '@/services/aiCoachService'
import {
  confirmar, cancelar, deshacer, type Confirmacion,
} from '@/services/confirmacionesService'
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme'
import { Screen } from '@/components/ui/Screen'
import { TabBar } from '@/constants/layout'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * En qué estado está una tarjeta de confirmación.
 *
 * «cerrada» es el cajón de sastre honesto: el servidor dijo que no —caducó, ya
 * se había resuelto en otro sitio— y lo único que se sabe es que esa propuesta
 * dejó de estar viva. Se enseña su mensaje y ahí acaba.
 */
type EstadoTarjeta = 'abierta' | 'aplicada' | 'cancelada' | 'deshecha' | 'cerrada'

const QUICK_QUESTIONS = [
  '¿Qué debería comer hoy para complementar mis macros?',
  '¿Cómo puedo mejorar mi Health Score esta semana?',
  '¿Qué ejercicio recomiendas para hoy?',
  '¿Cuánta proteína necesito y cómo distribuirla?',
  'Dame un tip de nutrición para hoy',
  '¿Cómo puedo mantener mi racha activa?',
]

// ── Message Bubble ─────────────────────────────────────────────────────────────

/**
 * La cara de ZENA.
 *
 * La imagen va sola: ya trae su aro de neón y su fondo transparente, así que
 * meterla en un círculo con borde le pondría un segundo aro alrededor del suyo.
 *
 * Tampoco cambia con el tema —lleva sus propios colores— y por eso no lee el
 * store: en claro y en oscuro es la misma cara.
 */
function AvatarZena({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/zena.png')}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  )
}

/**
 * El texto de ZENA, ya limpio.
 *
 * El prompt le pide que escriba en texto plano, pero un modelo se salta
 * instrucciones de vez en cuando y entonces aparecían en pantalla los
 * asteriscos en crudo: «Apunté **200 g de carne**». Se ve descuidado y no hay
 * forma de arreglarlo solo desde el prompt.
 *
 * Así que la app también sabe leerlo: lo que venga marcado como negrita se
 * pinta en negrita, y el resto de marcas se quitan. Entre las dos capas, el
 * usuario no ve un asterisco nunca.
 */
function TextoZena({ contenido, style }: { contenido: string; style: any }) {
  const limpio = contenido
    .replace(/^#{1,6}\s+/gm, '')       // títulos
    .replace(/`{1,3}/g, '')            // código
    .replace(/^\s*[*+]\s+/gm, '- ')    // viñetas con asterisco

  // Se parte por los tramos en negrita conservándolos, para poder pintarlos.
  const trozos = limpio.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).filter(Boolean)

  return (
    <Text style={style}>
      {trozos.map((t, i) => {
        const negrita = /^(\*\*[^*]+\*\*|__[^_]+__)$/.test(t)
        return negrita
          ? <Text key={i} style={{ fontWeight: '700' }}>{t.slice(2, -2)}</Text>
          : <Text key={i}>{t}</Text>
      })}
    </Text>
  )
}

function MessageBubble({ msg }: { msg: CoachMessage }) {
  const isUser = msg.role === 'user'
  const time = new Date(msg.timestamp).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return (
    <View style={[b.wrap, isUser ? b.wrapRight : b.wrapLeft]}>
      {!isUser && <AvatarZena />}
      <View style={[b.bubble, isUser ? b.bubbleUser : b.bubbleAssistant]}>
        {isUser
          ? <Text style={[b.txt, b.txtUser]}>{msg.content}</Text>
          : <TextoZena contenido={msg.content} style={[b.txt, b.txtAssistant]} />}
        <Text style={[b.time, isUser ? { color: 'rgba(255,255,255,0.5)' } : { color: Colors.dark.textTertiary }]}>{time}</Text>
      </View>
    </View>
  )
}

const b = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: Spacing[3], gap: Spacing[2] },
  wrapLeft: { justifyContent: 'flex-start' },
  wrapRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '80%', borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3] },
  bubbleUser: { backgroundColor: Colors.primary[500], borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: Colors.dark.surface, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: Colors.dark.border },
  txt: { fontSize: Typography.fontSize.sm, lineHeight: 21 },
  txtUser: { color: '#fff' },
  txtAssistant: { color: Colors.dark.text },
  time: { fontSize: 10, marginTop: Spacing[1], textAlign: 'right' } })

// ── Typing Indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <View style={[b.wrap, b.wrapLeft]}>
      <AvatarZena />
      <View style={[b.bubble, b.bubbleAssistant, { paddingVertical: Spacing[4], paddingHorizontal: Spacing[5] }]}>
        <ActivityIndicator size="small" color={Colors.primary[400]} />
      </View>
    </View>
  )
}

// ── Tarjeta de confirmación ────────────────────────────────────────────────────

/**
 * Lo que ZENA propone y todavía no ha hecho. §10.
 *
 * ── Por qué se enseñan las dos cifras ───────────────────────────────────────
 * «Tus calorías serán 1.850» obliga a acordarse de cuántas eran para saber si
 * eso es un ajuste o un despeñadero, y nadie se sabe de memoria sus gramos de
 * grasa. Con «2.100 → 1.850» delante, la magnitud se ve sin pensar — que es lo
 * único que se puede juzgar en los dos segundos que dura mirar una tarjeta.
 *
 * ── Por qué el botón de confirmar no es rojo ────────────────────────────────
 * En esta paleta el rojo es lo que exige atención, y aquí lo que la exige son
 * los números, no el botón. Un «Confirmar» en rojo neón es un botón que se
 * toca antes de leer, y una confirmación que se toca sin leer no confirma
 * nada: solo añade un paso.
 */
function TarjetaConfirmacion({
  confirmacion,
  onResuelta,
}: {
  confirmacion: Confirmacion
  onResuelta: (id: string, estado: EstadoTarjeta, mensaje: string) => void
}) {
  const [trabajando, setTrabajando] = useState(false)

  const responder = async (que: 'confirmar' | 'cancelar' | 'deshacer') => {
    if (trabajando) return
    setTrabajando(true)
    const fn = que === 'confirmar' ? confirmar : que === 'cancelar' ? cancelar : deshacer
    const r = await fn(confirmacion.id)
    // Si el servidor dice que no —caducó, ya se resolvió— la tarjeta se cierra
    // igual con SU mensaje. Dejarla abierta invitaría a volver a intentarlo
    // contra algo que ya no existe.
    const estado: EstadoTarjeta = !r.ok ? 'cerrada'
      : que === 'confirmar' ? 'aplicada'
      : que === 'cancelar' ? 'cancelada'
      : 'deshecha'
    onResuelta(confirmacion.id, estado, r.mensaje)
    setTrabajando(false)
  }

  return (
    <View style={[b.wrap, b.wrapLeft]}>
      <View style={{ width: 32 }} />
      <View style={tc.card}>
        <View style={tc.encabezado}>
          <Ionicons name="swap-horizontal" size={14} color={Colors.neon.red} />
          <Text style={tc.titulo}>ZENA propone un cambio</Text>
        </View>

        {confirmacion.cambios.map((c, i) => (
          <View key={`${c.etiqueta}-${i}`} style={tc.fila}>
            <Text style={tc.etiqueta}>{c.etiqueta}</Text>
            <View style={tc.valores}>
              <Text style={tc.antes}>{c.antes ?? '—'}</Text>
              <Ionicons name="arrow-forward" size={11} color={Colors.neon.w3} />
              <Text style={tc.despues}>
                {c.despues}{c.unidad ? ` ${c.unidad}` : ''}
              </Text>
            </View>
          </View>
        ))}

        <Text style={tc.nota}>Nada cambia hasta que lo confirmes.</Text>

        <View style={tc.botones}>
          <TouchableOpacity
            style={[tc.btn, tc.btnFantasma]}
            onPress={() => responder('cancelar')}
            disabled={trabajando}
            accessibilityRole="button"
            accessibilityLabel="Cancelar el cambio propuesto"
          >
            <Text style={tc.btnFantasmaTxt}>Ahora no</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[tc.btn, tc.btnPrincipal, trabajando && tc.btnApagado]}
            onPress={() => responder('confirmar')}
            disabled={trabajando}
            accessibilityRole="button"
            accessibilityLabel="Confirmar y aplicar el cambio"
          >
            {trabajando
              ? <ActivityIndicator size="small" color={Colors.neon.void} />
              : <Text style={tc.btnPrincipalTxt}>Confirmar</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

/**
 * La misma tarjeta cuando ya se resolvió.
 *
 * El botón de deshacer solo aparece si de verdad se aplicó algo. Ofrecer
 * «deshacer» sobre algo que se canceló sería ofrecer deshacer la nada, y el
 * usuario tendría que averiguar por su cuenta qué haría ese botón.
 */
function TarjetaResuelta({
  estado, mensaje, onDeshacer, deshaciendo,
}: {
  estado: EstadoTarjeta
  mensaje: string
  onDeshacer: () => void
  deshaciendo: boolean
}) {
  const icono = estado === 'aplicada' ? 'checkmark-circle' : 'close-circle'
  const color = estado === 'aplicada' ? Colors.neon.white : Colors.neon.w3

  return (
    <View style={[b.wrap, b.wrapLeft]}>
      <View style={{ width: 32 }} />
      <View style={[tc.card, tc.cardApagada]}>
        <View style={tc.encabezado}>
          <Ionicons name={icono} size={14} color={color} />
          <Text style={[tc.titulo, { color }]}>{mensaje}</Text>
        </View>
        {estado === 'aplicada' && (
          <TouchableOpacity
            style={[tc.btn, tc.btnFantasma, { alignSelf: 'flex-start', marginTop: Spacing[2] }]}
            onPress={onDeshacer}
            disabled={deshaciendo}
            accessibilityRole="button"
            accessibilityLabel="Deshacer este cambio"
          >
            <Text style={tc.btnFantasmaTxt}>{deshaciendo ? 'Deshaciendo…' : 'Deshacer'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const tc = StyleSheet.create({
  card: {
    flex: 1, maxWidth: '86%',
    backgroundColor: Colors.neon.pane,
    borderRadius: BorderRadius.lg, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.neon.redDim,
    padding: Spacing[4], gap: Spacing[2],
  },
  cardApagada: { borderColor: Colors.neon.edge, gap: 0 },
  encabezado: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  titulo: {
    fontSize: 11, fontWeight: '800', color: Colors.neon.red,
    textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 1,
  },
  fila: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: Spacing[3], paddingVertical: Spacing[1],
  },
  etiqueta: { fontSize: Typography.fontSize.sm, color: Colors.neon.w2, flexShrink: 1 },
  valores: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  // El valor viejo tachado y apagado: se enseña para comparar, no para leerlo.
  antes: { fontSize: Typography.fontSize.sm, color: Colors.neon.w3, textDecorationLine: 'line-through' },
  despues: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.neon.white },
  nota: { fontSize: 11, color: Colors.neon.w3, marginTop: Spacing[1] },
  botones: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[2] },
  btn: {
    borderRadius: BorderRadius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
    alignItems: 'center', justifyContent: 'center', minHeight: 36,
  },
  btnPrincipal: { flex: 1, backgroundColor: Colors.neon.white },
  btnPrincipalTxt: { fontSize: Typography.fontSize.sm, fontWeight: '800', color: Colors.neon.void },
  btnFantasma: { borderWidth: 1, borderColor: Colors.neon.edge },
  btnFantasmaTxt: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.neon.w2 },
  btnApagado: { opacity: 0.6 },
})

// ── Premium Gate Banner ────────────────────────────────────────────────────────

function PremiumGate() {
  return (
    <View style={pg.wrap}>
      <Ionicons name="flash" size={40} color={Colors.primary[400]} style={pg.emoji} />
      <Text style={pg.title}>Se acabaron los mensajes de hoy</Text>
      <Text style={pg.sub}>
        Mañana vuelves a empezar.
        {'\n'}Con Premium las conversaciones no tienen tope.
      </Text>
      <TouchableOpacity style={pg.btn} onPress={() => router.push('/(tabs)/profile')}>
        <Text style={pg.btnTxt}>Ver Premium →</Text>
      </TouchableOpacity>
    </View>
  )
}

const pg = StyleSheet.create({
  wrap: { margin: Spacing[4], backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.lg, padding: Spacing[5], alignItems: 'center', borderWidth: 1, borderColor: Colors.primary[500] + '50' },
  emoji: { fontSize: 36, marginBottom: Spacing[2] },
  title: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text, marginBottom: Spacing[2] },
  sub: { fontSize: Typography.fontSize.sm, color: Colors.dark.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: Spacing[4] },
  btn: { backgroundColor: Colors.primary[500], borderRadius: BorderRadius.md, paddingHorizontal: Spacing[6], paddingVertical: Spacing[3] },
  btnTxt: { color: '#fff', fontWeight: '800', fontSize: Typography.fontSize.sm } })

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const { totalCalories, totalProtein, waterGlasses } = useNutritionStore()
  const { entrenadoHoy } = useEntrenoResumen()
  const { checkInDone, todayCheckIn, scoreHistory } = useHealthStore()
  const { currentStreak } = useStreakStore()
  const { incrementAI } = usePremiumStore()
  const insets = useSafeAreaInsets()

  // Lo que ocupa la píldora de pestañas desde el borde inferior: su posición
  // —igual que en `GlassTabBar`— más su alto.
  const espacioBarra = Math.max(insets.bottom, 14) + TabBar.lift + TabBar.pill

  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [topeAlcanzado, setTopeAlcanzado] = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  /**
   * Cómo acabó cada tarjeta, por id de propuesta.
   *
   * Vive fuera de los mensajes porque una tarjeta cambia de estado sin que el
   * mensaje que la trajo cambie en nada. Reescribir el mensaje entero para
   * marcar que se confirmó obligaría a copiar toda la lista en cada toque.
   */
  const [resueltas, setResueltas] = useState<Record<string, { estado: EstadoTarjeta; mensaje: string }>>({})
  const [deshaciendo, setDeshaciendo] = useState<string | null>(null)

  const marcarResuelta = useCallback((id: string, estado: EstadoTarjeta, mensaje: string) => {
    setResueltas(prev => ({ ...prev, [id]: { estado, mensaje } }))
  }, [])

  const manejarDeshacer = useCallback(async (id: string) => {
    setDeshaciendo(id)
    const r = await deshacer(id)
    // Si no se pudo —pasaron las 24 h, ya estaba deshecho— se enseña el motivo
    // del servidor y la tarjeta deja de ofrecer el botón.
    setResueltas(prev => ({ ...prev, [id]: { estado: r.ok ? 'deshecha' : 'cerrada', mensaje: r.mensaje } }))
    setDeshaciendo(null)
  }, [])

  const today = hoyLocal()
  const healthScore = scoreHistory.find(s => (s as any).date === today)?.total
    ?? scoreHistory[0]?.total ?? 0

  const context: CoachContext = {
    totalCalories,
    caloriesTarget: 2000,
    totalProtein,
    proteinTarget: 150,
    waterGlasses,
    currentStreak,
    healthScore,
    workedOut: entrenadoHoy,
    checkInDone,
    mood: todayCheckIn?.mood,
    sleep: todayCheckIn?.sleep,
    intention: todayCheckIn?.intention }

  // Welcome message on first mount
  useEffect(() => {
    const welcome = createMessage(
      'assistant',
      `¡Hola! Soy ZENA, tu coach de ZENCRUS. Hoy llevas ${totalCalories} kcal, ${waterGlasses} vasos de agua y una racha de ${currentStreak} días. ¿En qué te puedo ayudar?`
    )
    setMessages([welcome])
  }, [])

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }, [messages, sending])

  /**
   * El tope lo decide el SERVIDOR, no esta pantalla.
   *
   * Aquí había un `canUseAI()` que comparaba un contador del AsyncStorage
   * contra un 5 escrito a mano. Dos problemas: quien editara ese almacenamiento
   * se daba mensajes infinitos, y —al revés— una cuenta interna o de pago se
   * quedaba bloqueada por un número que el teléfono se inventaba, que es lo que
   * pasaba al probar la app.
   *
   * Ahora se manda siempre y se escucha lo que conteste. Cuando el servidor
   * corta, devuelve 429 con su propio mensaje, y ese es el que se enseña.
   */
  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || sending) return

    setInput('')
    setSending(true)

    const userMsg = createMessage('user', content)
    setMessages(prev => [...prev, userMsg])
    await incrementAI()

    try {
      const { texto, confirmaciones } = await coachSend(content, messages, context)
      const assistantMsg = createMessage('assistant', texto, confirmaciones)
      setMessages(prev => [...prev, assistantMsg])
    } catch (err: any) {
      // El 429 no es un fallo: es el tope del día, y trae escrito qué decir.
      const tope = err?.response?.status === 429
      const texto = tope
        ? (err?.response?.data?.message ?? 'Llegaste a tus mensajes de hoy. Mañana volvemos a empezar.')
        : 'No pude conectar con el servidor. Revisa tu conexión y vuelve a intentarlo.'
      setMessages(prev => [...prev, createMessage('assistant', texto)])
      if (tope) setTopeAlcanzado(true)
    } finally {
      setSending(false)
    }
  }, [input, sending, incrementAI, messages, context])

  // Solo se marca cuando el servidor lo dice, no antes.
  const atLimit = topeAlcanzado

  return (
    <Screen>
      {/* Header */}
      <View style={s.header}>
        {/*
          La cabecera entera abre el perfil, no solo el nombre: es lo que se
          espera de una conversación, y un objetivo del ancho de la fila se
          acierta sin apuntar.
        */}
        <TouchableOpacity
          style={s.headerLeft}
          onPress={() => router.push('/zena')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Ver el perfil de ZENA"
        >
          <AvatarZena size={40} />
          <View>
            <View style={s.headerNombre}>
              <Text style={s.headerTitle}>ZENA</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.dark.textTertiary} />
            </View>
            <Text style={s.headerSub}>
              {atLimit ? 'Sin mensajes por hoy' : 'Coach de nutrición y fitness'}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={[s.statusDot, { backgroundColor: sending ? Colors.accent.orange : Colors.accent.green }]} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* Context bar */}
        <View style={s.ctxBar}>
          <CtxChip label={`${totalCalories} kcal`} emoji="🍽️" />
          <CtxChip label={`${waterGlasses} vasos`} emoji="💧" />
          <CtxChip label={`${currentStreak}d racha`} emoji="🔥" />
          <CtxChip label={`Score ${healthScore}`} emoji="⭐" />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(msg => (
            <View key={msg.id}>
              <MessageBubble msg={msg} />
              {/*
                Las tarjetas van DEBAJO del mensaje que las propuso: ZENA dice
                qué cambiaría y justo ahí está el botón. Separarlas dejaría el
                «¿lo confirmas?» a una distancia que crece con la conversación.
              */}
              {msg.confirmaciones?.map(c => {
                const resuelta = resueltas[c.id]
                return resuelta
                  ? (
                    <TarjetaResuelta
                      key={c.id}
                      estado={resuelta.estado}
                      mensaje={resuelta.mensaje}
                      deshaciendo={deshaciendo === c.id}
                      onDeshacer={() => manejarDeshacer(c.id)}
                    />
                  )
                  : <TarjetaConfirmacion key={c.id} confirmacion={c} onResuelta={marcarResuelta} />
              })}
            </View>
          ))}
          {sending && <TypingIndicator />}

          {/* Quick questions (show when only welcome msg) */}
          {messages.length <= 1 && !sending && (
            <View style={s.quickWrap}>
              <Text style={s.quickTitle}>Preguntas frecuentes</Text>
              {QUICK_QUESTIONS.map(q => (
                <TouchableOpacity
                  key={q}
                  style={s.quickBtn}
                  onPress={() => handleSend(q)}
                  disabled={atLimit}
                >
                  <Text style={s.quickBtnTxt}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {atLimit && <PremiumGate />}
        </ScrollView>

        {/*
          Input.
          El chat es una pestaña, así que la píldora flotante le pasa por
          encima: sin reservar su alto, el campo de escribir queda debajo y no
          se puede ni tocar ni leer. Se reserva aquí y no con `scrollInset`
          porque esta fila no está dentro del scroll, va fija bajo él.
        */}
        <View style={[s.inputRow, { paddingBottom: Spacing[3] + espacioBarra }]}>
          <TextInput
            style={[s.input, atLimit && s.inputDisabled]}
            value={input}
            onChangeText={setInput}
            placeholder={atLimit ? 'Límite diario alcanzado' : 'Escribe tu pregunta...'}
            placeholderTextColor={Colors.dark.textTertiary}
            multiline
            maxLength={500}
            editable={!atLimit}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!input.trim() || sending || atLimit) && s.sendBtnOff]}
            onPress={() => handleSend()}
            disabled={!input.trim() || sending || atLimit}
          >
            <Text style={s.sendBtnTxt}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function CtxChip({ label, emoji }: { label: string; emoji: string }) {
  return (
    <View style={cc.wrap}>
      <Text style={cc.emoji}>{emoji}</Text>
      <Text style={cc.label}>{label}</Text>
    </View>
  )
}

const cc = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1], borderWidth: 1, borderColor: Colors.dark.border },
  emoji: { fontSize: 12 },
  label: { fontSize: 10, color: Colors.dark.textSecondary, fontWeight: '600' } })

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing[5], paddingVertical: Spacing[3], borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  headerNombre: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  headerIconTxt: { fontSize: 20 },
  headerTitle: { fontSize: Typography.fontSize.base, fontWeight: '800', color: Colors.dark.text },
  headerSub: { fontSize: Typography.fontSize.xs, color: Colors.dark.textSecondary, marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  ctxBar: { flexDirection: 'row', gap: Spacing[2], paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], flexWrap: 'wrap' },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing[4], paddingBottom: Spacing[4] },
  quickWrap: { marginTop: Spacing[4] },
  quickTitle: { fontSize: Typography.fontSize.xs, fontWeight: '700', color: Colors.dark.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing[3] },
  quickBtn: { backgroundColor: Colors.dark.surface, borderRadius: BorderRadius.md, padding: Spacing[3], marginBottom: Spacing[2], borderWidth: 1, borderColor: Colors.dark.border },
  quickBtnTxt: { fontSize: Typography.fontSize.sm, color: Colors.primary[400], fontWeight: '500' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2], paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], borderTopWidth: 1, borderTopColor: Colors.dark.border },
  input: { flex: 1, borderWidth: 1.5, borderColor: Colors.dark.border, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3], fontSize: Typography.fontSize.base, color: Colors.dark.text, backgroundColor: Colors.dark.surface, maxHeight: 100 },
  inputDisabled: { opacity: 0.4 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary[500], alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: Colors.dark.surface, borderWidth: 1, borderColor: Colors.dark.border },
  sendBtnTxt: { fontSize: 20, color: '#fff', fontWeight: '800' } })

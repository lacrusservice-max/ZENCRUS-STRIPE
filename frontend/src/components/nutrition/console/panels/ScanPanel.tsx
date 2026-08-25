/**
 * PANEL · ESCÁNER
 * ───────────────
 * Dos vías bajo un mismo panel, separadas por submenú:
 *
 *   · Código   — la cámara lee el código de barras del envase
 *   · Foto     — estimación de macros del plato por imagen
 *
 * ── Lo que había aquí antes ─────────────────────────────────────────────────
 * Las dos vías funcionaban de mentira. «Simular lectura» sacaba un código al
 * azar de cinco, y cualquier código tecleado devolvía siempre algo: si no
 * estaba en una lista de nueve productos, el servicio se inventaba un
 * «Producto 3312 · Marca desconocida · 150 kcal» con macros redondos. Y la
 * pestaña de foto esperaba 1,8 segundos con un «Estimando macros…» para
 * devolver uno de cinco platos al azar, sin haber mirado ninguna foto.
 *
 * Lo grave no era el placeholder: era que esos números se podían añadir a la
 * comida del día con el mismo botón que los reales, y una vez dentro del diario
 * ya no se distinguían. Alguien podía llevar semanas cuadrando un déficit sobre
 * cifras sorteadas.
 *
 * Después de aquello el código pasó a consultarse de verdad, pero había que
 * teclear los trece dígitos a mano: `expo-camera` llevaba instalado en el
 * proyecto sin que lo importara ni un fichero. Ahora lee la cámara.
 *
 * ── El teclado no se va ─────────────────────────────────────────────────────
 * Sigue habiendo entrada manual, y no como parche: un código arrugado, un
 * envase sin plástico, permiso de cámara denegado o el simulador —que no tiene
 * cámara— son casos reales y frecuentes. Está a un toque, siempre.
 *
 * La foto del plato sigue diciendo que todavía no sabe hacerlo. Ninguna de las
 * dos rellena el hueco con un número inventado.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, ScrollView, ActivityIndicator, Image, Linking,
} from 'react-native'
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, withSequence, Easing,
} from 'react-native-reanimated'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { ZIcon } from '@/components/ui/ZencrusIcon'
import { VerifiedSeal } from '@/components/ui/VerifiedSeal'
import { Food, getFoodByBarcode, aportarAlimento } from '@/services/foodApi'
import { scaleMacros, fmtQty } from '@/utils/units'
import { FoodEntry } from '@/store/nutritionStore'
import { CT, numeral, legend } from '../tokens'
import { Tap, Panel, SubTabs, Bracket, Blank } from '../parts'

interface ScanPanelProps {
  onCommit: (entry: FoodEntry) => void
  /** Lleva a la pestaña de búsqueda: es la salida cuando el código no aparece. */
  onBuscar?: () => void
}

export function ScanPanel({ onCommit, onBuscar }: ScanPanelProps) {
  const [tab, setTab] = useState<'codigo' | 'foto'>('codigo')

  return (
    <Panel>
      <SubTabs
        tabs={[{ id: 'codigo', label: 'Código de barras' }, { id: 'foto', label: 'Foto del plato' }]}
        active={tab}
        onSelect={id => setTab(id as 'codigo' | 'foto')}
      />
      {tab === 'codigo'
        ? <BarcodeReader onCommit={onCommit} onBuscar={onBuscar} />
        : <PlateReader onBuscar={onBuscar} />}
    </Panel>
  )
}

// ── Código de barras ──────────────────────────────────────────────────────────

/**
 * Qué simbologías se miran.
 *
 * EAN-13 es el estándar de la alimentación en todo el mundo y EAN-8 el de los
 * envases pequeños. UPC-A —los doce dígitos de los productos americanos— NO
 * hace falta pedirlo: es formalmente un EAN-13 con un cero delante, y así lo
 * entrega el lector de iOS. Del cero de más se encarga el servidor, que prueba
 * las dos formas (ver `variantesDe` en `openFoodFacts.ts`).
 *
 * Code-128 e ITF-14 aparecen en marca blanca y en cajas de cartón. Los códigos
 * bidimensionales quedan fuera a propósito: un QR en un envase lleva a una web
 * promocional, no a una ficha nutricional, y leerlo solo daría un falso positivo.
 */
const SIMBOLOGIAS = ['ean13', 'ean8', 'code128', 'itf14'] as const

/** Tras un código que no está, cuánto se espera antes de admitir otra lectura. */
const REARME_MS = 1400

type Estado =
  | { fase: 'leyendo' }
  | { fase: 'buscando'; codigo: string }
  | { fase: 'hallado'; codigo: string; food: Food }
  | { fase: 'ausente'; codigo: string }
  | { fase: 'aportando'; codigo: string }

function BarcodeReader({ onCommit, onBuscar }: {
  onCommit: (e: FoodEntry) => void
  onBuscar?: () => void
}) {
  const [permiso, pedirPermiso] = useCameraPermissions()
  const [estado, setEstado] = useState<Estado>({ fase: 'leyendo' })
  const [linterna, setLinterna] = useState(false)
  const [aMano, setAMano] = useState(false)
  const [tecleado, setTecleado] = useState('')

  /**
   * El pestillo.
   *
   * `onBarcodeScanned` no se dispara una vez por código: se dispara en cada
   * fotograma en el que el código siga a la vista, o sea unas treinta veces por
   * segundo. Sin pestillo, apuntar dos segundos a un envase lanza sesenta
   * consultas al catálogo del mismo producto, sesenta vibraciones y una carrera
   * de respuestas para decidir cuál gana.
   *
   * Va en un `ref` y no en el estado porque tiene que cerrarse DENTRO del mismo
   * fotograma en que se abre. Un `useState` no se ve reflejado hasta el próximo
   * render, y para entonces ya han entrado veinte lecturas más.
   */
  const cerrado = useRef(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (temporizador.current) clearTimeout(temporizador.current) }, [])

  /* Se pide al entrar, no al abrir la app: quien toca una pestaña que se llama
     «Escáner» ya ha dicho lo que quiere, y un diálogo del sistema en cualquier
     otro momento se lee como que la app fisgonea. */
  useEffect(() => {
    if (permiso && !permiso.granted && permiso.canAskAgain) void pedirPermiso()
  }, [permiso?.granted, permiso?.canAskAgain])

  const consultar = useCallback(async (codigo: string) => {
    setEstado({ fase: 'buscando', codigo })
    const food = await getFoodByBarcode(codigo)
    if (food) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setEstado({ fase: 'hallado', codigo, food })
      // El pestillo se queda cerrado: hay una ficha en pantalla y volver a leer
      // la sustituiría por otra mientras la persona la está mirando.
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      setEstado({ fase: 'ausente', codigo })
      // Aquí sí se rearma: lo normal después de un «no está» es probar con otro
      // envase, y obligar a tocar un botón para eso sobra.
      temporizador.current = setTimeout(() => {
        cerrado.current = false
        setEstado(e => (e.fase === 'ausente' ? { fase: 'leyendo' } : e))
      }, REARME_MS)
    }
  }, [])

  const alLeer = useCallback(({ data }: BarcodeScanningResult) => {
    if (cerrado.current) return
    const codigo = String(data ?? '').replace(/\D/g, '')
    // Un EAN-8 son ocho dígitos; por debajo no es un código de producto.
    if (codigo.length < 8) return
    cerrado.current = true
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    void consultar(codigo)
  }, [consultar])

  const reiniciar = () => {
    if (temporizador.current) clearTimeout(temporizador.current)
    cerrado.current = false
    setEstado({ fase: 'leyendo' })
  }

  const buscarTecleado = () => {
    const codigo = tecleado.replace(/\D/g, '')
    if (codigo.length < 8) return
    cerrado.current = true
    void consultar(codigo)
  }

  const aportando = estado.fase === 'aportando'
  const puedeVerCamara = !!permiso?.granted && !aMano && !aportando

  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      {puedeVerCamara ? (
        <Visor
          estado={estado}
          linterna={linterna}
          onLinterna={() => setLinterna(v => !v)}
          onLeer={alLeer}
        />
      ) : aportando ? null : (
        <SinCamara
          permiso={permiso}
          aMano={aMano}
          onPedir={() => { setAMano(false); void pedirPermiso() }}
        />
      )}

      {/* La salida manual, siempre a un toque. No es un parche: el código
          arrugado, el envase sin plástico y el simulador —que no tiene cámara—
          son casos de todos los días. */}
      {!aportando && (
      <Tap onPress={() => setAMano(v => !v)} scaleTo={0.98} haptic="light">
        <View style={s.alterna}>
          <ZIcon name={aMano ? 'frame' : 'pen'} size={13} color={CT.ink3} weight={1.9} />
          <Text style={s.alternaTxt}>
            {aMano ? 'Volver a la cámara' : 'Escribir el código a mano'}
          </Text>
        </View>
      </Tap>
      )}

      {(aMano || !permiso?.granted) && !aportando && (
        <Animated.View entering={FadeIn.duration(180)} style={s.entry}>
          <TextInput
            style={s.entryInput}
            value={tecleado}
            onChangeText={setTecleado}
            placeholder="7501055363513"
            placeholderTextColor={CT.ink4}
            keyboardType="number-pad"
            returnKeyType="search"
            onSubmitEditing={buscarTecleado}
            maxLength={14}
          />
          <Tap
            onPress={buscarTecleado}
            disabled={estado.fase === 'buscando' || tecleado.replace(/\D/g, '').length < 8}
            scaleTo={0.94}
          >
            <View style={[
              s.entryBtn,
              (estado.fase === 'buscando' || tecleado.replace(/\D/g, '').length < 8) && s.entryBtnOff,
            ]}>
              <ZIcon name="reticle" size={15} color={CT.ink} weight={1.9} />
            </View>
          </Tap>
        </Animated.View>
      )}

      {estado.fase === 'ausente' && (
        <Animated.View entering={FadeInDown.duration(220)}>
          <Blank
            icon="warning"
            title={`El ${estado.codigo} no está fichado`}
            note="Ningún catálogo tiene todos los envases del mundo. Puedes darlo de alta tú: lo tienes en la mano."
          />

          {/* LA SALIDA BUENA.
              Antes esto era un callejón: «no lo tenemos» y a buscar por nombre.
              Quien tiene el envase delante puede leer su tabla nutricional en
              treinta segundos, y a partir de ahí lo encuentra TODO el mundo.
              Es lo que hace que el catálogo crezca en vez de quedarse. */}
          <Tap
            onPress={() => {
              if (temporizador.current) clearTimeout(temporizador.current)
              cerrado.current = true
              setEstado({ fase: 'aportando', codigo: estado.codigo })
            }}
            scaleTo={0.98}
            haptic="medium"
          >
            <View style={s.aportarCta}>
              <ZIcon name="plus" size={15} color="#fff" weight={2.2} />
              <Text style={s.aportarCtaTxt}>Añadirlo al catálogo</Text>
            </View>
          </Tap>

          {onBuscar && (
            <Tap onPress={onBuscar} scaleTo={0.98}>
              <View style={s.salida}>
                <ZIcon name="arrowRight" size={14} color={CT.ink} weight={1.9} />
                <Text style={s.salidaTxt}>Buscar por nombre</Text>
              </View>
            </Tap>
          )}
        </Animated.View>
      )}

      {estado.fase === 'aportando' && (
        <Aportar
          codigo={estado.codigo}
          onCancelar={reiniciar}
          onGuardado={food => setEstado({ fase: 'hallado', codigo: estado.codigo, food })}
        />
      )}

      {estado.fase === 'hallado' && (
        <Animated.View entering={FadeInDown.duration(260)}>
          <ResultCard food={estado.food} onCommit={onCommit} />
          <Tap onPress={reiniciar} scaleTo={0.98} haptic="light">
            <View style={s.salida}>
              <ZIcon name="frame" size={14} color={CT.ink} weight={1.9} />
              <Text style={s.salidaTxt}>Escanear otro</Text>
            </View>
          </Tap>
        </Animated.View>
      )}
    </ScrollView>
  )
}

// ── Visor ─────────────────────────────────────────────────────────────────────

/**
 * La cámara, con su ventana de puntería.
 *
 * El escudo oscuro de alrededor no es adorno: dice dónde poner el código. Sin
 * él la imagen ocupa todo y la gente encuadra el envase entero, que es la forma
 * más segura de que el código quede demasiado pequeño para leerse.
 */
function Visor({ estado, linterna, onLinterna, onLeer }: {
  estado: Estado
  linterna: boolean
  onLinterna: () => void
  onLeer: (r: BarcodeScanningResult) => void
}) {
  const leyendo = estado.fase === 'leyendo'

  return (
    <View style={s.visor}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={linterna}
        barcodeScannerSettings={{ barcodeTypes: [...SIMBOLOGIAS] }}
        /* Se desconecta el manejador en vez de desmontar la cámara: apagarla y
           encenderla entre lecturas cuesta medio segundo de negro y un
           parpadeo de enfoque cada vez. */
        onBarcodeScanned={leyendo ? onLeer : undefined}
      />

      {/* Escudo: cuatro bandas que dejan libre la ventana del centro. */}
      <View style={s.escudoArriba} pointerEvents="none" />
      <View style={s.escudoAbajo} pointerEvents="none" />
      <View style={s.escudoIzq} pointerEvents="none" />
      <View style={s.escudoDer} pointerEvents="none" />

      <View style={s.ventana} pointerEvents="none">
        <Bracket color={leyendo ? CT.signal : CT.ink3} inset={0} len={20} />
        {leyendo && <Barrido />}
      </View>

      <Tap onPress={onLinterna} scaleTo={0.9} haptic="light">
        <View style={[s.linterna, linterna && s.linternaOn]}>
          <ZIcon name="bolt" size={15} color={linterna ? '#0A0A0D' : CT.ink} weight={2} />
        </View>
      </Tap>

      <View style={s.pieVisor} pointerEvents="none">
        {estado.fase === 'buscando' ? (
          <View style={s.pieFila}>
            <ActivityIndicator size="small" color={CT.signal} />
            <Text style={s.pieTxt}>Buscando el {estado.codigo}…</Text>
          </View>
        ) : (
          <Text style={s.pieTxt}>
            {leyendo ? 'Encuadra el código de barras' : 'Lectura hecha'}
          </Text>
        )}
      </View>
    </View>
  )
}

/** La línea que recorre la ventana. Dice que la cámara está viva y mirando. */
function Barrido() {
  const y = useSharedValue(0)

  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    )
  }, [])

  const anim = useAnimatedStyle(() => ({
    top: `${y.value * 100}%`,
    // Se apaga en los extremos: una línea que choca contra el borde y rebota
    // parece un fallo de animación, no un barrido.
    opacity: 0.35 + 0.65 * Math.sin(Math.PI * y.value),
  }))

  return <Animated.View style={[s.barrido, anim]} pointerEvents="none" />
}

// ── Sin cámara ────────────────────────────────────────────────────────────────

function SinCamara({ permiso, aMano, onPedir }: {
  permiso: ReturnType<typeof useCameraPermissions>[0]
  aMano: boolean
  onPedir: () => void
}) {
  // Todavía no se sabe: el diálogo del sistema está a punto de salir.
  if (!permiso) {
    return (
      <View style={s.visorPlano}>
        <ActivityIndicator color={CT.ink3} />
      </View>
    )
  }

  if (aMano) {
    return (
      <View style={s.visorPlano}>
        <ZIcon name="barcode" size={38} color={CT.ink4} weight={1.6} />
        <Text style={s.planoTxt}>Teclea los dígitos que hay bajo las barras</Text>
      </View>
    )
  }

  const definitivo = !permiso.canAskAgain

  return (
    <View style={s.visorPlano}>
      <ZIcon name="frame" size={38} color={CT.ink4} weight={1.5} />
      <Text style={s.planoTxt}>
        {definitivo
          ? 'La cámara está bloqueada para ZENCRUS'
          : 'Hace falta permiso para usar la cámara'}
      </Text>
      <Text style={s.planoNota}>
        {definitivo
          ? 'Se activa desde los Ajustes del sistema. Mientras tanto, el código se puede teclear.'
          : 'Solo se usa para leer el código del envase. No se guarda ninguna imagen.'}
      </Text>
      <Tap onPress={definitivo ? () => void Linking.openSettings() : onPedir} scaleTo={0.96} haptic="light">
        <View style={s.planoBtn}>
          <Text style={s.planoBtnTxt}>{definitivo ? 'Abrir Ajustes' : 'Permitir la cámara'}</Text>
        </View>
      </Tap>
    </View>
  )
}


// ── Aportar el producto que falta ─────────────────────────────────────────────

/** Los cinco campos de una tabla nutricional, por 100 g. */
const CAMPOS_ETIQUETA: { id: keyof Macros; label: string; sufijo: string; obligatorio?: boolean }[] = [
  { id: 'calories', label: 'Energía',  sufijo: 'kcal', obligatorio: true },
  { id: 'protein',  label: 'Proteína', sufijo: 'g' },
  { id: 'carbs',    label: 'Carbos',   sufijo: 'g' },
  { id: 'fat',      label: 'Grasas',   sufijo: 'g' },
  { id: 'fiber',    label: 'Fibra',    sufijo: 'g' },
]

interface Macros { calories: number; protein: number; carbs: number; fat: number; fiber: number }

/**
 * DAR DE ALTA LO QUE NO ESTÁ
 * ══════════════════════════
 * El formulario que convierte un «no lo tenemos» en un producto fichado para
 * todo el mundo.
 *
 * ── Por qué la foto de la etiqueta ──────────────────────────────────────────
 * No se sube a ninguna parte: se queda en el teléfono mientras se rellena. Su
 * trabajo es que no haya que hacer malabares con el envase en una mano y el
 * móvil en la otra — se fotografía la tabla una vez y se teclea leyendo de la
 * pantalla, con el zoom que haga falta.
 *
 * Y no, aquí no entra ninguna IA. Un código de barras es una clave exacta
 * contra una base de datos: eso es lo que hace que el escáner sea gratis de
 * verdad y funcione sin depender de nadie. Leer un plato de una foto es otra
 * función, en otra pestaña, con otro problema — no se mezclan.
 *
 * ── Por qué se comprueba lo que se teclea ───────────────────────────────────
 * No por desconfianza: porque un dedo resbala. Teclear 5390 donde ponía 539
 * mete en el catálogo de TODOS una ficha que dice que cien gramos de crema de
 * avellanas son cinco mil kilocalorías. El aviso es el mismo cálculo que hace
 * el servidor —4 kcal por gramo de proteína y de carbohidrato, 9 por gramo de
 * grasa— pero enseñado ANTES de enviar, que es cuando la persona todavía tiene
 * el envase delante para mirarlo otra vez.
 */
function Aportar({ codigo, onCancelar, onGuardado }: {
  codigo: string
  onCancelar: () => void
  onGuardado: (food: Food) => void
}) {
  const camara = useRef<CameraView>(null)
  const [foto, setFoto] = useState<string | null>(null)
  const [nombre, setNombre] = useState('')
  const [marca, setMarca] = useState('')
  const [macros, setMacros] = useState<Macros>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const retratar = async () => {
    try {
      const p = await camara.current?.takePictureAsync({ quality: 0.6, skipProcessing: true })
      if (p?.uri) { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFoto(p.uri) }
    } catch {
      // Sin cámara —el simulador— o sin permiso: se teclea del envase y ya.
    }
  }

  /* El mismo cuadre que aplica el servidor, calculado mientras se escribe. Se
     avisa a partir de 40 kcal: por debajo, cualquier redondeo de la etiqueta es
     un porcentaje enorme y el aviso saltaría siempre sin significar nada. */
  const deMacros = macros.protein * 4 + macros.carbs * 4 + macros.fat * 9
  const descuadra = macros.calories >= 40 && deMacros > 0 &&
    Math.abs(deMacros - macros.calories) / macros.calories > 0.3
  const gramosDeMas = macros.protein + macros.carbs + macros.fat > 100
  const listo = nombre.trim().length >= 2 && macros.calories > 0 && !gramosDeMas

  const enviar = async () => {
    setEnviando(true); setError(null)
    const r = await aportarAlimento({
      barcode: codigo,
      name: nombre.trim(),
      brand: marca.trim() || undefined,
      per100: macros,
    })
    setEnviando(false)
    if ('error' in r) { setError(r.error); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onGuardado(r.food)
  }

  return (
    <Animated.View entering={FadeInDown.duration(240)}>
      <View style={s.aportarCabecera}>
        <Text style={legend}>Producto nuevo · {codigo}</Text>
        <Text style={s.aportarTitulo}>Léelo de la etiqueta</Text>
        <Text style={s.aportarNota}>
          Los valores por 100 g, tal y como vienen en la tabla nutricional. Lo que
          apuntes aquí lo va a encontrar todo el que escanee este envase.
        </Text>
      </View>

      {/* La foto de la tabla, para no hacer malabares con el envase. */}
      <View style={s.etiqueta}>
        {foto ? (
          <>
            <Image source={{ uri: foto }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            <Tap onPress={() => setFoto(null)} scaleTo={0.9} haptic="light">
              <View style={s.etiquetaOtra}>
                <ZIcon name="undo" size={13} color={CT.ink} weight={2} />
              </View>
            </Tap>
          </>
        ) : (
          <>
            <CameraView ref={camara} style={StyleSheet.absoluteFill} facing="back" />
            <Tap onPress={retratar} scaleTo={0.92} haptic="medium">
              <View style={s.disparador}>
                <ZIcon name="aperture" size={17} color="#0A0A0D" weight={2} />
                <Text style={s.disparadorTxt}>Foto de la tabla</Text>
              </View>
            </Tap>
          </>
        )}
      </View>

      <View style={s.aportarCampos}>
        <CampoTexto label="Nombre" valor={nombre} onChange={setNombre} placeholder="Galletas de avena" obligatorio />
        <CampoTexto label="Marca" valor={marca} onChange={setMarca} placeholder="Marinela" />
      </View>

      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <Text style={legend}>Por 100 g</Text>
      </View>

      <View style={s.rejilla}>
        {CAMPOS_ETIQUETA.map(c => (
          <CampoNumero
            key={c.id}
            label={c.label}
            sufijo={c.sufijo}
            obligatorio={c.obligatorio}
            valor={macros[c.id]}
            onChange={v => setMacros(m => ({ ...m, [c.id]: v }))}
          />
        ))}
      </View>

      {(descuadra || gramosDeMas) && (
        <View style={s.chequeo}>
          <ZIcon name="warning" size={13} color={CT.signalSoft} weight={2} />
          <Text style={s.chequeoTxt}>
            {gramosDeMas
              ? 'Los macros suman más de 100 g dentro de 100 g de producto. Revísalos.'
              : `Tus macros dan ${Math.round(deMacros)} kcal y arriba pusiste ${Math.round(macros.calories)}. Míralo otra vez antes de enviar.`}
          </Text>
        </View>
      )}

      {!!error && (
        <View style={[s.chequeo, s.chequeoError]}>
          <ZIcon name="close" size={13} color={CT.signal} weight={2.2} />
          <Text style={s.chequeoTxt}>{error}</Text>
        </View>
      )}

      <Tap onPress={enviar} disabled={!listo || enviando} scaleTo={0.98} haptic="medium">
        <View style={[s.aportarCta, (!listo || enviando) && s.entryBtnOff]}>
          {enviando
            ? <ActivityIndicator size="small" color="#fff" />
            : <ZIcon name="check" size={15} color="#fff" weight={2.2} />}
          <Text style={s.aportarCtaTxt}>
            {enviando ? 'Guardando…' : 'Guardar en el catálogo'}
          </Text>
        </View>
      </Tap>

      <Tap onPress={onCancelar} scaleTo={0.98}>
        <View style={s.salida}>
          <Text style={s.salidaTxt}>Cancelar</Text>
        </View>
      </Tap>
    </Animated.View>
  )
}

function CampoTexto({ label, valor, onChange, placeholder, obligatorio }: {
  label: string; valor: string; onChange: (v: string) => void
  placeholder: string; obligatorio?: boolean
}) {
  return (
    <View style={{ flex: 1 }}>
      <View style={s.campoLblFila}>
        <Text style={s.campoLbl}>{label}</Text>
        {obligatorio && <View style={s.obligatorio} />}
      </View>
      <View style={s.campoCaja}>
        <TextInput
          style={s.campoTxt}
          value={valor}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={CT.ink4}
          maxLength={120}
        />
      </View>
    </View>
  )
}

/**
 * Campo numérico.
 *
 * Guarda su propio texto mientras se escribe. Sin eso, teclear «12.» se
 * convertía en 12 y el punto desaparecía bajo el dedo; y vaciar el campo para
 * poner otra cifra dejaba un 0 delante que había que borrar antes.
 */
function CampoNumero({ label, sufijo, valor, obligatorio, onChange }: {
  label: string; sufijo: string; valor: number
  obligatorio?: boolean; onChange: (v: number) => void
}) {
  const [texto, setTexto] = useState<string | null>(null)
  const mostrado = texto ?? (valor > 0 ? String(valor) : '')

  return (
    <View style={s.celda}>
      <View style={s.campoLblFila}>
        <Text style={s.campoLbl}>{label}</Text>
        {obligatorio && <View style={s.obligatorio} />}
      </View>
      <View style={s.campoCaja}>
        <TextInput
          style={[s.campoTxt, numeral as object]}
          value={mostrado}
          onChangeText={t => {
            // Coma decimal: es la tecla que sale en el teclado español.
            const limpio = t.replace(',', '.').replace(/[^0-9.]/g, '')
            setTexto(limpio)
            const n = parseFloat(limpio)
            onChange(Number.isFinite(n) ? n : 0)
          }}
          onBlur={() => setTexto(null)}
          placeholder="0"
          placeholderTextColor={CT.ink4}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text style={s.campoSuf}>{sufijo}</Text>
      </View>
    </View>
  )
}

// ── Foto del plato ────────────────────────────────────────────────────────────

/**
 * No hay nada que ejecutar aquí, y ese es el punto.
 *
 * No existe reconocimiento de imagen en el proyecto: ni en el móvil, ni en el
 * servidor. Un botón «Analizar plato» que devolviera algo solo podría estar
 * devolviendo un invento, que es exactamente lo que hacía. Mientras no haya
 * modelo detrás, la pestaña explica qué falta y ofrece las dos vías que sí
 * miden de verdad.
 */
function PlateReader({ onBuscar }: { onBuscar?: () => void }) {
  return (
    <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={s.visorPlano}>
        <Bracket color={CT.edge} inset={14} len={22} />
        <ZIcon name="aperture" size={40} color={CT.ink4} weight={1.5} />
        <Text style={s.planoTxt}>Todavía no sé leer un plato</Text>
      </View>

      <View style={s.explica}>
        <Text style={s.explicaTxt}>
          Reconocer la comida de una foto y calcular sus macros necesita un modelo
          de visión que aún no está conectado. Hasta que lo esté, esta pestaña no
          va a devolver un número: prefiero decírtelo a darte una cifra inventada
          que acabaría en tu diario mezclada con las buenas.
        </Text>
      </View>

      <View style={{ paddingHorizontal: 18, paddingTop: 20 }}>
        <Text style={legend}>Mientras tanto</Text>
      </View>

      {onBuscar && (
        <Tap onPress={onBuscar} scaleTo={0.98}>
          <View style={s.salida}>
            <ZIcon name="arrowRight" size={14} color={CT.ink} weight={1.9} />
            <Text style={s.salidaTxt}>Buscar el alimento por nombre</Text>
          </View>
        </Tap>
      )}
    </ScrollView>
  )
}

// ── Ficha de resultado ────────────────────────────────────────────────────────

/**
 * La ficha ya no lleva semáforo de salud.
 *
 * El verde/amarillo/rojo salía de una lista de palabras clave («refresco» es
 * rojo, «pollo» es verde) que ni el catálogo ni el servidor conocen: era una
 * opinión de la app disfrazada de dato del producto. En su sitio va la
 * procedencia real —el sello y el nombre de la fuente— que es información que
 * sí existe y que además dice cuánto fiarse de los macros de al lado.
 *
 * ── La fuente se enseña aunque no esté verificada ───────────────────────────
 * Antes esta línea solo aparecía con `verified`, y los productos de Open Food
 * Facts —que son justo los que devuelve el escáner— entraban sin decir de dónde
 * salían. Dos motivos para cambiarlo: su licencia ODbL exige citar la fuente, y
 * unos macros que escribe cualquiera con el móvil en el súper merecen leerse
 * distinto de los de una tabla oficial. El sello se queda para las oficiales.
 */
function ResultCard({ food, onCommit }: { food: Food; onCommit: (e: FoodEntry) => void }) {
  const amount = food.defaultAmount
  const unit = food.defaultUnit
  const macros = scaleMacros(food.per100, amount, unit, food.gramsPerPiece)

  const commit = () => onCommit({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    name: food.name,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    fiber: macros.fiber,
    amount,
    unit,
    active: true,
    emoji: food.emoji,
  })

  return (
    <View style={s.card}>
      <View style={s.cardStripe} />

      <View style={s.cardHead}>
        {/* La foto del envase, cuando la fuente la trae: reconocer el producto
            de un vistazo es lo que confirma que se leyó el código correcto. */}
        {food.imageUrl
          ? <Image source={{ uri: food.imageUrl }} style={s.cardFoto} />
          : <View style={s.cardEmoji}><Text style={{ fontSize: 22 }}>{food.emoji}</Text></View>}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.cardTitle} numberOfLines={2}>{food.name}</Text>
          {!!food.brand && <Text style={s.cardSub}>{food.brand}</Text>}
          {!!food.sourceLabel && (
            <View style={s.fuente}>
              {food.verified && <VerifiedSeal size={12} color={CT.ink} checkColor={CT.panelHot} />}
              <Text style={s.fuenteTxt} numberOfLines={1}>{food.sourceLabel}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.cardBody}>
        <View>
          <Text style={[numeral, { fontSize: 30, lineHeight: 33 }]}>{macros.calories}</Text>
          <Text style={legend}>kcal · {fmtQty(amount, unit)}</Text>
        </View>
        <View style={s.cardMacros}>
          {([['P', macros.protein], ['C', macros.carbs], ['G', macros.fat]] as const).map(([k, v]) => (
            <View key={k} style={s.cardMacro}>
              <Text style={s.cardMacroVal}>{Math.round(v)}</Text>
              <Text style={s.cardMacroKey}>{k}</Text>
            </View>
          ))}
        </View>
      </View>

      <Tap onPress={commit} haptic="medium" scaleTo={0.98}>
        <View style={s.cardCta}>
          <ZIcon name="check" size={15} color="#fff" weight={2.2} />
          <Text style={s.cardCtaTxt}>Añadir a la comida</Text>
        </View>
      </Tap>
    </View>
  )
}

// ── Medidas del visor ─────────────────────────────────────────────────────────

const VISOR_ALTO = 268
/** Márgenes del escudo. La ventana es lo que queda libre en el centro. */
const ESCUDO_V = 62
const ESCUDO_H = 30
const ESCUDO = 'rgba(5,5,6,0.62)'

const s = StyleSheet.create({
  scroll: { paddingBottom: 28 },

  // Visor con cámara
  visor: {
    height: VISOR_ALTO, marginHorizontal: 18, marginTop: 14,
    borderRadius: CT.r.md, overflow: 'hidden', backgroundColor: '#000',
  },
  escudoArriba: { position: 'absolute', top: 0, left: 0, right: 0, height: ESCUDO_V, backgroundColor: ESCUDO },
  escudoAbajo:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: ESCUDO_V, backgroundColor: ESCUDO },
  escudoIzq:    { position: 'absolute', top: ESCUDO_V, bottom: ESCUDO_V, left: 0, width: ESCUDO_H, backgroundColor: ESCUDO },
  escudoDer:    { position: 'absolute', top: ESCUDO_V, bottom: ESCUDO_V, right: 0, width: ESCUDO_H, backgroundColor: ESCUDO },
  ventana: {
    position: 'absolute', top: ESCUDO_V, bottom: ESCUDO_V, left: ESCUDO_H, right: ESCUDO_H,
  },
  barrido: {
    position: 'absolute', left: 6, right: 6, height: 1.5,
    backgroundColor: CT.signal,
    shadowColor: CT.signal, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 },
  },
  linterna: {
    position: 'absolute', top: 12, right: 12,
    width: 34, height: 34, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  linternaOn: { backgroundColor: CT.ink },
  pieVisor: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' },
  pieFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pieTxt: {
    fontSize: 11.5, color: CT.ink2, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 4,
  },

  // Visor sin cámara
  visorPlano: {
    minHeight: 168, marginHorizontal: 18, marginTop: 14, padding: 20,
    borderRadius: CT.r.md, backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center', justifyContent: 'center', gap: 9, overflow: 'hidden',
  },
  planoTxt: { fontSize: 12.5, color: CT.ink2, fontWeight: '700', textAlign: 'center' },
  planoNota: { fontSize: 11, color: CT.ink3, textAlign: 'center', lineHeight: 16, paddingHorizontal: 8 },
  planoBtn: {
    height: 40, paddingHorizontal: 20, borderRadius: CT.r.sm, marginTop: 4,
    alignItems: 'center', justifyContent: 'center', backgroundColor: CT.signal,
  },
  planoBtnTxt: { fontSize: 12.5, fontWeight: '800', color: '#fff' },

  alterna: {
    height: 40, marginHorizontal: 18, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderRadius: CT.r.sm, backgroundColor: CT.panel,
  },
  alternaTxt: { fontSize: 11.5, fontWeight: '700', color: CT.ink3 },

  entry: { flexDirection: 'row', gap: 8, marginHorizontal: 18, marginTop: 10 },
  entryInput: {
    flex: 1, height: 44, paddingHorizontal: 13, borderRadius: CT.r.sm,
    backgroundColor: CT.panel, color: CT.ink, fontSize: 13.5,
    fontVariant: ['tabular-nums'],
  },
  entryBtn: {
    width: 46, height: 44, borderRadius: CT.r.sm, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  entryBtnOff: { opacity: 0.4 },

  // Aportar
  aportarCta: {
    height: 48, marginHorizontal: 18, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: CT.r.sm, backgroundColor: CT.signal,
  },
  aportarCtaTxt: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  aportarCabecera: { paddingHorizontal: 18, paddingTop: 14, gap: 4 },
  aportarTitulo: { fontSize: 17, fontWeight: '800', color: CT.ink, letterSpacing: -0.3 },
  aportarNota: { fontSize: 11.5, color: CT.ink3, lineHeight: 16.5, marginTop: 2 },

  etiqueta: {
    height: 190, marginHorizontal: 18, marginTop: 12,
    borderRadius: CT.r.md, overflow: 'hidden', backgroundColor: '#000',
    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12,
  },
  disparador: {
    height: 40, paddingHorizontal: 18, borderRadius: CT.r.pill,
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: CT.ink,
  },
  disparadorTxt: { fontSize: 12.5, fontWeight: '800', color: '#0A0A0D' },
  etiquetaOtra: {
    width: 36, height: 36, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },

  aportarCampos: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 14 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 18, paddingTop: 8 },
  celda: { flexGrow: 1, flexBasis: '30%', minWidth: 96 },

  campoLblFila: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  campoLbl: {
    fontSize: 8.5, fontWeight: '800', letterSpacing: 1.3,
    color: CT.ink4, textTransform: 'uppercase',
  },
  obligatorio: { width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: CT.signal },
  campoCaja: {
    height: 44, paddingHorizontal: 12, borderRadius: CT.r.sm,
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: CT.panel,
  },
  campoTxt: { flex: 1, minWidth: 0, fontSize: 14.5, color: CT.ink, padding: 0 },
  campoSuf: { fontSize: 9, fontWeight: '800', color: CT.ink4, letterSpacing: 0.5 },

  chequeo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 9,
    marginHorizontal: 18, marginTop: 12, padding: 11,
    borderRadius: CT.r.sm, backgroundColor: CT.signalWash,
    borderWidth: 1, borderColor: CT.signalEdge,
  },
  chequeoError: { backgroundColor: 'rgba(255,31,61,0.16)' },
  chequeoTxt: { flex: 1, fontSize: 11.5, color: CT.ink2, lineHeight: 16 },

  explica: { paddingHorizontal: 18, paddingTop: 14 },
  explicaTxt: { fontSize: 12.5, lineHeight: 19, color: CT.ink3 },

  salida: {
    height: 44, marginHorizontal: 18, marginTop: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: CT.r.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: CT.edge,
    backgroundColor: CT.panel,
  },
  salidaTxt: { fontSize: 12.5, fontWeight: '700', color: CT.ink },

  card: {
    marginHorizontal: 18, marginTop: 16, borderRadius: CT.r.md,
    backgroundColor: CT.panelHot, overflow: 'hidden',
  },
  cardStripe: { height: 2.5, width: '100%', backgroundColor: CT.signal },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, paddingBottom: 10 },
  cardFoto: { width: 52, height: 52, borderRadius: CT.r.xs, backgroundColor: CT.panel },
  cardEmoji: {
    width: 52, height: 52, borderRadius: CT.r.xs, backgroundColor: CT.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 14.5, fontWeight: '800', color: CT.ink, lineHeight: 19 },
  cardSub: { fontSize: 11, color: CT.ink3, marginTop: 3 },
  fuente: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 },
  fuenteTxt: { fontSize: 9.5, fontWeight: '700', color: CT.ink4, letterSpacing: 0.2 },

  cardBody: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: 14,
  },
  cardMacros: { flexDirection: 'row', gap: 8 },
  cardMacro: {
    width: 42, height: 42, borderRadius: CT.r.xs, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardMacroVal: { fontSize: 13.5, fontWeight: '800', color: CT.ink, fontVariant: ['tabular-nums'] },
  cardMacroKey: { fontSize: 8.5, fontWeight: '800', color: CT.ink3, letterSpacing: 0.6 },

  cardCta: {
    height: 46, margin: 14, marginTop: 0, borderRadius: CT.r.sm, backgroundColor: CT.signal,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  cardCtaTxt: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
})

/**
 * IMAGEN · LA CACHÉ QUE FALTABA
 * ─────────────────────────────
 * Reemplazo directo del `Image` de expo-image. Se importa igual y se usa igual;
 * lo único que hace de más es darle a cada foto una CLAVE DE CACHÉ ESTABLE.
 *
 * ── El fallo que arregla ────────────────────────────────────────────────────
 * Los medios viven en un bucket privado y llegan con la dirección firmada. Esa
 * firma lleva la hora dentro, así que la MISMA foto llega hoy como
 *
 *     …/library/poster/press-banca.jpg?X-Amz-Date=20260822T090000Z&X-Amz-Signature=a1b2…
 *
 * y dentro de un minuto como `…?X-Amz-Date=20260822T090100Z&X-Amz-Signature=9f8e…`.
 *
 * expo-image guarda en disco usando la dirección ENTERA como clave. Dos firmas
 * distintas son dos claves distintas, así que la caché no acertaba NUNCA: cada
 * vez que se abría una pantalla, todas sus miniaturas se descargaban otra vez
 * desde cero. Medido contra el bucket real: un póster pesa 7 KB pero cuesta
 * entre 200 y 1000 ms de ida y vuelta. Una rejilla de 24 miniaturas pagaba esa
 * espera entera en cada visita, y por eso «las imágenes no cargan».
 *
 * ── Por qué la RUTA sirve de clave y la firma no ────────────────────────────
 * De esa dirección, lo que identifica al archivo es la ruta; lo que cambia es
 * el interrogante. Quitando el interrogante queda `library/poster/press-banca.jpg`,
 * que es el mismo archivo hoy, mañana y en la sesión siguiente. Se descarga una
 * vez y se lee del disco para siempre.
 *
 * ── Y no puede enseñar una foto vieja por otra ──────────────────────────────
 * La duda razonable es: si la clave ya no cambia, ¿qué pasa cuando alguien se
 * cambia el avatar? Que se ve el nuevo. Cada archivo que se sube estrena una
 * ruta con identificador aleatorio (`avatar/<usuario>/<uuid>.jpg`, lo pone
 * `newKey` en el backend), así que una foto nueva es una ruta nueva y por tanto
 * una clave nueva. Nunca se reescribe una ruta con contenido distinto, que es
 * el único caso en el que esto serviría rancio.
 *
 * ── Lo que NO toca ──────────────────────────────────────────────────────────
 * Las imágenes del propio paquete (`require(...)`) y las de la galería del
 * teléfono (`file://`) se dejan intactas: ya viven en disco y no hay ida y
 * vuelta que ahorrar.
 */

import { forwardRef, memo, useMemo } from 'react'
import { Image as ImagenExpo, type ImageProps, type ImageSource } from 'expo-image'

/**
 * La parte de una dirección que identifica al archivo, sin la firma.
 *
 * Se hace a mano y no con `new URL()` porque en Hermes construir una URL por
 * cada miniatura de una lista larga es trabajo que no hace falta: aquí basta
 * con cortar por el primer interrogante y por la almohadilla.
 */
export function claveDeCache(uri: string): string | undefined {
  // Las que no son de red no necesitan clave: expo-image ya las resuelve bien.
  if (!/^https?:\/\//i.test(uri)) return undefined

  const sinAncla = uri.split('#')[0]
  const ruta = sinAncla.split('?')[0]

  // Una ruta vacía o rarísima: mejor dejar que expo-image use la dirección
  // entera, que es el comportamiento de siempre, que inventarse una clave.
  if (!ruta || ruta.length < 8) return undefined

  return ruta
}

/** Le pone la clave estable a una fuente, sea cual sea la forma en que venga. */
function conClave(source: ImageProps['source']): ImageProps['source'] {
  if (typeof source === 'string') {
    const clave = claveDeCache(source)
    return clave ? { uri: source, cacheKey: clave } : source
  }

  if (Array.isArray(source)) {
    return source.map(s => conClave(s as ImageProps['source'])) as ImageProps['source']
  }

  if (source && typeof source === 'object') {
    const s = source as ImageSource
    // Si quien llama ya puso su propia clave, manda la suya.
    if (!s.uri || s.cacheKey) return source
    const clave = claveDeCache(s.uri)
    return clave ? { ...s, cacheKey: clave } : source
  }

  return source
}

/**
 * `memory-disk` a propósito y no el `disk` de fábrica.
 *
 * Con solo disco, volver a una pantalla que ya se vio implica leer y descifrar
 * el archivo otra vez. Guardando además el mapa de bits ya montado en memoria,
 * volver a una pantalla vista hace un momento no cuesta nada. La memoria la
 * gestiona expo-image y la suelta sola cuando el sistema aprieta.
 */
const ImagenBase = forwardRef<
  React.ComponentRef<typeof ImagenExpo>,
  ImageProps
>(function Imagen({ source, cachePolicy = 'memory-disk', ...resto }, ref) {
  /**
   * La fuente se recalcula solo cuando cambia la DIRECCIÓN, no en cada render.
   *
   * Casi todas las llamadas escriben `source={{ uri: algo }}` en el propio JSX,
   * y eso construye un objeto nuevo cada vez que el componente se dibuja. Para
   * expo-image un objeto nuevo es una fuente nueva, así que en una lista que se
   * repinta —al hacer scroll, al llegar un dato— se ponía a reevaluar imágenes
   * que no habían cambiado.
   *
   * La dependencia es la dirección en texto, que sí es estable, y no el objeto.
   */
  const identidad = typeof source === 'string'
    ? source
    : Array.isArray(source)
      ? source.map(x => (typeof x === 'object' && x && 'uri' in x ? x.uri : String(x))).join('|')
      : source && typeof source === 'object'
        ? ((source as ImageSource).uri ?? '')
        : String(source ?? '')

  // `source` fuera de las dependencias a propósito: `identidad` ya resume lo
  // único que puede cambiar de él, y meterlo anularía justo lo que se busca.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fuente = useMemo(() => conClave(source), [identidad])

  return <ImagenExpo ref={ref} source={fuente} cachePolicy={cachePolicy} {...resto} />
})

/**
 * Y memoizada, porque casi siempre vive dentro de una lista.
 *
 * Una miniatura no depende de nada más que de sus props: si el padre se
 * repinta por otro motivo —un contador que sube, un dato que llega— no hay
 * ninguna razón para volver a montar cuarenta imágenes que siguen igual.
 */
export const Image = memo(ImagenBase)

export type { ImageProps, ImageSource }
export default Image

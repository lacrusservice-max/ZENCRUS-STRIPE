/**
 * IMÁGENES DE ENTRENA
 * ───────────────────
 * Las fotografías de portada de la sección. Ocho, tratadas todas con el mismo
 * duotono de marca.
 *
 * ── VAN EMPAQUETADAS, no en R2 ──────────────────────────────────────────────
 * Los medios de la comunidad viven en el bucket con URL firmadas de una hora,
 * y eso es correcto para lo que sube la gente. Estas son otra cosa:
 *
 *   · Son de MARCA, no de nadie. No cambian entre despliegues.
 *   · Se ven en la PRIMERA pantalla. Con URL firmada habría que pedir el enlace
 *     al servidor y luego la imagen, y la portada estaría en gris mientras
 *     tanto, cada vez que se abre la app.
 *   · Funcionan sin cobertura, que es medio gimnasio.
 *
 * Son 688 KB en total para las ocho, ya optimizadas y progresivas. Ese peso en
 * el paquete se paga una vez al instalar; el otro camino se paga en cada
 * arranque y encima falla sin red.
 *
 * ── DE DÓNDE SALEN Y CON QUÉ LICENCIA ───────────────────────────────────────
 * Buscadas en Openverse (el buscador de Creative Commons) y filtradas a **cc0 y
 * dominio público**: son las únicas dos que NO obligan a poner el crédito
 * visible. Una CC-BY exigiría el nombre del autor en la propia pantalla donde
 * sale la foto, y eso no se sostiene en una tarjeta de portada de una app de
 * pago. La procedencia de cada una queda anotada abajo por si algún día hay que
 * justificarla.
 *
 * ── Y por qué están teñidas ─────────────────────────────────────────────────
 * El problema de las fotos de licencia libre no es la calidad de cada una: es
 * que vienen de sitios distintos y juntas parecen un collage. Todas pasan por
 * el mismo mapa de gradiente —negro en las sombras, rojo de marca solo en las
 * luces altas— así que una foto de un gimnasio con fluorescentes y una de una
 * montaña nevada acaban en la misma escala. El script está en
 * `scratchpad/procesar.py` del día que se hicieron.
 */

import { ImageSourcePropType } from 'react-native'

export interface FotoEntrena {
  fuente: ImageSourcePropType
  /** Para el aviso legal, si algún día se quiere enseñar. */
  licencia: 'cc0' | 'pdm'
  origen: string
}

export const FOTOS: Record<string, FotoEntrena> = {
  gimnasio: {
    fuente: require('../../assets/entrena/gimnasio.jpg'),
    licencia: 'cc0',
    origen: 'https://www.flickr.com/photos/61765479@N08/9501241824',
  },
  fuerza: {
    fuente: require('../../assets/entrena/fuerza.jpg'),
    licencia: 'cc0',
    origen: 'https://www.rawpixel.com/image/5926278',
  },
  brazos: {
    fuente: require('../../assets/entrena/brazos.jpg'),
    licencia: 'pdm',
    origen: 'https://www.flickr.com/photos/140191733@N05/27001074737',
  },
  casa: {
    fuente: require('../../assets/entrena/casa.jpg'),
    licencia: 'cc0',
    origen: 'https://www.rawpixel.com/image/5921924',
  },
  aireLibre: {
    fuente: require('../../assets/entrena/aire-libre.jpg'),
    licencia: 'pdm',
    origen: 'https://www.flickr.com/photos/107640324@N05/11951675515',
  },
  montana: {
    fuente: require('../../assets/entrena/montana.jpg'),
    licencia: 'cc0',
    origen: 'https://www.flickr.com/photos/136375272@N05/21918341563',
  },
  rio: {
    fuente: require('../../assets/entrena/rio.jpg'),
    licencia: 'pdm',
    origen: 'https://www.flickr.com/photos/135886671@N08/33499514020',
  },
  movilidad: {
    fuente: require('../../assets/entrena/movilidad.jpg'),
    licencia: 'cc0',
    origen: 'https://stocksnap.io/photo/XUK1TN40FB',
  },
}

/**
 * Qué foto le toca a cada región del cuerpo.
 *
 * Fija y no aleatoria: la tarjeta de «Pecho» tiene que ser siempre la misma
 * imagen. Si cambiara, se perdería el reconocimiento —la gente vuelve a un
 * sitio por su aspecto antes que por su nombre— y la app parecería inestable.
 */
export const FOTO_REGION: Record<string, keyof typeof FOTOS> = {
  fullbody: 'gimnasio',
  upper: 'brazos',
  arms: 'brazos',
  chest: 'gimnasio',
  legs: 'fuerza',
  back: 'fuerza',
  shoulders: 'gimnasio',
  core: 'casa',
}

/** Y a cada modo de entrenar. */
export const FOTO_MODO: Record<string, keyof typeof FOTOS> = {
  gym: 'gimnasio',
  home: 'casa',
  outdoor: 'aireLibre',
  class: 'movilidad',
}

export const fotoDe = (clave: string | undefined): ImageSourcePropType | undefined =>
  clave ? FOTOS[clave]?.fuente : undefined

/**
 * ZENCRUS — MÉTRICA DE COMPOSICIÓN
 * ────────────────────────────────
 * Alturas declaradas de cada banda fija de la interfaz.
 *
 * Existe por una razón concreta: en React Native una banda sin altura
 * declarada dentro de un contenedor flex se estira hasta ocupar el espacio
 * sobrante, y un `ScrollView` horizontal sin `flexGrow: 0` arrastra a sus
 * hijos con él. Ese es exactamente el defecto que deformaba el selector de
 * comidas. Declarando la métrica en un solo sitio, ninguna banda puede
 * crecer sola y los cálculos de separación dejan de ser números mágicos
 * repartidos por los estilos.
 *
 * Regla de composición: toda banda fija declara `height`; el panel de
 * contenido lleva `flex: 1` **y** `minHeight: 0` para poder encogerse.
 */

/** Bandas fijas de la consola de alimentos. */
export const Band = {
  /** Cabecera con retorno, título e instrumento de presupuesto. */
  header: 62,
  /** Riel de métodos de captura con indicador deslizante. */
  rail: 58,
  /** Selector de comida destino. */
  target: 44,
  /** Pie con la acción principal (sin contar el safe-area inferior). */
  footer: 76,
  /** Barra de progreso de etapa. */
  progress: 3,
} as const

/** Barra de pestañas flotante de la app. */
export const TabBar = {
  /** Alto real de la píldora: 10+32+3+11 de contenido + 10 de padding. */
  pill: 74,
  /** Separación de la píldora respecto al borde inferior seguro. */
  lift: 6,
  /**
   * Espacio que cualquier scroll de pestaña debe reservar al final para que
   * su último elemento no quede bajo la píldora flotante.
   */
  scrollInset: 74 + 6 + 28,
} as const

/**
 * El botón flotante de la esquina superior derecha, en todas las pantallas.
 *
 * Se llama `BotonIA` porque durante mucho tiempo ese botón fue ZENA. Desde el
 * rediseño de la barra, ZENA vive en la píldora de abajo —elevada y en el
 * eje— y esta esquina la ocupa el acceso al perfil (`BotonPerfil`), que salió
 * de la barra para hacerle sitio. Las medidas no cambian: es el mismo hueco.
 *
 * `reserva` es lo que cualquier cabecera con acciones propias tiene que dejar
 * libre en esa esquina. Sin ello los dos botones se pisan y el de abajo deja
 * de poder tocarse — pasaba en Social, donde caía justo sobre la foto de
 * perfil.
 */
export const BotonIA = {
  /** Diámetro del círculo. */
  size: 40,
  /** Separación respecto al borde derecho. */
  gap: 16,
  /** Lo que debe reservar una cabecera con acciones a la derecha. */
  reserva: 44,
  /**
   * Lo que hay que reservar cuando TAMBIÉN flota el icono de racha.
   *
   * `reserva` es de cuando el botón de la esquina era el único elemento
   * flotante. El icono de
   * racha se añadió después, a su izquierda (`IconoRacha`: `right = gap + size
   * + 10`), y se pinta en `_layout.tsx` sobre TODAS las pantallas. Una cabecera
   * que solo reserve 44 pone su botón justo debajo de la racha o de ZENA, y el
   * botón deja de poder tocarse aunque se siga viendo — que es exactamente lo
   * que pasaba con el acceso al historial en la portada de Entrena.
   *
   * El ancho de la racha varía con las cifras (1 día vs 365), así que esto
   * cubre el caso de tres dígitos con aire.
   */
  reservaConRacha: 118,
} as const

/** Ritmo vertical de los bloques de contenido. */
export const Rhythm = {
  gutter: 20,
  block: 26,
  card: 12,
} as const

/** Duraciones de transición, en ms. Coherentes con `Animation` del tema. */
export const Motion = {
  /** Cambio de método dentro de una misma etapa. */
  swap: 190,
  /** Avance o retroceso entre etapas. */
  stage: 300,
  /** Realimentación de pulsación. */
  tap: 110,
} as const

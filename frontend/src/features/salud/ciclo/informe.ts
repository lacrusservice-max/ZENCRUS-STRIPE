/**
 * EL INFORME PARA CONSULTA
 * ═══════════════════════════════════════════════════════════════════════════
 * Lo que registró, ordenado para que alguien lo lea en treinta segundos y sepa
 * de qué hablar. Lógica pura: entra el historial y sale una estructura, y
 * aparte se convierte en HTML imprimible.
 *
 * ── Solo lo OBSERVADO. Ninguna predicción ──────────────────────────────────
 * Es la decisión que da forma a todo lo demás y la que más cuesta sostener,
 * porque la predicción es lo más vistoso que tiene la app. Pero un documento
 * con pinta de informe se lee como un informe: una fecha estimada impresa en
 * la misma hoja que las medidas reales acaba tratada como un hallazgo, y no lo
 * es. Aquí van los días que ella marcó, los ciclos que salen de ellos y las
 * temperaturas que se tomó. Nada más.
 *
 * ── Se distingue lo que ella declaró de lo que dedujo la app ───────────────
 * En la tabla de ciclos, cada inicio dice si lo escribió ella o lo dedujo el
 * sistema del sangrado. Parece un detalle y no lo es: un inicio deducido puede
 * estar un día desplazado si se saltó el registro del primer día, y quien vaya
 * a decidir algo sobre esas fechas tiene derecho a saber cuáles son medidas y
 * cuáles reconstrucciones. Ninguna app de las grandes lo dice.
 *
 * ── Y dice lo que NO es ────────────────────────────────────────────────────
 * Arriba del todo, no enterrado al final en letra pequeña: son datos que se
 * apuntó a sí misma en el teléfono, no una historia clínica, y ninguna cifra
 * de aquí es un diagnóstico. Un papel que se imprime y se lleva a una consulta
 * hereda la autoridad del sitio donde se enseña; si no dice de dónde viene, se
 * la queda prestada.
 */

import type { Periodo } from './periodos'
import type { Estadisticas, Regularidad } from './prediccion'
import type { Anomalia } from './anomalias'
import type { LecturaTemperatura } from './temperatura'

export const REGULARIDAD_ET: Record<Regularidad, string> = {
  sin_datos: 'sin datos suficientes',
  muy_regular: 'muy regular',
  regular: 'regular',
  algo_irregular: 'algo irregular',
  irregular: 'irregular',
}

export interface FilaCiclo {
  inicio: string
  fin: string | null
  diasSangrado: number
  /** `null` en el último: aún no ha empezado el siguiente. */
  duracion: number | null
  declarado: boolean
}

export interface FilaSintoma {
  etiqueta: string
  dias: number
  /** Días con registro sobre los que se cuenta. */
  de: number
}

export interface Informe {
  /** `YYYY-MM-DD` del día en que se genera. */
  generado: string
  nombre: string | null
  /** Primer y último día con algún dato. `null` si no hay ninguno. */
  desde: string | null
  hasta: string | null
  modo: string
  anticonceptivo: string | null
  diasRegistrados: number
  resumen: {
    ciclos: number
    usados: number
    media: number | null
    desviacion: number | null
    masCorto: number | null
    masLargo: number | null
    mediaSangrado: number | null
    regularidad: string
  }
  ciclos: FilaCiclo[]
  sintomas: FilaSintoma[]
  /** Lo que la app marcó como digno de comentarse, con su pregunta. */
  senales: { mensaje: string; pregunta: string | null; consulta: boolean }[]
  temperatura: { fecha: string; celsius: number }[]
  /** El cambio térmico sostenido, si las lecturas lo muestran. */
  cambioTermico: { fechaOvulacion: string; salto: number } | null
}

export interface EntradaInforme {
  hoy: string
  nombre: string | null
  modo: string
  anticonceptivo: string | null
  periodos: Periodo[]
  estadisticas: Estadisticas
  anomalias: Anomalia[]
  /** Días con algún registro, ordenados. */
  fechasRegistradas: string[]
  sintomas: FilaSintoma[]
  temperatura: LecturaTemperatura[]
  /**
   * El cambio térmico ya detectado por `detectarCambioTermico`.
   *
   * Entra calculado y no se calcula aquí para que este módulo siga siendo
   * traducción pura: quien monta la entrada ya tiene el motor a mano.
   */
  cambioTermico?: { fechaOvulacion: string; salto: number } | null
}

export function construirInforme(e: EntradaInforme): Informe {
  const fechas = [...e.fechasRegistradas].sort()

  return {
    generado: e.hoy,
    nombre: e.nombre,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
    modo: e.modo,
    anticonceptivo: e.anticonceptivo,
    diasRegistrados: fechas.length,
    resumen: {
      ciclos: e.estadisticas.ciclos,
      usados: e.estadisticas.usados,
      media: e.estadisticas.media,
      desviacion: e.estadisticas.desviacion,
      masCorto: e.estadisticas.masCorto,
      masLargo: e.estadisticas.masLargo,
      mediaSangrado: e.estadisticas.mediaSangrado,
      regularidad: REGULARIDAD_ET[e.estadisticas.regularidad],
    },
    /* Del más reciente al más antiguo: quien lo lee en una consulta empieza
       por lo de ahora, no por lo de hace ocho meses. */
    ciclos: [...e.periodos].reverse().map(p => ({
      inicio: p.inicio,
      fin: p.fin,
      diasSangrado: p.diasSangrado,
      duracion: p.duracionCiclo,
      declarado: p.declarado,
    })),
    sintomas: e.sintomas,
    /* Las de `consulta` primero: son las que traen pregunta y las que
       justifican que el papel exista. */
    senales: [...e.anomalias]
      .sort((a, b) => Number(b.nivel === 'consulta') - Number(a.nivel === 'consulta'))
      .map(a => ({
        mensaje: a.mensaje,
        pregunta: a.pregunta ?? null,
        consulta: a.nivel === 'consulta',
      })),
    temperatura: e.temperatura.map(l => ({ fecha: l.fecha, celsius: l.celsius })),
    cambioTermico: e.cambioTermico ?? null,
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   El HTML imprimible
   ═══════════════════════════════════════════════════════════════════════════ */

/** Escapa lo que venga del registro: un nombre con `&` no puede romper la hoja. */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** `2026-08-27` → `27 de agosto de 2026`. Sin `Date`, que se va de zona. */
export function fechaLarga(f: string): string {
  const [a, m, d] = f.split('-').map(Number)
  return `${d} de ${MESES[m - 1] ?? '?'} de ${a}`
}

const corta = (f: string): string => {
  const [, m, d] = f.split('-').map(Number)
  return `${d}/${m}`
}

/**
 * Un número, con coma decimal.
 *
 * El documento está en español y lo va a leer alguien en una consulta: «28.8
 * días» es un número escrito en otro idioma, y en una tabla de cifras el punto
 * se lee como separador de millares antes que como decimal.
 */
const num = (n: number | null, sufijo = '', dec = 1): string =>
  n === null ? '—' : `${n.toFixed(dec).replace('.', ',')}${sufijo}`

/**
 * La curva de temperatura, en SVG dentro del HTML.
 *
 * Sin librería y sin imagen: el generador de PDF renderiza SVG, y una gráfica
 * dibujada con dos bucles pesa menos y se imprime más nítida que un PNG. La
 * escala NO empieza en cero —entre 36,2 y 36,9 hay siete décimas y desde cero
 * serían siete líneas planas—, y por eso el eje lleva sus valores escritos.
 */
function svgTemperatura(
  xs: { fecha: string; celsius: number }[], marca: string | null = null,
): string {
  if (xs.length < 2) return ''
  const W = 720, H = 200, P = 34
  const vals = xs.map(x => x.celsius)
  const min = Math.min(...vals) - 0.1
  const max = Math.max(...vals) + 0.1
  const rango = Math.max(0.2, max - min)

  const px = (i: number) => P + (i / (xs.length - 1)) * (W - P * 2)
  const py = (v: number) => H - P - ((v - min) / rango) * (H - P * 2)

  const linea = xs.map((x, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(x.celsius).toFixed(1)}`).join(' ')
  const puntos = xs.map((x, i) =>
    `<circle cx="${px(i).toFixed(1)}" cy="${py(x.celsius).toFixed(1)}" r="2.4" fill="#6C4FD9"/>`).join('')

  /* Cuatro marcas en el eje, y las fechas solo en los extremos: con una
     etiqueta por lectura se solapan en cuanto hay más de tres semanas. */
  const marcas = [0, 1, 2, 3].map(k => {
    const v = min + (rango * k) / 3
    const y = py(v).toFixed(1)
    return `<line x1="${P}" y1="${y}" x2="${W - P}" y2="${y}" stroke="#E8E3F2" stroke-width="1"/>`
      + `<text x="6" y="${Number(y) + 3.5}" font-size="10" fill="#8A80A6">${v.toFixed(2).replace('.', ',')}</text>`
  }).join('')

  /* La vertical del cambio térmico. Se dibuja detrás de la curva para que no
     la tape, y solo si esa fecha está entre las lecturas: una marca fuera del
     eje sería una línea suelta sin explicación. */
  const iMarca = marca ? xs.findIndex(x => x.fecha === marca) : -1
  const vertical = iMarca >= 0
    ? `<line x1="${px(iMarca).toFixed(1)}" y1="${P - 8}" x2="${px(iMarca).toFixed(1)}" y2="${H - P + 4}"
             stroke="#B49CE8" stroke-width="1.4" stroke-dasharray="4 3"/>`
    : ''

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">
    ${marcas}
    ${vertical}
    <path d="${linea}" fill="none" stroke="#6C4FD9" stroke-width="1.8"/>
    ${puntos}
    <text x="${P}" y="${H - 10}" font-size="10" fill="#8A80A6">${corta(xs[0].fecha)}</text>
    <text x="${W - P}" y="${H - 10}" font-size="10" fill="#8A80A6" text-anchor="end">${corta(xs[xs.length - 1].fecha)}</text>
  </svg>`
}

export function informeHTML(inf: Informe): string {
  const r = inf.resumen

  const periodo = inf.desde && inf.hasta
    ? `Del ${fechaLarga(inf.desde)} al ${fechaLarga(inf.hasta)}`
    : 'Sin datos registrados'

  const filas = inf.ciclos.map(c => `<tr>
      <td>${esc(fechaLarga(c.inicio))}</td>
      <td>${c.duracion === null ? '<i>en curso</i>' : `${c.duracion} días`}</td>
      <td>${c.diasSangrado} ${c.diasSangrado === 1 ? 'día' : 'días'}</td>
      <td class="fuente">${c.declarado ? 'lo indicó ella' : 'deducido del registro'}</td>
    </tr>`).join('')

  const sintomas = inf.sintomas.length
    ? `<table>
        <tr><th>Síntoma</th><th>Días</th><th>Frecuencia</th></tr>
        ${inf.sintomas.map(s => `<tr>
          <td>${esc(s.etiqueta)}</td>
          <td>${s.dias} de ${s.de}</td>
          <td>${s.de ? Math.round((s.dias / s.de) * 100) : 0} %</td>
        </tr>`).join('')}
      </table>
      <p class="pie">El porcentaje se calcula sobre los días que registró algo
      (${inf.diasRegistrados}), no sobre los días transcurridos.</p>`
    : '<p class="vacio">No registró síntomas en este periodo.</p>'

  const senales = inf.senales.length
    ? inf.senales.map(s => `<li${s.consulta ? ' class="consulta"' : ''}>
        ${esc(s.mensaje)}
        ${s.pregunta ? `<br><span class="pregunta">Para preguntar: ${esc(s.pregunta)}</span>` : ''}
      </li>`).join('')
    : '<li class="vacio">La app no marcó nada fuera de lo esperable.</li>'

  const ct = inf.cambioTermico
  const temp = inf.temperatura.length >= 2
    ? `<h2>Temperatura basal</h2>
       <p class="sub">${inf.temperatura.length} mediciones.</p>
       ${svgTemperatura(inf.temperatura, ct?.fechaOvulacion ?? null)}
       ${ct
      /* «Compatible con» y no «confirma»: la regla de las tres sobre seis es
         un indicio bueno y barato, no una prueba de ovulación. En un papel que
         se lee en una consulta, la diferencia entre esas dos palabras es la
         diferencia entre un dato y una conclusión que no nos toca sacar. */
      ? `<p class="pie">Se observa una subida sostenida de ${num(ct.salto, ' °C', 2)}
           respecto a la línea previa, compatible con una ovulación alrededor del
           ${esc(fechaLarga(ct.fechaOvulacion))} (marcada con la línea de puntos).</p>`
      : '<p class="pie">Las mediciones no muestran un cambio térmico sostenido en este periodo.</p>'}`
    : ''

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
  @page { margin: 20mm 16mm; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
         color: #1B1430; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 21px; margin: 0 0 2px; letter-spacing: -0.3px; }
  h2 { font-size: 14px; margin: 22px 0 6px; padding-bottom: 4px;
       border-bottom: 1px solid #E8E3F2; }
  .sub { color: #6B6383; margin: 0 0 10px; }
  .aviso { background: #F4F0FC; border-left: 3px solid #6C4FD9;
           padding: 10px 12px; margin: 14px 0 4px; color: #4A3F6B; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  /* Una fila partida por el salto de página deja media fecha arriba y media
     abajo, y un título huérfano al pie es peor que un hueco. */
  tr, li, svg { page-break-inside: avoid; }
  h2 { page-break-after: avoid; }
  th { text-align: left; font-size: 10px; text-transform: uppercase;
       letter-spacing: 0.4px; color: #6B6383; padding: 4px 6px 4px 0;
       border-bottom: 1px solid #E8E3F2; }
  td { padding: 5px 6px 5px 0; border-bottom: 1px solid #F2EFF8;
       vertical-align: top; }
  .fuente { color: #6B6383; font-size: 11px; }
  /* Rejilla de tres y no un flex que envuelve: con seis cifras y anchos
     mínimos, la última se caía sola a una fila propia y parecía un error de
     maquetación en un papel que se enseña en una consulta. */
  .cifras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 26px;
            margin: 8px 0 0; padding: 0; list-style: none; }
  .cifras li { margin: 0; }
  .cifras b { display: block; font-size: 17px; }
  .cifras span { color: #6B6383; font-size: 11px; }
  ul.senales { padding-left: 16px; margin: 6px 0 0; }
  ul.senales li { margin-bottom: 8px; }
  ul.senales li.consulta { font-weight: 600; }
  .pregunta { font-weight: 400; color: #4A3F6B; }
  .vacio, .pie { color: #6B6383; }
  .pie { font-size: 11px; margin-top: 4px; }
  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #E8E3F2;
           color: #6B6383; font-size: 11px; }
</style></head><body>

<h1>Registro del ciclo menstrual${inf.nombre ? ` · ${esc(inf.nombre)}` : ''}</h1>
<p class="sub">${esc(periodo)} · generado el ${fechaLarga(inf.generado)}</p>

<div class="aviso">
  Estos son datos que ${inf.nombre ? esc(inf.nombre) : 'la usuaria'} se apuntó
  a sí misma en una aplicación. No son una historia clínica, no los tomó ni los
  verificó ningún profesional, y ninguna cifra de este documento es un
  diagnóstico. <b>El informe no incluye ninguna predicción</b>: solo lo que
  quedó registrado.
</div>

<h2>Resumen</h2>
<ul class="cifras">
  <li><b>${r.ciclos}</b><span>ciclos completos</span></li>
  <li><b>${num(r.media, ' días')}</b><span>duración media${r.usados ? ` (sobre ${r.usados})` : ''}</span></li>
  <li><b>${num(r.desviacion, ' días')}</b><span>variación</span></li>
  <li><b>${r.masCorto === null || r.masLargo === null ? '—' : `${r.masCorto}–${r.masLargo}`}</b><span>rango</span></li>
  <li><b>${num(r.mediaSangrado, ' días')}</b><span>sangrado medio</span></li>
  <li><b>${esc(r.regularidad)}</b><span>regularidad</span></li>
</ul>
<p class="pie">Situación declarada: ${esc(inf.modo)}${
  inf.anticonceptivo ? ` · anticoncepción: ${esc(inf.anticonceptivo)}` : ''
}.</p>

<h2>Ciclos registrados</h2>
${inf.ciclos.length
    ? `<table>
        <tr><th>Inicio</th><th>Duración</th><th>Sangrado</th><th>Origen del inicio</th></tr>
        ${filas}
      </table>
      <p class="pie">«Deducido del registro» significa que la fecha sale de los
      días de sangrado que apuntó; si se saltó el primer día, puede estar
      desplazada.</p>`
    : '<p class="vacio">Todavía no hay ningún ciclo completo.</p>'}

<h2>Síntomas</h2>
${sintomas}

<h2>Lo que la app señaló</h2>
<ul class="senales">${senales}</ul>

${temp}

<footer>
  Generado en el teléfono por ZENCRUS. Los datos no salieron del dispositivo
  para hacer este documento.
</footer>
</body></html>`
}

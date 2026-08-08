"""
EXTRACTOR INCMNSZ v2 · por coordenadas
══════════════════════════════════════

Reemplaza al parser de texto plano. Todos los bloques —alineados o no— pasan
por la misma vía: cada columna de la tabla ocupa una franja horizontal marcada
por su unidad, y cada valor se asigna a la columna cuyo centro tiene más cerca.

Por qué así y no por posición en la línea: el texto plano no dice qué valor
falta cuando hay menos números que campos. El Ciricote trae 11 para 12 y sin
las coordenadas es imposible saber si sobra al principio o al final. Emparejar
a ciegas correría todo y metería el kJ en «porción comestible» sin que nada lo
delate. Las coordenadas eliminan la duda: si una franja se queda vacía, ese
nutriente falta y el resto conserva su sitio.
"""
import pdfplumber, re, json, hashlib, unicodedata, warnings
from collections import Counter
from cidmap import Decoder
warnings.filterwarnings('ignore')

SRC = '/Users/sergio/Desktop/APP C+E/LISTA ALIMENTARIA/TABLAS_ALIMENTOS.pdf'
def num(t):
    t = t.strip()
    if t in ('*','-',''): return None
    try: return float(t.replace(',', ''))
    except ValueError: return None
def slug(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii','ignore').decode()
    return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')

UNIT_ROWS = [
 (r'^\(%\)$', ['edible_pct','energy_kj','energy_kcal','water_g','ash_g','ether_extract_g',
   'fat_sat_g','fat_mono_g','fat_poly_g','cholesterol_mg','protein_g','carbs_g']),
 (r'^\(g\)$', ['sugar_g','fiber_crude_g','fiber_total_g','fiber_insol_g','calcium_mg',
   'phosphorus_mg','iron_mg','sodium_mg','potassium_mg','magnesium_mg',
   'copper_mg','zinc_mg','manganese_mg','selenium_mg','lithium_mg']),
 (r'^\(U\.I\.\)$', ['vitamin_a_iu','vitamin_a_mg_rae','carotenes_mg','beta_carotenes_mg',
   'vitamin_b1_mg','vitamin_b2_mg','niacin_mg','vitamin_c_mg','vitamin_b6_mg',
   'vitamin_b12_mg','folic_acid_mg','folate_mg_dfe','vitamin_d_mg']),
]

def rows_of(words, tol=2.5):
    rs = {}
    for w in words:
        k = next((k for k in rs if abs(k - w['top']) <= tol), None)
        rs.setdefault(k if k is not None else w['top'], []).append(w)
    return [(top, sorted(v, key=lambda w: w['x0'])) for top, v in sorted(rs.items())]

def unit_cells(row):
    """
    Reagrupa las palabras de la fila de unidades en celdas reales.

    Cada unidad va entre paréntesis, pero algunas ocupan dos palabras:
    «(mg RAE)» llega como «(mg» y «RAE)». Contarlas por separado hacía que la
    fila de vitaminas nunca cuadrara en número de columnas y el bloque entero
    se descartaba — se perdían B1, B2, B6, B12, D y los folatos de golpe.
    Se acumula hasta cerrar el paréntesis.
    """
    cells, buf = [], []
    for w in row:
        buf.append(w)
        if w['text'].rstrip().endswith(')'):
            cells.append({'x0': buf[0]['x0'], 'x1': buf[-1]['x1'],
                          'text': ' '.join(b['text'] for b in buf)})
            buf = []
    if buf: cells.append({'x0': buf[0]['x0'], 'x1': buf[-1]['x1'],
                          'text': ' '.join(b['text'] for b in buf)})
    return cells

def assign(unit_row, value_row, fields):
    unit_row = unit_cells(unit_row)
    if len(unit_row) != len(fields): return None
    centers = [(w['x0']+w['x1'])/2 for w in unit_row]
    span = (max(centers)-min(centers)) / max(len(centers)-1, 1)
    out, used = {}, set()
    for w in value_row:
        c = (w['x0']+w['x1'])/2
        best, bd = None, 1e9
        for i, cc in enumerate(centers):
            if i in used: continue
            d = abs(c-cc)
            if d < bd: best, bd = i, d
        if best is None or bd > span*0.75: return None   # duda → se descarta
        used.add(best); out[fields[best]] = num(w['text'])
    return out

# ── Nombre: por coordenadas, igual que los valores ────────────────────────────
# La cabecera «Tipo | Descripción alimento | Type | Food description | Nombre
# Científico» define cinco columnas. Antes el nombre se cortaba buscando una
# racha de mayúsculas dentro del texto ya aplanado, y eso fallaba de dos formas
# que no daban error:
#
#   · El inglés se quedaba pegado al español en 59 fichas
#     («Frijol, con carne de cerdo, Bean, with pork meat»).
#   · El nombre solo leía la primera línea, así que las continuaciones se
#     perdían: «Arroz, cocido» era en realidad «Arroz, cocido (blanco)» y
#     «Frijol, con carne de cerdo» era «... enlatado». Nombre truncado es
#     alimento equivocado.
#
# Las bandas horizontales resuelven ambas: cada palabra cae en su columna por
# su centro, y las líneas de continuación se acumulan en la columna que les toca.

HDR_CELLS = [('grupo_es', r'^Tipo\b'), ('nombre_es', r'^Descripci'),
             ('grupo_en', r'^Type\b'),  ('nombre_en', r'^Food\b'),
             ('cientifico', r'^Nombre\b')]

def cells_of(row, gap=20):
    """Agrupa palabras contiguas de una fila en celdas, cortando por hueco."""
    cells = []
    for w in row:
        if cells and w['x0'] - cells[-1]['x1'] <= gap:
            cells[-1]['x1'] = w['x1']; cells[-1]['text'] += ' ' + w['text']
        else:
            cells.append({'x0': w['x0'], 'x1': w['x1'], 'text': w['text']})
    return cells

def bands_of(header_row):
    """Fronteras entre columnas, a mitad de camino entre celdas de cabecera."""
    cs = cells_of(header_row)
    found = {}
    for key, rx in HDR_CELLS:
        for c in cs:
            if re.match(rx, c['text']) and key not in found:
                found[key] = c
    keys = [k for k, _ in HDR_CELLS if k in found]
    if 'nombre_es' not in found: return None
    lim = []
    for a, b in zip(keys, keys[1:]):
        lim.append((found[a]['x1'] + found[b]['x0']) / 2)
    return keys, lim

def join_lines(parts):
    """
    Une las líneas de una misma columna.

    Un guion al final de línea es partición tipográfica y hay que coserlo:
    «tostado y mo-» + «lido …» es «molido». Un guion en medio de línea es un
    compuesto de verdad («fresa-chocolate», «Ciruela Chi-Abal») y se respeta.
    Por eso la decisión se toma aquí, con las líneas todavía separadas: una vez
    aplanado el texto ya no se distingue un caso del otro.
    """
    out = ''
    for p in parts:
        p = p.strip()
        if not p: continue
        if out.endswith('-'):
            out = out[:-1].rstrip('- ') + p
        else:
            out = (out + ' ' + p) if out else p
    return re.sub(r'\s+', ' ', out).strip(' ,.') or None


def name_from_rows(header_row, name_rows):
    """Reparte las palabras de las filas de nombre en sus columnas."""
    bd = bands_of(header_row)
    if not bd: return None
    keys, lim = bd
    lines = {k: [] for k in keys}
    for r in name_rows:
        row = {k: [] for k in keys}
        for w in r:
            c = (w['x0'] + w['x1']) / 2
            i = next((i for i, L in enumerate(lim) if c < L), len(lim))
            row[keys[i]].append(w['text'])
        for k in keys:
            if row[k]: lines[k].append(' '.join(row[k]))
    g = lambda k: join_lines(lines.get(k, []))
    return g('grupo_es'), g('nombre_es'), g('nombre_en'), g('cientifico')

# La fila de etiquetas de nutrientes cierra el nombre.
END_NAME = re.compile(r'^(Porci.n comestible|Edible portion)')

def main():
    foods, nutrients, st = [], [], Counter()
    dec = Decoder(SRC)
    with pdfplumber.open(SRC) as pdf:
        for pno, page in enumerate(pdf.pages):
            # La fuente hace falta palabra a palabra: cada subconjunto tiene su
            # propio mapa de códigos y no son intercambiables.
            words = page.extract_words(keep_blank_chars=False, extra_attrs=['fontname'])
            if not words: st['sin_texto'] += 1; continue
            for w in words: w['text'] = dec.decode(w['text'], w.get('fontname'))
            rows = rows_of(words)
            texts = [' '.join(w['text'] for w in r) for _, r in rows]

            page_group = next((t.split('/')[0].strip() for t in texts[:5]
                               if '/' in t and t.split('/')[0].strip().isupper()), None)
            starts = [i for i, t in enumerate(texts) if t.startswith('Tipo Descripci')]
            if not starts: st['sin_fichas'] += 1; continue

            for k, s0 in enumerate(starts):
                s1 = starts[k+1] if k+1 < len(starts) else len(rows)
                if s1 - s0 < 3: st['bloque_corto'] += 1; continue

                # Filas de nombre: desde la cabecera hasta la fila de etiquetas.
                off = 1
                while s0 + off < s1 and not END_NAME.match(texts[s0+off]):
                    off += 1
                if off == 1: st['sin_filas_nombre'] += 1; continue
                parsed = name_from_rows(rows[s0][1], [rows[i][1] for i in range(s0+1, s0+off)])
                if not parsed: st['sin_cabecera'] += 1; continue
                grupo, es, en, sci = parsed
                for t in (es, en, sci):
                    if t: dec.check(t)
                grupo = grupo or page_group
                review = en is None
                if not es or len(es) < 2: st['sin_nombre'] += 1; continue
                if off > 2: st['nombre_multilinea'] += 1

                rec, got = {}, 0
                for i in range(s0+off, s1):
                    first = rows[i][1][0]['text'] if rows[i][1] else ''
                    for rx, fields in UNIT_ROWS:
                        if not re.match(rx, first): continue
                        for j in range(i+1, min(i+3, s1)):
                            vr = rows[j][1]
                            if vr and all(re.match(r'^[\d\.\*\-,]+$', w['text']) for w in vr):
                                a = assign(rows[i][1], vr, fields)
                                if a: rec.update(a); got += 1
                                else: st['bloque_ambiguo'] += 1
                                break
                        break
                if got == 0: st['sin_valores'] += 1; continue
                st[f'secciones_{got}de3'] += 1
                if review: st['nombre_a_revisar'] += 1

                fid = 'incm_' + hashlib.sha1(f'incmnsz|{grupo}|{es}|{pno}|{k}'.encode()).hexdigest()[:12]
                foods.append({'id': fid, 'name': es, 'name_en': en, 'slug': slug(es),
                    'scientific_name': sci, 'group_source': grupo, 'source': 'INCMNSZ_2015',
                    'source_ref': 'Tablas de composición de alimentos y productos alimenticios, INCMNSZ, versión condensada 2015',
                    'source_page': pno+1, 'verified': True, 'name_needs_review': review,
                    'edible_portion_pct': rec.pop('edible_pct', None)})
                nutrients.append({'food_id': fid, 'basis': '100g', 'basis_grams': 100.0,
                                  'is_derived': False, **rec})
                st['ok'] += 1

    json.dump(foods, open('out/incmnsz_foods.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(nutrients, open('out/incmnsz_nutrients.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"ALIMENTOS  {len(foods)}\n")
    for k, v in st.most_common(): print(f"  {v:5d}  {k}")
    print("\nDECODIFICACIÓN DE NOMBRES:")
    print(dec.report())
    cov = {k: sum(1 for n in nutrients if n.get(k) is not None) for k in
           ('magnesium_mg','zinc_mg','selenium_mg','vitamin_b12_mg','vitamin_d_mg',
            'vitamin_b1_mg','vitamin_b6_mg','fiber_total_g','copper_mg','manganese_mg')}
    print(f"\nCOBERTURA (de {len(nutrients)}):")
    for k, v in sorted(cov.items(), key=lambda x: -x[1]): print(f"  {v:5d}  {k}")

if __name__ == '__main__':
    main()

"""
RECUPERACIÓN DE BLOQUES DESALINEADOS · INCMNSZ
══════════════════════════════════════════════

237 bloques se descartaron porque el número de valores no coincidía con el de
campos. El texto plano no dice CUÁL falta: «11 números para 12 campos» puede
significar que falta el primero, el último o cualquiera de en medio.

Las coordenadas sí lo dicen. Cada columna de la tabla ocupa una franja
horizontal fija, marcada por su unidad —«(%)», «(kJ)», «(kcal)»…—. Un valor
pertenece a la columna cuyo centro tiene más cerca. Si una franja se queda sin
valor, ese nutriente falta, y los demás conservan su sitio.

Así se recupera el dato sin adivinar y sin arriesgar el corrimiento que hacía
peligroso el emparejamiento por posición.
"""
import pdfplumber, re, json, hashlib, unicodedata, warnings
from collections import Counter
warnings.filterwarnings('ignore')

SRC = '/Users/sergio/Desktop/APP C+E/LISTA ALIMENTARIA/TABLAS_ALIMENTOS.pdf'

def decode(s):
    return re.sub(r'\(cid:(\d+)\)', lambda m: chr(int(m.group(1)) + 29), s)

def num(t):
    t = t.strip()
    if t in ('*', '-', ''): return None
    try: return float(t.replace(',', ''))
    except ValueError: return None

UNIT_ROWS = [
 (r'^\(%\)$',
  ['edible_pct','energy_kj','energy_kcal','water_g','ash_g','ether_extract_g',
   'fat_sat_g','fat_mono_g','fat_poly_g','cholesterol_mg','protein_g','carbs_g']),
 (r'^\(g\)$',
  ['sugar_g','fiber_crude_g','fiber_total_g','fiber_insol_g','calcium_mg',
   'phosphorus_mg','iron_mg','sodium_mg','potassium_mg','magnesium_mg',
   'copper_mg','zinc_mg','manganese_mg','selenium_mg','lithium_mg']),
 (r'^\(U\.I\.\)$',
  ['vitamin_a_iu','vitamin_a_mg_rae','carotenes_mg','beta_carotenes_mg',
   'vitamin_b1_mg','vitamin_b2_mg','niacin_mg','vitamin_c_mg','vitamin_b6_mg',
   'vitamin_b12_mg','folic_acid_mg','folate_mg_dfe','vitamin_d_mg']),
]

def rows_of(words, tol=2.5):
    """Agrupa palabras en renglones por su coordenada vertical."""
    rs = {}
    for w in words:
        key = next((k for k in rs if abs(k - w['top']) <= tol), None)
        rs.setdefault(key if key is not None else w['top'], []).append(w)
    return [sorted(v, key=lambda w: w['x0']) for _, v in sorted(rs.items())]

def assign(unit_row, value_row, fields):
    """
    Empareja valores con campos por cercanía horizontal.

    Devuelve también cuántos valores quedaron sin columna clara: si alguno se
    pierde, el bloque no es fiable y se descarta igual que antes.
    """
    if len(unit_row) != len(fields): return None, 0
    centers = [(w['x0'] + w['x1']) / 2 for w in unit_row]
    out, used, lost = {}, set(), 0
    for w in value_row:
        c = (w['x0'] + w['x1']) / 2
        # Columna más cercana que siga libre.
        best, bd = None, 1e9
        for i, cc in enumerate(centers):
            if i in used: continue
            d = abs(c - cc)
            if d < bd: best, bd = i, d
        # Más de media columna de distancia: no se asigna a ciegas.
        span = (max(centers) - min(centers)) / max(len(centers) - 1, 1)
        if best is None or bd > span * 0.75:
            lost += 1; continue
        used.add(best)
        out[fields[best]] = num(w['text'])
    return out, lost

def main():
    recovered, st = {}, Counter()
    with pdfplumber.open(SRC) as pdf:
        for pno, page in enumerate(pdf.pages):
            words = page.extract_words(keep_blank_chars=False)
            if not words: continue
            for w in words: w['text'] = decode(w['text'])
            rs = rows_of(words)

            for i, row in enumerate(rs):
                if not row: continue
                first = row[0]['text']
                for rx, fields in UNIT_ROWS:
                    if not re.match(rx, first): continue
                    # Renglón de valores: el siguiente todo numérico.
                    for j in range(i+1, min(i+3, len(rs))):
                        vr = rs[j]
                        if vr and all(re.match(r'^[\d\.\*\-,]+$', w['text']) for w in vr):
                            if len(vr) == len(fields):
                                st['ya_alineado'] += 1
                            else:
                                got, lost = assign(row, vr, fields)
                                if got and lost == 0:
                                    st[f'recuperado_{len(fields)}campos'] += 1
                                    recovered.setdefault((pno, i), {}).update(got)
                                else:
                                    st['irrecuperable'] += 1
                            break
                    break

    print("RECUPERACIÓN POR COORDENADAS\n")
    for k, v in st.most_common(): print(f"  {v:6d}  {k}")
    tot = sum(v for k, v in st.items() if k.startswith('recuperado'))
    print(f"\nbloques rescatados: {tot}")
    print(f"irrecuperables:     {st['irrecuperable']}")
    json.dump({f'{p}_{r}': v for (p, r), v in recovered.items()},
              open('out/incmnsz_recovered.json','w',encoding='utf-8'),
              ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()

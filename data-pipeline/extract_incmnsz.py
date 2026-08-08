"""
EXTRACTOR INCMNSZ · Tablas de composición de alimentos (2015)
════════════════════════════════════════════════════════════

Aporta lo que el SMAE no tiene: magnesio, cobre, zinc, manganeso, selenio,
litio, B1, B2, niacina, B6, B12, folato, vitamina D, carotenos, humedad,
cenizas y fibra dietética. Todo por 100 g de porción comestible.

── Estructura del PDF ──────────────────────────────────────────────────────────
Tres fichas por página. Cada una:

    Tipo Descripción alimento Type Food description Nombre Científico
    FRUTAS Ciruela FRUITS Plum Spondias sp.        ← grupo + nombre ES/EN + latín
    …cabeceras…
    (%) (kJ) (kcal) …                              ← unidades
    0.95 192.00 46.00 …                            ← valores

── Dos trampas, y cómo se evitan ───────────────────────────────────────────────

1. La fuente no trae mapa de caracteres: los nombres salen como
   «(cid:41)ri(cid:77)o». Los códigos van desplazados 29 respecto al ASCII,
   comprobado contra nombres conocidos («Ciruela», «Chile Largo»).

2. A veces faltan valores al principio de una línea. El Ciricote trae 11
   números para 12 campos: no declara porción comestible. Emparejar por
   posición correría TODO el resto —el kJ acabaría en «porción comestible»— y
   la ficha quedaría corrupta sin que nada lo delate. Por eso un bloque solo se
   acepta cuando el número de valores coincide exactamente con el de campos;
   si no, se descarta y se cuenta. Un hueco declarado es recuperable; un dato
   desplazado envenena la base.
"""
import pdfplumber, re, json, unicodedata, hashlib, warnings
from collections import Counter
warnings.filterwarnings('ignore')

SRC = '/Users/sergio/Desktop/APP C+E/LISTA ALIMENTARIA/TABLAS_ALIMENTOS.pdf'

def decode(s):
    return re.sub(r'\(cid:(\d+)\)', lambda m: chr(int(m.group(1)) + 29), s)

def num(tok):
    """Valor, o None si la fuente lo marca ausente con `*`."""
    tok = tok.strip()
    if tok in ('*', '-', ''): return None
    try: return float(tok.replace(',', ''))
    except ValueError: return None

HDR = 'Tipo Descripci'
UNITS = [
 (re.compile(r'^\(%\) \(kJ\) \(kcal\)'),
  ['edible_pct','energy_kj','energy_kcal','water_g','ash_g','ether_extract_g',
   'fat_sat_g','fat_mono_g','fat_poly_g','cholesterol_mg','protein_g','carbs_g']),
 (re.compile(r'^\(g\) \(g\) \(g\) \(g\) \(mg\)'),
  ['sugar_g','fiber_crude_g','fiber_total_g','fiber_insol_g','calcium_mg',
   'phosphorus_mg','iron_mg','sodium_mg','potassium_mg','magnesium_mg',
   'copper_mg','zinc_mg','manganese_mg','selenium_mg','lithium_mg']),
 (re.compile(r'^\(U\.I\.\)'),
  ['vitamin_a_iu','vitamin_a_mg_rae','carotenes_mg','beta_carotenes_mg',
   'vitamin_b1_mg','vitamin_b2_mg','niacin_mg','vitamin_c_mg','vitamin_b6_mg',
   'vitamin_b12_mg','folic_acid_mg','folate_mg_dfe','vitamin_d_mg']),
]

def split_name(line, page_group=None):
    """
    «FRUTAS Ciruela FRUITS Plum Spondias sp.» → grupo, nombre ES, nombre EN.

    Tres formas aparecen en el PDF:

      a) grupo + nombre ES + GRUPO_EN + nombre EN + latín   (la habitual)
      b) sin prefijo de grupo: «Amaranto, barrita con Amaranth, small bar»
      c) el grupo ocupa su propia línea y el nombre va debajo

    Cuando no se puede separar español de inglés con certeza se devuelve la
    línea completa y se marca para revisión. Perder el alimento por no saber
    recortar su nombre sería mucho peor que guardarlo con el nombre largo:
    el dato nutricional es irrecuperable, el nombre siempre se puede pulir.
    """
    line = re.sub(r'\s+', ' ', line).strip()
    grupo, resto, review = page_group, line, False

    m = re.match(r'^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ,\s]{2,40}?)\s+(?=[A-ZÁÉÍÓÚÑ][a-záéíóúñ])', line)
    if m:
        grupo = m.group(1).strip().rstrip(',')
        resto = line[m.end():]

    # El nombre latino cierra la ficha; se recorta si aparece.
    resto = re.sub(r'\s+[A-Z][a-z]+ (sp{1,2}\.|[a-z]+)( [A-Z]\.?[A-Za-z\.]*)?$', '', resto).strip()

    # Corte por el grupo en inglés, cuando está.
    m2 = re.search(r'\s([A-Z][A-Z,\s]{2,40})\s+[A-Z]', resto)
    if m2:
        es, en = resto[:m2.start()].strip(), resto[m2.end()-1:].strip()
    else:
        # Sin marca fiable: se conserva entero y se señala.
        es, en, review = resto, None, True

    es = re.sub(r'\s+', ' ', es).strip(' ,.')
    return grupo, (es or None), en, review

def slug(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii','ignore').decode()
    return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')

def main():
    foods, nutrients = [], []
    st = Counter()

    with pdfplumber.open(SRC) as pdf:
        for pno, page in enumerate(pdf.pages):
            raw = page.extract_text()
            if not raw: st['pagina_sin_texto'] += 1; continue
            lines = [decode(l).strip() for l in raw.split('\n')]

            # Grupo de la página: «FRUTAS / FRUITS» en la cabecera.
            page_group = None
            for l in lines[:5]:
                if '/' in l and l.split('/')[0].strip().isupper():
                    page_group = l.split('/')[0].strip(); break

            starts = [i for i, l in enumerate(lines) if l.startswith(HDR)]
            if not starts: st['pagina_sin_fichas'] += 1; continue

            for k, s0 in enumerate(starts):
                s1 = starts[k+1] if k+1 < len(starts) else len(lines)
                blk = lines[s0:s1]
                if len(blk) < 3: st['bloque_corto'] += 1; continue

                # El grupo puede ocupar su propia línea; el nombre va debajo.
                name_line = blk[1]
                if name_line.isupper() and len(blk) > 2:
                    name_line = blk[2]
                    st['grupo_en_linea_propia'] += 1
                grupo, es, en, review = split_name(name_line, page_group)
                if not es or len(es) < 2:
                    st['sin_nombre'] += 1; continue
                if review: st['nombre_a_revisar'] += 1

                rec, aligned = {}, 0
                for j, ln in enumerate(blk):
                    for rx, fields in UNITS:
                        if not rx.match(ln): continue
                        for jj in range(j+1, min(j+3, len(blk))):
                            toks = blk[jj].split()
                            if not toks or not all(re.match(r'^[\d\.\*\-,]+$', t) for t in toks):
                                continue
                            # GUARDA: sin coincidencia exacta no se empareja.
                            if len(toks) != len(fields):
                                st[f'desalineado_{len(fields)}campos'] += 1
                                break
                            rec.update({f: num(t) for f, t in zip(fields, toks)})
                            aligned += 1
                            break
                        break

                if aligned == 0: st['sin_valores'] += 1; continue
                st[f'bloques_alineados_{aligned}de3'] += 1

                fid = 'incm_' + hashlib.sha1(
                    f'incmnsz|{grupo}|{es}|{pno}|{k}'.encode()).hexdigest()[:12]
                foods.append({
                    'id': fid, 'name': es, 'name_en': en, 'slug': slug(es),
                    'group_source': grupo, 'source': 'INCMNSZ_2015',
                    'source_ref': 'Tablas de composición de alimentos y productos '
                                  'alimenticios, INCMNSZ, versión condensada 2015',
                    'source_page': pno + 1, 'verified': True,
                    'name_needs_review': review,
                    'edible_portion_pct': rec.pop('edible_pct', None),
                })
                nutrients.append({'food_id': fid, 'basis': '100g', 'basis_grams': 100.0,
                                  'is_derived': False, **rec})
                st['ok'] += 1

    json.dump(foods, open('out/incmnsz_foods.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(nutrients, open('out/incmnsz_nutrients.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f"ALIMENTOS  {len(foods)}\n")
    for k, v in st.most_common(): print(f"  {v:5d}  {k}")
    print("\nMUESTRA:")
    for f in foods[:10]:
        n = next(x for x in nutrients if x['food_id'] == f['id'])
        print(f"  [{f['group_source'][:14]:16s}] {f['name'][:34]:36s} "
              f"{n.get('energy_kcal')} kcal · Mg {n.get('magnesium_mg')} · B12 {n.get('vitamin_b12_mg')}")
    cov = {k: sum(1 for n in nutrients if n.get(k) is not None) for k in
           ('magnesium_mg','zinc_mg','selenium_mg','vitamin_b12_mg','vitamin_d_mg','vitamin_b1_mg','fiber_total_g')}
    print(f"\nCOBERTURA (de {len(nutrients)}):")
    for k, v in cov.items(): print(f"  {v:5d}  {k}")

if __name__ == '__main__':
    main()

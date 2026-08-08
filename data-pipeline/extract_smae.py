"""
EXTRACTOR SMAE 5.ª ed · ZENCRUS
═══════════════════════════════

Convierte la hoja «Todos los alimentos» en el modelo relacional de Zencrus.

── Dos hechos de la fuente que gobiernan el diseño ─────────────────────────────

1. Los valores nutricionales son POR PORCIÓN, no por 100 g. La acelga cocida
   declara 19 kcal para media taza (72 g). El «por 100 g» que pide la app se
   deriva dividiendo por el peso neto — es aritmética exacta, no una estimación,
   pero se marca como derivado para que nunca se confunda con dato de fuente.

2. «ND» significa dato no disponible. Se guarda como NULL. Jamás se calcula un
   nutriente ausente a partir de otros: un cero inventado es peor que un hueco
   honesto, porque el hueco se ve y el cero miente.

── Medidas derivadas ───────────────────────────────────────────────────────────
La fuente da una sola medida por alimento (la del equivalente). Las fracciones
y múltiplos se generan por proporción y se marcan `is_derived = true`. Solo se
derivan medidas contables o fraccionables; nunca se inventa una unidad que la
fuente no usa para ese alimento.
"""

import openpyxl, json, re, unicodedata, hashlib
from collections import Counter, defaultdict

SRC = '/Users/sergio/Desktop/APP C+E/LISTA ALIMENTARIA/SMAE 5ta Edicion EXCEL CALCULOS (2).xlsx'
OUT = 'out'

# ── Columnas → nombre de nutriente y unidad ───────────────────────────────────
NUTRIENTS = [
    ('energy_kcal',      7,  'kcal'),
    ('protein_g',        8,  'g'),
    ('fat_g',            9,  'g'),
    ('carbs_g',          10, 'g'),
    ('fat_sat_g',        11, 'g'),
    ('fat_mono_g',       12, 'g'),
    ('fat_poly_g',       13, 'g'),
    ('cholesterol_mg',   14, 'mg'),
    ('sugar_g',          15, 'g'),
    ('fiber_g',          16, 'g'),
    ('vitamin_a_mg_re',  17, 'mg RE'),
    ('vitamin_c_mg',     18, 'mg'),
    ('folate_mg',        19, 'mg'),
    ('calcium_mg',       20, 'mg'),
    ('iron_mg',          21, 'mg'),
    ('potassium_mg',     22, 'mg'),
    ('sodium_mg',        23, 'mg'),
    ('phosphorus_mg',    24, 'mg'),
    ('ethanol_g',        25, 'g'),
    ('glycemic_index',   26, 'index'),
    ('glycemic_load',    27, 'index'),
]

ND = {'ND', 'N/D', 'NA', 'N/A', '-', '', 'S/D'}

# ── Lo que NO se escala al pasar a 100 g ──────────────────────────────────────
# Casi todo lo de la tabla es una cantidad: 19 kcal en 72 g son 26 kcal en 100 g.
# El índice glicémico no. Es una propiedad del alimento, adimensional y de 0 a
# 110, y multiplicarlo por el peso lo convertía en un número sin sentido: la
# mediana pasaba de 51 —correcta— a 178, con máximos de 900. No daba error
# porque el campo admite cualquier número.
#
# La carga glicémica sí se escala, y por eso no está en esta lista: depende de
# cuántos hidratos se comen, así que el doble de comida es el doble de carga.
INTENSIVOS = {'glycemic_index'}

def num(v):
    """Número, o None si la fuente marca el dato como no disponible."""
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip()
    if s.upper() in ND: return None
    s = s.replace(',', '.')
    m = re.match(r'^-?\d+(\.\d+)?$', s)
    return float(s) if m else None

def qty(v):
    """Cantidad sugerida: acepta enteros, decimales y fracciones («1/2», «1 1/2»)."""
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace(',', '.')
    m = re.match(r'^(\d+)\s+(\d+)/(\d+)$', s)          # 1 1/2
    if m: return int(m[1]) + int(m[2]) / int(m[3])
    m = re.match(r'^(\d+)/(\d+)$', s)                   # 1/2
    if m: return int(m[1]) / int(m[2])
    m = re.match(r'^-?\d+(\.\d+)?$', s)
    return float(s) if m else None

def slug(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def food_id(grupo, alimento):
    """ID estable y reproducible: la misma fila da siempre el mismo id."""
    h = hashlib.sha1(f'smae|{grupo}|{alimento}'.encode('utf-8')).hexdigest()[:12]
    return f'smae_{h}'

# ── Preparación, deducida del nombre ──────────────────────────────────────────
PREP = [
    (r'\bcocid[oa]s?\b', 'cocido'), (r'\bcrud[oa]s?\b', 'crudo'),
    (r'\bfrit[oa]s?\b', 'frito'), (r'\basad[oa]s?\b', 'asado'),
    (r'\bhorne[ao]d[oa]s?\b', 'horneado'), (r'\bal vapor\b', 'al vapor'),
    (r'\bhervid[oa]s?\b', 'hervido'), (r'\ba la plancha\b', 'a la plancha'),
    (r'\benlatad[oa]s?\b', 'enlatado'), (r'\bdeshidratad[oa]s?\b', 'deshidratado'),
    (r'\bcongelad[oa]s?\b', 'congelado'), (r'\btostad[oa]s?\b', 'tostado'),
    (r'\bempanizad[oa]s?\b', 'empanizado'), (r'\bcapead[oa]s?\b', 'capeado'),
    (r'\ben almibar\b|\ben almíbar\b', 'en almíbar'),
]
def prep_of(name):
    n = name.lower()
    for rx, tag in PREP:
        if re.search(rx, n): return tag
    return None

# ── Unidades derivables ───────────────────────────────────────────────────────
# Solo se derivan fracciones/múltiplos de unidades que admiten partirse o
# repetirse de forma natural. «lata» o «sobre» no se parten en cuartos.
FRACTIONABLE = {'taza', 'cda', 'cdita', 'ml', 'gramos', 'vaso', 'copa', 'porcion', 'porción'}
COUNTABLE    = {'pieza', 'rebanada', 'unidad', 'pza'}
DERIVED_FACTORS = [0.25, 0.5, 2.0]

def main():
    wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
    ws = wb['Todos los alimentos']

    foods, portions, nutrients, aliases = [], [], [], []
    stats = Counter()

    # Un mismo alimento puede aparecer en varias filas con medidas distintas
    # («4 galletas» y «4 pieza» para la misma galleta; «1 rebanada» y «1/3 taza»
    # para la piña en almíbar). No son duplicados: son medidas alternativas del
    # mismo alimento, y descartarlas perdería datos de la fuente. Se agrupan.
    grouped = defaultdict(list)
    for r in ws.iter_rows(min_row=3, values_only=True):
        if not r[0] or not r[1]:
            stats['fila_vacia'] += 1; continue
        grouped[(str(r[0]).strip(), str(r[1]).strip())].append(r)

    for (grupo, nombre), variants in grouped.items():
        r = variants[0]                     # fila canónica para el alimento
        fid = food_id(grupo, nombre)
        if len(variants) > 1: stats['con_medidas_multiples'] += 1

        cantidad = qty(r[3])
        unidad   = (str(r[4]).strip() if r[4] else None)
        bruto    = num(r[5])
        neto     = num(r[6])
        canon_neto = neto

        # Parte comestible: solo si la fuente da ambos pesos y son coherentes.
        edible_pct = round(neto / bruto * 100, 2) if (bruto and neto and bruto > 0) else None
        yield_factor = round(neto / bruto, 4) if (bruto and neto and bruto > 0) else None

        foods.append({
            'id': fid,
            'name': nombre,
            'group_smae': grupo,
            'preparation': prep_of(nombre),
            'source': 'SMAE_5ED',
            'source_ref': 'Sistema Mexicano de Alimentos Equivalentes, 5.ª edición',
            'verified': True,
            'gross_weight_g': bruto,
            'net_weight_g': neto,
            'edible_portion_pct': edible_pct,
            'yield_factor': yield_factor,
            'slug': slug(nombre),
        })

        # ── Medidas de la fuente: una por cada fila del alimento ─────────────
        for vr in variants:
          cantidad, unidad = qty(vr[3]), (str(vr[4]).strip() if vr[4] else None)
          bruto, neto = num(vr[5]), num(vr[6])
          if cantidad and unidad and neto:
            portions.append({
                'food_id': fid, 'label': f'{vr[3]} {unidad}', 'unit': unidad,
                'amount': cantidad, 'grams': neto, 'gross_grams': bruto,
                'is_derived': False, 'source': 'SMAE_5ED',
            })
            stats['medida_fuente'] += 1

            # ── Medidas derivadas ────────────────────────────────────────────
            u = unidad.lower()
            if u in FRACTIONABLE or u in COUNTABLE:
                for f in DERIVED_FACTORS:
                    amt = cantidad * f
                    # Un contable no se registra en cuartos de pieza.
                    if u in COUNTABLE and abs(amt - round(amt)) > 1e-9 and amt < 1:
                        continue
                    portions.append({
                        'food_id': fid,
                        'label': f'{fmt_amount(amt)} {unidad}',
                        'unit': unidad, 'amount': round(amt, 4),
                        'grams': round(neto * f, 2),
                        'gross_grams': round(bruto * f, 2) if bruto else None,
                        'is_derived': True, 'source': 'DERIVED_FROM_SMAE',
                    })
                    stats['medida_derivada'] += 1

        # ── Nutrientes: por porción (fuente) y por 100 g (derivado) ──────────
        neto = canon_neto
        per_portion, per_100 = {}, {}
        for key, idx, unit in NUTRIENTS:
            v = num(r[idx])
            per_portion[key] = v
            if v is None:
                per_100[key] = None
                stats[f'nd_{key}'] += 1
            elif key in INTENSIVOS:
                per_100[key] = v                    # no depende de la cantidad
                stats['intensivo_sin_escalar'] += 1
            elif neto and neto > 0:
                per_100[key] = round(v / neto * 100, 4)
            else:
                per_100[key] = None

        nutrients.append({
            'food_id': fid, 'basis': 'portion', 'basis_grams': neto,
            'is_derived': False, **per_portion,
        })
        nutrients.append({
            'food_id': fid, 'basis': '100g', 'basis_grams': 100.0,
            'is_derived': True, **per_100,
        })

    # ── Salida ────────────────────────────────────────────────────────────────
    import os; os.makedirs(OUT, exist_ok=True)
    for name, data in [('foods', foods), ('food_portions', portions),
                       ('food_nutrients', nutrients), ('food_aliases', aliases)]:
        with open(f'{OUT}/{name}.json', 'w', encoding='utf-8') as fh:
            json.dump(data, fh, ensure_ascii=False, indent=1)

    print(f"ALIMENTOS      {len(foods):6d}")
    print(f"MEDIDAS        {len(portions):6d}  ({stats['medida_fuente']} de fuente + {stats['medida_derivada']} derivadas)")
    print(f"NUTRIENTES     {len(nutrients):6d}  (2 bases por alimento)")
    print(f"con 2+ medidas {stats['con_medidas_multiples']:6d}")
    print(f"filas vacías   {stats['fila_vacia']:6d}")
    print(f"\nCON parte comestible: {sum(1 for f in foods if f['edible_portion_pct'] is not None)}")
    print(f"CON preparación:      {sum(1 for f in foods if f['preparation'])}")

def fmt_amount(a):
    """0.5 → «1/2», 1.0 → «1», 2.0 → «2»."""
    fr = {0.25: '1/4', 0.5: '1/2', 0.75: '3/4', 1/3: '1/3', 2/3: '2/3'}
    for v, s in fr.items():
        if abs(a - v) < 1e-6: return s
    if abs(a - round(a)) < 1e-9: return str(int(round(a)))
    return str(round(a, 3))

if __name__ == '__main__':
    main()

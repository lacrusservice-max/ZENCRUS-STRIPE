"""
CARGA A SUPABASE · base nutricional ZENCRUS
═══════════════════════════════════════════

Sube el SMAE (y los micronutrientes cruzados del INCMNSZ) al esquema que la app
ya usa en producción.

── Por qué no se usa schema.sql ────────────────────────────────────────────────
`schema.sql` proponía un esquema `nutrition` propio. La base real ya tiene otro,
mejor normalizado y con 7.756 alimentos del USDA dentro: `foods` + `nutrients`
en modelo entidad-atributo-valor, `food_sources`, `food_portions`,
`food_aliases`, y `food_imports` para registrar cada carga. Crear un esquema
paralelo habría partido el catálogo en dos y obligado a la app a consultar en
dos sitios. Se carga sobre el esquema vivo, que es para lo que está hecho.

── Unidades: comprobadas contra alimentos de referencia ────────────────────────
Las cabeceras del SMAE dicen «mg» para vitamina A y folato, pero los VALORES
están en microgramos. Se comprobó contra alimentos de referencia con valor
conocido, y la coincidencia es exacta:

    espinaca cocida   → 524 vit. A   y 145,6 folato   (USDA: 524 µg y 146 µg)
    zanahoria baby    → 690 vit. A                    (USDA: 690 µg)

Fiarse de la cabecera y multiplicar por 1.000 habría metido mil veces la
vitamina A de cada alimento sin dar un solo error. Lo mismo pasa con B12,
vitamina D y folato del INCMNSZ: la columna dice «(mg)» y la mediana de B12 es
0,995 — que en miligramos sería mil veces la ingesta diaria de un adulto. Son
microgramos. Por eso aquí no se convierte nada: los valores ya están en la
unidad que espera la tabla destino.

── Se adapta a lo que la base admita ───────────────────────────────────────────
Hay dos cosas que dependen de `migracion.sql`, que necesita permisos de esquema
y puede estar aplicada o no. El script lo COMPRUEBA al arrancar en vez de
suponerlo, y sube lo que quepa:

· Las 6.487 medidas derivadas, que solo entran si existe la columna
  `is_derived`. Sin ella se quedan fuera a propósito: la regla del proyecto es
  que nada calculado viaje sin marca, y mezclarlas con las 2.863 del libro sin
  distintivo haría imposible saber después qué dijo la fuente. Son múltiplos
  exactos, así que mientras tanto las calcula la app.
· El índice y la carga glicémica, que son adimensionales y chocan con la
  restricción de unidades de la tabla `nutrients`.

Aplicada la migración, basta con volver a correr este script: no hay que tocar
nada aquí.

Lo que NO se sube en ningún caso está justificado más abajo, en SIN_DESTINO.

Los valores por 100 g sí se suben, aunque sean derivados del peso neto: el
esquema destino guarda todo por 100 g por diseño (`base_unit = 'g'`), así que
esa es la unidad del contrato, no una decisión de este script.
"""
import json, re, uuid, urllib.request, urllib.error, unicodedata, sys, time
from collections import Counter

ENV = '/Users/sergio/Desktop/APP C+E/NutriAI-Fit/backend/.env'
LOTE = 500

# ── Nutriente nuestro → id en la tabla `nutrients`. Sin conversión: comprobado. ─
MAPA_SMAE = {
    'energy_kcal': 1, 'protein_g': 2, 'carbs_g': 3, 'fat_g': 4, 'fat_sat_g': 5,
    'fiber_g': 7, 'sugar_g': 8, 'sodium_mg': 9, 'potassium_mg': 10,
    'cholesterol_mg': 11, 'calcium_mg': 12, 'iron_mg': 13, 'phosphorus_mg': 15,
    'vitamin_a_mg_re': 17, 'vitamin_c_mg': 18, 'folate_mg': 26,
    'fat_mono_g': 30, 'fat_poly_g': 31, 'ethanol_g': 32,
}
MAPA_INCMNSZ = {
    'magnesium_mg': 14, 'zinc_mg': 16, 'vitamin_d_mg': 19, 'vitamin_b1_mg': 22,
    'vitamin_b2_mg': 23, 'niacin_mg': 24, 'vitamin_b6_mg': 25,
    'vitamin_b12_mg': 27, 'water_g': 28, 'copper_mg': 35, 'manganese_mg': 36,
}

# ── Lo que se queda fuera, y por qué ──────────────────────────────────────────
# · selenium_mg: el INCMNSZ MEZCLA UNIDADES en esa columna. La clara de huevo
#   trae 20,0 —que solo tiene sentido en µg— y la sardina en aceite trae 0,05,
#   que solo lo tiene en mg. No hay forma de saber fila a fila cuál es cuál, y
#   equivocarse es un factor de mil. Se deja sin cargar hasta poder revisarlo.
# · glycemic_index y glycemic_load: son adimensionales y la tabla `nutrients`
#   tiene un check que solo admite kcal/g/mg/µg. Entran cuando se aplique
#   `migracion.sql`, que relaja esa restricción.
# · El resto no tiene equivalente y tampoco lo necesita: `ash_g` y `energy_kj`
#   son redundantes, y los carotenos ya van dentro de la vitamina A.
SIN_DESTINO = ['selenium_mg', 'glycemic_index', 'glycemic_load', 'ash_g',
               'energy_kj', 'carotenes_mg', 'beta_carotenes_mg',
               'fiber_total_g', 'folate_mg_dfe']

CATEGORIA = {
    'Cereales y derivados': 8, 'Azúcares y endulzantes': 18, 'Carnes': 3,
    'Lácteos': 7, 'Alimentos procesados': 16, 'Frutas': 1,
    'Frutos secos y semillas': 11, 'Verduras': 2, 'Grasas y aceites': 12,
    'Pescados y mariscos': 5, 'Condimentos y especias': 14, 'Bebidas': 13,
    'Leguminosas': 9, 'Tubérculos y raíces': 10, 'Huevos': 6,
}
# Solo se declara «procesado» donde la fuente lo afirma. No se clasifica a ojo.
KIND = {'Alimentos procesados': 'procesado'}

NS = uuid.UUID('6f9619ff-8b86-d011-b42d-00c04fc964ff')


def env():
    v = {}
    for line in open(ENV, encoding='utf-8'):
        m = re.match(r'^([A-Z_]+)=(.*)$', line.strip())
        if m: v[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return v['SUPABASE_URL'].rstrip('/'), v['SUPABASE_SERVICE_ROLE_KEY']


URL, KEY = env()
H = {'apikey': KEY, 'Authorization': 'Bearer ' + KEY,
     'Content-Type': 'application/json'}


def api(metodo, ruta, cuerpo=None, prefer=None):
    h = dict(H)
    if prefer: h['Prefer'] = prefer
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    req = urllib.request.Request(URL + '/rest/v1/' + ruta, data=datos,
                                 headers=h, method=metodo)
    for intento in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                cuerpo_resp = r.read()
                return json.loads(cuerpo_resp) if cuerpo_resp else None
        except urllib.error.HTTPError as e:
            detalle = e.read().decode()[:400]
            if e.code in (502, 503, 504) and intento < 3:
                time.sleep(2 ** intento); continue
            raise RuntimeError(f'{metodo} {ruta} → {e.code}: {detalle}') from None
        except urllib.error.URLError:
            if intento < 3: time.sleep(2 ** intento); continue
            raise


def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', s.lower()).strip()


def fid(nuestro_id):
    """UUID estable a partir de nuestro id: repetir la carga no duplica nada."""
    return str(uuid.uuid5(NS, 'zencrus:' + nuestro_id))


def subir(tabla, filas, conflicto, etiqueta):
    for i in range(0, len(filas), LOTE):
        lote = filas[i:i + LOTE]
        api('POST', f'{tabla}?on_conflict={conflicto}', lote,
            prefer='resolution=merge-duplicates,return=minimal')
        print(f'\r   {etiqueta}: {min(i+LOTE, len(filas))}/{len(filas)}', end='', flush=True)
    print()


def reemplazar(tabla, filas, ids, etiqueta):
    """
    Borra lo nuestro y lo vuelve a insertar.

    `food_portions` y `food_aliases` no tienen índice único por (alimento,
    descripción), así que no admiten upsert. Reinsertar sin más duplicaría en
    cada corrida. El borrado va acotado por food_id a los alimentos que crea
    este script, de modo que no toca las 14.369 medidas del USDA que ya había.
    """
    ids = list(ids)
    for i in range(0, len(ids), 100):
        trozo = ','.join(ids[i:i + 100])
        api('DELETE', f'{tabla}?food_id=in.({trozo})', prefer='return=minimal')
        print(f'\r   {etiqueta}: limpiando {min(i+100, len(ids))}/{len(ids)}', end='', flush=True)
    print()
    for i in range(0, len(filas), LOTE):
        api('POST', tabla, filas[i:i + LOTE], prefer='return=minimal')
        print(f'\r   {etiqueta}: {min(i+LOTE, len(filas))}/{len(filas)}', end='', flush=True)
    print()


def capacidades():
    """
    Mira qué admite hoy la base en vez de darlo por supuesto.

    `migracion.sql` añade la columna `is_derived` y los dos índices glicémicos.
    Puede estar aplicada o no, así que el cargador lo comprueba y sube lo que
    quepa. Al aplicarla basta con volver a correr este script: no hace falta
    cambiar nada aquí.
    """
    esquema = api('GET', '')
    cols = esquema['definitions']['food_portions']['properties']
    nutri = {n['code'] for n in api('GET', 'nutrients?select=code')}
    return {'is_derived': 'is_derived' in cols,
            'glicemicos': {'glycemic_index', 'glycemic_load'} <= nutri}


def main(dry=False):
    foods = json.load(open('out/foods.json', encoding='utf-8'))
    ports = json.load(open('out/food_portions.json', encoding='utf-8'))
    nuts = json.load(open('out/food_nutrients.json', encoding='utf-8'))
    cross = json.load(open('out/crossmatch.json', encoding='utf-8'))
    n100 = {n['food_id']: n for n in nuts if n['basis'] == '100g'}
    micros = {c['smae_food_id']: c for c in cross}

    # También en ensayo: son consultas de lectura, y fingir que la base no
    # admite algo haría que el ensayo mintiera sobre lo que va a subir.
    cap = capacidades()
    mapa_smae = dict(MAPA_SMAE)
    if cap['glicemicos']:
        mapa_smae.update({'glycemic_index': 33, 'glycemic_load': 34})
    print(f"base: marca de derivado={'sí' if cap['is_derived'] else 'no'} · "
          f"índices glicémicos={'sí' if cap['glicemicos'] else 'no'}")

    # ── Fuentes ───────────────────────────────────────────────────────────────
    fuentes = [
        {'code': 'smae_5ed', 'name': 'Sistema Mexicano de Alimentos Equivalentes · 5.ª edición',
         'country': 'MX', 'license': 'Uso académico', 'official': True, 'priority': 1,
         'attribution': 'Pérez Lizaur AB, Palacios González B, Castro Becerra AL, Flores Galicia I'},
        {'code': 'incmnsz_2015', 'name': 'Tablas de composición de alimentos · INCMNSZ 2015',
         'country': 'MX', 'license': 'Uso académico', 'official': True, 'priority': 2,
         'attribution': 'Instituto Nacional de Ciencias Médicas y Nutrición Salvador Zubirán'},
    ]
    if not dry:
        api('POST', 'food_sources?on_conflict=code', fuentes,
            prefer='resolution=merge-duplicates,return=minimal')
    sid = {s['code']: s['id'] for s in api('GET', 'food_sources?select=id,code')}
    if dry and 'smae_5ed' not in sid:
        src = -1
        print('fuente SMAE aún no existe (en ensayo no se crea); se usa id ficticio')
    else:
        src = sid['smae_5ed']
        print(f"fuente SMAE id={src} · INCMNSZ id={sid['incmnsz_2015']}")

    # ── Erratas del Excel que corrige el libro ────────────────────────────────
    # El Excel del SMAE trae nombres mal escritos («Alga para sushl», «Salchicha
    # Vlenna») que el PDF del mismo libro escribe bien. Se corrigen aquí y no en
    # `foods.json` para que el extractor siga reflejando su fuente tal cual: lo
    # que cambia es lo que ve el usuario, no lo que dice el Excel. El nombre
    # viejo se guarda como sinónimo, así que quien lo busque igual lo encuentra.
    try:
        erratas = {c['food_id']: c['pdf']
                   for c in json.load(open('out/smae_pdf.json', encoding='utf-8'))['erratas']}
    except FileNotFoundError:
        erratas = {}

    # ── Alimentos ─────────────────────────────────────────────────────────────
    filas_f, st, alias_erratas = [], Counter(), []
    for f in foods:
        g = f.get('group_zencrus')
        nombre = f['name']
        if f['id'] in erratas:
            alias_erratas.append({'food_id': fid(f['id']), 'alias': nombre,
                                  'alias_normalized': norm(nombre),
                                  'lang': 'es', 'kind': 'comun'})
            nombre = erratas[f['id']]
            st['nombre_corregido_con_el_libro'] += 1
        filas_f.append({
            'id': fid(f['id']), 'source_id': src, 'source_food_id': f['id'],
            'name': nombre, 'name_normalized': norm(nombre),
            'lang': 'es', 'country': 'MX',
            'category_id': CATEGORIA.get(g), 'kind': KIND.get(g, 'natural'),
            'base_unit': 'g', 'verified': bool(f.get('verified')), 'version': 1,
        })
        if CATEGORIA.get(g) is None: st['sin_categoria'] += 1

    # ── Nutrientes por 100 g ──────────────────────────────────────────────────
    filas_n = []
    for f in foods:
        u, r = fid(f['id']), n100.get(f['id'], {})
        for k, nid in mapa_smae.items():
            if r.get(k) is not None:
                filas_n.append({'food_id': u, 'nutrient_id': nid, 'amount': round(r[k], 4)})
                st['nutriente_smae'] += 1
        c = micros.get(f['id'])
        if c:
            st['alimento_con_micros_incmnsz'] += 1
            for k, nid in MAPA_INCMNSZ.items():
                if c['micros'].get(k) is not None:
                    filas_n.append({'food_id': u, 'nutrient_id': nid,
                                    'amount': round(c['micros'][k], 4)})
                    st['nutriente_incmnsz'] += 1

    # Un mismo nutriente no puede llegar dos veces para el mismo alimento.
    vistos, limpio = set(), []
    for r in filas_n:
        k = (r['food_id'], r['nutrient_id'])
        if k in vistos: st['nutriente_duplicado_descartado'] += 1; continue
        vistos.add(k); limpio.append(r)
    filas_n = limpio

    # ── Medidas ───────────────────────────────────────────────────────────────
    # Las derivadas solo entran si hay dónde marcarlas. Sin esa columna se
    # quedan fuera: mezclarlas con las del libro sin distintivo haría imposible
    # saber después qué dijo la fuente y qué calculamos nosotros.
    filas_p, seq = [], Counter()
    for p in ports:
        if p['is_derived'] and not cap['is_derived']:
            st['medida_derivada_omitida_sin_columna'] += 1; continue
        u = fid(p['food_id']); seq[u] += 1
        fila = {'food_id': u, 'description': p['label'],
                'amount': p['amount'], 'gram_weight': p['grams'], 'seq': seq[u]}
        if cap['is_derived']:
            fila['is_derived'] = p['is_derived']
        filas_p.append(fila)

    # ── Sinónimos: el nombre del INCMNSZ para los alimentos cruzados ──────────
    filas_a = list(alias_erratas)
    for c in cross:
        filas_a.append({'food_id': fid(c['smae_food_id']), 'alias': c['incmnsz_name'],
                        'alias_normalized': norm(c['incmnsz_name']),
                        'lang': 'es', 'kind': 'sinonimo'})

    print(f"\nA SUBIR:\n  alimentos   {len(filas_f):6d}\n  nutrientes  {len(filas_n):6d}"
          f"\n  medidas     {len(filas_p):6d}\n  sinónimos   {len(filas_a):6d}")
    for k, v in st.most_common(): print(f"  {v:6d}  {k}")
    fuera = [k for k in SIN_DESTINO if k not in mapa_smae and k not in MAPA_INCMNSZ]
    print(f"\n  sin destino en `nutrients`: {', '.join(fuera)}")

    if dry:
        print('\n[ENSAYO] no se ha escrito nada.')
        print('ejemplo alimento :', json.dumps(filas_f[0], ensure_ascii=False))
        print('ejemplo nutriente:', json.dumps(filas_n[0], ensure_ascii=False))
        print('ejemplo medida   :', json.dumps(filas_p[0], ensure_ascii=False))
        return

    print()
    nuestros = [r['id'] for r in filas_f]
    subir('foods', filas_f, 'id', 'alimentos')
    subir('food_nutrients', filas_n, 'food_id,nutrient_id', 'nutrientes')
    reemplazar('food_portions', filas_p, nuestros, 'medidas')
    reemplazar('food_aliases', filas_a, nuestros, 'sinónimos')

    api('POST', 'food_imports', [{
        'source_id': src, 'dataset': 'SMAE_5ED + INCMNSZ_2015 (micronutrientes cruzados)',
        'foods_inserted': len(filas_f), 'foods_updated': 0, 'foods_skipped': 0,
    }], prefer='return=minimal')
    print('\nregistro de importación anotado.')


if __name__ == '__main__':
    main(dry='--dry' in sys.argv)

"""
EXTRACTOR DEL SMAE EN PDF · lo que el Excel no trae
═══════════════════════════════════════════════════

El PDF del SMAE es un escaneo. Su capa de texto está rota —sale invertida
(«orofsóF» por «Fósforo») y los números son ruido— así que se rasteriza a 300 dpi
y se pasa por el OCR de Vision, que reconoce español (`ocr_smae_run.py`).

La tabla está GIRADA 90°: las etiquetas de fila («ALIMENTO», «Unidad», «Peso
neto (g)») ocupan una columna a la izquierda y cada alimento es una franja
VERTICAL a su derecha. Por eso se agrupa por coordenada x —cada franja, un
alimento— y dentro de la franja se asigna cada dato a la fila cuya etiqueta
tiene más cerca en y. Es el mismo principio de coordenadas que ya hizo falta
para el INCMNSZ, y por la misma razón: emparejar por orden de lectura corre los
valores en silencio.

── Qué se busca aquí, y qué NO ─────────────────────────────────────────────────
Los valores nutricionales NO se tocan. Ya están en el Excel, que es fuente
limpia; un número salido de un escaneo es peor dato, y mezclarlos sería cambiar
precisión por ruido sin ganar nada.

Lo que sí aporta el PDF es lo que el Excel no tiene:

  · Erratas del Excel. El Excel dice «Alga para sushl»; el libro, «sushi».
  · Medidas caseras que el Excel no recoge para ese alimento («bolsita»,
    «pza med»), que es justo lo que la persona reconoce al registrar comida.

Todo sale marcado con su confianza de OCR y NADA se acepta sin que el nombre
case con un alimento del Excel: un «sinónimo» que en realidad sea una errata de
lectura es basura metida en la base, y es un riesgo real cuando 1 de cada 3
líneas del escaneo trae ruido.
"""
import json, re, unicodedata, collections
from difflib import SequenceMatcher

SCR = '/private/tmp/claude-502/-Users-sergio-Desktop-APP-C-E/0923ed23-55b8-44b9-b436-5f760ef4b142/scratchpad'
CONF_MIN = 0.45
TOL_X = 0.013          # ancho de franja: los alimentos van cada ~0,028
FILAS = ['ALIMENTO', 'Cantidad sugerida', 'Unidad', 'Peso bruto', 'Peso neto']


def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def sim(a, b):
    return SequenceMatcher(None, a, b).ratio()


# Unidades que el SMAE usa de verdad, con sus abreviaturas del libro. Sirve de
# filtro: el OCR devuelve «laza» por «taza» y «coita» por «cdita», y sin una
# lista cerrada esas lecturas entrarían como medidas nuevas.
UNIDADES = {
    'taza': 'taza', 'tazas': 'taza', 'cda': 'cucharada', 'cdas': 'cucharada',
    'cucharada': 'cucharada', 'cdita': 'cucharadita', 'cditas': 'cucharadita',
    'cucharadita': 'cucharadita', 'pza': 'pieza', 'pzas': 'pieza',
    'pieza': 'pieza', 'piezas': 'pieza', 'reb': 'rebanada',
    'rebanada': 'rebanada', 'rebanadas': 'rebanada', 'gramos': 'gramos',
    'ml': 'ml', 'vaso': 'vaso', 'copa': 'copa', 'lata': 'lata',
    'bolsa': 'bolsa', 'bolsita': 'bolsita', 'paquete': 'paquete',
    'sobre': 'sobre', 'barra': 'barra', 'porcion': 'porción', 'plato': 'plato',
}

# Un nombre con letras pegadas («Hojuelasde») o con una mayúscula suelta al final
# («crudaR») es un fallo de lectura, no una variante del libro.
RUIDO = re.compile(r'[a-záéíóúñ][A-ZÁÉÍÓÚÑ]|[A-ZÁÉÍÓÚÑ]$')


def franjas(lineas, x_min):
    """Agrupa las líneas en columnas verticales: una por alimento."""
    ls = sorted((l for l in lineas if l['x'] >= x_min), key=lambda l: l['x'])
    out, actual = [], []
    for l in ls:
        if actual and l['x'] - actual[-1]['x'] > TOL_X:
            out.append(actual); actual = []
        actual.append(l)
    if actual: out.append(actual)
    return out


def main():
    paginas = json.load(open(f'{SCR}/ocr_smae.json', encoding='utf-8'))
    smae = json.load(open('out/foods.json', encoding='utf-8'))
    ports = json.load(open('out/food_portions.json', encoding='utf-8'))

    por_nombre = {norm(f['name']): f for f in smae}
    medidas = collections.defaultdict(set)
    for p in ports:
        if not p['is_derived']:
            medidas[p['food_id']].add(norm(p['unit']))

    st = collections.Counter()
    correcciones, nuevas_medidas = [], []

    for pg in paginas:
        lineas = [l for l in pg['lines'] if l['conf'] >= CONF_MIN]
        anc = {}
        for e in FILAS:
            n = norm(e)
            c = [l for l in lineas if norm(l['text']).startswith(n)]
            if c: anc[e] = min(c, key=lambda l: l['x'])
        if len(anc) < 4: st['pagina_sin_tabla'] += 1; continue
        st['pagina_tabla'] += 1

        x_etiquetas = max(l['x'] + l['w'] for l in anc.values())
        y_unidad = anc.get('Unidad', {}).get('y')
        if y_unidad is None: st['sin_fila_unidad'] += 1; continue

        for fr in franjas(lineas, x_etiquetas):
            # El nombre va por debajo de la fila «Unidad»: el texto girado se
            # ancla abajo y crece hacia arriba, así que es el bloque más bajo.
            abajo = [l for l in fr if l['y'] > y_unidad
                     and not re.match(r'^[\d\s\.,/\|\-]+$', l['text'])]
            if not abajo: continue
            crudo = max(abajo, key=lambda l: len(l['text']))
            # La franja arrastra la «cantidad sugerida» pegada al nombre
            # («… con fruta 1», «… 3/4»): fuera, tantas veces como haga falta.
            nombre = crudo['text']
            for _ in range(3):
                nombre = re.sub(r'[\s ]*\d+\s*(?:[/.]\s*\d+)?[\s ]*$', '', nombre).strip()
            if len(nombre) < 4: continue

            n = norm(nombre)
            f = por_nombre.get(n)
            if not f:
                # Casi igual a uno del Excel → candidato a errata de la fuente.
                cerca = [(sim(n, k), k) for k in por_nombre if abs(len(k) - len(n)) <= 3]
                mejor = max(cerca, default=(0, None))
                if mejor[0] >= 0.9:
                    f = por_nombre[mejor[1]]
                    if n != mejor[1]:
                        correcciones.append({
                            'excel': f['name'], 'pdf': nombre,
                            'parecido': round(mejor[0], 3), 'conf': round(crudo['conf'], 2),
                            'pagina': pg['file'][-7:-4], 'food_id': f['id'],
                        })
                        st['posible_correccion'] += 1
                else:
                    st['nombre_sin_correspondencia'] += 1
                    continue
            else:
                st['nombre_reconocido'] += 1

            # Unidad declarada en esta franja, si el Excel no la tiene ya.
            cerca_u = [l for l in fr if abs(l['y'] - y_unidad) < 0.02]
            for l in cerca_u:
                u = norm(re.sub(r'[\d\.,/]+', ' ', l['text']))
                canon = UNIDADES.get(u)
                if not canon:
                    if u: st['unidad_descartada_no_reconocida'] += 1
                    continue
                if norm(canon) in medidas[f['id']] or u in medidas[f['id']]: continue

                # Una unidad sin su peso no sirve para registrar comida: hay que
                # saber cuántos gramos es «1 rebanada». Se lee de la fila «Peso
                # neto», y si no aparece, la medida se descarta entera en vez de
                # guardar media.
                gramos = cantidad = None
                for etiq, destino in (('Peso neto', 'g'), ('Cantidad sugerida', 'c')):
                    a = anc.get(etiq)
                    if not a: continue
                    cand = [x for x in fr if abs(x['y'] - a['y']) < 0.015
                            and re.match(r'^[\d\s\./]+$', x['text'].strip())]
                    if not cand: continue
                    t = cand[0]['text'].strip()
                    m = re.match(r'^(\d+)\s*/\s*(\d+)$', t)
                    val = int(m[1]) / int(m[2]) if m else (
                        float(t) if re.match(r'^\d+(\.\d+)?$', t) else None)
                    if val is None: continue
                    if destino == 'g': gramos = val
                    else: cantidad = val
                if not gramos or gramos <= 0:
                    st['medida_sin_peso_descartada'] += 1
                    continue

                nuevas_medidas.append({'food_id': f['id'], 'excel': f['name'],
                                       'unidad_pdf': canon, 'leido': u,
                                       'cantidad': cantidad, 'gramos': gramos,
                                       'conf': round(l['conf'], 2),
                                       'pagina': pg['file'][-7:-4]})
                st['medida_no_presente_en_excel'] += 1

    for k, v in st.most_common(): print(f"  {v:6d}  {k}")

    # ── Erratas ───────────────────────────────────────────────────────────────
    # Que dos nombres difieran no dice cuál está mal: el error puede venir del
    # Excel o del OCR. Lo decide el vocabulario del propio catálogo. Si la
    # palabra del Excel no aparece en ningún otro alimento y la del PDF sale
    # muchas veces, la buena es la del PDF («Lmburger» contra «Limburger»).
    # Si las dos son palabras corrientes, no hay forma de saberlo y se aparta:
    # «Cocoa sin azúcar» contra «Coco sin azúcar» son alimentos distintos, no
    # una errata.
    vocab = collections.Counter()
    for f in smae: vocab.update(norm(f['name']).split())

    votos = collections.defaultdict(collections.Counter)
    for c in correcciones: votos[c['food_id']][c['pdf']] += 1

    firmes, dudosas, ya = [], [], set()
    for c in correcciones:
        if c['food_id'] in ya: continue
        if c['pdf'] != votos[c['food_id']].most_common(1)[0][0]: continue
        ya.add(c['food_id'])
        c['veces'] = votos[c['food_id']][c['pdf']]

        te, tp = set(norm(c['excel']).split()), set(norm(c['pdf']).split())
        solo_e, solo_p = te - tp, tp - te
        seguro = (
            c['conf'] >= 1.0
            and not RUIDO.search(c['pdf'])
            and len(solo_e) == 1 and len(solo_p) == 1
            # plural contra singular no dice nada: puede ser cualquiera de las dos
            and norm(c['excel']).replace('s ', ' ') != norm(c['pdf']).replace('s ', ' ')
            # La palabra del Excel no aparece en ningún otro alimento: las
            # palabras de verdad se repiten, las erratas no.
            and vocab[next(iter(solo_e))] <= 1
            # Y la del libro, o bien se usa en otros alimentos, o bien es la
            # misma palabra con una letra cambiada. Lo segundo hace falta para
            # los nombres propios, que salen una sola vez: «Limburger» no
            # aparece en ningún otro queso, y sin esto se quedaba fuera.
            and (vocab[next(iter(solo_p))] >= 1
                 or sim(next(iter(solo_e)), next(iter(solo_p))) >= 0.85)
        )
        (firmes if seguro else dudosas).append(c)

    print(f"\nERRATAS DEL EXCEL QUE EL LIBRO CORRIGE ({len(firmes)}):")
    for c in sorted(firmes, key=lambda x: -x['parecido']):
        print(f"   p{c['pagina']}  Excel «{c['excel']}»  →  libro «{c['pdf']}»")
    print(f"\nDIFERENCIAS QUE NO SE PUEDEN RESOLVER SOLAS ({len(dudosas)}), no se tocan:")
    for c in sorted(dudosas, key=lambda x: -x['parecido'])[:12]:
        print(f"   p{c['pagina']}  «{c['excel']}»  vs  «{c['pdf']}»")

    agr = collections.defaultdict(collections.Counter)
    for m in nuevas_medidas: agr[(m['food_id'], m['excel'])][m['unidad_pdf']] += 1
    print(f"\nMEDIDAS DEL PDF QUE EL EXCEL NO TRAE ({len(agr)} alimentos):")
    for (fid, nombre), c in list(agr.items())[:25]:
        print(f"   {nombre[:44]:46s} {dict(c)}")

    json.dump({'erratas': firmes, 'dudosas': dudosas, 'medidas': nuevas_medidas},
              open('out/smae_pdf.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('\n→ out/smae_pdf.json')


if __name__ == '__main__':
    main()

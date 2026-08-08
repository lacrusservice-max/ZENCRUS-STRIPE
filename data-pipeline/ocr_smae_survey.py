"""
Reconocimiento del OCR del SMAE antes de extraer nada.

La tabla del PDF está girada 90°: cada alimento ocupa una franja vertical y las
etiquetas de fila («ALIMENTO», «Unidad», «Cantidad sugerida», «Peso neto (g)»)
viven en una columna a la izquierda. Antes de escribir un extractor conviene
saber qué hay de verdad ahí dentro, porque el Excel ya trae las 2.863 filas y lo
único que justifica este trabajo es lo que el Excel NO tiene.

La pregunta que responde este script: de los nombres que salen del OCR, ¿cuántos
ya están en el Excel, cuántos son variantes y cuántos son alimentos nuevos?
Un «sinónimo» que en realidad sea una errata de OCR sería basura metida en la
base, así que primero se mide y luego se decide.
"""
import json, re, unicodedata, collections, sys

SCR = '/private/tmp/claude-502/-Users-sergio-Desktop-APP-C-E/0923ed23-55b8-44b9-b436-5f760ef4b142/scratchpad'
ETIQUETAS = ['ALIMENTO', 'Cantidad sugerida', 'Unidad', 'Peso bruto', 'Peso neto',
             'Energía', 'Proteína', 'Lípidos', 'Hidratos de carbono']


def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', s)).strip()


def main():
    paginas = json.load(open(f'{SCR}/ocr_smae.json', encoding='utf-8'))
    smae = json.load(open('out/foods.json', encoding='utf-8'))
    conocidos = {norm(f['name']): f['name'] for f in smae}

    st = collections.Counter()
    tipos_pagina = collections.Counter()
    candidatos = []

    for pg in paginas:
        lineas = [l for l in pg['lines'] if l['conf'] >= 0.45]

        # Las etiquetas llegan con su unidad pegada («Peso bruto (g)»), así que
        # se buscan por comienzo de línea y no por igualdad.
        def etiqueta(e):
            n = norm(e)
            for l in lineas:
                if norm(l['text']).startswith(n): return l
            return None

        hallados = {e: etiqueta(e) for e in ETIQUETAS}
        if sum(1 for v in hallados.values() if v) < 4:
            tipos_pagina['sin_tabla'] += 1
            continue
        tipos_pagina['tabla'] += 1

        y_alimento = (hallados.get('ALIMENTO') or {}).get('y')
        y_unidad = (hallados.get('Unidad') or {}).get('y')
        if y_alimento is None:
            st['tabla_sin_etiqueta_ALIMENTO'] += 1
            continue

        # Los nombres viven a la derecha de la columna de etiquetas y por debajo
        # de la fila «Unidad»: el texto girado se ancla abajo y crece hacia arriba.
        for l in lineas:
            t = l['text'].strip()
            if l['x'] < 0.33 or len(t) < 4:
                continue
            if y_unidad is not None and l['y'] < y_unidad:
                continue
            if re.match(r'^[\d\s\.,/\-]+$', t):
                continue
            candidatos.append({'pagina': pg['file'][-7:-4], 'x': round(l['x'], 3),
                               'y': round(l['y'], 3), 'conf': round(l['conf'], 2),
                               'texto': t})

    print(f"páginas: {dict(tipos_pagina)}")
    for k, v in st.most_common(): print(f"  {v}  {k}")

    # ── ¿Se parecen a lo que ya tenemos? ─────────────────────────────────────
    exactos, parciales, nuevos = [], [], []
    for c in candidatos:
        n = norm(re.sub(r'\s*\d+([/.]\d+)?\s*$', '', c['texto']))   # cola numérica fuera
        if not n: continue
        if n in conocidos:
            exactos.append(c)
        elif any(n in k or k in n for k in conocidos):
            parciales.append(c)
        else:
            nuevos.append((n, c))

    tot = len(exactos) + len(parciales) + len(nuevos)
    print(f"\nCANDIDATOS A NOMBRE: {tot}")
    print(f"  {len(exactos):5d}  coinciden exactamente con el Excel")
    print(f"  {len(parciales):5d}  contenidos o contienen a uno del Excel")
    print(f"  {len(nuevos):5d}  sin correspondencia")

    print("\nMUESTRA DE LOS SIN CORRESPONDENCIA (¿alimentos nuevos o erratas de OCR?):")
    vistos = set()
    for n, c in nuevos:
        if n in vistos: continue
        vistos.add(n)
        print(f"   p{c['pagina']} conf={c['conf']}  {c['texto'][:60]}")
        if len(vistos) >= 40: break

    json.dump({'exactos': len(exactos), 'parciales': len(parciales),
               'nuevos': [n for n, _ in nuevos]},
              open(f'{SCR}/smae_survey.json', 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()

"""
CRUCE SMAE ↔ INCMNSZ
════════════════════

Los 2.855 alimentos del SMAE traen macros y medidas caseras pero les faltan
magnesio, zinc, B12, D y compañía. Los 1.669 del INCMNSZ traen justo eso. Este
paso los une por nombre.

── Por qué el emparejamiento por cadena fallaba ────────────────────────────────
Las dos fuentes nombran al revés. El SMAE escribe «Pechuga de pollo» y el
INCMNSZ «Pollo, pechuga». Comparar las cadenas completas penaliza ese giro como
si fueran alimentos distintos, y el índice por primera palabra ni siquiera los
ponía frente a frente: «pechuga» y «pollo» caen en cajones diferentes. Por eso
solo cruzaban 127 de 2.855.

La solución es dejar de mirar el orden. Cada nombre se convierte en un conjunto
de palabras y se comparan por solapamiento (Jaccard):

    «Pechuga de pollo»  → {pechuga, pollo}
    «Pollo, pechuga»    → {pollo, pechuga}      solapamiento 1.00

El índice invertido va por todas las palabras, no solo la primera, así que el
candidato aparece se llame como se llame el orden. Las palabras se comparan con
tolerancia a plural y a erratas de la fuente («galletas»/«galleta»,
«sushl»/«sushi»), que si no se escapan buenos cruces por una letra.

── Por qué el cruce sigue siendo peligroso ─────────────────────────────────────
Un emparejamiento equivocado no da error: asigna micronutrientes de otro
alimento y la ficha queda plausible pero falsa. «Arroz cocido» y «Arroz,
harina» comparten palabras y son cosas distintas.

Cuatro defensas, y las cuatro deben pasar:

  1. Solapamiento alto de palabras, ya sin efecto del orden.
  2. Coincidencia de la preparación cuando ambos la declaran: «cocido» no
     empareja con «crudo» aunque el resto del nombre sea idéntico.
  3. Coincidencia de la negación: «sin azúcar» no empareja con «con azúcar».
     El nombre casi entero coincide y el sentido es el contrario.
  4. Contraste de energía. Si ambos declaran kcal por 100 g y difieren más de
     un 25 %, no son el mismo alimento por mucho que se llamen igual. Este es
     el filtro que caza los falsos positivos que el nombre deja pasar.

Lo que no supera las cuatro se queda sin cruzar. Un hueco es honesto; un dato de
otro alimento es un error que nadie detecta.
"""
import json, re, unicodedata, sys
from difflib import SequenceMatcher
from collections import Counter, defaultdict

# Umbral elegido mirando los cruces, no la curva. Entre 0,50 y 0,62 lo que
# entra es correcto casi siempre («Filete de róbalo»↔«Robalo, crudo»,
# «Harina de soya»↔«Soja (Soya), harina»). Por debajo de 0,50 empiezan los
# cruces entre alimentos que no tienen nada que ver —«Pasta de cacahuate
# desgrasada» con «Jojoba, pasta desgrasada»— y ahí se corta.
UMBRAL_SOLAPE  = 0.50     # solapamiento mínimo de palabras
SOLAPE_SEGURO  = 0.90     # por debajo de esto, la energía debe confirmar el cruce
TOL_ENERGIA    = 0.25     # desvío máximo de kcal/100 g entre fuentes
TOL_PALABRA    = 0.88     # parecido mínimo para dar dos palabras por iguales


def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii', 'ignore').decode().lower()
    s = re.sub(r'[^a-z0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


# Palabras de función: no distinguen alimentos, solo diluyen el solapamiento.
STOP = {'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'al', 'en', 'un',
        'una', 'para', 'su', 'e', 'u', 'lo', 'se', 'tipo', 'the', 'of'}

PREP_WORDS = {'cocido', 'cocida', 'cocidos', 'cocidas', 'crudo', 'cruda', 'crudos',
              'crudas', 'frito', 'frita', 'fritos', 'fritas', 'asado', 'asada',
              'horneado', 'horneada', 'hervido', 'hervida', 'tostado', 'tostada',
              'enlatado', 'enlatada', 'deshidratado', 'deshidratada', 'congelado',
              'congelada', 'guisado', 'guisada', 'vapor', 'plancha', 'capeado',
              'empanizado'}

# Familias de preparación: «cocido» y «hervido» no son un choque real.
PREP_FAM = {'cocido': 'cocido', 'cocida': 'cocido', 'cocidos': 'cocido', 'cocidas': 'cocido',
            'hervido': 'cocido', 'hervida': 'cocido', 'vapor': 'cocido',
            'crudo': 'crudo', 'cruda': 'crudo', 'crudos': 'crudo', 'crudas': 'crudo',
            'frito': 'frito', 'frita': 'frito', 'fritos': 'frito', 'fritas': 'frito',
            'capeado': 'frito', 'empanizado': 'frito',
            'asado': 'asado', 'asada': 'asado', 'plancha': 'asado',
            'horneado': 'horneado', 'horneada': 'horneado', 'tostado': 'tostado',
            'tostada': 'tostado', 'enlatado': 'enlatado', 'enlatada': 'enlatado',
            'deshidratado': 'deshidratado', 'deshidratada': 'deshidratado',
            'congelado': 'congelado', 'congelada': 'congelado',
            'guisado': 'guisado', 'guisada': 'guisado'}


def stem(w):
    """Plural fuera, para que «galletas» y «galleta» sean la misma palabra."""
    if len(w) > 4 and w.endswith('es'): return w[:-2]
    if len(w) > 3 and w.endswith('s'):  return w[:-1]
    return w


def tokens(name):
    """Conjunto de palabras significativas, sin preparación ni relleno."""
    return {stem(w) for w in norm(name).split()
            if w not in STOP and w not in PREP_WORDS and len(w) > 2}


def prep_of(name):
    return {PREP_FAM[w] for w in norm(name).split() if w in PREP_FAM}


# ── Origen del alimento ───────────────────────────────────────────────────────
# El INCMNSZ encabeza muchos nombres con el género —«Porcinos, jamón americano»,
# «Aves, pollo entero»— que el SMAE no escribe. Ese prefijo hunde el
# solapamiento de cruces que son correctos. Se puede descontar, pero solo con
# red: si las dos fuentes nombran especies DISTINTAS, el cruce se rechaza sin
# más. Confundir cerdo con res en una app de nutrición no es un error de
# precisión, es otro alimento.
ESPECIE = {
    'cerdo': 'cerdo', 'cerdos': 'cerdo', 'porcino': 'cerdo', 'porcinos': 'cerdo',
    'puerco': 'cerdo', 'lechon': 'cerdo', 'jabali': 'cerdo',
    'res': 'res', 'bovino': 'res', 'bovinos': 'res', 'ternera': 'res',
    'vacuno': 'res', 'buey': 'res',
    'pollo': 'pollo', 'gallina': 'pollo',
    'pavo': 'pavo', 'guajolote': 'pavo', 'pato': 'pato', 'codorniz': 'codorniz',
    'borrego': 'ovino', 'cordero': 'ovino', 'ovino': 'ovino', 'ovinos': 'ovino',
    'carnero': 'ovino', 'chivo': 'caprino', 'cabrito': 'caprino',
    'caprino': 'caprino', 'caprinos': 'caprino',
    'conejo': 'conejo', 'venado': 'venado',
}

# Paraguas taxonómicos: encabezan el nombre en el INCMNSZ pero no dicen la
# especie. «Aves» no contradice ni a pollo ni a pavo, así que no puede votar en
# el choque de especies —tratarlo como una más daba por bueno cruzar «Carne
# molida de pollo» con «Aves, pavo carne molida»—, pero sí es prefijo que quitar.
GENERO_TAX = {'porcinos', 'porcino', 'bovinos', 'bovino', 'aves', 'ave',
              'ovinos', 'ovino', 'caprinos', 'caprino', 'pescados', 'pescado',
              'mariscos', 'carnes', 'carne', 'visceras', 'huevo', 'huevos',
              'crustaceos', 'moluscos'} | set(ESPECIE)


def origen(name):
    """Solo especies concretas; los paraguas no cuentan."""
    return {ESPECIE[w] for w in norm(name).split() if w in ESPECIE}


# ── Forma del producto ────────────────────────────────────────────────────────
# Un elaborado no es su materia prima. «Gelatina de uva» contra «Uva» comparte
# casi todo el nombre y en algún caso hasta las kcal, pero son alimentos
# distintos; lo mismo «Pasta de almendras» contra «Almendra». Aquí no basta la
# regla de la preparación —que solo actúa si AMBOS la declaran—, porque el
# peligro está justo en que uno la declare y el otro no.
FORMA = {'gelatina', 'salsa', 'jarabe', 'pasta', 'harina', 'aceite', 'crema',
         'licuado', 'atole', 'mermelada', 'jugo', 'nectar', 'pure', 'mole',
         'caldo', 'consome', 'sopa', 'polvo', 'tortilla', 'galleta', 'pan',
         'pastel', 'helado', 'yogur', 'yogurt', 'yoghurt', 'queso',
         'mantequilla', 'manteca', 'vinagre', 'almibar', 'bebida', 'refresco',
         'barra', 'paleta', 'tamal', 'papilla', 'compota', 'flan', 'budin',
         'nieve', 'gluten'}

# «Dulce», «Cereal» o «Guiso» encabezan nombres del INCMNSZ como categoría, no
# como forma del producto: «Dulce, rollo de guayaba» es un rollo de guayaba.
# Contarlas como forma rechazaba cruces correctos por una palabra de índice.
CATEGORIA_INCMNSZ = {'dulce', 'dulces', 'cereal', 'cereales', 'guiso', 'guisado',
                     'conserva', 'conservas', 'bebidas', 'alimento', 'alimentos'}


def forma(name):
    return {stem(w) for w in norm(name).split()
            if w in FORMA and w not in CATEGORIA_INCMNSZ}


def sin_genero(name):
    """
    Tokens del nombre INCMNSZ sin su prefijo taxonómico: «Porcinos, jamón» → {jamon}.

    Solo se descuenta cuando el prefijo entero son palabras de género —«Porcinos»,
    «Aves», «Pescados»—, que es vocabulario de clasificación y no de cocina: el
    SMAE nunca llama así a un alimento. Descontar cualquier primera palabra sería
    otra cosa: se comería la identidad del alimento y emparejaba «Chocolate con
    leche» con «Amaranto, con chocolate», o «Limón sin semilla» con «Tuna
    Chaveña, sin semilla».
    """
    if ',' not in name: return None
    cabeza = norm(name.split(',', 1)[0]).split()
    if not cabeza or not all(w in GENERO_TAX for w in cabeza): return None
    return tokens(name.split(',', 1)[1]) or None


def negations(name):
    """{'azucar'} para «sin azúcar» — lo que el alimento declara NO llevar."""
    ws = norm(name).split()
    return {stem(ws[i + 1]) for i, w in enumerate(ws)
            if w == 'sin' and i + 1 < len(ws) and len(ws[i + 1]) > 2}


def solape(a, b, peso):
    """
    Jaccard con emparejamiento tolerante y palabras pesadas por su rareza.

    Cada palabra de A se casa como mucho con una de B, exacta o muy parecida.
    Inmune al orden por construcción.

    El peso importa tanto como el solapamiento. Contando palabras a secas,
    «Cebolla blanca rebanada» contra «Cebolla Blanca» sacaba 0,67 —el mismo
    castigo que se lleva «Calabaza de Castilla cocida» contra «Calabaza, de
    Castilla, SEMILLA»— y las dos cosas no se parecen en nada: «rebanada» es
    relleno que aparece por todas partes y «semilla» cambia el alimento. Pesar
    por rareza separa un caso del otro: sobrar una palabra común casi no resta,
    sobrar una rara hunde el parecido.
    """
    if not a or not b: return 0.0
    libres, casadas = set(b), []
    for w in a:
        if w in libres:
            libres.discard(w); casadas.append(w); continue
        mejor, mr = None, TOL_PALABRA
        for c in libres:
            r = SequenceMatcher(None, w, c).ratio()
            if r >= mr: mejor, mr = c, r
        if mejor:
            libres.discard(mejor); casadas.append(w)
    if not casadas: return 0.0
    p_cas = sum(peso(w) for w in casadas)
    sobran = (a - set(casadas)) | libres
    return p_cas / (p_cas + sum(peso(w) for w in sobran))


MICROS = ['magnesium_mg', 'zinc_mg', 'copper_mg', 'manganese_mg', 'selenium_mg',
          'vitamin_b1_mg', 'vitamin_b2_mg', 'niacin_mg', 'vitamin_b6_mg',
          'vitamin_b12_mg', 'vitamin_d_mg', 'folate_mg_dfe', 'fiber_total_g',
          'water_g', 'ash_g', 'energy_kj', 'carotenes_mg', 'beta_carotenes_mg']


def main(umbral=UMBRAL_SOLAPE, verbose=True):
    smae  = json.load(open('out/foods.json', encoding='utf-8'))
    snuts = {n['food_id']: n for n in json.load(open('out/food_nutrients.json', encoding='utf-8'))
             if n['basis'] == '100g'}
    incm  = json.load(open('out/incmnsz_foods.json', encoding='utf-8'))
    inuts = {n['food_id']: n for n in json.load(open('out/incmnsz_nutrients.json', encoding='utf-8'))}

    # Índice invertido por TODAS las palabras: el orden del nombre deja de importar.
    idx, itok, igen = defaultdict(list), {}, {}
    for f in incm:
        t = tokens(f['name'])
        if not t: continue
        itok[f['id']] = t
        igen[f['id']] = sin_genero(f['name'])
        for w in t:
            idx[w].append(f)

    # Rareza de cada palabra sobre las dos fuentes juntas. «cocido» o «rebanada»
    # salen en cientos de nombres y casi no distinguen; «pescuezo» o «chipotle»
    # aparecen en dos o tres y mandan.
    import math
    df = Counter()
    for t in list(itok.values()) + [tokens(f['name']) for f in smae]:
        df.update(t)
    N = len(incm) + len(smae)
    peso = lambda w: math.log(N / (1 + df.get(w, 0)))

    links, st = [], Counter()
    rechazos = defaultdict(list)

    for f in smae:
        ts = tokens(f['name'])
        if not ts: st['sin_palabras'] += 1; continue

        cands = {c['id']: c for w in ts for c in idx.get(w, [])}
        if not cands: st['sin_candidato'] += 1; continue

        pf, nf = prep_of(f['name']), negations(f['name'])
        ks = (snuts.get(f['id']) or {}).get('energy_kcal')

        best, bs, motivo = None, 0.0, None
        of, ff = origen(f['name']), forma(f['name'])
        for cf in cands.values():
            # Especies distintas declaradas a ambos lados: fuera, sin mirar nada más.
            oc = origen(cf['name'])
            if of and oc and not (of & oc):
                motivo = 'origen_distinto'; continue
            # Elaborado contra materia prima: tampoco. La condición es asimétrica
            # a propósito —salta cuando UNO declara forma y el otro no— porque el
            # peligro está justo ahí: «Gelatina de durazno» contra «Durazno».
            # Si los dos declaran forma, aunque no sea la misma, deciden el
            # solapamiento y la energía: «Puré de jitomate» contra «Jitomate,
            # puré, conserva» es el mismo alimento y no debe caerse por una
            # palabra de más.
            fc = forma(cf['name'])
            if bool(ff) != bool(fc):
                motivo = 'forma_distinta'; continue
            s = solape(ts, itok[cf['id']], peso)
            sg = igen.get(cf['id'])
            if sg: s = max(s, solape(ts, sg, peso))
            if s < umbral:
                motivo = motivo or 'solape_bajo'; continue
            pc = prep_of(cf['name'])
            if pf and pc and not (pf & pc):
                motivo = 'preparacion'; continue
            nc = negations(cf['name'])
            # «sin azúcar» contra algo que sí lleva azúcar (y viceversa).
            if (nf - nc) & itok[cf['id']] or (nc - nf) & ts:
                motivo = 'negacion'; continue
            ki = (inuts.get(cf['id']) or {}).get('energy_kcal')
            if ks and ki and ks > 0 and abs(ks - ki) / ks > TOL_ENERGIA:
                motivo = 'energia'; continue
            # Cuando el nombre no es concluyente, la energía deja de ser opcional:
            # sin ese contraste no queda nada que distinga «Chile Chipotle seco»
            # de «Chile Chipotle enlatado», y el error no daría señal ninguna.
            if s < SOLAPE_SEGURO and not (ks and ki):
                motivo = 'sin_energia_para_confirmar'; continue
            if s > bs: best, bs = cf, s

        if not best:
            st[f'rechazo_{motivo or "sin_candidato"}'] += 1
            rechazos[motivo or 'sin_candidato'].append(f['name'])
            continue

        ki = (inuts.get(best['id']) or {}).get('energy_kcal')
        st['verificado_por_energia' if (ks and ki) else 'sin_contraste_energia'] += 1

        src = inuts.get(best['id'], {})
        add = {k: src[k] for k in MICROS if src.get(k) is not None}
        if not add: st['sin_micros_que_aportar'] += 1; continue

        links.append({
            'smae_food_id': f['id'], 'smae_name': f['name'],
            'incmnsz_food_id': best['id'], 'incmnsz_name': best['name'],
            'overlap': round(bs, 3),
            'energy_smae': ks, 'energy_incmnsz': ki,
            'micros_added': len(add), 'micros': add,
        })
        st['cruzado'] += 1

    if not verbose:
        return links, st

    json.dump(links, open('out/crossmatch.json', 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print(f"CRUCES ACEPTADOS  {len(links)} de {len(smae)}"
          f"  ({100*len(links)/len(smae):.1f} %)\n")
    for k, v in st.most_common(): print(f"  {v:5d}  {k}")

    print("\nPOR BANDA DE SOLAPAMIENTO:")
    bandas = Counter()
    for l in links:
        bandas['1.00' if l['overlap'] == 1 else
               f"{int(l['overlap']*10)/10:.1f}–{int(l['overlap']*10)/10+0.1:.1f}"] += 1
    for b, c in sorted(bandas.items(), reverse=True): print(f"  {c:5d}  {b}")

    print("\nMUESTRA DE CRUCES ACEPTADOS (los de solapamiento más bajo, que son los dudosos):")
    for l in sorted(links, key=lambda x: x['overlap'])[:12]:
        print(f"  {l['overlap']:.2f}  {l['smae_name'][:34]:36s} ↔ {l['incmnsz_name'][:34]:36s} "
              f"{l['energy_smae']}/{l['energy_incmnsz']} kcal")
    print(f"\nmicronutrientes añadidos: {sum(l['micros_added'] for l in links)}")
    return links, st


if __name__ == '__main__':
    main(float(sys.argv[1]) if len(sys.argv) > 1 else UMBRAL_SOLAPE)

"""
ETIQUETAS Y GRUPOS FUNCIONALES · ZENCRUS
═══════════════════════════════════════

Dos añadidos derivados, ambos marcados como tales porque NO son dato de fuente.

── Etiquetas ───────────────────────────────────────────────────────────────────
Cada etiqueta lleva la regla que la justifica. Los umbrales siguen el criterio
de declaraciones nutricionales del Codex/UE por 100 g, que es el marco público
más usado; los que no tienen equivalente regulado van marcados como criterio
propio de Zencrus para que se sepa de dónde salen.

Una etiqueta que no se puede probar con los datos NO se emite. En concreto:

  «Sin azúcar añadida» depende de la lista de ingredientes, no de la
  composición: un zumo sin azúcar añadida y otro azucarado pueden dar la misma
  cifra de azúcares. La fuente no trae ingredientes, así que no se emite.

  «Vegano» / «Vegetariano» tampoco. El grupo SMAE identifica el origen animal
  (AOA, Leche) y de ahí sale «origen animal» con certeza, pero lo contrario no
  se deduce: la gelatina está en Azúcares y es de origen animal. Marcar algo
  como vegano por omisión sería un error con consecuencias reales para quien
  confía en la etiqueta.

── Grupos ──────────────────────────────────────────────────────────────────────
El SMAE clasifica por equivalentes, no por origen: la papa vive en «Cereales
sin grasa» y el atún en «AOA muy bajo aporte de grasa». Para la app hace falta
además el grupo intuitivo. Se deduce del nombre con reglas explícitas y queda
en `group_zencrus`, separado del `group_smae`, que sigue siendo el dato fiel.
"""
import json, re, unicodedata

def norm(s):
    s = unicodedata.normalize('NFKD', str(s)).encode('ascii','ignore').decode()
    return s.lower()

# ── Grupos funcionales, por palabra en el nombre ──────────────────────────────
# El orden importa: la primera regla que casa, gana.
GROUP_RULES = [
 ('Pescados y mariscos', r'\b(atun|salmon|mojarra|tilapia|bacalao|sardina|camaron|pulpo|calamar|almeja|ostion|jaiba|cangrejo|langosta|marlin|sierra|robalo|huachinango|trucha|pescado|surimi|caviar|mejillon|filete de pesc)'),
 ('Huevos',              r'\bhuevo|clara de huevo|yema'),
 ('Lácteos',             r'\b(leche|yogur|queso|requeson|crema|jocoque|kefir|lactea)'),
 ('Carnes',              r'\b(res|cerdo|pollo|pavo|cordero|ternera|carne|bistec|chuleta|jamon|tocino|salchicha|chorizo|milanesa|arrachera|higado|molida|pechuga|muslo|pierna|costilla|barbacoa|carnitas|birria|machaca|cecina|longaniza|pastrami|mortadela|salami|pepperoni)'),
 ('Leguminosas',         r'\b(frijol|lenteja|garbanzo|haba|alubia|soya|soja|edamame|chicharo seco)'),
 ('Frutos secos y semillas', r'\b(almendra|nuez|nueces|cacahuate|pistache|avellana|marañon|maranon|semilla|chia|linaza|ajonjoli|girasol|calabaza pepita|pepita|amaranto|macadamia|piñon|pinon)'),
 ('Tubérculos y raíces', r'\b(papa|camote|yuca|betabel|zanahoria|nabo|jicama|malanga|ñame|name)'),
 ('Verduras',            r''),   # se resuelve por grupo SMAE
 ('Frutas',              r''),
 ('Grasas y aceites',    r'\b(aceite|mantequilla|margarina|manteca|aguacate|aderezo|mayonesa|crema para)'),
 ('Azúcares y endulzantes', r'\b(azucar|miel|mermelada|jarabe|piloncillo|cajeta|chocolate|dulce|caramelo|gelatina|helado|nieve|paleta|galleta|pastel|pan dulce|churro|flan|natilla)'),
 ('Bebidas',             r'\b(agua|jugo|refresco|te |cafe|bebida|licuado|malteada|cerveza|vino|tequila|ron|whisky|vodka|mezcal|licor|smoothie|atole)'),
 ('Cereales y derivados', r'\b(arroz|pan|tortilla|pasta|avena|trigo|maiz|cereal|harina|galleta salada|tostada|bolillo|baguette|croissant|hot ?cake|waffle|granola|quinoa|cuscus|couscous|elote|palomita)'),
 ('Condimentos y especias', r'\b(sal\b|pimienta|comino|oregano|canela|vainilla|mostaza|catsup|salsa|vinagre|consome|caldo|especia|chile en polvo|ajo en polvo)'),
]
SMAE_TO_GROUP = {
 'Verduras': 'Verduras', 'Frutas': 'Frutas', 'Leguminosas': 'Leguminosas',
 'Leche descremada': 'Lácteos', 'Leche semidescremada': 'Lácteos',
 'Leche entera': 'Lácteos', 'Leche con azúcar': 'Lácteos',
 'Bebidas alcohólicas': 'Bebidas',
 'Azúcares sin grasa': 'Azúcares y endulzantes',
 'Azúcares con grasa': 'Azúcares y endulzantes',
 'Cereales sin grasa': 'Cereales y derivados',
 'Cereales con grasa': 'Cereales y derivados',
 'Grasas sin proteína': 'Grasas y aceites',
 'Grasas con proteína': 'Grasas y aceites',
}
ANIMAL_GROUPS = ('AOA', 'Leche')

def group_of(name, smae):
    n = norm(name)
    for g, rx in GROUP_RULES:
        if rx and re.search(rx, n): return g
    return SMAE_TO_GROUP.get(smae, 'Alimentos procesados')

# ── Umbrales de etiqueta, por 100 g ──────────────────────────────────────────
# (etiqueta, campo, comparador, umbral, justificación)
RULES = [
 ('Alto en fibra',       'fiber_g',       '>=', 6.0,  'Codex/UE: ≥6 g de fibra por 100 g'),
 ('Fuente de fibra',     'fiber_g',       '>=', 3.0,  'Codex/UE: ≥3 g de fibra por 100 g'),
 ('Bajo en grasa',       'fat_g',         '<=', 3.0,  'Codex/UE: ≤3 g de grasa por 100 g'),
 ('Sin grasa',           'fat_g',         '<=', 0.5,  'Codex/UE: ≤0,5 g de grasa por 100 g'),
 ('Bajo en sodio',       'sodium_mg',     '<=', 120.0,'Codex/UE: ≤120 mg de sodio por 100 g'),
 ('Alto en calcio',      'calcium_mg',    '>=', 240.0,'≥30 % del VRN de calcio (800 mg) por 100 g'),
 ('Fuente de calcio',    'calcium_mg',    '>=', 120.0,'≥15 % del VRN de calcio (800 mg) por 100 g'),
 ('Alto en hierro',      'iron_mg',       '>=', 4.2,  '≥30 % del VRN de hierro (14 mg) por 100 g'),
 ('Alto en potasio',     'potassium_mg',  '>=', 600.0,'≥30 % del VRN de potasio (2000 mg) por 100 g'),
 ('Rico en vitamina C',  'vitamin_c_mg',  '>=', 24.0, '≥30 % del VRN de vitamina C (80 mg) por 100 g'),
 ('Bajo en carbohidratos','carbs_g',      '<=', 5.0,  'Criterio Zencrus: ≤5 g de hidratos por 100 g'),
 ('Bajo en azúcar',      'sugar_g',       '<=', 5.0,  'Codex/UE: ≤5 g de azúcares por 100 g'),
]

def main():
    foods = json.load(open('out/foods.json', encoding='utf-8'))
    nuts  = {n['food_id']: n for n in json.load(open('out/food_nutrients.json', encoding='utf-8'))
             if n['basis'] == '100g'}

    tags = []
    from collections import Counter
    gcount, tcount = Counter(), Counter()

    for f in foods:
        f['group_zencrus'] = group_of(f['name'], f['group_smae'])
        gcount[f['group_zencrus']] += 1
        n = nuts.get(f['id'])
        if not n: continue

        for label, field, op, thr, why in RULES:
            v = n.get(field)
            if v is None: continue          # dato ausente: no se etiqueta
            ok = v >= thr if op == '>=' else v <= thr
            if ok:
                tags.append({'food_id': f['id'], 'tag': label, 'rationale': f'{why} (valor: {v})'})
                tcount[label] += 1

        # Proteína: por porcentaje de la energía, no por gramos. 100 g de
        # lechuga y 100 g de pollo pueden dar gramos parecidos con densidades
        # calóricas opuestas; lo que importa es de dónde vienen las kcal.
        kcal, prot = n.get('energy_kcal'), n.get('protein_g')
        if kcal and prot and kcal > 0:
            pct = prot * 4 / kcal * 100
            if pct >= 20:
                tags.append({'food_id': f['id'], 'tag': 'Alto en proteína',
                             'rationale': f'≥20 % de la energía procede de proteína ({pct:.0f} %)'})
                tcount['Alto en proteína'] += 1
            elif pct >= 12:
                tags.append({'food_id': f['id'], 'tag': 'Fuente de proteína',
                             'rationale': f'≥12 % de la energía procede de proteína ({pct:.0f} %)'})
                tcount['Fuente de proteína'] += 1

        # Origen animal: certeza a partir del grupo SMAE. Lo contrario no se
        # deduce, así que no se emite «vegano» ni «vegetariano».
        if any(f['group_smae'].startswith(g) for g in ANIMAL_GROUPS):
            tags.append({'food_id': f['id'], 'tag': 'Origen animal',
                         'rationale': f"Grupo SMAE «{f['group_smae']}»"})
            tcount['Origen animal'] += 1

        if 'integral' in norm(f['name']):
            tags.append({'food_id': f['id'], 'tag': 'Integral',
                         'rationale': 'El nombre del alimento en la fuente lo declara integral'})
            tcount['Integral'] += 1

    json.dump(foods, open('out/foods.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump(tags,  open('out/food_tags.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)

    print(f"ETIQUETAS  {len(tags)}\n")
    for t, c in tcount.most_common(): print(f"  {c:5d}  {t}")
    print(f"\nGRUPOS ZENCRUS ({len(gcount)}):")
    for g, c in gcount.most_common(): print(f"  {c:5d}  {g}")

if __name__ == '__main__':
    main()

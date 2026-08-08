"""Validación del bloque SMAE antes de pasar a los PDF."""
import json
from collections import Counter, defaultdict

foods = json.load(open('out/foods.json', encoding='utf-8'))
ports = json.load(open('out/food_portions.json', encoding='utf-8'))
nuts  = json.load(open('out/food_nutrients.json', encoding='utf-8'))
tags  = json.load(open('out/food_tags.json', encoding='utf-8'))

ids = {f['id'] for f in foods}
fail = []

def check(name, ok, detail=''):
    print(f"  {'✓' if ok else '✗'} {name}{'' if ok else '  → ' + detail}")
    if not ok: fail.append(name)

print("INTEGRIDAD REFERENCIAL")
check('portions → foods', all(p['food_id'] in ids for p in ports),
      f"{sum(1 for p in ports if p['food_id'] not in ids)} huérfanas")
check('nutrients → foods', all(n['food_id'] in ids for n in nuts))
check('tags → foods', all(t['food_id'] in ids for t in tags))

print("\nUNICIDAD")
check('ids únicos', len(ids) == len(foods), f"{len(foods)-len(ids)} repetidos")
pk = Counter((p['food_id'], p['label']) for p in ports)
check('medida única por alimento', all(v == 1 for v in pk.values()),
      f"{sum(1 for v in pk.values() if v>1)} colisiones")
nk = Counter((n['food_id'], n['basis']) for n in nuts)
check('una base nutricional por tipo', all(v == 1 for v in nk.values()))

print("\nCOBERTURA")
with100 = {n['food_id'] for n in nuts if n['basis'] == '100g'}
check('todos con datos por 100 g', with100 == ids, f"faltan {len(ids-with100)}")
wp = {p['food_id'] for p in ports}
check('todos con al menos una medida', wp == ids, f"sin medida: {len(ids-wp)}")
src = {p['food_id'] for p in ports if not p['is_derived']}
check('todos con medida de fuente', src == ids, f"solo derivadas: {len(ids-src)}")

print("\nCOHERENCIA DE DATOS")
check('gramos siempre positivos', all(p['grams'] > 0 for p in ports),
      f"{sum(1 for p in ports if p['grams']<=0)} con gramos ≤ 0")
bad_pct = [f for f in foods if f['edible_portion_pct'] and not (0 < f['edible_portion_pct'] <= 100)]
check('parte comestible en 0–100 %', not bad_pct, f"{len(bad_pct)} fuera de rango")

# Atwater: las kcal declaradas deben acercarse a 4P + 4HC + 9G + 7 etanol
off = []
for n in nuts:
    if n['basis'] != 'portion': continue
    k, p, c, g = n['energy_kcal'], n['protein_g'], n['carbs_g'], n['fat_g']
    e = n.get('ethanol_g') or 0
    if None in (k, p, c, g) or k < 20: continue
    calc = p*4 + c*4 + g*9 + e*7
    if abs(calc - k) / k > 0.30: off.append((n['food_id'], k, round(calc)))
check('energía cuadra con macros (±30 %)', len(off) < len(nuts)*0.02,
      f"{len(off)} alimentos fuera de tolerancia")

print("\nDERIVADOS BIEN MARCADOS")
check('100 g marcado como derivado',
      all(n['is_derived'] for n in nuts if n['basis']=='100g'))
check('porción marcada como fuente',
      all(not n['is_derived'] for n in nuts if n['basis']=='portion'))
d = sum(1 for p in ports if p['is_derived']); s = len(ports)-d
print(f"     medidas: {s} de fuente · {d} derivadas")

print("\nTRAZABILIDAD")
check('toda medida tiene fuente', all(p.get('source') for p in ports))
check('todo alimento verificado', all(f['verified'] for f in foods))
check('toda etiqueta justificada', all(t.get('rationale') for t in tags))

print(f"\n{'BLOQUE VÁLIDO' if not fail else 'FALLOS: ' + ', '.join(fail)}")
if off[:5]:
    print("\nEjemplos fuera de Atwater (revisar en fuente):")
    byid = {f['id']: f['name'] for f in foods}
    for i,k,c in off[:5]: print(f"   {byid[i][:44]:46s} declara {k} · calculado {c}")

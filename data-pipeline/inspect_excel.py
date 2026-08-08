"""Sondeo del Excel SMAE: valores atípicos y calidad del dato antes de extraer."""
import openpyxl, re
from collections import Counter

SRC = '/Users/sergio/Desktop/APP C+E/LISTA ALIMENTARIA/SMAE 5ta Edicion EXCEL CALCULOS (2).xlsx'
wb = openpyxl.load_workbook(SRC, data_only=True, read_only=True)
ws = wb['Todos los alimentos']
rows = list(ws.iter_rows(min_row=3, values_only=True))

units = Counter(); qty = Counter(); nd = Counter(); blanks = Counter()
hdr = ['grupo','alimento','key','cantidad','unidad','bruto','neto','energia','proteina',
       'lipidos','hc','ags','agm','agp','colesterol','azucar','fibra','vitA','vitC','folico',
       'calcio','hierro','potasio','sodio','fosforo','etanol','ig','cg']
for r in rows:
    units[r[4]] += 1
    qty[str(r[3])] += 1
    for i, v in enumerate(r[:28]):
        if v is None: blanks[hdr[i]] += 1
        elif isinstance(v, str) and v.strip().upper() in ('ND','N/D','-',''): nd[hdr[i]] += 1

print(f"FILAS: {len(rows)}\n")
print("UNIDADES DISTINTAS:", len(units))
for u,n in units.most_common(20): print(f"  {n:5d}  {u!r}")
print("\nCANTIDADES DISTINTAS:", len(qty))
for q,n in qty.most_common(18): print(f"  {n:5d}  {q!r}")
print("\nCAMPOS CON 'ND' (dato no disponible):")
for k,n in nd.most_common(): print(f"  {n:5d}  {k}")
print("\nCAMPOS VACÍOS:")
for k,n in blanks.most_common(): print(f"  {n:5d}  {k}")

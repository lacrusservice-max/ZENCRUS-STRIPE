"""
Rasteriza el SMAE escaneado y lo pasa por el OCR de Vision.

Se hace en dos fases separadas y con caché en disco porque el OCR de 208 páginas
no es barato: si algo falla en el análisis posterior, no hay que repetirlo.
"""
import json, os, subprocess, sys
import pypdfium2 as pdfium

SRC = '/Users/sergio/Desktop/APP C+E/LISTA ALIMENTARIA/SMAE 5a ed - Ana Bertha Pérez Lizaur-1.pdf'
SCR = '/private/tmp/claude-502/-Users-sergio-Desktop-APP-C-E/0923ed23-55b8-44b9-b436-5f760ef4b142/scratchpad'
PAGES, OUT = f'{SCR}/pages', f'{SCR}/ocr_smae.json'
AQUI = os.path.dirname(os.path.abspath(__file__))

os.makedirs(PAGES, exist_ok=True)
pdf = pdfium.PdfDocument(SRC)
n = len(pdf)
rutas = []
for i in range(n):
    p = f'{PAGES}/p{i+1:03d}.png'
    if not os.path.exists(p):
        pdf[i].render(scale=300 / 72).to_pil().save(p)
    rutas.append(p)
    if (i + 1) % 25 == 0:
        print(f'  rasterizadas {i+1}/{n}', flush=True)
print(f'rasterizadas {n} páginas', flush=True)

todo = []
LOTE = 8
for i in range(0, len(rutas), LOTE):
    r = subprocess.run([f'{AQUI}/ocr_vision', *rutas[i:i + LOTE]],
                       capture_output=True, timeout=900)
    if r.returncode != 0:
        print('  fallo OCR:', r.stderr.decode()[:300], flush=True)
        continue
    todo += json.loads(r.stdout)
    print(f'  OCR {min(i+LOTE, len(rutas))}/{len(rutas)}', flush=True)

json.dump(todo, open(OUT, 'w'), ensure_ascii=False)
print(f'listo: {len(todo)} páginas · {sum(len(p["lines"]) for p in todo)} líneas → {OUT}')

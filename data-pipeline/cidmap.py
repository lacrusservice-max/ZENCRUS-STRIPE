"""
DECODIFICADOR DE NOMBRES DEL PDF INCMNSZ
════════════════════════════════════════

pdfplumber devuelve algunas letras como «(cid:N)» en lugar del carácter, porque
la fuente que dibuja los nombres de alimento no trae un ToUnicode completo. El
pipeline las venía traduciendo con un desplazamiento fijo de +29 sobre ASCII.
Ese atajo acierta en las letras corrientes y falla en todo lo demás sin avisar:

    «Coli□or»       debía ser  «Coliflor»    (ligadura fl)
    «Algod□n»       debía ser  «Algodón»
    «TUB□RCULOS»    debía ser  «TUBÉRCULOS»
    «□machaca□»     debía ser  «“machaca”»

Ninguno de esos fallos da error: producen un nombre plausible y equivocado, que
es justo lo que rompe el cruce entre fuentes y lo que acabaría viendo el usuario.
Peor aún, al normalizar se pierde la letra entera («mazapán» → «mazapn»), así
que el alimento deja de parecerse a sí mismo.

── Por qué no hay una tabla única ──────────────────────────────────────────────
Cada fuente incrustada es un subconjunto independiente con su propio orden de
glifos. El código 86 vale 's' en la fuente de los nombres y 'é' en otras 51 del
mismo documento. Copiar el mapa de una fuente a otra habría corrompido los
nombres en silencio, así que aquí no se transfiere nada entre fuentes.

── De dónde sale cada carácter, por orden de autoridad ─────────────────────────
 1. El ToUnicode de esa misma fuente, cuando cubre el código.
 2. La tabla OVERRIDES de abajo, derivada del contexto del propio documento.
 3. El desplazamiento +29, solo para el rango ASCII. Verificado por contexto:
    «(cid:11)(cid:79)(cid:12)» es «(l)» dentro de «(blanco)», y el 45 de los 46
    códigos ASCII resueltos contra el vocabulario del PDF confirmaron el +29.
 4. Nada de lo anterior → se marca y se cuenta. Un hueco visible, no un
    carácter inventado.
"""
import re, warnings
from collections import Counter
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfpage import PDFPage
from pdfminer.pdftypes import resolve1

warnings.filterwarnings('ignore')

_HEX = r'<([0-9a-fA-F]+)>'

# ── Códigos extendidos de la fuente de los nombres ────────────────────────────
# Derivados del contexto del propio PDF; entre paréntesis, la palabra que lo
# demuestra. Nueve de los trece coinciden además con el ToUnicode de fuentes
# hermanas del documento. Los dos de comillas NO coinciden —el mapa hermano va
# desplazado una posición— y manda el contexto, porque abren y cierran en pareja.
OVERRIDES = {
    'IUVNVQ+ArialNarrow-Bold': {
        101: 'É',    # TUB·RCULOS  → TUBÉRCULOS
        102: 'Ñ',    # (·ame)      → (Ñame)
        105: 'á',    # Guan·bana   → Guanábana
        112: 'é',    # n·ctar      → néctar
        116: 'í',    # (ToUnicode de fuentes hermanas; no aparece en los nombres)
        120: 'ñ',    # Casta·a     → Castaña
        121: 'ó',    # Algod·n     → Algodón
        126: 'ú',    # a·car       → azúcar
        129: 'ü',    # Ping·ica    → Pingüica
        141: '’',    # cow·s       → cow's
        180: '“',    # ·machaca·   → “machaca”
        181: '”',
        183: '’',    # K·Antuunil  → K'Antuunil
        193: 'fl',   # Coli·or     → Coliflor   (ligadura, DOS caracteres)
        204: 'Í',    # RA·CES      → RAÍCES
    },
}

# Repertorio esperado tras decodificar. Todo lo que caiga fuera se cuenta.
OK_CHARS = re.compile(r'^[0-9A-Za-zÁÉÍÓÚÑÜáéíóúñü \-().,;:/%\'’“”ª°&+*\[\]#$!?«»_=<>|"~^\\]*$')


def _utf16(h):
    """'0066006c' → 'fl'. Un código puede valer por varios caracteres."""
    try:
        return bytes.fromhex(h if len(h) % 2 == 0 else '0' + h).decode('utf-16-be')
    except (ValueError, UnicodeDecodeError):
        return None


def parse_cmap(data):
    """Extrae el mapa código → texto de un CMap ToUnicode."""
    m = {}
    for body in re.findall(r'beginbfrange(.*?)endbfrange', data, re.S):
        # <lo> <hi> [<d0> <d1> ...] — un destino explícito por código
        for mt in re.finditer(_HEX + r'\s*' + _HEX + r'\s*\[(.*?)\]', body, re.S):
            lo = int(mt.group(1), 16)
            for i, d in enumerate(re.findall(_HEX, mt.group(3))):
                if (t := _utf16(d)) is not None:
                    m[lo + i] = t
        # <lo> <hi> <dst> — destinos consecutivos desde dst
        for mt in re.finditer(_HEX + r'\s*' + _HEX + r'\s*' + _HEX, body):
            lo, hi, base = int(mt.group(1), 16), int(mt.group(2), 16), _utf16(mt.group(3))
            if base is None:
                continue
            if len(base) != 1:
                m.setdefault(lo, base)
                continue
            for i in range(lo, hi + 1):
                m.setdefault(i, chr(ord(base) + i - lo))
    for body in re.findall(r'beginbfchar(.*?)endbfchar', data, re.S):
        for c, d in re.findall(_HEX + r'\s*' + _HEX, body):
            if (t := _utf16(d)) is not None:
                m[int(c, 16)] = t
    return m


def load_maps(path):
    """
    {nombre_de_fuente: {código: texto}} fusionando todas sus apariciones.

    El PDF reutiliza el mismo prefijo de subconjunto en páginas distintas y cada
    aparición trae solo los códigos de esa página. Quedarse con la primera
    dejaba fuera casi todo. Se anota cualquier código que dos apariciones
    traduzcan distinto: eso indicaría que el nombre no identifica un subconjunto
    único y que el mapa no es de fiar.
    """
    with open(path, 'rb') as fh:
        doc = PDFDocument(PDFParser(fh))
        maps, conflicts = {}, Counter()
        for page in PDFPage.create_pages(doc):
            fonts = resolve1((resolve1(page.resources) or {}).get('Font')) or {}
            for v in fonts.values():
                f = resolve1(v)
                bf = str(f.get('BaseFont')).strip("/'")
                if not f.get('ToUnicode'):
                    continue
                try:
                    m = parse_cmap(resolve1(f['ToUnicode']).get_data().decode('latin-1'))
                except Exception:
                    continue
                cur = maps.setdefault(bf, {})
                for code, txt in m.items():
                    if code in cur and cur[code] != txt:
                        conflicts[(bf, code)] += 1
                    else:
                        cur[code] = txt
        return maps, conflicts


CID = re.compile(r'\(cid:(\d+)\)')


class Decoder:
    """Traduce los «(cid:N)» de una palabra usando el mapa de su propia fuente."""

    def __init__(self, pdf_path):
        self.maps, self.conflicts = load_maps(pdf_path)
        self.stats = Counter()
        self.unknown = Counter()

    def decode(self, text, fontname=None):
        if '(cid:' not in text:
            return text
        fn = fontname or ''
        tu, ov = self.maps.get(fn, {}), OVERRIDES.get(fn, {})

        def sub(mt):
            n = int(mt.group(1))
            if n in tu:
                self.stats['tounicode'] += 1
                return tu[n]
            if n in ov:
                self.stats['tabla_contextual'] += 1
                return ov[n]
            if 33 <= n + 29 <= 126:
                self.stats['ascii_+29'] += 1
                return chr(n + 29)
            self.stats['SIN_RESOLVER'] += 1
            self.unknown[(fn, n)] += 1
            return '�'

        return CID.sub(sub, text)

    def check(self, text):
        """Cuenta caracteres fuera del repertorio esperado."""
        if not OK_CHARS.match(text):
            bad = ''.join(sorted({c for c in text if not OK_CHARS.match(c)}))
            self.stats['texto_con_caracteres_raros'] += 1
            self.unknown[('carácter', bad)] += 1
        return text

    def report(self):
        out = [f"  {v:6d}  {k}" for k, v in self.stats.most_common()]
        if self.conflicts:
            out.append(f"  códigos en conflicto entre páginas: {len(self.conflicts)}")
        for k, c in self.unknown.most_common(10):
            out.append(f"      sin resolver {k} ×{c}")
        return '\n'.join(out)

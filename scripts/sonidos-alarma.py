#!/usr/bin/env python3
"""
LOS SONIDOS DE ALARMA
═══════════════════════════════════════════════════════════════════════════
Genera los audios que suenan cuando salta una alarma de un hábito.

── Por qué se sintetizan y no se descargan ────────────────────────────────
Porque iOS no presta los tonos del sistema a nadie más que a su Reloj, y un
audio de banco de sonidos trae licencia detrás. Estos se calculan aquí, son
nuestros y se pueden retocar cambiando cuatro números.

── El formato no es negociable ────────────────────────────────────────────
iOS solo reproduce sonidos de notificación en PCM lineal, IMA4 o µ-law, y
descarta el que pase de 30 segundos poniendo el suyo en su lugar. Aquí se
escribe WAV PCM de 16 bits, que es lo más simple que acepta.

22 050 Hz basta: lo más agudo de estos tonos no llega a 4 kHz y el muestreo
solo tiene que doblar la frecuencia más alta. A 44 100 pesarían el doble sin
sonar mejor.

── Por qué cada uno suena como suena ──────────────────────────────────────
No son cinco variaciones del mismo pitido. Un despertador y un aviso de
«vete a la cama» piden cosas opuestas, y la lista cubre ese rango: de
`goteo`, que casi no interrumpe, a `pulso`, que no se puede ignorar.

    python3 scripts/sonidos-alarma.py
"""

import math
import random
import struct
import wave
from pathlib import Path

SR = 22050
DESTINO = Path(__file__).resolve().parent.parent / 'frontend' / 'src' / 'assets' / 'sounds'

# Semilla fija: el ruido del pulsado tiene que dar el mismo fichero cada vez,
# o cada ejecución cambiaría los binarios del repo sin que nadie tocara nada.
random.seed(20260825)


def envolvente(n, ataque, caida, total):
    """Sube, se mantiene y baja. Sin esto, empezar y cortar en seco chasquea."""
    a = max(1, int(ataque * SR))
    c = max(1, int(caida * SR))
    if n < a:
        return n / a
    if n > total - c:
        return max(0.0, (total - n) / c)
    return 1.0


def campana(f0, dur, brillo=1.0):
    """
    Una campana no es una nota: sus armónicos NO son múltiplos enteros.
    Estas cuatro razones son las que la hacen sonar a metal y no a flauta, y
    cada parcial se apaga más rápido cuanto más agudo, como en la realidad.
    """
    razones = [(1.0, 1.0, 3.2), (2.76, 0.55, 2.0), (5.40, 0.28, 1.3), (8.93, 0.12, 0.9)]
    n = int(dur * SR)
    out = [0.0] * n
    for razon, amp, vida in razones:
        f = f0 * razon
        if f > SR / 2 * 0.9:
            continue
        for i in range(n):
            t = i / SR
            out[i] += amp * brillo * math.exp(-t / vida) * math.sin(2 * math.pi * f * t)
    return out


def cuerda(freq, dur, decaimiento=0.9955):
    """
    Karplus-Strong: un chasquido de ruido dando vueltas por un retardo que se
    promedia consigo mismo. Suena a cuerda pulsada porque ES lo que hace una
    cuerda: una perturbación que rebota perdiendo agudos en cada vuelta.
    """
    largo = max(2, int(SR / freq))
    buf = [random.uniform(-1, 1) for _ in range(largo)]
    out = []
    for _ in range(int(dur * SR)):
        out.append(buf[0])
        buf.append(decaimiento * 0.5 * (buf[0] + buf[1]))
        buf.pop(0)
    return out


def tono(freq, dur, forma='sin', armonico=0.0):
    n = int(dur * SR)
    out = []
    for i in range(n):
        t = i / SR
        v = math.sin(2 * math.pi * freq * t)
        if forma == 'suave_cuadrada':
            # Cuadrada redondeada: corta como una alarma, pero sin el filo
            # metálico de la cuadrada pura, que a volumen alto duele.
            v = math.tanh(2.5 * v) / math.tanh(2.5)
        if armonico:
            v += armonico * math.sin(4 * math.pi * freq * t)
        out.append(v)
    return out


def gota(f_ini, f_fin, dur):
    """Una gota es un barrido de frecuencia hacia abajo que se apaga enseguida."""
    n = int(dur * SR)
    out, fase = [], 0.0
    for i in range(n):
        p = i / n
        f = f_ini * (f_fin / f_ini) ** p
        fase += 2 * math.pi * f / SR
        out.append(math.exp(-p * 5.0) * math.sin(fase))
    return out


def mezclar(largo_seg, piezas):
    """Coloca cada pieza en su instante y las suma."""
    total = int(largo_seg * SR)
    out = [0.0] * total
    for inicio, ganancia, muestras in piezas:
        desde = int(inicio * SR)
        for i, v in enumerate(muestras):
            j = desde + i
            if 0 <= j < total:
                out[j] += ganancia * v
    return out


def escribir(nombre, muestras, cabeza=0.006, cola=0.05):
    """Normaliza al 89 %, funde los bordes y guarda el WAV."""
    pico = max((abs(v) for v in muestras), default=1.0) or 1.0
    k = 0.89 / pico
    n = len(muestras)
    datos = bytearray()
    for i, v in enumerate(muestras):
        v = v * k * envolvente(i, cabeza, cola, n)
        datos += struct.pack('<h', max(-32767, min(32767, int(v * 32767))))

    ruta = DESTINO / nombre
    with wave.open(str(ruta), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(datos))
    return ruta, n / SR, ruta.stat().st_size


# ── Los cinco ──────────────────────────────────────────────────────────────

def amanecer():
    """Tres notas que suben, solapadas y sin filo. Para despertar sin sobresalto."""
    return mezclar(4.2, [
        (0.00, 1.00, campana(440.00, 3.2, 0.75)),   # la
        (0.55, 0.85, campana(554.37, 3.0, 0.70)),   # do#
        (1.10, 0.75, campana(659.25, 3.0, 0.65)),   # mi
    ])


def campanas():
    """Dos golpes de campana. Claro y con cuerpo, sin llegar a alarmar."""
    return mezclar(4.0, [
        (0.00, 1.00, campana(587.33, 3.6)),
        (1.30, 0.62, campana(587.33, 2.6)),
    ])


def cuerdas():
    """Cuatro pulsaciones ascendentes. Cálido, para un aviso de irse a la cama."""
    return mezclar(3.8, [
        (0.00, 1.00, cuerda(196.00, 2.4)),   # sol2
        (0.42, 0.90, cuerda(293.66, 2.2)),   # re3
        (0.84, 0.80, cuerda(392.00, 2.0)),   # sol3
        (1.26, 0.70, cuerda(587.33, 2.4)),   # re4
    ])


def pulso():
    """Doble pitido, tres veces. El que no se puede ignorar."""
    piezas = []
    for k in range(3):
        base = k * 0.86
        piezas.append((base + 0.00, 1.00, tono(880, 0.11, 'suave_cuadrada')))
        piezas.append((base + 0.19, 1.00, tono(880, 0.11, 'suave_cuadrada')))
    return mezclar(3.0, piezas)


def goteo():
    """Cuatro gotas a destiempo. Lo más discreto de la lista."""
    return mezclar(4.0, [
        (0.00, 1.00, gota(1400, 520, 0.5)),
        (0.78, 0.85, gota(1250, 470, 0.5)),
        (1.85, 0.92, gota(1550, 560, 0.5)),
        (2.70, 0.72, gota(1180, 440, 0.5)),
    ])


if __name__ == '__main__':
    DESTINO.mkdir(parents=True, exist_ok=True)
    for nombre, hacer in [
        ('amanecer.wav', amanecer),
        ('campanas.wav', campanas),
        ('cuerdas.wav', cuerdas),
        ('pulso.wav', pulso),
        ('goteo.wav', goteo),
    ]:
        ruta, dur, peso = escribir(nombre, hacer())
        print(f'  {nombre:15} {dur:4.1f} s   {peso / 1024:6.0f} KB')

# AUDIT · Sección Running de Entrena

**Fase 0 del prompt maestro v1.0** · 21-ago-2026 · Repositorio `NutriAI-Fit`

Documento único previo a construir. Recoge lo que hay, y sobre todo **dónde
choca lo que hay con lo que el prompt pide**, que es lo que decide el plan real.

---

## 1 · Dónde vive Running hoy

**Ya existe. Dos veces.**

| Ruta | Líneas | Enlazada desde |
|---|---|---|
| `frontend/app/workout/running.tsx` | 168 | `app/(tabs)/workout.tsx:46` — Entrena |
| `frontend/app/salud/running/index.tsx` | 217 | `app/(tabs)/salud.tsx:52` — Salud |

Las dos hacen lo mismo: pintan los pasos del día y la semana desde
`healthTrackerStore`, y **declaran honestamente que la captura por GPS no está
conectada**. La de `workout/` dice en su cabecera «ahora dentro de Entrena y no
de Salud», o sea que `salud/running` es el original que debió retirarse y no se
retiró. Ambas siguen accesibles desde la barra de pestañas.

El botón de empezar de `workout/running.tsx` abre un `Alert` que explica que
todavía no graba, con un razonamiento que conviene conservar: *«Un botón que
promete registrar una carrera y no la registra se cobra la mentira la primera
vez que alguien vuelve a casa sin su recorrido.»* Esa regla se hereda.

## 2 · Árbol de rutas

`expo-router` con grupos `(auth)`, `(onboarding)`, `(tabs)`. 80 rutas.
Entrena vive en `app/(tabs)/workout.tsx` + 16 pantallas bajo `app/workout/`.

## 3 · Componentes reutilizables

`src/components/ui/` — 11 piezas: `ActivityRings`, `BotonZena`, `CountUp`,
`Glass`, `Input`, `MiniRing`, `PlateRing`, `ProgressWidgets`, `Screen`,
`VerifiedSeal`, `ZencrusIcon`.

`src/components/workout/` — 13 piezas propias de Entrena, incluidas
`Charts.tsx`, `Kit.tsx` (17 iconos propios), `Signature.tsx` (arte generativo
sembrado por id), `Miniatura.tsx`, `anatomy.ts`.

**`Kit.tsx` y `Signature.tsx` son precedente directo** de lo que el prompt pide
en §7 y §8: iconografía propia y visual generada del dato. No se parte de cero.

## 4 · Tokens de diseño existentes

`src/constants/theme.ts` — `Colors`, `Typography`, `Spacing`, `BorderRadius`,
`Shadows`, `Gradients`, `Animation`, `Glass`.

- Paleta viva: `neon.*` — fondo `#050506`, acento **rojo `#FF1F3D`**, y una
  familia de superficies translúcidas (`pane`, `paneHi`, `edge`).
- Tipografía: **Rajdhani** (display) + **Inter** (cuerpo), vía `expo-font`.
  No hay ficheros `.ttf` locales: se cargan desde `@expo-google-fonts`.

## 5 · Estado

**Zustand 5** con 28 stores en `src/store/`. Sin slices: un store por dominio.
Relevantes: `sessionStore` (sesión de entreno viva, cola offline, `clientId`),
`workoutStore`, `healthTrackerStore` (pasos), `recoveryStore`, `healthStore`,
`streakStore`, `achievementStore`, `challengeStore`, `duelStore`, `privacyStore`.

## 6 · Cliente de datos

**El frontend NO habla con Supabase.** Cero importaciones de `@supabase/*`.

El patrón real es: `src/services/api.ts` → **axios** contra el backend Express
en Railway (`https://web-production-1d2e22.up.railway.app/api`), con
interceptores de refresco, **circuit breaker**, reintento con backoff y
`expo-secure-store` para los tokens. Supabase existe **solo del lado servidor**.

No hay TanStack Query.

## 7 · Esquema de base de datos

18 migraciones en `database/migrations/`. Lo de actividad ya construido:

- `008_workout_sessions.sql` — `workout_sessions`, `workout_sets`,
  `personal_records`. Las sesiones ya tienen `mode` (`gym|home|outdoor|class`),
  `distance_m`, `elevation_m`, `calories_kcal`, `avg_hr`, `max_hr`, `metrics`.
  **El modo `outdoor` está modelado y sin construir: es exactamente el hueco de
  Running.**
- `009_workout_programs.sql` — `workout_programs`, `program_enrollments`.
- `016_salud.sql` — capa de salud.

**Aviso de numeración:** hay **tres** ficheros `016_*`. La próxima migración es
`017`.

## 8 · Permisos nativos — mejor de lo esperado

`app.config.ts` ya declara todo lo que M01 necesita:

```
NSLocationWhenInUseUsageDescription · NSLocationAlwaysUsageDescription
UIBackgroundModes: ['location']
ACCESS_BACKGROUND_LOCATION (se pide aparte, en su propia pantalla)
ACTIVITY_RECOGNITION
expo-location con isAndroidBackgroundLocationEnabled: true
```

`expo-location ~19.0.8` y `expo-task-manager ~14.0.9` **instalados**.
Existe `frontend/ios/` — hay proyecto nativo, luego dev build posible.
**No existe `frontend/android/`.**

## 9 · Versiones

```
expo ~54.0.36   ·  react 19.1.0  ·  react-native 0.81.5
expo-router ~6.0.24  ·  reanimated ~4.1.1  ·  zustand ^5.0.0
react-native-svg 15.12.1  ·  expo-sqlite ~16.0.10  ·  expo-sensors ~15.0.8
```

Reanimated es **4**, no 3. Los worklets y la API que pide §6.3 aplican igual.

## 10 · HealthKit / Health Connect

**No hay integración.** Ni librería, ni permisos declarados, ni código.
`healthTrackerStore` guarda pasos introducidos/estimados dentro de la app.

---

# 11 · CONFLICTOS

Ordenados por lo que bloquean.

### C1 · Skia no está instalado, y en Expo Go no puede estarlo
§2.2 y §8.2 exigen Skia para el Núcleo y **todos** los gráficos.
`@shopify/react-native-skia` no está en `package.json`, y la app se está
probando hoy en **Expo Go**, donde Skia no existe.

Hay `frontend/ios/`, así que el dev build es viable. **Decisión tomada:** se
adopta Skia y la sección se desarrolla contra el dev build, pero el Núcleo y los
gráficos se escriben detrás de una interfaz de render con implementación
alternativa en `react-native-svg` (ya instalado) + Reanimated, para que la
sección no reviente si alguien la abre en Expo Go. La abstracción cuesta poco y
evita que el trabajo quede rehén de un runtime.

### C2 · `victory-native` está instalado y el prompt lo prohíbe — RESUELTO
`^41.14.0` en dependencias, **cero importaciones en el código**. Era peso muerto.
**Desinstalado en F1.**

### C3 · §10.2 asume Supabase en el cliente; el cliente no lo usa
El front habla con Express vía axios, con circuit breaker y refresco ya
resueltos. Por la regla de conflicto del propio prompt (§1: *el código existente
gana en convenciones*), **Running usa axios contra el backend propio**. Las
tablas nuevas viven en Supabase, pero se acceden desde el servidor.

### C4 · §10.2 pide TanStack Query — CORREGIDO Y RESUELTO
**Corrección de la primera versión de este documento:** dije que el repositorio
no tenía librería de queries. Lo tenía. Busqué `@tanstack/react-query`, que es
el nombre nuevo, y no el viejo: había **`react-query@3.39.3` como dependencia
directa**. Apareció al fallar un `npm install`.

Estaba **sin usar en un solo fichero**, y además solo admite React ≤18 mientras
el proyecto va con React 19, así que **bloqueaba cualquier instalación futura**.
**Desinstalado en F1.**

El patrón vigente sigue siendo Zustand + servicios axios. Meter TanStack Query
solo para Running crearía **dos sistemas de fetching** en la misma app, que es
justo lo que Entrena aprendió a evitar. **Decisión:** no se introduce.

### C5 · Identidad visual: choque frontal
El prompt (§2.4, §2.6) propone fondo `#04060A`, acento cian `#00F5FF`, y
**prohíbe glassmorphism e Ionicons sin retrabajar**.

La app entera es lo contrario: cristal líquido, acento **rojo `#FF1F3D`**,
Ionicons animados, tab bar flotante. Es una decisión de diseño vigente en todas
las secciones.

Aplicado tal cual, Running parecería una app distinta pegada dentro de ZENCRUS.

**Decisión — corregida al implementarla en F1.** La primera versión de este
documento proponía reanclar el estado `optimal` al rojo LACRUSS. Es un error:
`strained` ya es rojo, y dos estados con el mismo tono destruyen exactamente lo
que hace útil a la escala. Que el rojo signifique «alerta» es un acuerdo
universal y no se gasta en identidad de marca.

Lo que se hizo: **separar los dos usos del color, que nunca se mezclan.**

- `RunningColors.state` — la escala fisiológica del prompt, **intacta**
  (verde → cian → ámbar → rojo). Aquí el color ES el dato.
- `RunningColors.signal` — el rojo `#FF1F3D` de ZENCRUS para **marca y acción**:
  botones primarios, lo que se toca. Running sigue siendo de esta app sin
  robarle el significado a la escala.

El fondo sí se reancla al `#050506` de la app: un negro distinto se nota al
cambiar de pestaña, una escala de color dentro de un módulo no.

Todo en `running-tokens.ts`, sin tocar `theme.ts`. Aislado en un fichero para
poder revertirlo entero.

### C6 · Duplicado de Running
`salud/running` y `workout/running` coexisten enlazadas. Consolidar en Entrena y
dejar en Salud una redirección, no una segunda copia.

### C7 · El pipeline de Figma de §3.2 no es ejecutable
Las herramientas de Figma disponibles son **de lectura**: `get_design_context`,
`get_metadata`, `get_screenshot`, `get_variable_defs`,
`create_design_system_rules`, `add_code_connect_map`. **No hay herramienta para
crear el archivo de Figma** que §3.2 manda construir si no existe, y no existe.

Se puede hacer lo inverso y es lo que se hará: construir el sistema en código
como fuente, generar `/docs/design-system-rules.md`, y dejar el mapeo de Code
Connect listo para cuando el archivo exista. Si tienes un frame de Figma, dame
el enlace y se invierte la dirección.

### C8 · Solapamiento grande con lo ya construido en Entrena
- **M07 Cuerpo** — ya existe: `workout_sessions/sets`, `personal_records`,
  catálogo de 206 ejercicios con vídeo, `stats`, `records`, programas de varias
  semanas con progresión real. Reimplementarlo sería un segundo sistema.
- **M09 Escuadras** — hay capa social completa (17 pantallas, moderación,
  bloqueos, denuncias).
- **M10 Ciclos** — hay `achievementStore`, `challengeStore`, `duelStore`,
  `streakStore` y pantallas de rachas, retos, duelos y logros.

**Decisión:** Running **consume y extiende**, no duplica. M07/M09/M10 se
reducen a integrar Running en lo existente.

### C9 · Faltan librerías para M01, M08 y M13
Sin mapas, sin BLE, sin HealthKit/Health Connect, sin FlashList, sin `d3-shape`,
sin `expo-file-system` (importar GPX/FIT/TCX). Todas exigen dev build. Se
instalan en su fase, no antes.

### C10 · Tipografías
Michroma, Satoshi y Geist Mono no están. Michroma y Geist Mono salen de Google
Fonts; **Satoshi es de Fontshare y hay que empaquetar el fichero**. Convivirán
con Rajdhani/Inter, que siguen mandando fuera de Running.

### C11 · Deuda abierta que Running heredaría
La revisión de Entrena de hoy dejó tres fallos de integridad **sin arreglar**,
en tablas que Running va a compartir:
1. Las series pueden guardarse en el día equivocado del programa
   (`exercise/hacer.tsx:230`).
2. Se guardan series `load_type: 'weight'` con `weight_kg` nulo
   (`exercise/hacer.tsx:183`) → volumen 0, sin récords, progresión sin datos.
3. El contador del programa lleva congelado desde el 13-ago: dos diseños
   incompatibles, calendario contra contador.

Running escribirá en `workout_sessions`. **Conviene cerrarlos antes de la F6**,
o el historial de Running nace torcido.

### C12 · Menor
`@expo/vector-icons` se importa en todo el código pero **no es dependencia
directa**: entra transitivamente por `expo`. Funciona, pero es frágil.

---

## 12 · Plan real

Las 14 fases del §14 son trabajo de equipo y varias semanas: M01 solo (GPS en
background, recuperación de crash, cola offline, BLE, importación de tres
formatos) es una entrega completa por sí misma. Se ejecutan en el orden del
prompt, una por entrega, cada una verificada en el simulador antes de la
siguiente.

Orden ajustado por las dependencias reales encontradas:

```
F0   Auditoría                                    ← este documento
F0.5 Cerrar C11 (los tres fallos de integridad)   ← nuevo, bloquea F6
F1   Tokens + fuentes + dev build con Skia
F2   Átomos
F3   Iconografía animada
F4   Moléculas + ModuleShell
F5   Migración 017 + RLS + seeds
F6   M01 Captura
F7   M02 Núcleo + M05 Curva Vital
...  resto según §14, con M07/M09/M10 reducidos a integración (C8)
```

---

## 13 · Lo que necesito de ti antes de la F1

Nada bloqueante — pero dos decisiones tuyas ahorran retrabajo:

1. **C5, la identidad visual.** ¿Running se pinta con el cian del prompt aunque
   se despegue del resto de la app, o se reancla al rojo LACRUSS?
2. **C7, Figma.** ¿Existe un frame que yo no vea? Si lo hay, manda el enlace y
   el sistema se extrae de ahí en vez de escribirse en código.

Si no contestas, aplico lo decidido arriba: rojo reanclado y sistema en código.

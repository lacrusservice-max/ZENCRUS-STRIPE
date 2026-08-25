# Encargo: que la app deje de sentirse seca

> Este documento ES el encargo. Léelo entero antes de tocar un fichero.
> Verificado el 21-ago-2026 contra el código real. Si algún número de aquí no
> te cuadra con lo que ves, **para y dilo** — no sigas adelante suponiendo.

---

## 1. El problema, en una frase

La app no tiene ningún fallo técnico de animación: tiene **765 puntos de toque
que no hacen nada más que un fundido de opacidad**, y cero transiciones de
navegación. No hay que arreglar nada roto; hay que escribir lo que no está.

## 2. Lo que YA está comprobado — no lo vuelvas a investigar

Se perdió una sesión entera persiguiendo fantasmas. Todo esto está verificado:

| Comprobación | Estado |
|---|---|
| `react-native-reanimated/plugin` en `babel.config.js` | ✅ presente |
| `react-native-reanimated` | ✅ `4.1.1` |
| `react-native-worklets` (obligatorio para Reanimated 4) | ✅ `0.5.1` |
| `expo-haptics` | ✅ `15.0.8` |
| Metro en modo CI (mata el watch) | ✅ NO lo está |
| «Reduce Motion» en el dispositivo | ✅ apagado |
| Ficheros que ya usan Reanimated | 25 |

**Conclusión: la librería funciona.** Si algo no anima, es que nadie se lo ha
pedido. No vuelvas a auditar la instalación.

### Los números que explican todo

```
765  TouchableOpacity   ← fundido de opacidad y nada más
 72  Pressable
 10  ficheros (de toda la app) que llaman a expo-haptics
  0  animaciones de navegación configuradas
```

Por eso añadir una animación bonita a una pantalla nunca se ha notado: el resto
de la app son 765 toques idénticos y planos. **La sensación de una app no la da
un efecto espectacular en un sitio; la da que los mil gestos pequeños respondan.**

## 3. Dónde se prueba esto — léelo o perderás el día

- **Sergio prueba en su iPhone FÍSICO con Expo Go.** No en el simulador.
- Expo Go SDK 54 **sí** trae Reanimated 4, worklets y `expo-haptics`. Todo lo de
  este encargo funciona en Expo Go sin compilar nada.
- **El simulador NO tiene Taptic Engine.** `expo-haptics` ahí es un no-op
  silencioso: no falla, no avisa, no pasa nada. **Nunca** juzgues la háptica en
  el simulador ni le digas a Sergio que «no funciona» basándote en eso.
- Expo Go **no** trae `@stripe/stripe-react-native` ni `@shopify/react-native-skia`.
  No uses Skia en este encargo aunque esté en `package.json` (está instalado y
  sin usar). Si un día hace falta, exige dev build en el iPhone.

### Si un cambio no llega a la app

Antes de tocar caché o reiniciar nada, en este orden:

1. `pm2 logs zencrus-metro --lines 30 --nostream | grep "CI mode"` — si aparece
   la línea, el watch está muerto y **ningún** cambio llegará jamás.
2. No hay `watchman` instalado; el vigilante de node se pierde escrituras
   (probablemente por el espacio en la ruta «APP C+E»). Contar con el ciclo
   completo tras cada tanda, no con Fast Refresh.
3. Comprobar que el bundle sirve el cambio antes de culpar al cliente:
   ```bash
   curl -s "http://localhost:8081/.expo/.virtual-metro-entry.bundle?platform=ios&dev=true" -o /tmp/b.js
   grep -c "una-cadena-unica-del-codigo-nuevo" /tmp/b.js
   ```

**Avisa a Sergio ANTES de reiniciar Metro**: le desloguea la app y tiene que
volver a entrar a mano.

## 4. Mapa del proyecto

```
NutriAI-Fit/frontend/
  app/                    pantallas (expo-router).  Aquí están los 765 toques.
  src/components/ui/      componentes compartidos   → alias @/components/ui
  src/constants/theme.ts  Colors, Typography, Spacing, BorderRadius,
                          Shadows, Gradients, Animation, Glass
  app/_layout.tsx         layout raíz (Stack)
  app/(tabs)/_layout.tsx  layout de pestañas
```

Alias: `@/*` → `./src/*`, `@app/*` → `./*`

**Usa los tokens que ya existen.** `Animation.spring` es `{ damping: 20,
stiffness: 300, mass: 1 }` y `Animation.duration` tiene `fast/normal/slow/spring`.
No inventes constantes nuevas ni metas números sueltos en los componentes.

---

## 5. El trabajo

### Fase 1 — Un componente de toque, y que la háptica viva dentro

Crear `src/components/ui/Toque.tsx` con **dos variantes**, porque un botón y una
fila de lista no se sienten igual:

- **`Toque`** — botones y acciones. Escala a `0.96` con muelle + `impactAsync(Light)`.
- **`ToqueSuave`** — filas de lista, tarjetas, celdas. Sin escala (hunde toda la
  fila y se siente pesado): solo opacidad a `0.7` + `selectionAsync()`.

Requisitos no negociables:

- La háptica va **dentro del componente**, en `onPressIn`. Así nadie tiene que
  acordarse de llamarla en cada botón nunca más. Ese es el punto entero.
- `useAnimatedStyle` se asigna a una `const` en el cuerpo del componente —
  **no** se llama en línea dentro del JSX.
- Respeta `useReducedMotion()` de Reanimated: si está activo, sin escala (la
  háptica se queda).
- Reenvía `disabled`, `hitSlop`, `accessibilityRole`, `accessibilityLabel`,
  `testID` y `style`. Con `disabled` no hay háptica ni animación.
- Tipado en TypeScript, sin `any`.

Esbozo de la forma (adáptalo, no lo copies a ciegas):

```tsx
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function Toque({ children, onPress, disabled, style, ...rest }: ToqueProps) {
  const escala = useSharedValue(1)
  const sinMovimiento = useReducedMotion()

  const animado = useAnimatedStyle(() => ({ transform: [{ scale: escala.value }] }))

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        if (disabled) return
        if (!sinMovimiento) escala.value = withSpring(0.96, Animation.spring)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => { escala.value = withSpring(1, Animation.spring) }}
      onPress={onPress}
      style={[style, animado]}
      {...rest}
    >{children}</AnimatedPressable>
  )
}
```

### Fase 2 — Pantalla piloto, y parar

Migrar **una sola** pantalla y enseñársela a Sergio en su iPhone antes de seguir.
Candidata: `app/workout/active.tsx` (41 toques, es donde más se nota).

**No sigas a la fase 3 sin su visto bueno.** Si la sensación no le convence, es
mucho más barato cambiar un componente que 765 llamadas.

### Fase 3 — La migración

Sustituir `TouchableOpacity` por `Toque` / `ToqueSuave` en `app/`. Los ficheros
con más carga:

```
app/workout/active.tsx          41    app/workout/program/nuevo.tsx   23
app/menstrual.tsx               35    app/recipe/cook.tsx             23
app/workout/routines.tsx        31    app/(tabs)/nutrition.tsx        23
app/meal-planner.tsx            26    app/health-tracker.tsx          21
app/progress.tsx                25    app/(tabs)/profile.tsx          21
```

**Esto NO es un `sed` a ciegas.** Pantalla por pantalla, y en cada una:

- Quitar `activeOpacity` (no es prop de `Pressable`; se quedaría de adorno).
- Decidir por cada toque si es **botón** (`Toque`) o **fila** (`ToqueSuave`).
  Piénsalo, no lo hagas por tamaño.
- Cuidado con `TouchableOpacity` anidados: háptica doble se siente a avería.
  En anidados, la de fuera no vibra.
- Arreglar el `import` de `react-native` en cada fichero.
- En listas largas (`FlatList`) la háptica en cada fila es ruido: usa
  `selectionAsync()`, que es la más leve, y nunca `impactAsync(Heavy)`.

### Fase 4 — Que las pantallas entren, no aparezcan

En `app/_layout.tsx` (hoy solo tiene `screenOptions={{ headerShown: false }}`):

```tsx
screenOptions={{
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: Animation.duration.normal,
}}
```

En `app/(tabs)/_layout.tsx`, animación entre pestañas (`animation: 'shift'` o
un fundido). **Ojo:** el tab bar es `GlassTabBar`, un componente propio —
comprueba que no se rompe al animar la transición.

Modales (`app/subscription.tsx`, `subscription-intro.tsx`) con
`presentation: 'modal'` si no lo tienen ya.

### Fase 5 — Que las pantallas se sientan vivas al abrirse

En los `map` de listas y en las tarjetas del primer pliegue:

```tsx
<Animated.View entering={FadeInDown.delay(i * 40).duration(Animation.duration.normal)}>
```

Escalonado de `40ms`, **máximo 8 elementos** con retardo (a partir de ahí entran
todos a la vez, o abrir una lista larga tarda un segundo en verse).

---

## 6. Cómo se verifica — y cómo NO

Ya se han dado dos conclusiones falsas por medir mal. Las reglas:

- **Región de control siempre.** Al comparar capturas, mide también una zona que
  sepas quieta (un texto fijo). Si el control cambia, la pantalla hizo scroll y
  tu medida no vale nada.
- **Localiza el elemento, no lo supongas.** Un mapa de bandas horizontales de
  100px entre dos capturas te dice dónde se mueve algo antes de recortar.
- **Animar no es verse.** Un `scaleY` de 1.03 sobre un elemento pequeño son tres
  píxeles: anima de verdad y se lee como congelado. La amplitud se piensa como
  fracción del **contenedor**, no del elemento.
- **La háptica solo se juzga en el iPhone de Sergio.** En simulador, jamás.
- **Nada de números inventados.** Si no pudiste medir algo, dilo. Un hueco
  relleno con una cifra creíble corrompe todo lo que se calcule encima.

Criterio de terminado, por fase: Fase 1, el componente compila y la pantalla
piloto responde al tacto en el iPhone. Fase 3, `grep -rc TouchableOpacity app`
baja de 765 a cero y ninguna pantalla perdió funcionalidad.

## 7. Qué NO hacer

- ❌ No auditar otra vez la instalación de Reanimated (sección 2).
- ❌ No usar Skia: no existe en Expo Go.
- ❌ No tocar `@stripe/stripe-react-native` en `app/_layout.tsx`. Es un import
  estático de un módulo que Expo Go no tiene; hoy lo tolera. Es otra conversación.
- ❌ No reiniciar Metro sin avisar: desloguea la app.
- ❌ No migrar las 765 de golpe sin el visto bueno de la fase 2.
- ❌ No animar `height`, `flex` ni márgenes: van por el hilo de JS y se atascan.
  Solo `transform` y `opacity` corren en el hilo de UI.

## 8. Cómo se escribe el código aquí

Mira `src/components/ui/BotonZena.tsx` antes de escribir nada. La convención del
proyecto es una cabecera larga en español que explica **por qué** está hecho así
y qué se intentó antes que no funcionó — no qué hace el código. Los nombres son
en español (`Toque`, `escala`, `sinMovimiento`). Respétalo.

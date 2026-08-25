# MAPA DE SISTEMA · Módulo de Salud (ciclo)
### ZENCRUS · LACRUSS INNOVATION TECHNOLOGY
**Fase 0 — Reconocimiento.** Documento generado antes de escribir código.
Fecha: 21 de agosto de 2026.

---

## 1. STACK REAL DEL PROYECTO

Lo que **hay**, no lo que el prompt maestro asume. Donde difieren, manda el proyecto.

| Pieza | Versión real | Prompt de referencia | Estado |
|---|---|---|---|
| Expo SDK | **54.0.36** | 52+ | ✅ compatible |
| React Native | **0.81.5** | — | ✅ |
| Expo Router | **6.0.24** | v3 | ⚠️ el proyecto va 3 mayores por delante |
| Reanimated | **4.1.1** | 3 | ⚠️ el proyecto va una mayor por delante |
| Zustand | **5.0.0** + persist | 4/5 | ✅ |
| TypeScript | **5.5** estricto | estricto | ✅ |
| gesture-handler | 2.28 | ✅ | ✅ |
| react-native-svg | 15.12.1 | ✅ | ✅ |
| zod | 3.23.8 | ✅ | ✅ |
| expo-secure-store | 15.0.8 | ✅ | ✅ |
| expo-local-authentication | 17.0.8 | ✅ | ✅ |
| expo-notifications | 0.32.17 | ✅ | ✅ |
| expo-haptics | 15.0.8 | ✅ | ✅ |
| **@shopify/react-native-skia** | **NO INSTALADO** | requerido | 🔴 **bloqueante** |
| **@shopify/flash-list** | **NO INSTALADO** | requerido en listas | 🟠 |
| **@supabase/supabase-js** | **NO EXISTE EN EL FRONTEND** | asumido | 🔴 **cambia la arquitectura** |
| RevenueCat | **NO** — hay Stripe (`paymentsService.ts`) | asumido | 🟠 |
| New Architecture | no declarada en `app.config.ts` | ON | 🟠 verificar |
| Apple Health / Health Connect | **sin integración** | requerido en F14 | 🟠 |

**Build nativo:** existe. `ios/ZENCRUS.xcodeproj` versionado, development build compilado
en local el 21/08/2026 con `expo-dev-client`, `expo-location`, `expo-sensors` y
`expo-task-manager`. Permisos de ubicación (incl. *always*) y de movimiento ya
declarados en `app.config.ts`.

---

## 2. ARQUITECTURA DE DATOS — EL HALLAZGO QUE MÁS CAMBIA EL PLAN

El prompt maestro asume **Supabase directo desde el cliente con RLS por `auth.uid()`**.
**Este proyecto no funciona así.**

```
   App (Expo)  ──HTTP──▶  Backend Express (Railway)  ──service_role──▶  Supabase
                             /backend/src/routes/*.routes.ts
```

- El frontend **no tiene cliente de Supabase**: no hay un solo `createClient` en `/src`.
- Todo pasa por servicios HTTP: `src/services/trackingService.ts` (verbos) +
  `src/store/trackingSync.ts` (cola offline con reintentos).
- **El proyecto no usa Supabase Auth.** Está escrito literalmente en la migración 012:
  > «El proyecto no usa Supabase Auth: `auth.uid()` sería siempre NULL y una política
  > escrita con ella no autorizaría a nadie. Se activa RLS sin política permisiva; el
  > único camino es el backend con service_role.»

### Consecuencia directa sobre §2.1 del prompt

La política `USING (auth.uid() = user_id)` que el prompt marca como obligatoria
**no puede implementarse**: no autorizaría a nadie y rompería el módulo entero.

**Lo que se hace en su lugar** (ver `DECISIONES.md`, D-01): RLS activado sin política
permisiva —igual que las 9 tablas de la 012 y la 016— y la garantía de aislamiento se
traslada al backend, que **debe** filtrar por el `user_id` del token en cada consulta,
nunca por uno recibido en el cuerpo o en la ruta. Esto exige una prueba de penetración
propia en el QA de la fase 14 (un usuario intentando leer datos de otro por la API).

---

## 3. LO QUE YA EXISTE DEL MÓDULO DE SALUD

No se parte de cero. Inventario real:

| Pieza | Ubicación | Estado |
|---|---|---|
| Pantalla de ciclo | `app/menstrual.tsx` (697 líneas) | Funcional: rueda de ciclo, registro diario, fases, nutrición por fase |
| Store de ciclo | `src/store/menstrualStore.ts` (343) | **Solo AsyncStorage.** No llega al servidor |
| Bloqueo biométrico | dentro de `menstrual.tsx` + `privacyStore.ts` | Funcional (`menstrualLockEnabled`) |
| Síntomas | `menstrualStore.ts` | **11 síntomas.** El prompt pide 90+ |
| Tablas de ciclo | `database/migrations/016_salud.sql` | **Escritas, NO aplicadas**: `cycle_entries`, `cycle_daily_logs`, `medical_id` |
| Recuperación / check-in | `src/store/recoveryStore.ts` | Unificado el 21/08; fuente única del check-in |
| Sueño, pasos, pulso | `src/store/healthTrackerStore.ts` | Solo AsyncStorage |
| Hábitos | `src/store/habitsStore.ts` | ✅ sí sincroniza con servidor |
| Hub de Salud | `app/(tabs)/salud.tsx` | Rediseñado el 21/08 |

### Colisión de numeración de migraciones 🔴

Hay **tres** archivos con el prefijo `016`:
```
016_salud.sql                          ← tablas de salud (sin aplicar)
016_PARA_PEGAR.sql
016_social_guardar_bloquear_denunciar.sql
```
Debe resolverse **antes** de la Fase 2 renumerando; si no, el orden de aplicación es
indeterminado y una de las tres se perderá.

---

## 4. DATOS DISPONIBLES PARA LA CORRELACIÓN CRUZADA (Fase 6)

La Fase 6 es el diferenciador y depende de qué se puede **leer** de los otros módulos.
Inventario de fuentes reales:

| Fuente | Dónde vive | Sirve para |
|---|---|---|
| Sesiones de entrenamiento | tabla `workout_sessions` (mode, duración, volumen, kcal, RPE) | Fuerza y adherencia por fase |
| Series de fuerza | tabla `workout_sets` | Carga por ejercicio y por fase |
| Récords | tabla `personal_records` | Días de PR probable |
| Nutrición | `nutritionStore` + `nutrition_logs` | Calorías y macros por fase |
| Hidratación | `nutritionStore` (`waterGlasses`) | Retención en lútea |
| Sueño | `healthTrackerStore.sleepHistory` | Calidad de sueño por fase |
| Check-in subjetivo | `recoveryStore` (energía, ánimo, estrés, dolor) | Ánimo y energía por fase |
| Peso y medidas | tabla `body_metrics` | Peso por fase |
| Actividad diaria | tabla `activity_days` | Adherencia |
| **HRV / FC reposo** | **no existe fuente automática** | 🔴 requiere entrada manual o wearable |

**Riesgo de la Fase 6:** el prompt exige mínimo 3 ciclos para mostrar una correlación.
Con `menstrualStore` en AsyncStorage y sin historial en servidor, **hoy no hay usuarios
con 3 ciclos registrados**. La fase se construye pero nace en estado «reuniendo datos».

---

## 5. NAVEGACIÓN Y PANTALLAS

```
app/(tabs)/salud.tsx        Hub de Salud (rediseñado 21/08)
app/salud/recuperacion.tsx  Check-in único (creado 21/08)
app/menstrual.tsx           Ciclo — a migrar a app/salud/ciclo/
app/health-tracker.tsx      Historial de pasos/sueño/pulso
app/medical-id.tsx          Ficha médica (huérfana: no enlazada desde Salud)
```

Barra de pestañas: Nutrición · Entrena · **Salud** · Social · Perfil.
Running **ya no vive en Salud**: se mudó a Entrena el 21/08
(`app/workout/running.tsx`, con selector en `app/(tabs)/workout.tsx`).

---

## 6. SEGURIDAD Y PRIVACIDAD — ESTADO ACTUAL

| Requisito del prompt | Estado hoy |
|---|---|
| Bloqueo biométrico del módulo | ✅ existe (`expo-local-authentication`) |
| Auto-bloqueo configurable | ❌ |
| Blur en app switcher | ❌ |
| Modo discreto (notificaciones sin contenido) | ❌ |
| Modo anónimo real + código de 12 palabras | ❌ |
| Encriptación en reposo de datos de ciclo | ❌ — hoy AsyncStorage en claro |
| Exclusión de SDKs de terceros en `/salud/*` | ⚠️ **verificar**: hay Stripe en el bundle |
| Exportación / borrado de datos | ❌ |
| Edad mínima 16 | ❌ |

**Aviso de riesgo legal:** el punto de los SDKs de terceros (caso *Frasco v. Flo Health*,
59,5 M USD) exige auditar qué se inicializa globalmente en `app/_layout.tsx` y garantizar
que nada capture payloads en rutas de Salud. Pendiente de verificar en Fase 2.

---

## 7. RENDIMIENTO Y ERRORES — ESTADO ACTUAL

- Listas: `FlatList` en todo el proyecto; **no hay FlashList**.
- Error boundary: **no hay uno específico** para el módulo de Salud.
- Animaciones: Reanimated 4 disponible; el módulo actual apenas lo usa.
- Skia: **ausente**. La Cinta, el campo de fase y todas las gráficas del prompt
  dependen de él.

---

## 8. FALLBACKS Y DEGRADACIÓN

| Escenario | Comportamiento hoy |
|---|---|
| Sin red | El ciclo funciona (AsyncStorage); los hábitos usan cola offline |
| Backend caído | Salud sigue leyendo local; sin aviso al usuario |
| Sin permisos | No aplica todavía en el módulo de ciclo |
| Fuentes ausentes | `menstrualStore` no valida contra esquema |

---

## 9. CONFLICTOS QUE BLOQUEAN FASES

| # | Conflicto | Fase afectada | Gravedad |
|---|---|---|---|
| C-1 | Skia no instalado | F1, F5 (La Cinta), F6 (gráficas) | 🔴 bloqueante |
| C-2 | Sin Supabase en cliente; RLS sin `auth.uid()` | F2 completa | 🔴 rearquitectura |
| C-3 | Tres migraciones con prefijo `016` | F2 | 🔴 corregir antes de aplicar |
| C-4 | `016_salud.sql` escrita pero sin aplicar | F2 | 🟠 |
| C-5 | Sin HRV ni FC en reposo automáticas | F6 | 🟠 correlaciones parciales |
| C-6 | Sin Apple Health / Health Connect | F14 | 🟠 |
| C-7 | Stripe, no RevenueCat | F7 (paywall) | 🟠 adaptar |
| C-8 | Fuentes Michroma / Fraunces / JetBrains Mono ausentes | F1 | 🟠 la app usa Rajdhani + Inter |
| C-9 | Sin FlashList | F10, F12 | 🟢 menor |
| C-10 | New Architecture sin declarar | transversal | 🟠 verificar |

---

## 10. ORDEN DE ATAQUE RECOMENDADO

Antes de la Fase 1 hay que resolver C-3 (renumerar migraciones) y decidir C-1 y C-8,
porque condicionan todo el sistema visual. C-2 se resuelve documentando el modelo real
de aislamiento y trasladando la garantía al backend.

Todo queda registrado en `DECISIONES.md`.

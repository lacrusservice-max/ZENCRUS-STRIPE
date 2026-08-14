/**
 * ESLint · frontend
 *
 * Configuración plana, la única que entiende ESLint 9. Antes no había ninguna
 * —ni siquiera el parser de TypeScript instalado— así que `npm run lint`
 * fallaba antes de leer una línea. El script tampoco valía: `--ext` desapareció
 * en la versión 9 y los archivos se eligen aquí, con `files`.
 */

const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const reactHooks = require('eslint-plugin-react-hooks')
const globals = require('globals')

module.exports = [
  {
    ignores: [
      'node_modules/**', '.expo/**', 'dist/**', 'android/**', 'ios/**',
      'coverage/**', 'eslint.config.js', 'babel.config.js', 'metro.config.js',
      'jest.config.js',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        __DEV__: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      /**
       * Los hooks. El código ya tenía comentarios `eslint-disable` apuntando a
       * estas reglas, pero el plugin no estaba instalado: ESLint fallaba con
       * «regla no encontrada» en vez de comprobar nada.
       *
       * `rules-of-hooks` es error porque romperla es un fallo de verdad —un
       * hook dentro de un `if` desalinea el estado entre renders y produce
       * errores que parecen aleatorios—. `exhaustive-deps` queda en aviso: casi
       * siempre acierta, pero hay dependencias que se omiten a propósito y
       * convertirlo en error obligaría a discutir cada una hoy.
       */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // `catch {}` a secas es deliberado en los stores: si AsyncStorage falla,
      // la pantalla se queda con lo que tenga y no se rompe nada.
      'no-empty': ['error', { allowEmptyCatch: true }],

      /**
       * Aviso, no error, y a conciencia.
       *
       * La app arrastra 83 símbolos muertos —imports que se quedaron atrás,
       * helpers escritos y aún sin conectar— repartidos por 44 pantallas. No
       * son fallos: no rompen nada y el empaquetador los descarta.
       *
       * Ponerlo en `error` obliga a elegir entre dejar el lint roto o barrer 44
       * archivos de golpe, y ninguna de las dos vale la pena: el barrido mete
       * ruido en cualquier rama que esté abierta y, peor, borra funciones que
       * alguien puede tener a medio conectar.
       *
       * Como aviso salen en cada `npm run lint`, con nombre y línea, y se
       * limpian cuando toque el archivo quien lo esté tocando.
       */
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        // El idioma de quitar campos con `...resto`: las variables sobran a
        // propósito, existen para que el resto no las lleve.
        ignoreRestSiblings: true,
      }],

      // Las respuestas del servidor no tienen tipo generado. Se avisa para que
      // no se extienda; no se prohíbe.
      '@typescript-eslint/no-explicit-any': 'warn',

      // En React Native `require()` no es un import perezoso: es la ÚNICA forma
      // de referenciar un asset estático —imágenes, vídeos, fuentes— porque es
      // lo que Metro sabe empaquetar. `import logo from './logo.png'` no da la
      // referencia que espera `<Image source>`.
      '@typescript-eslint/no-require-imports': 'off',

      // `condicion ? hacerA() : hacerB()` como sentencia es una elección de
      // estilo extendida en las pantallas, no un despiste: las dos ramas son
      // llamadas con efecto. Lo que sí se sigue prohibiendo es la expresión
      // suelta que no llama a nada, que casi siempre es una línea a medio
      // escribir.
      '@typescript-eslint/no-unused-expressions': ['error', {
        allowTernary: true,
        allowShortCircuit: true,
      }],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',

      /**
       * El error de fechas que costó esta sesión: `toISOString()` devuelve la
       * fecha en UTC, no la del usuario. En México, a partir de las seis de la
       * tarde, la cena se apuntaba en el diario del día siguiente.
       *
       * Se prohíbe recortar un `toISOString()` para sacar una fecha. Lo
       * correcto está en `@/utils/fechas`: `hoyLocal`, `aFechaLocal`,
       * `haceDias`, `enDias`, `sumarDias`.
       */
      'no-restricted-syntax': ['error', {
        selector: "CallExpression[callee.object.callee.property.name='toISOString'][callee.property.name=/^(slice|split|substring|substr)$/]",
        message: 'toISOString() da la fecha en UTC, no la del usuario. Usa hoyLocal() o aFechaLocal() de @/utils/fechas.',
      }],
    },
  },
  {
    // Las pruebas construyen series sintéticas donde el huso da igual y lo que
    // importa es que la fecha sea reproducible.
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-restricted-syntax': 'off' },
  },
]

/**
 * ESLint · backend
 *
 * Configuración plana, que es la única que entiende ESLint 9. Antes no había
 * ningún archivo de configuración, así que `npm run lint` fallaba siempre antes
 * de mirar una sola línea de código.
 *
 * El script tampoco valía: `--ext` desapareció en la versión 9. Ahora los
 * archivos se eligen aquí, con `files`.
 */

const tsPlugin = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const globals = require('globals')

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'eslint.config.js'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,

      // `catch {}` a secas es un patrón deliberado en los controladores: hay
      // sitios donde el fallo ya se registró y volver a mirarlo no aporta.
      'no-empty': ['error', { allowEmptyCatch: true }],

      // El guion bajo delante marca «esto no se usa y es a propósito», que es
      // como se escriben los `_req` de Express.
      //
      // `ignoreRestSiblings` permite el idioma con el que se quitan campos
      // sensibles antes de responder:
      //
      //   const { password_hash, two_factor_secret, ...safeUser } = user
      //
      // Ahí las variables no se usan A PROPÓSITO —existen para que el resto no
      // las lleve— y renombrarlas a `_password_hash` para callar al linter
      // haría ilegible justo el código que protege las contraseñas.
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // Los `namespace` sueltos sobran, pero ampliar el tipo `Request` de
      // Express —donde viven `req.user` y `req.cuota`— solo se puede hacer con
      // `declare global { namespace Express { … } }`. No hay alternativa en
      // sintaxis de módulos.
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],

      // Las filas que devuelve Supabase no tienen tipo generado: obligarlas a
      // uno inventado daría una falsa sensación de seguridad. Se avisa para que
      // no se extienda, no se prohíbe.
      '@typescript-eslint/no-explicit-any': 'warn',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
]

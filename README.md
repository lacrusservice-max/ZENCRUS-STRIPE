# NutriAI Fit 🥗💪

Aplicación de gestión nutricional y entrenamiento personalizado con IA.

**Equipo:** Carlos (Dev) + Eunice (Nutrióloga/Admin)  
**Stack:** React Native (Expo) + Node.js/Express/TypeScript + Supabase  
**Estado:** Fase 1 — Base lista para integrar IA y DB

---

## Estructura del proyecto

```
NutriAI-Fit/
├── backend/           # API REST (Node.js + Express + TypeScript)
├── frontend/          # App móvil (React Native + Expo)
├── database/          # Schemas SQL para Supabase
├── ai-integration/    # Módulo IA (placeholder para DeepSeek)
├── docs/              # Documentación técnica
└── .github/workflows/ # CI/CD con GitHub Actions
```

---

## Inicio rápido

### Backend
```bash
cd backend
cp ../.env.example ../.env
# Editar .env con tus valores reales

npm install
npm run dev
# API corriendo en http://localhost:5000
```

### Frontend (React Native + Expo)
```bash
cd frontend
npm install
npx expo start
# Escanea el QR con Expo Go en tu teléfono
```

### Con Docker
```bash
cp .env.example .env
# Editar .env con tus valores reales

docker-compose up -d
# API en http://localhost:5000
```

---

## Variables de entorno requeridas

Copia `.env.example` a `.env` y completa:

| Variable | Descripción |
|----------|-------------|
| `JWT_SECRET` | Secret de 64+ caracteres para JWT |
| `JWT_REFRESH_SECRET` | Secret diferente para refresh tokens |
| `ENCRYPTION_KEY` | String hex de 64 chars (32 bytes) para AES-256 |
| `SMTP_*` | Credenciales de correo para emails transaccionales |
| `APP_SECRET` | Secret de la app para fingerprints |

Las demás variables (Supabase, DeepSeek, Stripe, Firebase) se conectan en fases posteriores.

---

## Fases de desarrollo

### Fase 1 (Actual) ✅
- [x] Arquitectura completa backend + frontend
- [x] Autenticación JWT con refresh tokens rotativos
- [x] Verificación de email con código de 6 dígitos
- [x] Módulo de dieta con placeholder IA
- [x] Módulo de entrenamiento con placeholder IA
- [x] Chat 24/7 con EuniceAI (placeholder)
- [x] Sistema de suscripciones (estructura lista)
- [x] Panel administrativo para Eunice
- [x] Seguridad: rate limiting, headers, cifrado, anti-hackeo
- [x] Schema completo para Supabase con RLS
- [x] Docker + CI/CD
- [x] Documentación técnica

### Fase 2 (Próxima)
- [ ] Conectar Supabase (ejecutar `database/migrations/001_initial_schema.sql`)
- [ ] Integrar DeepSeek API (activar en `ai-integration/deepseek-client.js`)
- [ ] Configurar Firebase para push notifications
- [ ] Activar Stripe y MercadoPago
- [ ] Publicar en App Store y Google Play

### Fase 3
- [ ] Módulo Dark Kitchen
- [ ] Dashboard analytics avanzado
- [ ] Plan Corporativo con múltiples usuarios

---

## Seguridad implementada

- ✅ Argon2id para contraseñas (no bcrypt)
- ✅ JWT de 15 minutos + refresh tokens rotativos
- ✅ Rate limiting por IP con bloqueo progresivo
- ✅ Cifrado AES-256-GCM para datos sensibles
- ✅ Row Level Security en Supabase
- ✅ Tokens en SecureStore nativo (Keychain/Keystore)
- ✅ Headers de seguridad (Helmet + HSTS + CSP)
- ✅ Detección de emergencias médicas en el chat
- ✅ Sanitización de inputs server-side

Ver [docs/SECURITY.md](docs/SECURITY.md) para detalles completos.

---

## API Reference

Ver [docs/API.md](docs/API.md)

---

## Contribuir

1. `git checkout -b feature/nombre-feature`
2. Hacer cambios
3. `npm test` + `npm run type-check`
4. Pull request a `develop`

---

## Licencia

Privada — © 2024 LACRUSS Innovation Technology / NutriAI Fit

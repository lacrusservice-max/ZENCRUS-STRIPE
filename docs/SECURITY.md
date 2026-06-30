# Seguridad — NutriAI Fit

## Modelo de seguridad

NutriAI Fit implementa **Defensa en Profundidad** con 7 capas de protección.

### Capa 1: Red
- Cloudflare WAF con reglas OWASP
- DDoS protection activada
- IP blocking automático tras comportamiento anómalo

### Capa 2: Transporte
- HTTPS/TLS 1.3 obligatorio en producción
- HSTS con `max-age=63072000; includeSubDomains; preload`
- Certificate Pinning en la app mobile

### Capa 3: Aplicación
- Validación de inputs con Zod (server-side siempre)
- Content Security Policy estricta
- CORS con lista blanca explícita
- Rate limiting: 100 req/15min global, 5 intentos de login/15min
- Sanitización de HTML con DOMPurify

### Capa 4: Autenticación
- JWT con expiración de 15 minutos (access token)
- Refresh tokens rotativos y de un solo uso (7 días)
- Hashing de contraseñas con Argon2id (memory: 64MB, iterations: 3)
- Bloqueo de cuenta tras 5 intentos fallidos (15 minutos)
- 2FA opcional vía TOTP (compatível con Authy, Google Authenticator)

### Capa 5: Autorización
- RBAC: `user`, `nutritionist`, `admin`
- Row Level Security en Supabase (usuarios solo ven sus datos)
- Principio de mínimo privilegio en tokens JWT

### Capa 6: Datos
- Contraseñas: Argon2id, nunca texto plano
- Datos PII sensibles: AES-256-GCM en base de datos
- Tokens de sesión: Expo SecureStore (Keychain/Keystore nativo)
- Pagos: tokenización Stripe/MercadoPago (nunca guardamos datos de tarjeta)
- Backups encriptados

### Capa 7: Infraestructura
- Secrets en variables de entorno, nunca en código
- Audit logs de todas las acciones críticas
- Alertas en comportamiento anómalo
- Dependency scanning en CI/CD

---

## Privacidad (LFPDPPP + GDPR)

### Principios
- **Mínimo necesario**: solo datos requeridos para el servicio
- **Transparencia**: aviso de privacidad en lenguaje simple
- **Consentimiento explícito**: casilla NO pre-marcada

### Derechos del usuario (implementados)
| Derecho | Endpoint |
|---------|----------|
| Ver mis datos | `GET /api/users/me` |
| Exportar datos | `GET /api/users/me/export` |
| Corregir datos | `PATCH /api/users/me` |
| Eliminar cuenta | `DELETE /api/users/me` |

### Retención de datos
- Logs de actividad: 1 año
- Notificaciones leídas: 6 meses
- Datos de usuario: mientras la cuenta esté activa
- Datos anonimizados para analytics: indefinido

---

## Reporte de vulnerabilidades

Si encuentras una vulnerabilidad de seguridad:

1. **NO** abras un issue público en GitHub
2. Envía un email a: `security@nutriaifit.com`
3. Incluye: descripción, pasos para reproducir, impacto potencial
4. Te responderemos en < 48 horas

**No divulgar públicamente** hasta que el equipo haya tenido oportunidad de corregir el problema.

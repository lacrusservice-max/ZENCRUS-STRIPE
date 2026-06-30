# API Reference — NutriAI Fit

Base URL: `https://api.nutriaifit.com/api`  
Auth: `Authorization: Bearer <access_token>`

---

## Autenticación

### POST /auth/register
```json
Body: { "email": "string", "password": "string", "fullName": "string" }
Response 201: { "success": true, "message": "Cuenta creada", "data": { "email": "...", "requiresVerification": true } }
```

### POST /auth/login
```json
Body: { "email": "string", "password": "string", "fcmToken?": "string" }
Response 200: { "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }
```

### POST /auth/verify-email
```json
Body: { "email": "string", "code": "string (6 dígitos)" }
Response 200: { "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }
```

### POST /auth/refresh
```json
Body: { "refreshToken": "string" }
Response 200: { "success": true, "data": { "accessToken": "...", "refreshToken": "..." } }
```

### POST /auth/logout `[Auth]`
```json
Response 200: { "success": true, "message": "Sesión cerrada" }
```

### POST /auth/forgot-password
```json
Body: { "email": "string" }
Response 200: { "success": true, "message": "Si el correo existe, recibirás instrucciones" }
```

---

## Usuario

### GET /users/me `[Auth]`
Obtiene el perfil del usuario autenticado.

### PATCH /users/me `[Auth]`
Actualiza el perfil. Campos opcionales: `fullName`, `birthDate`, `gender`, `phone`, `fitnessLevel`, `activityLevel`, `weight`, `height`, `goals`, `healthConditions`, `dietaryPreferences`.

### DELETE /users/me `[Auth]`
Elimina la cuenta y todos los datos (hard delete irreversible).

### GET /users/me/export `[Auth]`
Descarga un JSON con todos los datos del usuario.

---

## Planes de Dieta

### POST /diet/generate `[Auth]`
```json
Body: {
  "name?": "string",
  "targetCalories?": 2000,
  "durationDays": 7,
  "requestValidation?": false
}
Response 201: { "success": true, "data": { DietPlan } }
```

### GET /diet/active `[Auth]`
Obtiene el plan de dieta activo.

### GET /diet `[Auth]`
Lista todos los planes del usuario.

### GET /diet/:id `[Auth]`
Detalle de un plan específico.

### POST /diet/:id/validate `[Auth: nutritionist/admin]`
Valida un plan generado por IA.

---

## Rutinas de Entrenamiento

### POST /workout/generate `[Auth]`
```json
Body: {
  "level": "beginner|intermediate|advanced",
  "goal": "strength|hypertrophy|endurance|functional",
  "daysPerWeek": 3,
  "sessionDuration": 60,
  "equipment": ["bodyweight"],
  "injuries": []
}
```

### GET /workout/active `[Auth]`
Obtiene la rutina activa.

### GET /workout `[Auth]`
Lista todas las rutinas del usuario.

---

## Chat IA

### POST /chat/sessions `[Auth]`
Crea una nueva sesión de chat.

### GET /chat/sessions `[Auth]`
Lista las sesiones del usuario.

### POST /chat/sessions/:id/messages `[Auth]`
```json
Body: { "content": "string (max 2000 chars)" }
Response 200: { "success": true, "data": { "userMessage": {...}, "aiMessage": {...} } }
```

---

## Suscripciones

### GET /subscriptions/plans
Lista los planes disponibles (público).

### GET /subscriptions/current `[Auth]`
Obtiene la suscripción activa del usuario.

### POST /subscriptions/checkout `[Auth]`
```json
Body: { "tier": "basic|premium|corporate", "provider": "stripe|mercadopago" }
Response 200: { "success": true, "data": { "checkoutUrl": "..." } }
```

---

## Panel Admin `[Auth: nutritionist/admin]`

### GET /admin/dashboard
Métricas generales de la plataforma.

### GET /admin/users
Lista todos los usuarios con filtros.

### GET /admin/reports/adherence
Reporte de adherencia de usuarios.

---

## Códigos de respuesta

| Código | Significado |
|--------|-------------|
| 200 | Éxito |
| 201 | Creado |
| 400 | Datos inválidos |
| 401 | No autenticado |
| 403 | Sin permisos |
| 404 | No encontrado |
| 409 | Conflicto (ej: email ya existe) |
| 422 | Validación fallida |
| 423 | Cuenta bloqueada |
| 429 | Rate limit excedido |
| 500 | Error interno |

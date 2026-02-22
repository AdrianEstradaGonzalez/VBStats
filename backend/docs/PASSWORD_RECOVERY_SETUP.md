# Password Recovery – Gmail SMTP (Nodemailer)

Sistema de recuperación de contraseña que envía un código de 8 caracteres al email del usuario, **sin necesidad de dominio propio ni verificación de dominio**.

---

## ¿Por qué Gmail SMTP en lugar de SendGrid/Resend?

| | SendGrid / Resend | Gmail SMTP (Nodemailer) |
|---|---|---|
| Dominio propio | ✅ Requiere | ❌ No requiere |
| Verificación DNS | ✅ Requiere (SPF, DKIM) | ❌ No requiere |
| Costo | Gratis hasta cierto límite | 100% gratis |
| Límite diario | Varía según plan | ~500 emails/día |
| Requisitos | API Key + dominio verificado | Cuenta Gmail + App Password |

> **Nota sobre Railway/Render:** Algunos hostings bloquean puertos SMTP (465/587). Railway **sí** permite conexiones SMTP salientes, así que Gmail SMTP funciona perfectamente.

---

## Configuración paso a paso

### 1. Habilitar verificación en 2 pasos
1. Entra a tu cuenta de Google: https://myaccount.google.com/security
2. En **"Cómo inicias sesión en Google"**, activa **Verificación en 2 pasos**

### 2. Crear una contraseña de aplicación (App Password)
1. Ve a: https://myaccount.google.com/apppasswords
2. En **"Nombre de la app"**, escribe: `VBStats Backend`
3. Haz clic en **Crear**
4. Copia la contraseña de 16 caracteres que te genera (ejemplo: `abcd efgh ijkl mnop`)

### 3. Configurar variables de entorno

En tu archivo `.env` del backend:

```env
GMAIL_USER=vbstats.contact@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
EMAIL_FROM=VBStats <vbstats.contact@gmail.com>
```

| Variable | Descripción |
|---|---|
| `GMAIL_USER` | Tu cuenta de Gmail |
| `GMAIL_APP_PASSWORD` | La contraseña de aplicación de 16 caracteres |
| `EMAIL_FROM` | (Opcional) Remitente que aparece en el email. Si no se define, usa `VBStats <GMAIL_USER>` |

### 4. En Railway (producción)
Añade las mismas variables en **Railway > tu servicio > Variables**:
- `GMAIL_USER` → `vbstats.contact@gmail.com`
- `GMAIL_APP_PASSWORD` → tu App Password
- `EMAIL_FROM` → `VBStats <vbstats.contact@gmail.com>`

---

## Seguridad Implementada

### 1. **Protección contra enumeración de usuarios**
   - El endpoint siempre responde 200 OK, sin revelar si el correo existe o no

### 2. **Tokens criptográficamente seguros**
   - 64 caracteres hex generados con `crypto.randomBytes(32)`

### 3. **Expiración de tokens**
   - Los tokens expiran después de 1 hora

### 4. **Uso único**
   - Cada token solo puede usarse una vez (se marca `used = TRUE`)

### 5. **Invalidación de tokens anteriores**
   - Al solicitar un nuevo código, todos los anteriores del usuario se invalidan

### 6. **Hash de contraseñas**
   - Bcrypt con 12 salt rounds

### 7. **Cierre de sesión automático**
   - Al cambiar la contraseña, todas las sesiones activas se cierran

---

## Flujo de Recuperación

1. Usuario ingresa su correo en la app
2. Backend genera token de 64 chars y envía los primeros **8 caracteres** como código por email
3. Usuario ingresa el código de 8 caracteres
4. Backend verifica el código (case-insensitive) y devuelve el token completo
5. Usuario establece nueva contraseña
6. Backend hashea contraseña, invalida tokens y cierra sesiones

---

## Endpoints API

### `POST /api/users/forgot-password`
**Body:** `{ "email": "usuario@ejemplo.com" }`
- Siempre responde 200 (no revela si el email existe)

### `POST /api/users/verify-reset-token`
**Body:** `{ "email": "usuario@ejemplo.com", "code": "A1B2C3D4" }`
- Devuelve `{ success: true, token: "<64-char>" }` si el código es válido

### `POST /api/users/reset-password`
**Body:** `{ "token": "<64-char-token>", "password": "nuevaContraseña123" }`
- Actualiza la contraseña y cierra sesiones

---

## Tabla de Base de Datos

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_user_expires (user_id, expires_at)
);
```

---

## Límites de Gmail SMTP

- **500 emails/día** con cuenta personal de Gmail
- **2000 emails/día** con Google Workspace
- Más que suficiente para apps pequeñas/medianas

---

## Troubleshooting

| Problema | Solución |
|---|---|
| `Email no configurado` | Verifica que `GMAIL_USER` y `GMAIL_APP_PASSWORD` están en `.env` |
| `Invalid login` | App Password mal copiada, o 2FA no está activado |
| `Less secure app access` | NO uses esa opción. Usa **App Password** |
| Emails van a spam | El destinatario debe añadir el remitente a contactos |
| Error `534-5.7.9` | Restricción de cuenta. Verifica 2FA y recrea el App Password |

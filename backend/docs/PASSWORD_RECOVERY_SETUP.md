# Configuración de Recuperación de Contraseña

## Configuración del Correo (Backend)

Para que la funcionalidad de recuperación de contraseña funcione correctamente, necesitas configurar **Resend** (servicio de email via API HTTP que funciona en Render y otros hosting).

### Pasos para configurar Resend:

1. **Crear cuenta en Resend:**
   - Ve a https://resend.com y crea una cuenta gratuita
   - El plan gratuito incluye 100 emails/día (suficiente para la mayoría de apps)

2. **Obtener API Key:**
   - En el dashboard de Resend, ve a **API Keys**
   - Crea una nueva API Key y cópiala

3. **Verificar dominio (opcional pero recomendado):**
   - Para enviar desde `vbstats.contact@gmail.com`, necesitas verificar el dominio
   - Si no tienes dominio verificado, los emails se enviarán desde `onboarding@resend.dev`
   - Para verificar un dominio propio, sigue las instrucciones en Resend > Domains

4. **Agregar las variables de entorno en Render:**
   
   ```env
   # Configuración de Resend para envío de emails
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
   
   # Email remitente (requiere dominio verificado en Resend)
   # Sin dominio verificado, usa: VBStats <onboarding@resend.dev>
   EMAIL_FROM=VBStats <vbstats.contact@gmail.com>
   
   # Entorno (development/production)
   NODE_ENV=production
   ```

5. **Desplegar cambios en Render**

### ¿Por qué Resend en lugar de Gmail SMTP?

Render (y muchos otros hostings) bloquean las conexiones SMTP salientes en los puertos 465 y 587 para prevenir spam. Resend usa una API HTTP que no tiene este problema.

## Seguridad Implementada

La implementación de recuperación de contraseña incluye las siguientes medidas de seguridad:

### 1. **Protección contra enumeración de usuarios**
   - El sistema siempre responde con el mismo mensaje, independientemente de si el correo existe o no
   - Esto evita que atacantes descubran qué correos están registrados

### 2. **Tokens seguros**
   - Se generan tokens de 64 caracteres usando `crypto.randomBytes(32)`
   - Los tokens son criptográficamente seguros y únicos

### 3. **Expiración de tokens**
   - Los tokens expiran después de 1 hora
   - Esto limita la ventana de tiempo para posibles ataques

### 4. **Uso único**
   - Cada token solo puede usarse una vez
   - Una vez utilizado, se marca como "usado" en la base de datos

### 5. **Invalidación de tokens anteriores**
   - Al solicitar un nuevo código, todos los códigos anteriores del usuario se invalidan
   - Esto evita acumulación de tokens válidos

### 6. **Hash de contraseñas**
   - Las nuevas contraseñas se hashean con bcrypt (12 rounds)
   - Nunca se almacenan contraseñas en texto plano

### 7. **Cierre de sesión automático**
   - Al cambiar la contraseña, todas las sesiones activas se cierran
   - El usuario debe volver a iniciar sesión

## Flujo de Recuperación

1. Usuario solicita recuperación ingresando su correo
2. Sistema genera token seguro y lo envía por correo
3. Usuario ingresa el código de 8 caracteres (prefijo del token)
4. Sistema verifica el código y devuelve el token completo
5. Usuario establece nueva contraseña
6. Sistema actualiza contraseña, invalida token y cierra sesiones

## Tabla de Base de Datos

La tabla `password_reset_tokens` se crea automáticamente:

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires (expires_at)
);
```

## Endpoints API

### POST `/api/users/forgot-password`
Solicita un código de recuperación.

**Body:**
```json
{
  "email": "usuario@ejemplo.com"
}
```

### POST `/api/users/verify-reset-token`
Verifica si un código es válido.

**Body:**
```json
{
  "token": "ABC12345"
}
```

### POST `/api/users/reset-password`
Establece la nueva contraseña.

**Body:**
```json
{
  "token": "token_completo_de_64_caracteres",
  "newPassword": "nueva_contraseña_segura"
}
```

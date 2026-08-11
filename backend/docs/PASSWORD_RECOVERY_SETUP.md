# Recuperación de contraseña y verificación de registro (Resend)

Los correos transaccionales de VBStats — el código de recuperación de contraseña y
el código de verificación al registrarse — se envían con **Resend** desde un dominio
propio.

Implementación: [`backend/services/emailService.js`](../services/emailService.js)

---

## Por qué Resend y no Gmail

Antes se usaba Gmail SMTP con una contraseña de aplicación. Funcionaba, pero:

| | Gmail SMTP | Resend |
|---|---|---|
| Remitente | `tucuenta@gmail.com` | `no-reply@tudominio.com` |
| Entregabilidad | Sin SPF/DKIM propios, acaba en spam | Dominio autenticado |
| Límite diario | ~500, y Google puede bloquear la cuenta | Según plan, con avisos |
| Visibilidad | Ninguna: un rebote es invisible | Panel con entregado / rebotado / spam |
| Uso previsto | Buzón personal | Correo transaccional |

Lo determinante es lo de la visibilidad: con Gmail, un correo de recuperación
filtrado como spam no dejaba ni rastro, y el usuario simplemente se quedaba sin
poder entrar.

Gmail se mantiene como **respaldo automático**: si Resend falla y hay credenciales
de Gmail configuradas, el envío sale por ahí en lugar de perderse.

---

## Configuración

### 1. Verificar el dominio en Resend

1. https://resend.com/domains → **Add Domain** → tu dominio
2. Resend te da tres registros DNS. Créalos en tu proveedor de dominio.

   **Importante:** en Namecheap (y en la mayoría de paneles) el campo *Host* lleva
   el nombre **corto**, porque el panel añade el dominio automáticamente. Poner
   `resend._domainkey.tudominio.com` genera
   `resend._domainkey.tudominio.com.tudominio.com` y no verifica nunca.

   | Type | Host | Value |
   |---|---|---|
   | TXT | `resend._domainkey` | `p=MIGfMA0…` (la clave completa, sin espacios) |
   | MX | `send` | `feedback-smtp.<region>.amazonses.com`, prioridad `10` |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` |

   El MX va en el subdominio `send`, **nunca en la raíz**: en la raíz te cargarías
   el correo entrante del dominio.

3. Espera a la propagación y pulsa **Verify DNS Records**.

Para comprobarlo por tu cuenta:

```bash
nslookup -type=TXT resend._domainkey.tudominio.com
```

### 2. Crear la API key

https://resend.com/api-keys → **Create API Key** con permiso de envío.

### 3. Variables de entorno

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=VBStats <no-reply@tudominio.com>
```

El dominio de `EMAIL_FROM` **debe** ser el verificado en Resend, o todos los
envíos fallan.

Opcionalmente, para mantener el respaldo:

```env
GMAIL_USER=tucuenta@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## Comprobar que funciona

Al arrancar, el servidor indica el proveedor activo:

```
✅ Email provider: Resend
ℹ️  Gmail SMTP available as fallback
```

Si ves esto, falta configuración:

```
⚠️  No email provider configured — password recovery and email verification will not work.
```

Prueba de extremo a extremo:

```bash
curl -X POST https://tu-backend/api/users/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"tu-correo@ejemplo.com"}'
```

La respuesta es siempre la misma exista o no la cuenta — es deliberado, para no
revelar qué correos están registrados. Para saber si salió de verdad, mira los logs
del servidor (`📧 Email sent via Resend: <id>`) o el panel de Resend.

---

## Errores frecuentes

**`Resend: The <dominio> domain is not verified`**
El dominio de `EMAIL_FROM` no coincide con el verificado, o la verificación aún no
ha terminado.

**`Resend: API key is invalid`**
La clave está mal copiada o fue revocada. Debe empezar por `re_`.

**El correo no llega pero los logs dicen que se envió**
Míralo en el panel de Resend: ahí verás si rebotó o si el destinatario lo marcó
como spam. Es justo lo que con Gmail no se podía saber.

**Rate limit al pedir varios códigos seguidos**
No es del correo: el backend limita a 10 intentos cada 15 minutos en los endpoints
de credenciales, para evitar fuerza bruta sobre los códigos de recuperación.

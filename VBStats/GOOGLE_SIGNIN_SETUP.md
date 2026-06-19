# Configuración de Google Sign-In

El código de "Continuar con Google" ya está implementado (frontend + backend), pero
**no se activa hasta que completes esta configuración**, porque requiere credenciales
OAuth propias de tu proyecto de Google Cloud y una recompilación nativa de la app.

Mientras `GOOGLE_WEB_CLIENT_ID` esté vacío, el botón de Google **no se muestra** y el
resto de la app funciona con normalidad (login/registro por correo).

---

## 1. Crear credenciales en Google Cloud Console

1. Entra en https://console.cloud.google.com/ con la cuenta de Google del proyecto.
2. Crea un proyecto (o usa uno existente).
3. **APIs y servicios → Pantalla de consentimiento OAuth**: configúrala (tipo *External*,
   nombre de la app, correo de soporte). Añade tu correo como *test user* mientras esté en
   modo prueba.
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**. Necesitas
   crear **tres** clientes:

   | Tipo de cliente | Para qué sirve |
   |---|---|
   | **Aplicación web** | Su *Client ID* es el que verifica el backend (`GOOGLE_WEB_CLIENT_ID`) y el que usa la app como `webClientId`. |
   | **Android** | Requiere el *nombre del paquete* (`com.vbstats` u el que uses) y la huella **SHA-1** del keystore. |
   | **iOS** | Requiere el *Bundle ID* de la app. |

### Obtener la huella SHA-1 (Android)

```bash
# Debug
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Release (usa tu keystore de publicación)
keytool -list -v -keystore /ruta/a/tu/release.keystore -alias TU_ALIAS
```

Registra **tanto la SHA-1 de debug como la de release** en el cliente Android.

---

## 2. Configurar el backend

En las variables de entorno del backend (`backend/.env` o el panel de Render):

```
GOOGLE_WEB_CLIENT_ID=XXXXXXXX.apps.googleusercontent.com   # el "Client ID" del cliente WEB
```

Instala la dependencia (ya añadida a `backend/package.json`):

```bash
cd backend
npm install
```

---

## 3. Configurar el frontend

1. Pon el **mismo Web Client ID** en `VBStats/services/config.ts`:

   ```ts
   export const GOOGLE_WEB_CLIENT_ID = 'XXXXXXXX.apps.googleusercontent.com';
   ```

2. Instala la librería (ya añadida a `VBStats/package.json`):

   ```bash
   cd VBStats
   npm install
   ```

### Android (`VBStats/android`)

- Coloca el archivo `google-services.json` (descargado de Firebase/Google Cloud) en
  `android/app/`.
- Asegúrate de que el plugin de Google Services esté aplicado (si usas Firebase).
  Con `@react-native-google-signin/google-signin` en modo "Original Google Sign In"
  basta con el SHA-1 + Web Client ID; sigue la guía oficial del paquete para tu versión.

### iOS (`VBStats/ios`)

- Añade el *reversed client ID* del cliente iOS como **URL Scheme** en `Info.plist`.
- Ejecuta `cd ios && pod install`.

> Guía oficial y siempre actualizada del paquete:
> https://react-native-google-signin.github.io/docs/setting-up/get-config-file

---

## 4. Recompilar la app nativa

Google Sign-In incluye código nativo, así que **no basta con recargar el bundle JS**:

```bash
# Android
npm run android

# iOS
npm run ios
```

---

## 5. Cómo funciona (resumen técnico)

1. La app abre el diálogo de Google y obtiene un **idToken** (`services/googleAuth.ts`).
2. La app lo envía a `POST /api/users/google`.
3. El backend verifica el idToken contra `GOOGLE_WEB_CLIENT_ID` con `google-auth-library`.
4. Si el correo es válido, busca el usuario o crea uno nuevo (`auth_provider = 'google'`)
   y devuelve la sesión, igual que un login normal.

## Solución de problemas

- **`DEVELOPER_ERROR` en Android**: el SHA-1 o el package name no coinciden con el cliente
  Android, o falta el Web Client ID. Revisa que la SHA-1 del keystore con el que compilas
  esté registrada.
- **El backend responde 503**: falta `GOOGLE_WEB_CLIENT_ID` en el servidor.
- **El botón no aparece**: `GOOGLE_WEB_CLIENT_ID` está vacío en `services/config.ts`.

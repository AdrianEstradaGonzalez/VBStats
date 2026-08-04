# Configurar notificaciones push (Firebase Cloud Messaging)

Guía paso a paso. Al final tienes una lista de verificación.

**Datos del proyecto que vas a necesitar:**

| Dato | Valor |
|---|---|
| Nombre de paquete Android | `com.vbstats` |
| Bundle ID de iOS | `com.adrianestrada2025.VBStats` |
| SHA-1 del certificado de release | `71:23:60:FB:32:CA:4F:2E:BB:EA:2F:98:2E:F9:24:2E:F6:36:4E:78` |

> El SHA-1 sólo hace falta para Google Sign-In, no para las notificaciones. Y si
> usas **Play App Signing**, el que vale es el que muestra Play Console en
> *Integridad de la app*, no éste.

---

## Paso 1 — Crear el proyecto en Firebase

1. Entra en https://console.firebase.google.com
2. **Agregar proyecto** → nombre `VBStats` → Continuar.
3. Google Analytics: puedes **desactivarlo**. No se usa para nada aquí y evita
   tener que crear una cuenta de Analytics.
4. Crear proyecto y esperar a que termine.

---

## Paso 2 — Registrar la app de Android

1. En la pantalla principal del proyecto, pulsa el icono de **Android**.
2. **Nombre del paquete**: `com.vbstats`

   Tiene que coincidir **exactamente**. Si te equivocas aquí, la app compila pero
   Firebase la rechaza en tiempo de ejecución.
3. Alias: `VBStats Android` (o lo que quieras, es sólo una etiqueta).
4. SHA-1: déjalo vacío por ahora.
5. **Registrar app**.
6. **Descarga `google-services.json`** y colócalo exactamente en:

   ```
   VBStats/android/app/google-services.json
   ```

   Junto a `build.gradle`, no en la raíz de `android/`.
7. Los pasos siguientes que muestra Firebase (añadir el plugin de Gradle y el
   classpath) **ya están hechos** en el repositorio. Salta hasta el final y pulsa
   *Continuar en la consola*.

> El fichero está en `.gitignore` a propósito: contiene identificadores ligados a
> tu cuenta. Guárdalo aparte (gestor de contraseñas o almacenamiento privado)
> porque lo necesitarás en cada máquina donde compiles.

---

## Paso 3 — Registrar la app de iOS (sáltalo si sólo publicas en Android)

1. Icono de **iOS** en la consola.
2. **ID del paquete**: `com.adrianestrada2025.VBStats`
3. Descarga `GoogleService-Info.plist`.
4. Ábrelo **desde Xcode**, no copiándolo a mano: abre `VBStats.xcworkspace`,
   arrastra el fichero al proyecto, marca *Copy items if needed* y asegúrate de
   que el target `VBStats` está seleccionado. Si lo copias por fuera de Xcode, no
   se incluye en el bundle y Firebase no arranca.
5. `cd ios && pod install`

### 3b. Clave de APNs (imprescindible en iOS)

Sin esto, iOS **no recibe nada** aunque todo lo demás esté bien.

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles**
   → **Keys** → botón `+`.
2. Nombre: `VBStats Push`. Marca **Apple Push Notifications service (APNs)**.
3. Continuar → Registrar → **Descargar el `.p8`**.

   Sólo se puede descargar **una vez**. Guárdalo bien.
4. Apunta el **Key ID** (aparece en la misma pantalla) y tu **Team ID**
   (arriba a la derecha en la web de Apple Developer).
5. En Firebase: **Configuración del proyecto** (rueda dentada) →
   **Cloud Messaging** → sección *Configuración de la app de Apple* →
   **Subir** la clave de autenticación de APNs. Te pedirá el `.p8`, el Key ID y
   el Team ID.

---

## Paso 4 — Credenciales del servidor

El backend necesita una cuenta de servicio para poder enviar.

1. Firebase → **Configuración del proyecto** → pestaña **Cuentas de servicio**.
2. **Generar nueva clave privada** → *Generar clave*. Se descarga un `.json`.

   Este fichero permite enviar notificaciones a toda tu base de usuarios.
   Trátalo como una contraseña: **nunca** lo subas al repositorio.
3. Conviértelo a base64. En PowerShell:

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\al\service-account.json")) | Set-Clipboard
   ```

   Queda copiado al portapapeles. (En Linux/macOS: `base64 -w0 fichero.json`)
4. En **Render** → tu servicio → **Environment** → *Add Environment Variable*:

   ```
   FIREBASE_SERVICE_ACCOUNT_BASE64 = <pega el base64>
   ```
5. Guardar. Render redespliega solo.

**Verificación:** en los logs de Render debe aparecer

```
✅ Firebase Admin initialised (push notifications enabled)
```

Si ves `⚠️ Push notifications disabled: set FIREBASE_SERVICE_ACCOUNT_BASE64`,
la variable no llegó o el base64 está mal copiado (revisa que no tenga saltos de
línea).

---

## Paso 5 — Recompilar la app

El bundle que se generó **antes** de tener `google-services.json` no sirve para
notificaciones: la configuración se incrusta en tiempo de compilación.

```powershell
cd C:\Projects\VBStats\VBStats\android
.\gradlew.bat clean
.\gradlew.bat bundleRelease
```

El resultado queda en `app/build/outputs/bundle/release/app-release.aab`.

Para probar en un móvil antes de subirlo a Play:

```powershell
.\gradlew.bat assembleRelease
```

y instala `app/build/outputs/apk/release/app-release.apk`.

> Comprueba que el plugin se aplicó: durante la compilación **no** debe aparecer
> `WARNING: android/app/google-services.json not found`.

---

## Paso 6 — Probar de punta a punta

1. Instala el APK nuevo y entra con tu cuenta.
2. Debe salir el diálogo *"Activar notificaciones"* → **Activar** → después el
   diálogo del sistema Android → **Permitir**.
3. En los logs de la app (`npx react-native log-android`) busca
   `✅ Push token registered`.
4. Entra con una cuenta de administrador → menú lateral → **Enviar notificación**.
5. Arriba debe indicar cuántos dispositivos hay registrados. Si pone 0, el token
   no llegó al servidor.
6. Escribe título y mensaje, elige audiencia *Todos*, envía.
7. La notificación debe llegar al móvil. Con la app abierta se ve como aviso
   dentro de la app; cerrada, en la bandeja del sistema.

**Si el envío responde 503:** falta `FIREBASE_SERVICE_ACCOUNT_BASE64` en Render.

**Si dice "enviado" pero no llega nada:** el token está registrado pero FCM no
entrega. Casi siempre es que se compiló sin `google-services.json`, o en iOS que
falta la clave de APNs.

---

## Lista de verificación

- [ ] Proyecto creado en Firebase
- [ ] App Android registrada con el paquete `com.vbstats`
- [ ] `google-services.json` en `VBStats/android/app/`
- [ ] (iOS) App registrada con `com.adrianestrada2025.VBStats`
- [ ] (iOS) `GoogleService-Info.plist` añadido **desde Xcode** + `pod install`
- [ ] (iOS) Clave `.p8` de APNs subida a Firebase con Key ID y Team ID
- [ ] `FIREBASE_SERVICE_ACCOUNT_BASE64` en Render
- [ ] Logs de Render: `Firebase Admin initialised`
- [ ] AAB **recompilado** después de añadir `google-services.json`
- [ ] Probado el envío de una notificación real

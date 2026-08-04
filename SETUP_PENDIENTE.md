# Qué queda por hacer (acciones manuales)

Todo lo de este documento requiere credenciales o consolas a las que el código no
tiene acceso. Sin estos pasos, las funciones indicadas quedan inactivas — la app
sigue funcionando, simplemente no las ofrece.

---

## 1. URGENTE — rotar credenciales

Ficheros de configuración y material de firma se han retirado del control de
versiones y añadido a `.gitignore`. Retirarlos del índice **no basta**: cualquier
valor que haya estado versionado debe considerarse comprometido y rotarse.

1. **MySQL** — cambiar la contraseña del usuario de base de datos. Actualizar
   `MYSQL_PUBLIC_URL` en Render.
2. **Stripe** — Dashboard → Developers → API keys → *Roll* la clave secreta.
   Revisar el log de eventos por si hubo actividad no reconocida.
3. **Gmail** — https://myaccount.google.com/apppasswords → revocar la contraseña
   de aplicación y crear otra.
4. **Apple** — App Store Connect → App Information → regenerar el
   *App-Specific Shared Secret*.
5. **Keystore Android** — si usas Play App Signing, solicita una clave de subida
   nueva en Play Console → Configuración → Integridad de la app. Si no la usas,
   tendrás que generar un keystore nuevo (y eso implica publicar la app como una
   entrada nueva, así que revísalo bien antes).

Considera pasar el repositorio a privado.

---

## 2. Autenticación — activar el modo estricto

El backend admite dos modos:

- `STRICT_AUTH=false` (por defecto): las rutas de datos toleran clientes antiguos
  que aún no envían el token de sesión. Las rutas sensibles (sesión, perfil,
  administración, suscripciones) exigen token siempre.
- `STRICT_AUTH=true`: se rechaza cualquier petición sin token válido.

**Secuencia recomendada:**

1. Desplegar el backend con `STRICT_AUTH` sin definir.
2. Publicar la nueva versión de la app.
3. Subir `MIN_APP_VERSION` a la nueva versión para forzar la actualización.
4. Cuando los logs dejen de mostrar tráfico sin token, poner `STRICT_AUTH=true`.

### Variables nuevas del backend

```
STRICT_AUTH=false
SUPERADMIN_EMAILS=tu-correo@ejemplo.com
SUBSCRIPTION_INTERNAL_KEY=<cadena larga aleatoria>
STRIPE_WEBHOOK_SECRET=<Stripe Dashboard → Webhooks → Signing secret>
CORS_ORIGINS=
ALLOW_LEGACY_REGISTER=false
```

`SUPERADMIN_EMAILS` sustituye a la lista que estaba escrita en `db.js`. Si no la
defines, **nadie será superadmin** y el panel de administración quedará vacío.

`STRIPE_WEBHOOK_SECRET` **no estaba configurado**: sin él, `constructEvent` falla
y todos los webhooks de Stripe se descartaban en silencio. De ahí venían las
desincronizaciones de suscripción que el código intentaba parchear con lógica de
"sync" en cada lectura.

---

## 3. Notificaciones push (Firebase)

La implementación anterior llamaba a `require('expo-notifications')`, un paquete
que nunca estuvo instalado en esta app (React Native puro, sin Expo). El require
fallaba siempre, así que no se registraba ningún token y no se podía entregar
ninguna notificación. Ahora usa Firebase Cloud Messaging.

**Guía paso a paso completa: [FIREBASE_SETUP.md](FIREBASE_SETUP.md)** — incluye el
alta del proyecto, el registro de las apps Android e iOS, la clave de APNs, las
credenciales del servidor y cómo probarlo de punta a punta.

Resumen: registrar la app en Firebase, colocar `google-services.json` en
`VBStats/android/app/`, y poner la cuenta de servicio en base64 en Render como
`FIREBASE_SERVICE_ACCOUNT_BASE64`.

> Sin `google-services.json` el build de Android **sigue compilando** (el plugin de
> Google Services se aplica de forma condicional), pero las notificaciones no
> funcionarán: la configuración se incrusta en tiempo de compilación, así que hay
> que **recompilar** después de añadir el fichero. La pantalla de administración
> avisa cuando el servidor no tiene credenciales.

Los usuarios ven una explicación propia antes del diálogo del sistema, y la
respuesta se recuerda para no volver a preguntar en cada inicio de sesión.

---

## 4. Inicio de sesión con Google

Actualmente **no aparece en la app**. Faltan tres cosas:

1. El paquete nativo:
   ```bash
   npm install @react-native-google-signin/google-signin
   ```
   (y `pod install` en iOS)
2. `GOOGLE_WEB_CLIENT_ID` en `VBStats/services/config.ts` — está vacío, y con el
   valor vacío el botón se oculta deliberadamente.
3. `GOOGLE_WEB_CLIENT_ID` en el entorno del backend.

Los tres valores deben ser el **Web client ID** de Google Cloud Console, no el de
Android ni el de iOS. Guía completa en `VBStats/GOOGLE_SIGNIN_SETUP.md`.

`google-auth-library` faltaba en las dependencias del backend, así que el endpoint
`/api/users/google` habría devuelto 500 aunque el resto estuviera configurado. Ya
está instalada.

---

## 5. Pagos en Android — riesgo de política de Google Play

Android cobra a través de **Stripe Checkout abriendo el navegador**. La política
de Google Play exige Google Play Billing para bienes digitales consumidos dentro
de la app, y el incumplimiento puede acabar en retirada de la app.

Se ha añadido el `intent-filter` de `vbstats://` que faltaba, así que el retorno
del pago ya vuelve a la app (antes el usuario pagaba y la app no se enteraba
nunca). Pero eso no resuelve el problema de política.

Migrar a Play Billing implica:
- Crear los productos de suscripción en Play Console.
- Usar `react-native-iap` en Android (ya es dependencia, se usa para Apple).
- Validar las compras en servidor con la Google Play Developer API.
- No se puede probar sin publicar en un canal de test cerrado.

Queda fuera de esta pasada; decide tú cuándo abordarlo.

---

## 6. Firma del APK

`android/gradle.properties` ya no contiene contraseñas. Crea
`VBStats/android/keystore.properties` (ignorado por git) a partir de
`keystore.properties.example`:

```
MYAPP_UPLOAD_STORE_FILE=my-release-key.jks
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=...
MYAPP_UPLOAD_KEY_PASSWORD=...
```

Si el fichero no existe, el build de release firma con la clave de debug para que
el APK siga siendo instalable en pruebas. **Un APK así no vale para Play Store.**

---

## 7. Verificar en Stripe tras el despliegue

`current_period_end` se lee del objeto `Subscription`. En versiones de la API de
Stripe a partir de 2025-03-31 ese campo se movió a
`subscription.items.data[0].current_period_end`. Con `stripe-node` 17 y la versión
de API fijada actualmente sigue funcionando, pero **si actualizas la versión de la
API en el Dashboard, las fechas de expiración pasarán a `undefined`** y las
suscripciones se marcarán como caducadas. Revisa esto antes de tocar la versión de
API.

# Generar APK para VBStats

## Pasos para generar el APK de release

### 1. Limpiar el proyecto
```bash
cd android
.\gradlew.bat clean
```

### 2. Generar APK de release
```bash
.\gradlew.bat assembleRelease
```

### 3. Ubicación del APK generado
El APK se generará en:
```
android/app/build/outputs/apk/release/app-release.apk
```

## Configuración del icono de la app

El icono de la app está configurado usando `assets/logo_sinfondo.png` y se ha copiado a todas las carpetas de recursos de Android:

- `android/app/src/main/res/mipmap-mdpi/ic_launcher.png` (48x48dp)
- `android/app/src/main/res/mipmap-hdpi/ic_launcher.png` (72x72dp)
- `android/app/src/main/res/mipmap-xhdpi/ic_launcher.png` (96x96dp)
- `android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png` (144x144dp)
- `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png` (192x192dp)

También se han configurado los iconos round para cada densidad.

## Notas importantes

- El APK generado es para **release** y está listo para ser instalado en dispositivos Android.
- Para generar un APK firmado para publicar en Google Play Store, necesitas configurar el keystore en `android/app/build.gradle`.
- El icono se verá en el launcher de Android una vez instalado el APK.

## Instalación del APK en un dispositivo

```bash
# Conecta tu dispositivo Android por USB y ejecuta:
adb install android/app/build/outputs/apk/release/app-release.apk
```

O simplemente copia el APK a tu dispositivo y ábrelo para instalarlo manualmente.

# VBStats

Aplicación de Estadísticas de Voleibol desarrollada con React Native.

## Descripción

VBStats es una aplicación móvil para gestionar y visualizar estadísticas de voleibol.

## Estructura del Proyecto

```
VBStats/
├── android/           # Proyecto nativo de Android
├── ios/              # Proyecto nativo de iOS
├── App.tsx           # Componente principal de la aplicación
├── index.js          # Punto de entrada de la aplicación
├── package.json      # Dependencias y scripts del proyecto
└── README.md         # Este archivo
```

## Requisitos Previos

- Node.js >= 20
- React Native CLI
- Para Android: Android Studio y Android SDK
- Para iOS: Xcode (solo en macOS)

## Instalación

```bash
# Instalar dependencias
npm install

# Para iOS (solo en macOS)
cd ios && pod install && cd ..
```

## Ejecución

```bash
# Iniciar el servidor de desarrollo
npm start

# Ejecutar en Android
npm run android

# Ejecutar en iOS
npm run ios
```

## Scripts Disponibles

- `npm start` - Inicia el servidor de desarrollo de React Native
- `npm run android` - Ejecuta la aplicación en Android
- `npm run ios` - Ejecuta la aplicación en iOS
- `npm run lint` - Ejecuta el linter
- `npm test` - Ejecuta las pruebas

## Tecnologías

- React Native 0.81.4
- React 19.1.0
- TypeScript 5.8.3

## Licencia

© Copyright 2025 - BlueDeBug

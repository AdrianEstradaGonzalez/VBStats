# VBStats Services

Servicios centralizados para comunicación con el backend de VBStats.

## Estructura

```
services/
├── config.ts          # Configuración de URL base (detecta Android/iOS/localhost)
├── types.ts           # Tipos TypeScript compartidos (Team, Player, Match, Stat)
├── teamsService.ts    # CRUD de equipos
├── playersService.ts  # CRUD de jugadores
├── matchesService.ts  # CRUD de partidos
├── statsService.ts    # CRUD de estadísticas
└── api.ts             # Export centralizado de todos los servicios
```

## Uso

```typescript
import { teamsService, playersService, Team, Player } from './services/api';

// Crear equipo
const team = await teamsService.create('Mi Equipo');

// Listar jugadores
const players = await playersService.getAll();

// Obtener jugadores de un equipo
const teamPlayers = await playersService.getByTeam(teamId);
```

## Configuración de URL

La URL del backend se configura automáticamente según la plataforma:

- **Android Emulator**: `http://10.0.2.2:4000/api` (mapea al localhost del host)
- **iOS Simulator**: `http://localhost:4000/api`
- **Dispositivo físico**: Necesitas cambiar manualmente en `config.ts` a tu IP local (ej: `http://192.168.1.X:4000/api`)

## Backend

Asegúrate de que el backend esté corriendo en `http://localhost:4000`:

```bash
cd backend
npm run dev
```

## Endpoints disponibles

- `/api/teams` - Equipos
- `/api/players` - Jugadores
- `/api/matches` - Partidos
- `/api/stats` - Estadísticas
- `/api/health` - Health check

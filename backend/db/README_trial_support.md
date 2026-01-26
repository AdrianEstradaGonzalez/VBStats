# Migración: Soporte para Pruebas Gratuitas (Free Trial)

## Descripción

Esta migración añade soporte para pruebas gratuitas de 7 días para los planes Básico y Pro.

## Características

1. **Prueba gratuita de 7 días** - Los usuarios nuevos pueden probar los planes Básico o Pro durante 7 días sin cargo.

2. **Una prueba por dispositivo** - Cada dispositivo solo puede usar una prueba gratuita para evitar abusos.

3. **Una prueba por cuenta** - Cada cuenta de usuario solo puede usar una prueba gratuita.

4. **Cobro automático al finalizar** - Al terminar los 7 días, se cobra automáticamente la suscripción del plan elegido.

5. **Posibilidad de cancelar** - El usuario puede cancelar en cualquier momento desde su perfil antes de que termine la prueba para evitar cargos.

## Pasos para aplicar la migración

### 1. Ejecutar el script SQL

Conecta a tu base de datos MySQL y ejecuta:

```bash
mysql -u tu_usuario -p tu_base_de_datos < backend/db/add_trial_support.sql
```

O ejecuta el contenido del archivo directamente:

```sql
-- Add trial tracking fields to users table
ALTER TABLE users 
ADD COLUMN trial_used BOOLEAN DEFAULT FALSE AFTER stripe_subscription_id,
ADD COLUMN trial_started_at DATETIME NULL AFTER trial_used,
ADD COLUMN trial_ends_at DATETIME NULL AFTER trial_started_at,
ADD COLUMN trial_plan_type ENUM('basic', 'pro') NULL AFTER trial_ends_at;

-- Create table to track device IDs that have used trials
CREATE TABLE IF NOT EXISTS device_trials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  plan_type ENUM('basic', 'pro') NOT NULL,
  trial_started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  trial_ended_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_device_id (device_id)
);
```

### 2. Reiniciar el backend

Después de aplicar la migración, reinicia el servidor backend para que los cambios surtan efecto.

## Nuevos endpoints de API

### POST /subscriptions/check-trial-eligibility

Verifica si un usuario/dispositivo puede usar la prueba gratuita.

**Body:**
```json
{
  "userId": 123,
  "deviceId": "device_xxx"
}
```

**Response:**
```json
{
  "eligible": true,
  "deviceUsedTrial": false,
  "userUsedTrial": false,
  "currentTrial": null,
  "trialDays": 7
}
```

### POST /subscriptions/start-trial

Inicia una prueba gratuita sin requerir pago inicial.

**Body:**
```json
{
  "userId": 123,
  "planType": "pro",
  "deviceId": "device_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "planType": "pro",
  "trialEndsAt": "2026-02-03T00:00:00.000Z",
  "trialDays": 7,
  "message": "Prueba gratuita de 7 días activada. Después se cobrará automáticamente."
}
```

### GET /subscriptions/:userId (actualizado)

Ahora incluye información del trial activo:

```json
{
  "type": "pro",
  "expiresAt": "2026-02-03T00:00:00.000Z",
  "trialUsed": true,
  "activeTrial": {
    "planType": "pro",
    "endsAt": "2026-02-03T00:00:00.000Z",
    "daysRemaining": 5
  }
}
```

## Flujo de usuario

1. Usuario crea cuenta o selecciona un plan
2. Si es elegible, ve la opción "Probar 7 días gratis" marcada
3. Al confirmar, se le muestra un mensaje claro indicando que se cobrará automáticamente al finalizar
4. Durante la prueba, puede ver los días restantes en su perfil
5. Puede cancelar en cualquier momento desde su perfil
6. Al finalizar la prueba:
   - Si no canceló: se cobra automáticamente
   - Si canceló: vuelve al plan gratuito

## Notas importantes

- La restricción por dispositivo usa un ID único generado y almacenado en AsyncStorage
- Si el usuario reinstala la app, se genera un nuevo ID de dispositivo, pero la restricción por cuenta sigue activa
- Los usuarios existentes que nunca usaron trial son elegibles

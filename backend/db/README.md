# Limpieza de Configuraciones de Estadísticas

Este script limpia y reconfigura la tabla `stat_settings` para eliminar duplicados y establecer constraints.

## Pasos para ejecutar

### Opción 1: MySQL Workbench
1. Abre MySQL Workbench
2. Conecta a tu base de datos VBStats
3. Abre el archivo `clean_stat_settings.sql`
4. Ejecuta el script completo

### Opción 2: Línea de comandos
```bash
mysql -u root -p vbstats < clean_stat_settings.sql
```

### Opción 3: phpMyAdmin
1. Abre phpMyAdmin
2. Selecciona la base de datos VBStats
3. Ve a la pestaña "SQL"
4. Copia y pega el contenido de `clean_stat_settings.sql`
5. Ejecuta

## Qué hace el script

1. **TRUNCATE**: Borra todos los datos de la tabla `stat_settings`
2. **ALTER TABLE**: Agrega una constraint UNIQUE para evitar duplicados
   - Combinación única: `(position, stat_category, stat_type, user_id)`
3. **INSERT**: Inserta configuraciones por defecto para todas las posiciones
   - Solo configuraciones globales (user_id = NULL)
   - Todas habilitadas por defecto (enabled = 1)

## Estructura resultante

Después de ejecutar el script:
- **90 filas** de configuraciones globales (user_id = NULL)
  - Receptor: 18 estadísticas
  - Opuesto: 18 estadísticas
  - Colocador: 18 estadísticas
  - Central: 18 estadísticas
  - Líbero: 8 estadísticas (no tiene Ataque, Bloqueo, ni Saque)

## Funcionamiento del sistema

### Configuraciones Globales (user_id = NULL)
- Son las configuraciones por defecto
- Se usan cuando un usuario NO tiene configuraciones personalizadas

### Configuraciones Personalizadas (user_id = X)
- Cuando un usuario guarda configuraciones, se crea una copia para él
- La constraint UNIQUE previene duplicados
- Cada usuario puede tener su propia configuración independiente

### Ejemplo
```sql
-- Global (todos los usuarios sin config personalizada)
position='Opuesto', stat_category='Saque', stat_type='Positivo', enabled=1, user_id=NULL

-- Usuario 1 desactiva "Positivo" en Saque
position='Opuesto', stat_category='Saque', stat_type='Positivo', enabled=0, user_id=1

-- Usuario 2 mantiene configuración global (no tiene fila propia)
-- El backend devolverá la configuración global con enabled=1
```

## Verificación

Ejecuta estas queries para verificar:

```sql
-- Total de configuraciones
SELECT COUNT(*) FROM stat_settings;

-- Por posición
SELECT position, COUNT(*) as total 
FROM stat_settings 
GROUP BY position;

-- Configuraciones globales vs personalizadas
SELECT 
  CASE WHEN user_id IS NULL THEN 'Global' ELSE 'Personal' END as tipo,
  COUNT(*) as total
FROM stat_settings
GROUP BY CASE WHEN user_id IS NULL THEN 'Global' ELSE 'Personal' END;

-- Verificar que no hay duplicados
SELECT position, stat_category, stat_type, user_id, COUNT(*) as count
FROM stat_settings
GROUP BY position, stat_category, stat_type, user_id
HAVING count > 1;
```

## Importante

⚠️ **Este script borra TODAS las configuraciones personalizadas de usuarios**

Si hay configuraciones importantes que quieres preservar, haz un backup antes:

```sql
-- Backup
CREATE TABLE stat_settings_backup AS SELECT * FROM stat_settings;

-- Restaurar si es necesario
-- INSERT INTO stat_settings SELECT * FROM stat_settings_backup;
```

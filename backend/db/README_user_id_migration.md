# Actualización de la Base de Datos - Agregar user_id a teams

## Problema
Los equipos no estaban asociados a usuarios específicos, por lo que todos los usuarios veían todos los equipos.

## Solución
Se agregó el campo `user_id` a la tabla `teams` para establecer una relación entre equipos y usuarios.

## Pasos para aplicar la actualización

### Opción 1: Render.com Dashboard (Recomendado para producción)
1. Ve a tu dashboard de Render: https://dashboard.render.com
2. Selecciona tu base de datos MySQL
3. Ve a la pestaña "Shell" o "Query"
4. Ejecuta el contenido del archivo `add_user_id_to_teams.sql`

### Opción 2: MySQL Workbench (Local)
1. Abre MySQL Workbench
2. Conecta a tu base de datos VBStats
3. Abre el archivo `add_user_id_to_teams.sql`
4. Ejecuta el script completo

### Opción 3: Línea de comandos
```bash
mysql -u root -p vbstats < add_user_id_to_teams.sql
```

### Opción 4: phpMyAdmin
1. Abre phpMyAdmin
2. Selecciona la base de datos VBStats
3. Ve a la pestaña "SQL"
4. Copia y pega el contenido de `add_user_id_to_teams.sql`
5. Ejecuta

## Qué hace el script

1. **ALTER TABLE ADD COLUMN**: Agrega la columna `user_id` a la tabla `teams`
   - Tipo: INT NOT NULL
   - Valor por defecto: 1 (se asignan equipos existentes al usuario con id=1)

2. **CREATE INDEX**: Crea un índice para mejorar el rendimiento de las consultas filtradas por usuario

3. **ADD FOREIGN KEY**: Establece la relación con la tabla `users`
   - ON DELETE CASCADE: Si se elimina un usuario, se eliminan sus equipos

## Nota importante sobre equipos existentes

Los equipos que ya existen en la base de datos quedarán asignados al usuario con `id = 1` por defecto. Si necesitas reasignarlos a otros usuarios, ejecuta:

```sql
-- Asignar equipo específico a un usuario
UPDATE teams SET user_id = 2 WHERE id = 1;

-- Asignar todos los equipos a un usuario específico
UPDATE teams SET user_id = 2;

-- Ver qué equipos pertenecen a cada usuario
SELECT t.id, t.name, t.user_id, u.email 
FROM teams t 
LEFT JOIN users u ON t.user_id = u.id;
```

## Cambios en la API

Después de aplicar el script SQL, también se actualizaron los siguientes endpoints:

### GET /teams
- **Antes**: Devolvía todos los equipos
- **Ahora**: Requiere `?user_id=X` y devuelve solo los equipos del usuario

### POST /teams
- **Antes**: Solo requería `{ name }`
- **Ahora**: Requiere `{ name, user_id }`

### PUT /teams/:id
- **Antes**: Solo verificaba que el equipo existiera
- **Ahora**: Verifica que el equipo pertenezca al usuario

### DELETE /teams/:id
- **Antes**: Eliminaba cualquier equipo
- **Ahora**: Solo elimina si el equipo pertenece al usuario

## Verificación

Para verificar que la actualización funcionó correctamente:

```sql
-- Ver la estructura de la tabla teams
DESCRIBE teams;

-- Debería mostrar:
-- | Field   | Type         | Null | Key | Default | Extra          |
-- |---------|--------------|------|-----|---------|----------------|
-- | id      | int          | NO   | PRI | NULL    | auto_increment |
-- | name    | varchar(255) | NO   |     | NULL    |                |
-- | user_id | int          | NO   | MUL | 1       |                |

-- Ver los equipos con sus usuarios
SELECT t.*, u.email as user_email 
FROM teams t 
LEFT JOIN users u ON t.user_id = u.id;
```

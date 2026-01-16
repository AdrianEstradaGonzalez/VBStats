-- Agregar campo user_id a la tabla teams
-- Este campo relaciona cada equipo con un usuario específico

-- Paso 1: Asegurar que existe un usuario con id=1 (usuario por defecto)
-- Si no existe, lo creamos
INSERT INTO users (id, email, password, name, created_at, updated_at)
SELECT 1, 'default@vbstats.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Usuario Por Defecto', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 1);

-- Paso 2: Agregar la columna user_id a la tabla teams
ALTER TABLE teams 
ADD COLUMN user_id INT NOT NULL DEFAULT 1;

-- Paso 3: Agregar índice para mejorar consultas por usuario
CREATE INDEX idx_teams_user_id ON teams(user_id);

-- Paso 4: Agregar foreign key constraint hacia la tabla users
ALTER TABLE teams
ADD CONSTRAINT fk_teams_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE;

-- Resultado: 
-- - Usuario con id=1 garantizado en la base de datos
-- - Todos los equipos existentes asignados al usuario id=1
-- - Nueva estructura permite que cada usuario tenga sus propios equipos

-- Si necesitas reasignar equipos existentes a otro usuario, ejecuta:
-- UPDATE teams SET user_id = X WHERE id = Y;

-- Para ver qué equipos pertenecen a cada usuario:
-- SELECT t.id, t.name, t.user_id, u.email FROM teams t LEFT JOIN users u ON t.user_id = u.id;

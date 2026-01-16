-- Agregar campo user_id a la tabla teams
-- Este campo relaciona cada equipo con un usuario específico

-- Agregar la columna user_id
ALTER TABLE teams 
ADD COLUMN user_id INT NOT NULL DEFAULT 1;

-- Agregar índice para mejorar consultas por usuario
CREATE INDEX idx_teams_user_id ON teams(user_id);

-- Agregar foreign key constraint hacia la tabla users
ALTER TABLE teams
ADD CONSTRAINT fk_teams_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) 
ON DELETE CASCADE;

-- Nota: Los equipos existentes quedarán asignados al usuario con id=1
-- Si necesitas reasignarlos manualmente, ejecuta:
-- UPDATE teams SET user_id = X WHERE id = Y;

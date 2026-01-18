-- Limpiar tabla stat_settings y prevenir duplicados
-- Ejecutar este script en MySQL

-- 1. Eliminar todos los datos
TRUNCATE TABLE stat_settings;

-- 2. Agregar constraint UNIQUE para prevenir duplicados
-- Una combinación de (position, stat_category, stat_type, user_id) debe ser única
ALTER TABLE stat_settings 
ADD UNIQUE KEY unique_stat_config (position, stat_category, stat_type, user_id);

-- 3. Insertar configuraciones por defecto (solo globales con user_id NULL)

-- Receptor
INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id) VALUES
('Receptor', 'Recepción', 'Doble positiva', 1, NULL),
('Receptor', 'Recepción', 'Positiva', 1, NULL),
('Receptor', 'Recepción', 'Neutra', 1, NULL),
('Receptor', 'Recepción', 'Error', 1, NULL),
('Receptor', 'Ataque', 'Positivo', 1, NULL),
('Receptor', 'Ataque', 'Neutro', 1, NULL),
('Receptor', 'Ataque', 'Error', 1, NULL),
('Receptor', 'Bloqueo', 'Positivo', 1, NULL),
('Receptor', 'Bloqueo', 'Neutro', 1, NULL),
('Receptor', 'Bloqueo', 'Error', 1, NULL),
('Receptor', 'Saque', 'Punto directo', 1, NULL),
('Receptor', 'Saque', 'Positivo', 1, NULL),
('Receptor', 'Saque', 'Neutro', 1, NULL),
('Receptor', 'Saque', 'Error', 1, NULL),
('Receptor', 'Defensa', 'Positiva', 1, NULL),
('Receptor', 'Defensa', 'Error', 1, NULL),
('Receptor', 'Colocación', 'Positiva', 1, NULL),
('Receptor', 'Colocación', 'Error', 1, NULL);

-- Opuesto
INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id) VALUES
('Opuesto', 'Recepción', 'Doble positiva', 1, NULL),
('Opuesto', 'Recepción', 'Positiva', 1, NULL),
('Opuesto', 'Recepción', 'Neutra', 1, NULL),
('Opuesto', 'Recepción', 'Error', 1, NULL),
('Opuesto', 'Ataque', 'Positivo', 1, NULL),
('Opuesto', 'Ataque', 'Neutro', 1, NULL),
('Opuesto', 'Ataque', 'Error', 1, NULL),
('Opuesto', 'Bloqueo', 'Positivo', 1, NULL),
('Opuesto', 'Bloqueo', 'Neutro', 1, NULL),
('Opuesto', 'Bloqueo', 'Error', 1, NULL),
('Opuesto', 'Saque', 'Punto directo', 1, NULL),
('Opuesto', 'Saque', 'Positivo', 1, NULL),
('Opuesto', 'Saque', 'Neutro', 1, NULL),
('Opuesto', 'Saque', 'Error', 1, NULL),
('Opuesto', 'Defensa', 'Positiva', 1, NULL),
('Opuesto', 'Defensa', 'Error', 1, NULL),
('Opuesto', 'Colocación', 'Positiva', 1, NULL),
('Opuesto', 'Colocación', 'Error', 1, NULL);

-- Colocador
INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id) VALUES
('Colocador', 'Recepción', 'Doble positiva', 1, NULL),
('Colocador', 'Recepción', 'Positiva', 1, NULL),
('Colocador', 'Recepción', 'Neutra', 1, NULL),
('Colocador', 'Recepción', 'Error', 1, NULL),
('Colocador', 'Ataque', 'Positivo', 1, NULL),
('Colocador', 'Ataque', 'Neutro', 1, NULL),
('Colocador', 'Ataque', 'Error', 1, NULL),
('Colocador', 'Bloqueo', 'Positivo', 1, NULL),
('Colocador', 'Bloqueo', 'Neutro', 1, NULL),
('Colocador', 'Bloqueo', 'Error', 1, NULL),
('Colocador', 'Saque', 'Punto directo', 1, NULL),
('Colocador', 'Saque', 'Positivo', 1, NULL),
('Colocador', 'Saque', 'Neutro', 1, NULL),
('Colocador', 'Saque', 'Error', 1, NULL),
('Colocador', 'Defensa', 'Positiva', 1, NULL),
('Colocador', 'Defensa', 'Error', 1, NULL),
('Colocador', 'Colocación', 'Positiva', 1, NULL),
('Colocador', 'Colocación', 'Error', 1, NULL);

-- Central
INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id) VALUES
('Central', 'Recepción', 'Doble positiva', 1, NULL),
('Central', 'Recepción', 'Positiva', 1, NULL),
('Central', 'Recepción', 'Neutra', 1, NULL),
('Central', 'Recepción', 'Error', 1, NULL),
('Central', 'Ataque', 'Positivo', 1, NULL),
('Central', 'Ataque', 'Neutro', 1, NULL),
('Central', 'Ataque', 'Error', 1, NULL),
('Central', 'Bloqueo', 'Positivo', 1, NULL),
('Central', 'Bloqueo', 'Neutro', 1, NULL),
('Central', 'Bloqueo', 'Error', 1, NULL),
('Central', 'Saque', 'Punto directo', 1, NULL),
('Central', 'Saque', 'Positivo', 1, NULL),
('Central', 'Saque', 'Neutro', 1, NULL),
('Central', 'Saque', 'Error', 1, NULL),
('Central', 'Defensa', 'Positiva', 1, NULL),
('Central', 'Defensa', 'Error', 1, NULL),
('Central', 'Colocación', 'Positiva', 1, NULL),
('Central', 'Colocación', 'Error', 1, NULL);

-- Líbero
INSERT INTO stat_settings (position, stat_category, stat_type, enabled, user_id) VALUES
('Líbero', 'Recepción', 'Doble positiva', 1, NULL),
('Líbero', 'Recepción', 'Positiva', 1, NULL),
('Líbero', 'Recepción', 'Neutra', 1, NULL),
('Líbero', 'Recepción', 'Error', 1, NULL),
('Líbero', 'Defensa', 'Positiva', 1, NULL),
('Líbero', 'Defensa', 'Error', 1, NULL),
('Líbero', 'Colocación', 'Positiva', 1, NULL),
('Líbero', 'Colocación', 'Error', 1, NULL);

-- Verificar
SELECT COUNT(*) as total_settings FROM stat_settings;
SELECT position, COUNT(*) as count_per_position FROM stat_settings GROUP BY position;

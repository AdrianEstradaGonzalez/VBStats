const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function giveTempPro() {
  const email = process.argv[2];
  const months = parseInt(process.argv[3] || '2', 10);

  if (!email) {
    console.error('Uso: node give_temp_pro.js <email> [meses]');
    process.exit(1);
  }

  // Configuración de la conexión
  const dbConfig = {
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
    ssl: {
      rejectUnauthorized: false
    }
  };

  // Usar URL pública si está disponible (prioridad para desarrollo local vs remoto)
  // Pero aquí usamos los campos individuales si MYSQL_PUBLIC_URL no se parsea fácil, 
  // o mejor usamos createPool con la URL si existe.
  let pool;
  if (process.env.MYSQL_PUBLIC_URL) {
    pool = mysql.createPool(process.env.MYSQL_PUBLIC_URL);
  } else {
    pool = mysql.createPool(dbConfig);
  }

  try {
    const connection = await pool.getConnection();
    console.log(`Conectado a la base de datos.`);

    // Verificar si el usuario existe
    const [rows] = await connection.execute(
      'SELECT id, email, subscription_type, subscription_expires_at FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      console.error(`Error: Usuario con email ${email} no encontrado.`);
      process.exit(1);
    }

    const user = rows[0];
    console.log(`Usuario encontrado: ${user.email} (ID: ${user.id})`);
    console.log(`Estado actual: ${user.subscription_type}, expira: ${user.subscription_expires_at}`);

    // Calcular nueva fecha de expiración
    const now = new Date();
    const newExpiration = new Date(now.setMonth(now.getMonth() + months));
    
    // Formatear para MySQL: YYYY-MM-DD HH:MM:SS
    const formattedDate = newExpiration.toISOString().slice(0, 19).replace('T', ' ');

    console.log(`Estableciendo Plan PRO por ${months} meses.`);
    console.log(`Nueva fecha de expiración: ${formattedDate}`);

    // Actualizar usuario
    // subscription_type = 'pro'
    // subscription_expires_at = nueva fecha
    // stripe_subscription_id = NULL (para simular cancelado/sin renovación automática)
    const [updateResult] = await connection.execute(
      `UPDATE users 
       SET subscription_type = 'pro', 
           subscription_expires_at = ?, 
           stripe_subscription_id = NULL
       WHERE id = ?`,
      [formattedDate, user.id]
    );

    if (updateResult.affectedRows > 0) {
      console.log('✅ Actualización exitosa.');
      console.log(`El usuario ${email} ahora tiene Plan PRO hasta ${formattedDate} sin renovación automática.`);
    } else {
      console.error('❌ No se pudo actualizar el usuario.');
    }

    connection.release();
  } catch (error) {
    console.error('Error durante la ejecución:', error);
  } finally {
    await pool.end();
  }
}

giveTempPro();

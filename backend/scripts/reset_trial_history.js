const { pool } = require('../db');

async function resetTrialHistory() {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [deviceCountRows] = await conn.query('SELECT COUNT(*) AS total FROM device_trials');
    const [userTrialCountRows] = await conn.query('SELECT COUNT(*) AS total FROM users WHERE trial_used = TRUE');

    const devicesBefore = deviceCountRows[0]?.total || 0;
    const usersBefore = userTrialCountRows[0]?.total || 0;

    const [deleteResult] = await conn.query('DELETE FROM device_trials');

    const [resetUsersResult] = await conn.query(`
      UPDATE users
      SET
        trial_used = FALSE,
        trial_started_at = NULL,
        trial_ends_at = NULL,
        trial_plan_type = NULL
      WHERE trial_used = TRUE
         OR trial_started_at IS NOT NULL
         OR trial_ends_at IS NOT NULL
         OR trial_plan_type IS NOT NULL
    `);

    await conn.commit();

    const [deviceCountAfterRows] = await conn.query('SELECT COUNT(*) AS total FROM device_trials');
    const [userTrialCountAfterRows] = await conn.query('SELECT COUNT(*) AS total FROM users WHERE trial_used = TRUE');

    console.log('✅ Reset de historial de trials completado');
    console.log(`- Dispositivos olvidados: ${deleteResult.affectedRows} (antes: ${devicesBefore})`);
    console.log(`- Usuarios con flags de trial reseteados: ${resetUsersResult.affectedRows} (antes trial_used=TRUE: ${usersBefore})`);
    console.log(`- device_trials después: ${deviceCountAfterRows[0]?.total || 0}`);
    console.log(`- users con trial_used=TRUE después: ${userTrialCountAfterRows[0]?.total || 0}`);
  } catch (error) {
    await conn.rollback();
    console.error('❌ Error reseteando historial de trials:', error.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

resetTrialHistory();

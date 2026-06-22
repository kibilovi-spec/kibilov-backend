const sql = require('mssql');
const config = {
  server: process.env.FINA_SQL_HOST,
  port: 443,
  database: process.env.FINA_SQL_DB || 'ipm02_5202_67',
  user: process.env.FINA_SQL_USER || 'sa',
  password: process.env.FINA_SQL_PASS || '',
  options: { encrypt: true, trustServerCertificate: true }
};
async function syncFromFinaSQL() {
  let pool;
  try {
    pool = await sql.connect(config);
    const r = await pool.request().query('SELECT TOP 100 product_id as sku, product_name as nameKa, price, is_active as isActive FROM book.DTItems WHERE is_active=1');
    return r.recordset;
  } finally { if(pool) await pool.close(); }
}
module.exports = { syncFromFinaSQL };

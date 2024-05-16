const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: '192.168.81.207',
  database: 'postgres',
  password: 'Seta2022()',
});

module.exports = pool;

const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: '192.168.80.20',
  database: 'postgres',
  password: 'postgres',
});

module.exports = pool;

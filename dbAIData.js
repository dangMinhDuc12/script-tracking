const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: '192.168.80.26',
  database: 'postgres',
  password: 'seta2020',
});

module.exports = pool;

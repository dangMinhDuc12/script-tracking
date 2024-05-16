const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'db-stage-insurance.cjhwxwedud1f.ap-southeast-1.rds.amazonaws.com',
  database: 'postgres',
  password: 'seta2024))',
});

module.exports = pool;

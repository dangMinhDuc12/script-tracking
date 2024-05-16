const { Pool } = require('pg')
const pool = new Pool({
  user: 'postgres',
  host: 'db-insurance.cjhwxwedud1f.ap-southeast-1.rds.amazonaws.com',
  database: 'postgres',
  password: 'Seta2022()'
})

module.exports = pool;
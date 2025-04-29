const { Pool } = require('pg');
const logger = require('../utils/logger');

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection
});

// Test the connection
const connect = async () => {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    logger.error('Database connection error', { error: error.message });
    throw error;
  }
};

// Custom query method with logging
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // Log slow queries (taking more than 100ms)
    if (duration > 100) {
      logger.warn('Slow query', { 
        query: text, 
        duration, 
        rows: res.rowCount 
      });
    }
    
    return res;
  } catch (error) {
    logger.error('Query error', { 
      query: text, 
      params, 
      error: error.message 
    });
    throw error;
  }
};

module.exports = {
  query,
  connect,
  pool
};
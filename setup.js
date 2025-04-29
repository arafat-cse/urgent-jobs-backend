/**
 * Database and application setup script
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const logger = require('./src/utils/logger');

// Create necessary directories
const createDirectories = () => {
  const dirs = [
    './uploads',
    './uploads/profiles',
    './uploads/jobs',
    './logs'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created directory: ${dir}`);
    }
  });
};

// Create PostgreSQL database
const setupDatabase = async () => {
  // First connect to postgres database to create our app database if needed
  const pgPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
  });
  
  try {
    // Check if database exists
    const dbCheckResult = await pgPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME]
    );
    
    // Create database if it doesn't exist
    if (dbCheckResult.rows.length === 0) {
      logger.info(`Creating database: ${process.env.DB_NAME}`);
      await pgPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
    } else {
      logger.info(`Database ${process.env.DB_NAME} already exists`);
    }
  } catch (error) {
    logger.error('Error checking or creating database', { error });
    throw error;
  } finally {
    await pgPool.end();
  }
  
  // Now connect to our application database
  const appPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
    connectionTimeoutMillis: 2000, // How long to wait for a connection
  });
  
  try {
    // Read SQL setup file
    const sqlScript = fs.readFileSync(
      path.join(__dirname, 'src/db/setup.sql'),
      'utf8'
    );
    
    // Execute SQL script
    await appPool.query(sqlScript);
    logger.info('Database tables created successfully');
    
    // Create admin user if it doesn't exist
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    
    // Check if admin user exists
    const adminCheckResult = await appPool.query(
      "SELECT 1 FROM users WHERE email = 'admin@example.com'"
    );
    
    if (adminCheckResult.rows.length === 0) {
      await appPool.query(
        `INSERT INTO users (email, password, first_name, last_name, role)
         VALUES ($1, $2, $3, $4, $5)`,
        ['admin@example.com', hashedPassword, 'Admin', 'User', 'admin']
      );
      logger.info('Admin user created successfully');
    } else {
      logger.info('Admin user already exists');
    }
    
    return true;
  } catch (error) {
    logger.error('Error setting up database tables', { error });
    throw error;
  } finally {
    await appPool.end();
  }
};

// Run setup
const runSetup = async () => {
  try {
    // Create directories
    createDirectories();
    
    // Setup database
    await setupDatabase();
    
    logger.info('Setup completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Setup failed', { error });
    process.exit(1);
  }
};

runSetup();
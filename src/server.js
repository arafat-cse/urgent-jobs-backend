require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const db = require('./db/connection');

const PORT = process.env.PORT || 5000;

// Test database connection
db.connect()
  .then(() => {
    logger.info('Database connected successfully');
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch(err => {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection', { error: err.message });
  // Close server & exit process
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message });
  // Close server & exit process
  process.exit(1);
});
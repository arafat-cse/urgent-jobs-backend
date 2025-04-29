const { query } = require('../db/connection');
const logger = require('../utils/logger');

/**
 * Job model encapsulating database operations for jobs
 */
class Job {
  /**
   * Create a new job
   * @param {Object} jobData - Job data
   * @param {Number} employerId - Employer profile ID
   */
  static async create(jobData, employerId) {
    try {
      const {
        title,
        description,
        requirements,
        payAmount,
        payType,
        locationLatitude,
        locationLongitude,
        locationAddress,
        urgency,
        category,
        startDate,
        endDate,
        estimatedHours,
        status = 'active'
      } = jobData;

      const result = await query(
        `INSERT INTO jobs (
          employer_id, title, description, requirements, pay_amount,
          pay_type, location_latitude, location_longitude, location_address,
          urgency, category, start_date, end_date, estimated_hours, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *`,
        [
          employerId, title, description, requirements, payAmount,
          payType, locationLatitude, locationLongitude, locationAddress,
          urgency, category, startDate, endDate, estimatedHours, status
        ]
      );

      return result.rows[0];
    } catch (error) {
      logger.error('Error creating job', { error });
      throw error;
    }
  }

  /**
   * Find job by ID
   * @param {Number} id - Job ID
   * @param {Boolean} includeEmployer - Whether to include employer details
   */
  static async findById(id, includeEmployer = false) {
    try {
      let queryText;
      
      if (includeEmployer) {
        queryText = `
          SELECT j.*, 
          ep.company_name, ep.company_logo, ep.company_website,
          u.first_name, u.last_name, u.email
          FROM jobs j
          JOIN employer_profiles ep ON j.employer_id = ep.id
          JOIN users u ON ep.user_id = u.id
          WHERE j.id = $1
        `;
      } else {
        queryText = 'SELECT * FROM jobs WHERE id = $1';
      }

      const result = await query(queryText, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error finding job by ID', { error, id });
      throw error;
    }
  }

  /**
   * Update job by ID
   * @param {Number} id - Job ID
   * @param {Object} updateData - Data to update
   */
  static async update(id, updateData) {
    try {
      // Build the dynamic update query
      const updates = Object.keys(updateData).map((key, index) => {
        // Convert camelCase to snake_case for DB columns
        const column = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        return `${column} = $${index + 2}`;
      });
      
      const values = Object.values(updateData);
      
      // Add the ID as the first parameter
      const queryText = `
        UPDATE jobs
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await query(queryText, [id, ...values]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating job', { error, id });
      throw error;
    }
  }

  /**
   * Delete job by ID
   * @param {Number} id - Job ID
   */
  static async delete(id) {
    try {
      await query('DELETE FROM jobs WHERE id = $1', [id]);
      return true;
    } catch (error) {
      logger.error('Error deleting job', { error, id });
      throw error;
    }
  }

  /**
   * Find all jobs with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Number} page - Page number (default: 1)
   * @param {Number} limit - Items per page (default: 10)
   */
  static async findAll(filters = {}, page = 1, limit = 10) {
    try {
      // Calculate offset for pagination
      const offset = (page - 1) * limit;
      
      // Start building the query
      let queryText = `
        SELECT j.*, 
        ep.company_name, ep.company_logo,
        (
          SELECT COUNT(*) 
          FROM job_applications 
          WHERE job_id = j.id
        ) AS application_count
        FROM jobs j
        JOIN employer_profiles ep ON j.employer_id = ep.id
      `;
      
      // Build WHERE clauses
      const whereConditions = [];
      const queryParams = [];
      let paramCounter = 1;
      
      // Handle filters
      if (filters.status) {
        whereConditions.push(`j.status = $${paramCounter}`);
        queryParams.push(filters.status);
        paramCounter++;
      }
      
      if (filters.category) {
        whereConditions.push(`j.category = $${paramCounter}`);
        queryParams.push(filters.category);
        paramCounter++;
      }
      
      if (filters.urgency) {
        whereConditions.push(`j.urgency = $${paramCounter}`);
        queryParams.push(filters.urgency);
        paramCounter++;
      }
      
      if (filters.minPay) {
        whereConditions.push(`j.pay_amount >= $${paramCounter}`);
        queryParams.push(filters.minPay);
        paramCounter++;
      }
      
      if (filters.maxPay) {
        whereConditions.push(`j.pay_amount <= $${paramCounter}`);
        queryParams.push(filters.maxPay);
        paramCounter++;
      }
      
      if (filters.payType) {
        whereConditions.push(`j.pay_type = $${paramCounter}`);
        queryParams.push(filters.payType);
        paramCounter++;
      }
      
      // Location-based search with radius
      if (filters.latitude && filters.longitude && filters.radius) {
        // Calculate distance using the Haversine formula
        whereConditions.push(`
          (6371 * acos(
            cos(radians($${paramCounter})) * 
            cos(radians(j.location_latitude)) * 
            cos(radians(j.location_longitude) - radians($${paramCounter + 1})) + 
            sin(radians($${paramCounter})) * 
            sin(radians(j.location_latitude))
          )) <= $${paramCounter + 2}
        `);
        queryParams.push(
          filters.latitude,
          filters.longitude,
          filters.radius
        );
        paramCounter += 3;
      }
      
      // Search by keyword in title or description
      if (filters.keyword) {
        whereConditions.push(`
          (j.title ILIKE $${paramCounter} OR 
          j.description ILIKE $${paramCounter} OR
          j.requirements ILIKE $${paramCounter})
        `);
        queryParams.push(`%${filters.keyword}%`);
        paramCounter++;
      }
      
      // Add WHERE clause if conditions exist
      if (whereConditions.length > 0) {
        queryText += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      // Sorting
      const sortField = filters.sortBy || 'created_at';
      const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
      
      queryText += ` ORDER BY j.${sortField} ${sortOrder}`;
      
      // Add pagination
      queryText += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
      queryParams.push(limit, offset);
      
      // Execute the query
      const result = await query(queryText, queryParams);
      
      // Get total count for pagination
      let countQueryText = `
        SELECT COUNT(*) 
        FROM jobs j
      `;
      
      if (whereConditions.length > 0) {
        countQueryText += ` WHERE ${whereConditions.join(' AND ')}`;
      }
      
      const countResult = await query(countQueryText, queryParams.slice(0, -2));
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        jobs: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding jobs', { error });
      throw error;
    }
  }

  /**
   * Find jobs by employer ID
   * @param {Number} employerId - Employer ID
   * @param {Object} filters - Additional filters
   * @param {Number} page - Page number
   * @param {Number} limit - Items per page
   */
  static async findByEmployer(employerId, filters = {}, page = 1, limit = 10) {
    try {
      filters.employerId = employerId;
      const whereConditions = ['j.employer_id = $1'];
      const queryParams = [employerId];
      let paramCounter = 2;
      
      // Calculate offset for pagination
      const offset = (page - 1) * limit;
      
      // Start building the query
      let queryText = `
        SELECT j.*,
        (
          SELECT COUNT(*) 
          FROM job_applications 
          WHERE job_id = j.id
        ) AS application_count
        FROM jobs j
      `;
      
      // Handle additional filters
      if (filters.status) {
        whereConditions.push(`j.status = $${paramCounter}`);
        queryParams.push(filters.status);
        paramCounter++;
      }
      
      // Add WHERE clause
      queryText += ` WHERE ${whereConditions.join(' AND ')}`;
      
      // Sorting
      const sortField = filters.sortBy || 'created_at';
      const sortOrder = filters.sortOrder === 'asc' ? 'ASC' : 'DESC';
      
      queryText += ` ORDER BY j.${sortField} ${sortOrder}`;
      
      // Add pagination
      queryText += ` LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`;
      queryParams.push(limit, offset);
      
      // Execute the query
      const result = await query(queryText, queryParams);
      
      // Get total count for pagination
      let countQueryText = `
        SELECT COUNT(*) 
        FROM jobs j
        WHERE ${whereConditions.join(' AND ')}
      `;
      
      const countResult = await query(countQueryText, queryParams.slice(0, -2));
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        jobs: result.rows,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      };
    } catch (error) {
      logger.error('Error finding jobs by employer', { error, employerId });
      throw error;
    }
  }
}

module.exports = Job;
-- Create database (run manually if not exists)
-- CREATE DATABASE urgent_jobs;

-- Connect to database before running the rest
-- \c urgent_jobs

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table (for all user types)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    profile_picture VARCHAR(255),
    role VARCHAR(20) NOT NULL CHECK (role IN ('job_seeker', 'employer', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Seeker Profiles
CREATE TABLE IF NOT EXISTS job_seeker_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    bio TEXT,
    skills TEXT[],
    experience_years INTEGER,
    education TEXT,
    availability TEXT,
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    location_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employer Profiles
CREATE TABLE IF NOT EXISTS employer_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_description TEXT,
    company_website VARCHAR(255),
    company_logo VARCHAR(255),
    industry VARCHAR(100),
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    location_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    employer_id INTEGER REFERENCES employer_profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    pay_amount DECIMAL(10, 2),
    pay_type VARCHAR(20) CHECK (pay_type IN ('hourly', 'fixed', 'daily')),
    location_latitude DECIMAL(10, 8),
    location_longitude DECIMAL(11, 8),
    location_address TEXT NOT NULL,
    urgency VARCHAR(20) CHECK (urgency IN ('immediate', 'today', 'this_week', 'flexible')),
    category VARCHAR(100),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    estimated_hours INTEGER,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'filled', 'expired', 'draft')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Applications
CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
    job_seeker_id INTEGER REFERENCES job_seeker_profiles(id) ON DELETE CASCADE,
    cover_letter TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews (employers can review job seekers and vice versa)
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    reviewer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reviewee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    job_id INTEGER REFERENCES jobs(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    type VARCHAR(50),
    related_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_urgency ON jobs(urgency);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_seeker_id ON job_applications(job_seeker_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON job_applications(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Create admin user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT * FROM users WHERE email = 'admin@example.com') THEN
        INSERT INTO users (email, password, first_name, last_name, role)
        VALUES (
            'admin@example.com',
            crypt('admin123', gen_salt('bf')), -- Replace with your actual password
            'Admin',
            'User',
            'admin'
        );
    END IF;
END
$$;
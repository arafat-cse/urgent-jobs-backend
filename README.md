# Urgent Jobs Backend

A robust Node.js backend for a local, part-time, urgent job listings application. This API powers both mobile and web applications, facilitating connections between job seekers and employers for urgent, local work opportunities.

## Features

- **User Authentication**: Secure JWT-based authentication with role-based access control
- **Job Management**: Create, update, search, and apply for jobs with advanced filtering
- **Role-Based Access**: Different permissions for job seekers, employers, and admins
- **Notification System**: Updates for application status changes
- **Profile Management**: Separate profiles for job seekers and employers
- **Location-Based Search**: Find jobs within a specific radius
- **Review System**: Allow users to rate each other after job completion

## Technology Stack

- **Runtime**: Node.js
- **Web Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT, bcrypt
- **Validation**: express-validator
- **File Upload**: multer
- **Logging**: winston, morgan
- **Documentation**: API documentation with Swagger UI (optional)

## Project Structure

```
project-root/
├── src/                    # Application source code
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── db/                 # Database setup and migrations
│   ├── middlewares/        # Custom middleware
│   ├── models/             # Database models
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── utils/              # Utility functions
│   └── app.js              # Express app setup
├── tests/                  # Test files
├── uploads/                # Uploaded files (profiles, job attachments)
├── logs/                   # Application logs
├── .env.example            # Example environment variables
├── .gitignore              # Git ignore file
├── package.json            # Dependencies and scripts
└── README.md               # Project documentation
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd urgent-jobs-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Update the `.env` file with your database credentials and other environment-specific settings.

5. Create the PostgreSQL database:
   ```bash
   createdb urgent_jobs
   ```

6. Run the database setup script:
   ```bash
   psql -d urgent_jobs -f src/db/setup.sql
   ```

7. Start the development server:
   ```bash
   npm run dev
   ```

The server will be running at http://localhost:5000 (or the port you specified in the .env file).

## Database Schema

![ER Diagram](er-diagram.png)

### Main Tables

- **users**: Stores user account information for all user types
- **job_seeker_profiles**: Stores additional information for job seekers
- **employer_profiles**: Stores company information for employers
- **jobs**: Contains job listings posted by employers
- **job_applications**: Tracks job applications and their statuses
- **reviews**: Stores reviews and ratings between users
- **notifications**: Handles user notifications

## API Documentation

### Authentication

- `POST /api/auth/register` - Register a new user (job seeker or employer)
- `POST /api/auth/login` - Login and receive JWT token
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/password` - Update password

### Users

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile/basic` - Update basic user information
- `PUT /api/users/profile/job-seeker` - Update job seeker profile
- `PUT /api/users/profile/employer` - Update employer profile
- `GET /api/users/dashboard` - Get user dashboard statistics

### Jobs

- `GET /api/jobs` - Get all jobs with filtering
- `GET /api/jobs/:id` - Get job by ID
- `POST /api/jobs` - Create a new job (employers only)
- `PUT /api/jobs/:id` - Update job (owner only)
- `DELETE /api/jobs/:id` - Delete job (owner only)
- `GET /api/jobs/employer/listings` - Get employer's job listings

### Applications

- `POST /api/applications` - Apply for a job (job seekers only)
- `GET /api/applications/me` - Get job seeker's applications
- `GET /api/applications/job/:jobId` - Get applications for a job (employer only)
- `GET /api/applications/:id` - Get application by ID
- `PATCH /api/applications/:id/status` - Update application status

## Error Handling

The API uses standardized error responses:

```json
{
  "success": false,
  "message": "Error message",
  "errors": {
    "field1": "Field-specific error message",
    "field2": "Another field-specific error message"
  }
}
```

## API Response Format

All successful responses follow this format:

```json
{
  "success": true,
  "message": "Success message",
  "data": { ... },
  "meta": { ... } // Optional metadata like pagination
}
```

## Security Best Practices

- JWT tokens for authentication
- Password hashing with bcrypt
- Input validation with express-validator
- Security headers with helmet
- Rate limiting to prevent abuse
- CORS configuration for frontend access
- Environment variables for sensitive data

## Testing

Run tests with:

```bash
npm test
```

This project uses Jest and Supertest for testing API endpoints.

## Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
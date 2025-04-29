# Deployment Guide for Urgent Jobs Backend

This guide will walk you through deploying the Urgent Jobs backend application to a Virtual Private Server (VPS).

## Prerequisites

- A VPS running Ubuntu 20.04 or later
- Domain name (optional but recommended)
- Node.js 16.x or later
- PostgreSQL 12 or later
- Nginx (for reverse proxy)
- PM2 (for process management)

## 1. Server Setup

### Update Server Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Install PostgreSQL

```bash
sudo apt install postgresql postgresql-contrib -y
```

### Install Nginx

```bash
sudo apt install nginx -y
```

### Install PM2

```bash
sudo npm install pm2 -g
```

## 2. Database Setup

### Create Database and User

```bash
sudo -u postgres psql

postgres=# CREATE DATABASE urgent_jobs;
postgres=# CREATE USER urgent_jobs_user WITH PASSWORD 'your_secure_password';
postgres=# GRANT ALL PRIVILEGES ON DATABASE urgent_jobs TO urgent_jobs_user;
postgres=# \q
```

### Run Database Setup Script

```bash
sudo -u postgres psql -d urgent_jobs -f /path/to/src/db/setup.sql
```

## 3. Application Deployment

### Clone Repository

```bash
git clone https://your-repository-url.git /var/www/urgent-jobs-api
cd /var/www/urgent-jobs-api
```

### Install Dependencies

```bash
npm install --production
```

### Create Environment File

```bash
cp .env.example .env
nano .env
```

Update the environment variables with your production settings:

```
NODE_ENV=production
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=urgent_jobs
DB_USER=urgent_jobs_user
DB_PASSWORD=your_secure_password

JWT_SECRET=your_strong_secret_key
JWT_EXPIRES_IN=7d

LOG_LEVEL=info

CORS_ORIGIN=https://your-frontend-domain.com

UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
```

### Create Upload Directory

```bash
mkdir -p uploads/profiles uploads/jobs
chmod -R 755 uploads
```

### Set Up PM2 Process

```bash
pm2 start src/server.js --name urgent-jobs-api
pm2 save
pm2 startup
```

## 4. Nginx Configuration

### Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/urgent-jobs-api
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /uploads {
        alias /var/www/urgent-jobs-api/uploads;
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
    }

    client_max_body_size 10M;
}
```

### Enable the Configuration

```bash
sudo ln -s /etc/nginx/sites-available/urgent-jobs-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 5. SSL Setup (Recommended)

### Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Obtain SSL Certificate

```bash
sudo certbot --nginx -d api.yourdomain.com
```

Follow the prompts to complete the process.

## 6. Security Considerations

### Set Up Firewall

```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### Database Backup Strategy

Set up a cron job to backup your database regularly:

```bash
sudo nano /etc/cron.daily/backup-urgentjobs-db
```

Add the following content:

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/postgresql"
mkdir -p $BACKUP_DIR
pg_dump urgent_jobs | gzip > "$BACKUP_DIR/urgent_jobs_$TIMESTAMP.sql.gz"
find $BACKUP_DIR -type f -mtime +7 -delete
```

Make the script executable:

```bash
sudo chmod +x /etc/cron.daily/backup-urgentjobs-db
```

## 7. Monitoring and Maintenance

### View Application Logs

```bash
pm2 logs urgent-jobs-api
```

### Check Application Status

```bash
pm2 status
```

### Update Application

To update the application:

```bash
cd /var/www/urgent-jobs-api
git pull
npm install --production
pm2 restart urgent-jobs-api
```

## 8. Scaling Considerations

As your application grows, consider:

1. Implementing a Redis cache for performance
2. Setting up load balancing
3. Containerization using Docker and orchestration with Kubernetes
4. Implementing CI/CD pipelines
5. Using managed database services

## 9. Troubleshooting

### Application Not Starting

Check logs:

```bash
pm2 logs urgent-jobs-api
```

### Database Connection Issues

Verify PostgreSQL is running:

```bash
sudo systemctl status postgresql
```

Check credentials in .env file.

### Nginx Not Serving Requests

Check Nginx status:

```bash
sudo systemctl status nginx
```

Check error logs:

```bash
sudo tail -f /var/log/nginx/error.log
```
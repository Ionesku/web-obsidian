# Deployment Guide

This guide covers deploying Obsidian Web to production.

## Prerequisites

- Server with Docker and Docker Compose installed
- Domain name (optional, but recommended)
- SSL certificate (use Let's Encrypt)
- At least 1GB RAM, 10GB disk space

## Quick Start (Docker)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd obsidian
   ```

2. **Configure environment**
   ```bash
   # Generate a secure secret key
   openssl rand -hex 32
   
   # Set environment variables
   export SECRET_KEY="your-generated-secret-key"
   export CORS_ORIGINS="https://yourdomain.com"
   ```

3. **Start services**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - Frontend: http://0.0.0.0
   - Backend API: http://0.0.0.0:8000
   - API Docs: http://0.0.0.0:8000/docs

## Production Deployment

### Option 1: Docker Compose (Recommended)

1. **Set up production configuration**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   nano .env
   ```

2. **Build and start with production config**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

3. **Set up reverse proxy (Nginx)**

   Create `/etc/nginx/sites-available/obsidian`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       # Redirect to HTTPS
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
       
       # SSL configuration
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;
       ssl_prefer_server_ciphers on;
       
       # Frontend
       location / {
           proxy_pass http://0.0.0.0:80;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
       
       # Backend API
       location /api {
           proxy_pass http://0.0.0.0:8000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Enable and restart:
   ```bash
   sudo ln -s /etc/nginx/sites-available/obsidian /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

4. **Set up SSL with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Option 2: Manual Installation

#### Backend

1. **Install Python 3.11+**
   ```bash
   sudo apt update
   sudo apt install python3.11 python3.11-venv
   ```

2. **Set up application**
   ```bash
   cd backend
   python3.11 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Configure systemd service**
   
   Create `/etc/systemd/system/obsidian-backend.service`:
   ```ini
   [Unit]
   Description=Obsidian Web Backend
   After=network.target

   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/opt/obsidian/backend
   Environment="PATH=/opt/obsidian/backend/venv/bin"
   EnvironmentFile=/opt/obsidian/backend/.env
   ExecStart=/opt/obsidian/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

   Enable and start:
   ```bash
   sudo systemctl enable obsidian-backend
   sudo systemctl start obsidian-backend
   ```

#### Frontend

1. **Install Node.js 20+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Build frontend**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

3. **Serve with Nginx**
   
   Copy build to web directory:
   ```bash
   sudo cp -r dist/* /var/www/obsidian/
   ```

## Environment Variables

### Backend

```bash
# Required
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///data/app.db

# Storage
VAULTS_ROOT=/data/vaults
INDEXES_ROOT=/data/indexes

# Security
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Limits
MAX_NOTE_SIZE=10485760
MAX_ATTACHMENT_SIZE=52428800
```

## Security Checklist

- [ ] Changed default SECRET_KEY
- [ ] Enabled HTTPS
- [ ] Configured firewall (UFW/iptables)
- [ ] Set up regular backups
- [ ] Configured CORS_ORIGINS correctly
- [ ] Set up rate limiting
- [ ] Enabled security headers
- [ ] Set strong admin passwords
- [ ] Regular updates scheduled
- [ ] Monitoring enabled

## Backup and Restore

### Automated Backups

Backups run automatically every 24 hours by default.

Location: `./backups/vault-backup-*.tar.gz`

### Manual Backup

```bash
# Using Makefile
make backup

# Or manually
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/
```

### Restore

```bash
# Stop services
docker-compose down

# Restore data
tar -xzf backup-20240101-120000.tar.gz

# Start services
docker-compose up -d
```

## Monitoring

### Logs

```bash
# Docker logs
docker-compose logs -f

# Application logs
tail -f data/app.log
```

### Health Checks

```bash
# Backend health
curl http://0.0.0.0:8000/health

# Docker health status
docker-compose ps
```

### Enable Monitoring Stack (Optional)

```bash
docker-compose --profile monitoring up -d
```

Access:
- Prometheus: http://0.0.0.0:9090
- Grafana: http://0.0.0.0:3000 (default: admin/admin)

## Performance Tuning

### For High Load

1. **Increase worker processes**
   ```bash
   # Modify backend/Dockerfile CMD
   CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
   ```

2. **Use PostgreSQL instead of SQLite**
   ```bash
   DATABASE_URL=postgresql://user:pass@postgres:5432/obsidian
   ```

3. **Add Redis for caching**
   ```bash
   REDIS_URL=redis://redis:6379
   ```

4. **Enable CDN for static assets**

## Troubleshooting

### Backend won't start
- Check logs: `docker-compose logs backend`
- Verify environment variables
- Check disk space
- Ensure ports 8000 is not in use

### Frontend not loading
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- Verify proxy settings
- Check CORS configuration
- Clear browser cache

### Database locked
- Ensure only one backend instance running
- Consider switching to PostgreSQL for multi-user

### Out of disk space
- Clean old backups: `find backups/ -mtime +30 -delete`
- Clean Docker: `docker system prune -a`
- Increase disk space

## Updating

### Docker

```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

### Manual

```bash
git pull
cd backend && pip install -r requirements.txt
cd frontend && npm install && npm run build
sudo systemctl restart obsidian-backend
```

## Support

- Documentation: README.md
- Issues: GitHub Issues
- Security: See SECURITY.md


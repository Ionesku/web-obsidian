# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of Obsidian Web seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do NOT:

- Open a public issue on GitHub
- Disclose the vulnerability publicly before we've had a chance to address it

### Please DO:

1. Email details to: [your-security-email@example.com]
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to expect:

- Acknowledgment within 48 hours
- Regular updates on our progress
- Credit in our security hall of fame (if desired)

## Security Best Practices

### For Deployment:

1. **Change default SECRET_KEY**: Generate a strong secret key
   ```bash
   openssl rand -hex 32
   ```

2. **Use HTTPS**: Always use HTTPS in production with valid SSL certificates

3. **Regular Updates**: Keep dependencies up to date
   ```bash
   pip list --outdated
   npm outdated
   ```

4. **Environment Variables**: Never commit `.env` files with secrets

5. **Database Backups**: Regular automated backups (included in docker-compose)

6. **Rate Limiting**: Configure appropriate rate limits for your use case

7. **CORS**: Only allow trusted domains in CORS_ORIGINS

8. **File Permissions**: Ensure proper file permissions on vault directories

### Authentication:

- JWT tokens expire after 7 days (configurable)
- Passwords are hashed using bcrypt
- Use strong passwords (min 8 characters recommended)

### Known Security Considerations:

1. **Path Traversal**: Protected by path validation in VaultService
2. **File Upload**: Limited file types and sizes
3. **SQL Injection**: Protected by SQLAlchemy ORM
4. **XSS**: React escapes by default, markdown sanitization recommended
5. **CSRF**: JWT tokens in headers (not cookies) prevent CSRF

## Security Headers

The application automatically adds these security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

## Audit Log

Major security updates will be documented here:

- **2024-01**: Initial security review and documentation


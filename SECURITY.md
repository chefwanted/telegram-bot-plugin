# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.2.x   | :white_check_mark: |
| < 2.2   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by:

1. **DO NOT** open a public issue
2. Email the maintainers directly
3. Include detailed information about the vulnerability
4. Wait for acknowledgment before disclosing publicly

## Security Best Practices

### Environment Variables

- Never commit `.env` files to version control
- Use `.env.example` as a template
- Rotate API keys regularly
- Use environment-specific configurations

### API Keys

- Store API keys in environment variables only
- Never hardcode API keys in source code
- Use separate keys for development/production
- Implement key rotation policies

### Bot Token

- Keep your Telegram bot token secret
- Use BotFather to regenerate if compromised
- Implement webhook validation when using webhooks
- Monitor bot activity for suspicious behavior

### Input Validation

- All user input should be validated and sanitized
- Use TypeScript strict mode for type safety
- Implement rate limiting for API calls
- Validate file uploads (type, size, content)

### Database Security

- Use prepared statements (better-sqlite3 does this by default)
- Implement proper access controls
- Regular backups of SQLite database
- Encrypt sensitive data at rest

### Dependencies

- Regularly update dependencies (`npm audit`)
- Review security advisories
- Use `npm audit fix` to auto-fix vulnerabilities
- Pin critical dependency versions

### Code Review

- Review all code changes for security issues
- Run security linters (ESLint with security plugins)
- Implement CI/CD security checks
- Use static analysis tools

## Recent Security Fixes

### v2.2.0 (January 2026)

- Fixed critical vulnerability in form-data dependency
- Migrated Telegram API layer to grammY to remove legacy request-based dependencies
- Removed console.log statements leaking sensitive data
- Replaced 'any' types with proper TypeScript types
- Added proper error handling and logging

## Security Checklist

- [x] Environment variables for all secrets
- [x] Input validation on user commands
- [x] Proper error handling without exposing internals
- [x] Updated dependencies with security patches
- [x] TypeScript strict mode enabled
- [x] Removed 'any' types for better type safety
- [x] Proper logging without sensitive data exposure
- [ ] Rate limiting implementation (TODO)
- [ ] Webhook signature verification (TODO)
- [ ] User authentication/authorization (TODO)
- [ ] File upload virus scanning (TODO)
- [ ] Audit logging for admin actions (TODO)

## Contact

For security concerns, please contact the maintainers.

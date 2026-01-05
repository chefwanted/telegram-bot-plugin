---
name: production-deployment
description: Deploy Telegram bots to production with process management, monitoring, and scaling. Use this skill when: (1) Deploying bot to production server, (2) Setting up process management (PM2/systemd), (3) Configuring monitoring and alerting, (4) Implementing CI/CD pipelines, (5) Scaling bot infrastructure.
---

# Production Deployment Guide

## Overview

This guide covers deploying the Telegram Bot Plugin to production with proper process management, monitoring, and scaling strategies.

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors
- [ ] Linting passes: `npm run lint`
- [ ] Code coverage > 80%
- [ ] No console.log or debug code
- [ ] Environment variables documented

### Configuration

- [ ] `.env` file created with production values
- [ ] All required secrets set (TELEGRAM_BOT_TOKEN, API keys)
- [ ] CLAUDE_TIMEOUT configured appropriately
- [ ] Database backup strategy in place
- [ ] Log directory writable: `/tmp/bot.log`

### Infrastructure

- [ ] Server resources sufficient (CPU, RAM, disk)
- [ ] Node.js version compatible (>= 18.0.0)
- [ ] Network connectivity to Telegram API
- [ ] Claude CLI installed and authenticated
- [ ] Firewall rules configured
- [ ] SSL/TLS certificates (if using webhooks)

### Monitoring

- [ ] Log aggregation configured
- [ ] Error tracking setup (Sentry, etc.)
- [ ] Uptime monitoring configured
- [ ] Performance metrics collection
- [ ] Alert rules defined

## Deployment Strategies

### 1. Simple Deployment (Systemd)

Best for: Single bot instance, low traffic

#### Create Systemd Service

```bash
sudo nano /etc/systemd/system/telegram-bot.service
```

```ini
[Unit]
Description=Telegram Bot Plugin
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=botuser
Group=botuser
WorkingDirectory=/opt/telegram-bot-plugin
ExecStart=/usr/bin/node /opt/telegram-bot-plugin/start.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/telegram-bot/bot.log
StandardError=append:/var/log/telegram-bot/bot-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/telegram-bot /tmp

# Environment
Environment="NODE_ENV=production"
Environment="CLAUDE_TIMEOUT=300000"
EnvironmentFile=/opt/telegram-bot-plugin/.env

# Resource Limits
MemoryMax=512M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
```

#### Deploy

```bash
# Create bot user
sudo useradd -r -s /bin/false botuser

# Setup directories
sudo mkdir -p /opt/telegram-bot-plugin
sudo mkdir -p /var/log/telegram-bot
sudo chown -R botuser:botuser /opt/telegram-bot-plugin
sudo chown -R botuser:botuser /var/log/telegram-bot

# Copy files
sudo cp -r . /opt/telegram-bot-plugin/
sudo chown -R botuser:botuser /opt/telegram-bot-plugin

# Install dependencies
cd /opt/telegram-bot-plugin
sudo -u botuser npm install --production

# Setup environment
sudo -u botuser cp .env.example .env
sudo -u botuser nano .env  # Edit with production values

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable telegram-bot
sudo systemctl start telegram-bot

# Check status
sudo systemctl status telegram-bot
```

#### Management Commands

```bash
# Start/stop/restart
sudo systemctl start telegram-bot
sudo systemctl stop telegram-bot
sudo systemctl restart telegram-bot

# View logs
sudo journalctl -u telegram-bot -f
sudo journalctl -u telegram-bot --since "1 hour ago"

# Check status
sudo systemctl status telegram-bot

# Reload configuration
sudo systemctl daemon-reload
sudo systemctl restart telegram-bot
```

### 2. Process Manager (PM2)

Best for: Multiple bots, advanced monitoring, zero-downtime redeployment

#### Install PM2

```bash
npm install -g pm2
pm2 install pm2-logrotate
```

#### Create Ecosystem File

`ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'telegram-bot',
    script: './start.js',
    cwd: '/opt/telegram-bot-plugin',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      CLAUDE_TIMEOUT: '300000',
    },
    env_production: {
      NODE_ENV: 'production',
    },
    error_file: '/var/log/telegram-bot/pm2-error.log',
    out_file: '/var/log/telegram-bot/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    log_file: '/var/log/telegram-bot/pm2-combined.log',
    time: true,
  }],
};
```

#### Deploy

```bash
# Setup directories
sudo mkdir -p /opt/telegram-bot-plugin
sudo mkdir -p /var/log/telegram-bot

# Copy files
sudo cp -r . /opt/telegram-bot-plugin/
cd /opt/telegram-bot-plugin
npm install --production

# Setup environment
cp .env.example .env
nano .env  # Edit with production values

# Start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
# Copy and run the output command
```

#### Management Commands

```bash
# Start/stop/restart
pm2 start telegram-bot
pm2 stop telegram-bot
pm2 restart telegram-bot
pm2 reload telegram-bot  # Zero-downtime reload

# Monitor
pm2 monit

# View logs
pm2 logs telegram-bot
pm2 logs telegram-bot --lines 100

# Check status
pm2 status
pm2 describe telegram-bot

# Update and reload
git pull
npm install --production
npm run build
pm2 reload telegram-bot
```

### 3. Docker Deployment

Best for: Containerized environments, easy scaling, consistency

#### Create Dockerfile

```dockerfile
FROM node:18-alpine

# Install Claude CLI
RUN npm install -g @anthropic-ai/claude-code

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create log directory
RUN mkdir -p /var/log/telegram-bot

# Set environment
ENV NODE_ENV=production
ENV CLAUDE_TIMEOUT=300000

# Create non-root user
RUN addgroup -g 1001 -S botuser && \
    adduser -S -D -H -u 1001 -s /sbin/nologin -G botuser botuser && \
    chown -R botuser:botuser /usr/src/app /var/log/telegram-bot

USER botuser

EXPOSE 3000

CMD ["node", "start.js"]
```

#### Create docker-compose.yml

```yaml
version: '3.8'

services:
  telegram-bot:
    build: .
    container_name: telegram-bot
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - CLAUDE_TIMEOUT=300000
    env_file:
      - .env
    volumes:
      - ./logs:/var/log/telegram-bot
      - /tmp/telegram-bot:/tmp/telegram-bot
    networks:
      - bot-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  bot-network:
    driver: bridge
```

#### Deploy

```bash
# Build image
docker-compose build

# Start container
docker-compose up -d

# View logs
docker-compose logs -f

# Check status
docker-compose ps

# Stop
docker-compose down

# Update and redeploy
git pull
docker-compose build
docker-compose up -d
docker image prune -f
```

### 4. Kubernetes Deployment

Best for: Large-scale deployments, auto-scaling, high availability

#### Create Deployment

`telegram-bot-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: telegram-bot
  labels:
    app: telegram-bot
spec:
  replicas: 2
  selector:
    matchLabels:
      app: telegram-bot
  template:
    metadata:
      labels:
        app: telegram-bot
    spec:
      containers:
      - name: bot
        image: your-registry/telegram-bot:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: CLAUDE_TIMEOUT
          value: "300000"
        - name: TELEGRAM_BOT_TOKEN
          valueFrom:
            secretKeyRef:
              name: bot-secrets
              key: telegram-token
        - name: ZAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: bot-secrets
              key: zai-api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "ps aux | grep '[n]ode start.js'"
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - /bin/sh
            - -c
            - "ps aux | grep '[n]ode start.js'"
          initialDelaySeconds: 5
          periodSeconds: 5
```

#### Deploy

```bash
# Create secrets
kubectl create secret generic bot-secrets \
  --from-literal=telegram-token=YOUR_TOKEN \
  --from-literal=zai-api-key=YOUR_KEY

# Apply deployment
kubectl apply -f telegram-bot-deployment.yaml

# Check status
kubectl get deployments
kubectl get pods

# View logs
kubectl logs -f deployment/telegram-bot

# Scale
kubectl scale deployment telegram-bot --replicas=4
```

## Monitoring & Logging

### Log Management

#### Log Rotation (logrotate)

```bash
sudo nano /etc/logrotate.d/telegram-bot
```

```
/var/log/telegram-bot/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 botuser botuser
    sharedscripts
    postrotate
        systemctl reload telegram-bot > /dev/null 2>&1 || true
    endscript
}
```

#### Centralized Logging (ELK Stack)

```javascript
// Use Winston for structured logging
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: '/var/log/telegram-bot/error.log', level: 'error' }),
    new winston.transports.File({ filename: '/var/log/telegram-bot/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Send to external service
if (process.env.ELASTICSEARCH_URL) {
  require('winston-elasticsearch');
  logger.add(new winston.transports.Elasticsearch({
    level: 'info',
    clientOpts: { node: process.env.ELASTICSEARCH_URL },
    index: 'telegram-bot-logs'
  }));
}
```

### Health Checks

#### Simple Health Endpoint

```typescript
// src/utils/health.ts
import { getDatabase } from '../database';

export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  checks: Record<string, boolean>;
}> {
  const checks = {
    database: false,
    claude: false,
    telegram: false,
  };

  try {
    // Check database
    const db = getDatabase();
    db.prepare('SELECT 1').get();
    checks.database = true;
  } catch {}

  try {
    // Check Claude CLI
    spawnSync('claude', ['--version']);
    checks.claude = true;
  } catch {}

  try {
    // Check Telegram API
    // Implementation depends on your API client
    checks.telegram = true;
  } catch {}

  const allHealthy = Object.values(checks).every(Boolean);
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks,
  };
}
```

### Performance Monitoring

#### Metrics Collection

```typescript
// src/utils/metrics.ts
import { performance } from 'perf_hooks';

class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  recordTiming(name: string, duration: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    // Keep only last 100 measurements
    const measurements = this.metrics.get(name)!;
    if (measurements.length > 100) {
      measurements.shift();
    }
  }

  getStats(name: string) {
    const measurements = this.metrics.get(name) || [];
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort((a, b) => a - b);
    return {
      count: measurements.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }
}

export const metrics = new MetricsCollector();
```

#### Usage

```typescript
const start = performance.now();
try {
  await processMessage(chatId, message);
} finally {
  metrics.recordTiming('message_processing', performance.now() - start);
}
```

### Alerting

#### Setup Alert Rules

```bash
# Using Prometheus Alertmanager
# telegram-bot-alerts.yaml
groups:
- name: telegram-bot
  rules:
  - alert: HighErrorRate
    expr: rate(bot_errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"

  - alert: BotDown
    expr: up{job="telegram-bot"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Bot is down"
```

## CI/CD Pipeline

### GitHub Actions Example

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/telegram-bot-plugin
            git pull
            npm install --production
            npm run build
            pm2 reload telegram-bot
```

## Scaling Strategies

### Horizontal Scaling

Multiple bot instances behind a load balancer (if using webhooks):

```yaml
# docker-compose.yml for multiple instances
services:
  telegram-bot-1:
    build: .
    environment:
      - INSTANCE_ID=1
  telegram-bot-2:
    build: .
    environment:
      - INSTANCE_ID=2
  telegram-bot-3:
    build: .
    environment:
      - INSTANCE_ID=3
```

### Vertical Scaling

Increase resources for single instance:

```ini
# systemd service
[Service]
MemoryMax=2G
CPUQuota=200%
```

### Database Connection Pooling

For high traffic, use connection pooling:

```typescript
// src/database/pool.ts
import { Pool } from 'better-sqlite3-pool';

const pool = new Pool({
  filename: '/tmp/telegram-bot/bot.db',
  maxSize: 10,
});

export function getDbFromPool() {
  return pool.acquire();
}
```

## Backup & Recovery

### Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/telegram-bot"
DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/tmp/telegram-bot/bot.db"

mkdir -p "$BACKUP_DIR"

# Backup database
cp "$DB_PATH" "$BACKUP_DIR/bot_$DATE.db"

# Compress
gzip "$BACKUP_DIR/bot_$DATE.db"

# Keep last 30 days
find "$BACKUP_DIR" -name "bot_*.db.gz" -mtime +30 -delete

echo "Backup completed: bot_$DATE.db.gz"
```

```bash
# Add to crontab
0 2 * * * /opt/telegram-bot-plugin/scripts/backup.sh
```

### Restore from Backup

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file>"
  exit 1
fi

# Stop bot
systemctl stop telegram-bot

# Restore database
gunzip -c "$BACKUP_FILE" > /tmp/telegram-bot/bot.db

# Start bot
systemctl start telegram-bot

echo "Restore completed"
```

## Security Hardening

### File Permissions

```bash
# Secure .env file
chmod 600 .env

# Secure log files
chmod 640 /var/log/telegram-bot/*.log

# Secure application files
chmod 750 /opt/telegram-bot-plugin
chmod 640 /opt/telegram-bot-plugin/.env
```

### Firewall Rules

```bash
# UFW example
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 443/tcp   # HTTPS (if using webhooks)
sudo ufw enable
```

### Rate Limiting

```typescript
// src/utils/rate-limiter.ts
import { LRUCache } from 'lru-cache';

class RateLimiter {
  private cache = new LRUCache<string, number[]>({
    max: 10000,
    ttl: 60000, // 1 minute
  });

  canProcess(userId: string, maxRequests: number = 20): boolean {
    const now = Date.now();
    const requests = this.cache.get(userId) || [];

    // Filter requests older than 1 minute
    const recentRequests = requests.filter(t => now - t < 60000);

    if (recentRequests.length >= maxRequests) {
      return false;
    }

    recentRequests.push(now);
    this.cache.set(userId, recentRequests);
    return true;
  }
}
```

## Disaster Recovery

### Recovery Procedures

1. **Database Corruption**
   ```bash
   # Restore from latest backup
   systemctl stop telegram-bot
   gunzip -c /backups/bot_latest.db.gz > /tmp/telegram-bot/bot.db
   systemctl start telegram-bot
   ```

2. **Server Failure**
   - Spin up new server
   - Restore from backup
   - Update DNS (if applicable)
   - Verify bot token still valid

3. **API Key Compromise**
   - Rotate all API keys
   - Update .env file
   - Restart services
   - Review logs for unauthorized access

## Maintenance

### Regular Tasks

- **Daily**: Check error logs
- **Weekly**: Review performance metrics
- **Monthly**: Update dependencies
- **Quarterly**: Security audit

### Dependency Updates

```bash
# Check for updates
npm outdated

# Update dependencies
npm update

# Test updates
npm test

# Deploy updates
pm2 reload telegram-bot
```

### Log Cleanup

```bash
# Add to crontab
0 3 * * * find /var/log/telegram-bot -name "*.log" -mtime +7 -delete
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Bot won't start | Check logs, verify .env file |
| High memory usage | Restart service, check for leaks |
| Slow responses | Check network, increase CLAUDE_TIMEOUT |
| Database locked | Check for long-running transactions |
| Process crashes | Check error logs, increase memory limit |

### Debug Mode

```bash
# Enable debug logging
export DEBUG=true
systemctl restart telegram-bot
journalctl -u telegram-bot -f
```

### Performance Profiling

```typescript
// Add to start.js
if (process.env.PROFILE === 'true') {
  const inspector = require('inspector');
  inspector.open(9229, '0.0.0.0');
  console.log('Profiler running on port 9229');
}
```

```bash
# Enable profiling
export PROFILE=true
node start.js

# Connect with Chrome DevTools
# chrome://inspect
```

## Best Practices

1. **Always test in staging first**
2. **Use environment-specific configurations**
3. **Implement proper logging**
4. **Monitor resources continuously**
5. **Have backup and recovery procedures**
6. **Keep dependencies updated**
7. **Use version control tags**
8. **Document changes**
9. **Automate deployments**
10. **Plan for scaling**

# WA Supervisor — Deployment Guide

## VPS Setup (Ubuntu 22.04)

### 1. Clone project on VPS
```bash
sudo mkdir -p /opt/wa-supervisor
sudo chown -R $USER:$USER /opt/wa-supervisor
git clone https://github.com/luhur99/wasupervisor.git /opt/wa-supervisor
cd /opt/wa-supervisor
```

### 2. Install system dependencies (automated)
```bash
sudo bash scripts/vps-bootstrap.sh
```

### 3. Create database
```bash
sudo -u postgres psql -c "CREATE USER wa_supervisor_user WITH PASSWORD 'your_strong_password';"
sudo -u postgres psql -c "CREATE DATABASE wa_supervisor OWNER wa_supervisor_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE wa_supervisor TO wa_supervisor_user;"
```

### 4. Configure environment
```bash
cp .env.example .env
# Edit .env with your real values
```

### 5. Deploy application (automated)
```bash
bash scripts/vps-deploy.sh
```

### 6. Generate internal API key for PHP dashboard
```bash
node -e "
const crypto = require('crypto');
const key = crypto.randomBytes(32).toString('hex');
const hash = crypto.createHash('sha256').update(key).digest('hex');
console.log('RAW KEY (put in PHP env.php):', key);
console.log('HASH (put in VPS .env INTERNAL_API_KEY_HASH):', hash);
"
```

### 7. Ensure PM2 starts on reboot
```bash
pm2 save
pm2 startup  # follow the printed command to enable on boot
```

### 8. Nginx config
Copy template:
```bash
sudo cp deploy/nginx/wa-supervisor.conf /etc/nginx/sites-available/wa-supervisor
```

Edit domain name in file (`api.your-domain.com`), then enable site:
```nginx
server {
    listen 80;
    server_name api.your-domain.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl;
    server_name api.your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/api.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.your-domain.com/privkey.pem;

    client_max_body_size 20M;

    location /uploads/ {
        alias /opt/wa-supervisor/uploads/;
        expires 7d;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/wa-supervisor /etc/nginx/sites-enabled/wa-supervisor
sudo certbot --nginx -d api.your-domain.com
sudo nginx -t && sudo systemctl reload nginx
```

### 9. Firewall
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 10. Update app on next deploy
```bash
cd /opt/wa-supervisor
bash scripts/vps-deploy.sh
```

---

## Shared Hosting Setup

### 1. Run MySQL migration
```bash
php migrations/add_supervisor_role.php
```

### 2. Set supervisor role for your user
```sql
UPDATE users SET role='supervisor' WHERE username='your_username';
```

### 3. Add VPS API config to env.php
```php
putenv('VPS_API_BASE=https://api.your-domain.com/api/v1');
putenv('VPS_API_KEY=your-raw-api-key-generated-in-step-4-above');
```

### 4. Create first API key in VPS database
```bash
# On VPS:
node -e "
require('dotenv').config();
const { pool } = require('./src/config/database');
const { hashApiKey, generateApiKey } = require('./src/utils/crypto');
const key = generateApiKey();
const hash = hashApiKey(key);
pool.query(
  \`INSERT INTO api_keys (name, key_hash, permissions) VALUES (\$1, \$2, \$3)\`,
  ['PHP Dashboard', hash, JSON.stringify(['read','write'])]
).then(() => {
  console.log('API Key:', key);
  pool.end();
}).catch(console.error);
"
```

---

## CloudChat Webhook

In your CloudChat account settings, set the webhook URL to:
```
https://api.your-domain.com/webhook/cloudchat
```

---

## Verification Checklist

- [ ] `curl https://api.your-domain.com/health` → `{"status":"ok","db":"ok"}`
- [ ] POST `/api/v1/users` → creates a PIC
- [ ] POST `/api/v1/tasks` → creates a task
- [ ] POST `/api/v1/tasks/:id/remind-now` → WA message received on test phone
- [ ] Reply to WA → `task_responses` row in DB
- [ ] Send photo → file in `uploads/responses/` + `photo_urls` populated
- [ ] `ai_summary` populated within 10 seconds of response
- [ ] `supervisor/index.php` loads → KPI cards visible
- [ ] `supervisor/tasks/create.php` → create task form works
- [ ] Weekly review: POST `/api/v1/reviews/generate` → WA received

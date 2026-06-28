#!/bin/bash
set -e

PANEL_DIR="/opt/maddix-portal-v2"
PORT="4000"
DEFAULT_DOMAIN="yourdomain.com"

echo "🔧 Maddix Portal v2 Installer"
echo "   Open Source WhatsApp Bot Panel"

if [ "$EUID" -ne 0 ]; then
   echo "❌ Please run as root (sudo)"
   exit 1
fi

echo ""
echo "🌐 Domain Configuration"
read -p "Enter your domain (default: $DEFAULT_DOMAIN): " USER_DOMAIN
DOMAIN=${USER_DOMAIN:-$DEFAULT_DOMAIN}

echo "Using domain: $DOMAIN"

apt-get update -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install MongoDB
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -y
    apt-get install -y mongodb-org
fi

systemctl enable mongod || true
systemctl start mongod || true
sleep 3

# Install PM2, Nginx, Certbot
npm install -g pm2
apt-get install -y nginx certbot python3-certbot-nginx

# Backup old installation if exists
if [ -d "$PANEL_DIR" ]; then
    mv "$PANEL_DIR" "$PANEL_DIR.backup.$(date +%s)"
fi

mkdir -p "$PANEL_DIR"
cp -r . "$PANEL_DIR/"

# Install backend dependencies
cd "$PANEL_DIR/backend"
npm install --legacy-peer-deps

# Create .env file
cd "$PANEL_DIR"
# Generate a random admin password unless one already exists.
# Previously this was hardcoded to "MaddixAdmin123!" in a PUBLIC repo,
# meaning anyone could log in as admin on a fresh install.
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)}"
cat > .env << EOF
PORT=$PORT
CLIENT_URL=https://$DOMAIN
MONGODB_URI=mongodb://localhost:27017/maddix_portal_v2
JWT_SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=admin@maddix.com
ADMIN_PASSWORD=$ADMIN_PASSWORD
PANEL_URL=https://$DOMAIN
WHATSAPP_GROUP_LINK=https://chat.whatsapp.com/K9EzrPMPsb10GThtpalAyM
WHATSAPP_CHANNEL_LINK=https://whatsapp.com/channel/0029Vb7I24LJUM2X4E5beD0E
DEFAULT_BOT_COST=5
MAX_BOTS_PER_USER=10
OWNER_NUMBER=256752972945
DOMAIN=$DOMAIN
EOF

# Seed database
cd "$PANEL_DIR/backend"
node -e "import('./utils/seed.js').then(m=>m.default?.())" 2>/dev/null || node utils/seed.js || true

# Start with PM2
pm2 delete maddix-portal-v2 2>/dev/null || true
cd "$PANEL_DIR/backend"
pm2 start server.js --name maddix-portal-v2
pm2 save

# Nginx + SSL Setup
echo "🌐 Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/maddix << NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://localhost:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/maddix /etc/nginx/sites-enabled/maddix
nginx -t && systemctl restart nginx || true

# SSL Certificate
echo "🔒 Setting up SSL..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@$DOMAIN" --redirect || {
    echo "⚠️ SSL setup failed. You can run manually later:"
    echo "   certbot --nginx -d $DOMAIN"
}

echo ""
echo "✅ Maddix Portal v2 installed successfully!"
echo ""
echo "🌐 Access your panel at: https://$DOMAIN"
echo ""
echo "Admin Login:"
echo "   Email:    admin@maddix.com"
echo "   Password: $ADMIN_PASSWORD"
echo ""
echo "   (Save this now — it is also stored in $PANEL_DIR/.env)"
echo ""
echo "📌 Features:"
echo "   - Domain + HTTPS ready"
echo "   - Admin can set bot prices"
echo "   - Admin can create rental packages"
echo "   - Kango & Jawad bots removed"
echo ""
echo "Thank you for using Maddix Portal!"

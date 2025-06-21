# SSH into your EC2 server
ssh -i infra/terraform/matcha-key.pem ubuntu@3.1.220.134

# Create the SSL setup script
cat > setup-ssl-matchat.sh << 'EOF'
#!/bin/bash

# SSL Setup for matchat-app.xyz
# Run this script on your EC2 instance as ubuntu user

set -e

# Configuration
DOMAIN="matchat-app.xyz"
EMAIL=""  # Will be prompted
APP_PORT="3030"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    print_error "Please run this script as ubuntu user, not root!"
    exit 1
fi

# Get email
read -p "Enter your email address for Let's Encrypt: " EMAIL

print_status "Setting up SSL for $DOMAIN on port $APP_PORT"

# Update system
print_status "Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y

# Install nginx
print_status "Installing nginx..."
sudo apt-get install -y nginx

# Install certbot
print_status "Installing certbot..."
sudo apt-get install -y snapd
sudo snap install core && sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot

# Create initial nginx config (HTTP only for certbot verification)
print_status "Creating initial nginx configuration..."
sudo tee /etc/nginx/sites-available/matchat-app > /dev/null <<NGINX_EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Allow certbot verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Proxy all other requests to your app
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_EOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/matchat-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate
print_status "Obtaining SSL certificate from Let's Encrypt..."
sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive

# Create final SSL-enabled nginx config
print_status "Creating SSL-enabled nginx configuration..."
sudo tee /etc/nginx/sites-available/matchat-app > /dev/null <<NGINX_EOF
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # File upload limit
    client_max_body_size 50M;

    # Main application proxy
    location / {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.IO support
    location /socket.io/ {
        proxy_pass http://localhost:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_cache_bypass \$http_upgrade;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)\$ {
        proxy_pass http://localhost:$APP_PORT;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://localhost:$APP_PORT/health;
        access_log off;
    }
}
NGINX_EOF

# Test and reload nginx
sudo nginx -t && sudo systemctl reload nginx

# Setup firewall
print_status "Configuring firewall..."
sudo ufw --force enable
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# Test certificate renewal
print_status "Testing certificate auto-renewal..."
sudo certbot renew --dry-run

# Enable nginx autostart
sudo systemctl enable nginx

print_status "✅ SSL setup completed successfully!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Your application is now accessible via HTTPS:"
echo "   https://$DOMAIN"
echo "   https://www.$DOMAIN"
echo ""
echo "📋 Status check:"
echo "   - Nginx status: $(sudo systemctl is-active nginx)"
echo "   - App running on port $APP_PORT: $(curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT/health || echo "Check if app is running")"
echo ""
echo "🔧 Useful commands:"
echo "   - Check nginx: sudo systemctl status nginx"
echo "   - Test nginx config: sudo nginx -t"
echo "   - Reload nginx: sudo systemctl reload nginx"
echo "   - Check SSL: sudo certbot certificates"
echo "   - View logs: sudo tail -f /var/log/nginx/error.log"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
EOF
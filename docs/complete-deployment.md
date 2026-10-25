# ShanuTechX Deployment Status

## ✅ Completed Steps

1. **SSH Connection** - Successfully connected to server at 13.229.204.128
2. **File Upload** - All project files uploaded to `/home/ubuntu/shanutechx`
   - API files
   - Dashboard files
   - Package configurations
   - Services (WhatsApp bot, Discord bot, Node agent)
   - Packages (Database, SDK packages)
   - Templates catalog
   - Infrastructure configurations

## 📋 Next Steps (To Complete on Server)

SSH into the server and run these commands:

```bash
ssh -i LightsailDefaultKey-ap-southeast-1.pem ubuntu@13.229.204.128
```

Then execute:

```bash
cd /home/ubuntu/shanutechx

# Install system dependencies
echo "Installing Docker..."
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

echo "Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

echo "Installing Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install project dependencies
echo "Installing npm dependencies..."
npm install --legacy-peer-deps

# Generate Prisma client
echo "Generating Prisma client..."
npm run db:generate

# Set up environment files
echo "Setting up environment files..."

# Create control-plane .env
cat > infra/control-plane/.env << 'EOF'
ROOT_DOMAIN=shanutechx.com
ACME_EMAIL=admin@shanutechx.com
POSTGRES_PASSWORD=$(openssl rand -base64 32)
NODE_AGENT_SECRET=$(openssl rand -base64 32)

# Firebase - UPDATE THESE
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_API_BASE_URL=https://api.shanutechx.com
EOF

# Get the generated passwords
POSTGRES_PASS=$(grep POSTGRES_PASSWORD infra/control-plane/.env | cut -d'=' -f2)
AGENT_SECRET=$(grep NODE_AGENT_SECRET infra/control-plane/.env | cut -d'=' -f2)

# Create API .env
cat > apps/api/.env << EOF
PORT=4000
DATABASE_URL="postgresql://shanutechx:${POSTGRES_PASS}@postgres:5432/shanutechx?schema=public"
REDIS_URL="redis://redis:6379"

# Firebase Admin SDK - UPDATE THESE
FIREBASE_PROJECT_ID="your-project-id"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@your-project.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL="https://your-project.firebaseio.com"

# Secrets
NODE_AGENT_SECRET="${AGENT_SECRET}"
SMS_WEBHOOK_SECRET=$(openssl rand -base64 32)
SECRETS_ENCRYPTION_KEY=$(openssl rand -hex 32)
BILLING_CRON_SECRET=$(openssl rand -base64 32)

# Internal Services
WHATSAPP_INTERNAL_SECRET=$(openssl rand -base64 32)
WHATSAPP_BOT_URL="http://whatsapp-bot:4100"
DISCORD_INTERNAL_SECRET=$(openssl rand -base64 32)
DISCORD_BOT_URL="http://discord-bot:4200"

# Cloudflare - UPDATE THESE
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_ZONE_ID=""
ROOT_DOMAIN="shanutechx.com"

# AI Services (Optional)
GEMINI_API_KEY=""
GROQ_API_KEY=""

# Billing
AUTO_VERIFY_DELAY_MS=86400000
GRACE_PERIOD_DAYS=7

# Leaseweb (Optional)
LEASEWEB_API_KEY=""
EOF

# Build and start Docker services
echo "Building Docker containers..."
cd infra/control-plane

# You need to log out and log back in for docker group to take effect
# Or run this command with newgrp
newgrp docker << DOCKERCMD
docker-compose build
docker-compose up -d
DOCKERCMD

echo "Waiting for database to be ready..."
sleep 30

# Run database migrations
echo "Running database migrations..."
cd /home/ubuntu/shanutechx
npm run db:migrate:deploy

echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
echo "Services Status:"
cd infra/control-plane && docker-compose ps

echo ""
echo "Your services should be available at:"
echo "  - API: https://api.shanutechx.com"
echo "  - Dashboard: https://app.shanutechx.com"
echo "  - Website: https://shanutechx.com"
echo ""
echo "⚠️ IMPORTANT: Configure the following:"
echo ""
echo "1. DNS Records in Cloudflare:"
echo "   - A record: @ -> 13.229.204.128"
echo "   - A record: api -> 13.229.204.128"
echo "   - A record: app -> 13.229.204.128"
echo "   - A record: * -> 13.229.204.128 (wildcard)"
echo ""
echo "2. Update Firebase credentials in:"
echo "   - /home/ubuntu/shanutechx/apps/api/.env"
echo "   - /home/ubuntu/shanutechx/infra/control-plane/.env"
echo ""
echo "3. Get Firebase credentials from Firebase Console:"
echo "   https://console.firebase.google.com"
echo "   Project Settings > Service Accounts > Generate New Private Key"
echo ""
echo "4. Restart services after updating credentials:"
echo "   cd /home/ubuntu/shanutechx/infra/control-plane"
echo "   docker-compose restart"
echo ""
echo "5. View logs:"
echo "   docker-compose logs -f"
echo ""
```

## 🔐 Security Notes

**IMPORTANT**: The SSH key you shared (`LightsailDefaultKey-ap-southeast-1.pem`) was exposed in this conversation. After deployment:

1. **Delete the exposed key** from AWS Lightsail
2. **Generate a new key pair** in AWS Lightsail Console
3. **Update your local SSH configuration** with the new key

## 📊 Monitoring Commands

After deployment, use these commands to monitor your services:

```bash
# View all service status
cd /home/ubuntu/shanutechx/infra/control-plane
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f api
docker-compose logs -f dashboard
docker-compose logs -f postgres

# Restart a service
docker-compose restart api

# Restart all services
docker-compose restart

# Stop all services
docker-compose down

# Start all services
docker-compose up -d
```

## 🔧 Configuration Files

### Files to Update

1. **`/home/ubuntu/shanutechx/infra/control-plane/.env`**
   - Firebase public client configuration
   - Domain settings

2. **`/home/ubuntu/shanutechx/apps/api/.env`**
   - Firebase Admin SDK credentials (private key)
   - Cloudflare API credentials
   - Optional: Gemini, Groq, Leaseweb API keys

### Getting Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create new one)
3. Go to **Project Settings** (gear icon)
4. Navigate to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Download the JSON file
7. Extract values:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (keep the \n characters)

## 🌐 DNS Configuration in Cloudflare

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain `shanutechx.com`
3. Go to **DNS** > **Records**
4. Add these A records (all pointing to `13.229.204.128`):

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| A | @ | 13.229.204.128 | DNS only (grey) | Auto |
| A | api | 13.229.204.128 | DNS only (grey) | Auto |
| A | app | 13.229.204.128 | DNS only (grey) | Auto |
| A | * | 13.229.204.128 | DNS only (grey) | Auto |

**Important**: Set Proxy Status to "DNS only" (grey cloud) to allow Let's Encrypt SSL certificates to work properly.

## 🎯 First Admin User Setup

After deployment and Firebase configuration:

1. Create your first user through Firebase Authentication (Email/Password)
2. SSH into server and update their role to 'dev':

```bash
ssh -i your-new-key.pem ubuntu@13.229.204.128
docker exec -it shanutechx-postgres psql -U shanutechx -d shanutechx

# In PostgreSQL prompt:
UPDATE "User" SET role = 'dev' WHERE "firebaseUid" = 'your-firebase-uid';
\q
```

## ✅ Verification Checklist

- [ ] All files uploaded to server
- [ ] Docker and Docker Compose installed
- [ ] Node.js 22 installed
- [ ] npm dependencies installed
- [ ] Prisma client generated
- [ ] Environment files created
- [ ] Docker containers built
- [ ] Docker containers running
- [ ] Database migrations applied
- [ ] DNS records configured in Cloudflare
- [ ] Firebase credentials configured
- [ ] SSL certificates obtained (automatic via Let's Encrypt)
- [ ] First admin user created
- [ ] Old SSH key deleted and new one generated

## 📞 Support

If you encounter any issues:

1. Check service logs: `docker-compose logs -f`
2. Check individual service: `docker-compose logs api`
3. Verify environment variables: `cat apps/api/.env`
4. Check DNS propagation: `dig shanutechx.com`
5. Test SSL certificates: `openssl s_client -connect api.shanutechx.com:443`

## 🚀 Next Steps After Deployment

1. **Test the API**: `curl https://api.shanutechx.com/api/health`
2. **Access Dashboard**: Open `https://app.shanutechx.com` in browser
3. **Create First User**: Sign up through Firebase Auth
4. **Promote to Admin**: Use PostgreSQL command above
5. **Add First Node**: Register your VPS as a deployment node
6. **Deploy First App**: Choose from the 500+ template catalog

Your ShanuTechX platform is now ready for production use! 🎉

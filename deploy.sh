#!/bin/bash

# ════════════════════════════════════════════════════════════
#  PRODUCTION DEPLOYMENT — Product Research Frontend (Next.js)
#  URL: https://research.hasaniche.com
#  Served as: Next.js process (next start :3012) via PM2 + Nginx
#  Directory: /home/deploy/apps/productresearch-hasaniche-frontend
# ════════════════════════════════════════════════════════════

APP_DIR="/home/deploy/apps/productresearch-hasaniche-frontend"
PM2_APP_NAME="product-research-frontend"
BRANCH="main"

echo "══════════════════════════════════════════"
echo "🚀 [PRD] Product Research Frontend Deployment"
echo "   https://research.hasaniche.com"
echo "══════════════════════════════════════════"

# ── Step 1: Navigate to app directory ──────────────────────
echo ""
echo "📂 Moving to $APP_DIR..."
cd $APP_DIR || { echo "❌ Error: Directory not found at $APP_DIR"; exit 1; }

# ── Step 2: Pull latest code ────────────────────────────────
echo ""
echo "⬇️  Pulling latest code from origin/$BRANCH..."
git pull origin $BRANCH || { echo "❌ Error: Git pull failed!"; exit 1; }

# ── Step 3: Install dependencies ───────────────────────────
echo ""
echo "📦 Installing dependencies..."
npm ci || { echo "❌ Error: npm ci failed!"; exit 1; }

# ── Step 4: Build Next.js app ──────────────────────────────
# (NEXT_PUBLIC_API_URL is read from .env.production at build time)
echo ""
echo "🏗️  Building Next.js app..."
npm run build || { echo "❌ Error: Build failed!"; exit 1; }

# ── Step 5: Verify .next/ was created ──────────────────────
echo ""
echo "🔍 Verifying .next/ output..."
if [ ! -d "$APP_DIR/.next" ]; then
  echo "❌ Error: .next/ folder not found after build!"
  exit 1
fi
echo "✅ .next/ build output verified."

# ── Step 6: Restart the PM2 process ────────────────────────
echo ""
echo "🔄 Restarting frontend in PM2..."
pm2 restart $PM2_APP_NAME || pm2 start npm --name $PM2_APP_NAME -- start

# Wait a second for it to boot
sleep 2

# ── Done ────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════"
echo "✅ Deployment complete!"
echo "   Site:  https://research.hasaniche.com"
echo "   Built: $(date '+%Y-%m-%d %H:%M:%S')"
echo "══════════════════════════════════════════"

# Show the live logs
echo "📜 Tailing live logs... (Press CTRL+C to exit logs)"
echo "--------------------------------------"
pm2 logs $PM2_APP_NAME --lines 20

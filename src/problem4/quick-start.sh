#!/bin/bash

echo "🚀 Express CRUD API - Quick Start Setup"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo "✅ npm version: $(npm -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check if .env file exists
if [ ! -f .env ]; then
    echo ""
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created"
fi

# Build the project
echo ""
echo "🔨 Building TypeScript files..."
npm run build

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the server:"
echo "  Development mode: npm run dev"
echo "  Production mode:  npm start"
echo ""
echo "API will be available at: http://localhost:3000/api/v1"
echo "Health check endpoint: http://localhost:3000/health"
echo ""
echo "Check README.md for API documentation and examples."

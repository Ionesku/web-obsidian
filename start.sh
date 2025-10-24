#!/bin/bash

# Obsidian Web - Quick Start Script
echo "🚀 Starting Obsidian Web..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose exists
if ! command -v docker-compose &> /dev/null; then
    echo "⚠️  docker-compose not found. Using 'docker compose' instead."
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
$DOCKER_COMPOSE down

# Build images
echo "🔨 Building Docker images..."
$DOCKER_COMPOSE build

# Start services
echo "▶️  Starting services..."
$DOCKER_COMPOSE up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 5

# Check status
echo ""
echo "✅ Services status:"
$DOCKER_COMPOSE ps

echo ""
echo "🎉 Obsidian Web is running!"
echo ""
echo "📱 Access the application:"
echo "   Frontend: http://0.0.0.0:80"
echo "   Backend API: http://0.0.0.0:8000"
echo "   API Docs: http://0.0.0.0:8000/docs"
echo ""
echo "📊 View logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Stop services:"
echo "   docker-compose down"


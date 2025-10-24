.PHONY: help install dev build up down logs test clean

help: ## Show this help
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

dev-backend: ## Run backend in development mode
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Run frontend in development mode
	cd frontend && npm run dev

dev: ## Run both backend and frontend in development
	@echo "Starting development servers..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:5173"
	@make -j2 dev-backend dev-frontend

build: ## Build Docker images
	docker-compose build

up: ## Start services with Docker
	docker-compose up -d
	@echo "Services started!"
	@echo "Frontend: http://0.0.0.0"
	@echo "Backend API: http://0.0.0.0:8000"
	@echo "API Docs: http://0.0.0.0:8000/docs"

down: ## Stop services
	docker-compose down

logs: ## Show Docker logs
	docker-compose logs -f

restart: ## Restart services
	docker-compose restart

ps: ## Show running containers
	docker-compose ps

test-backend: ## Run backend tests
	cd backend && pytest tests/ -v

test-frontend: ## Run frontend tests  
	cd frontend && npm test

test: test-backend ## Run all tests

lint-backend: ## Lint backend code
	cd backend && black --check app/
	cd backend && flake8 app/ --max-line-length=100

format-backend: ## Format backend code
	cd backend && black app/

clean: ## Clean up generated files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	cd frontend && rm -rf dist/ node_modules/.vite/

backup: ## Create backup of data
	@echo "Creating backup..."
	tar -czf backup-$$(date +%Y%m%d-%H%M%S).tar.gz data/
	@echo "Backup created!"

migrate: ## Run database migrations (placeholder)
	@echo "No migrations yet. Add Alembic for migrations."

shell-backend: ## Open backend container shell
	docker-compose exec backend /bin/bash

shell-frontend: ## Open frontend container shell
	docker-compose exec frontend /bin/sh

db-shell: ## Open database shell
	docker-compose exec backend python -c "from app.database import SessionLocal; from app.models import User; db = SessionLocal(); print('Database shell ready. Use db variable.'); import IPython; IPython.embed()"

prod-check: ## Check production readiness
	@echo "Checking production configuration..."
	@echo "1. SECRET_KEY should be changed"
	@grep -q "change-me-in-production" backend/.env && echo "❌ Change SECRET_KEY!" || echo "✅ SECRET_KEY looks good"
	@echo "2. CORS origins should be set correctly"
	@grep "CORS_ORIGINS" backend/.env
	@echo "3. Database should be backed up regularly"
	@echo "4. HTTPS should be configured"
	@echo "5. Firewall should be configured"


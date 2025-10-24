# Troubleshooting Guide

## Docker Build Errors

### Error: "failed to read dockerfile: no such file or directory"

**Причина:** Docker не может найти Dockerfile

**Решение:**
```bash
# 1. Убедитесь, что вы в корневой директории проекта
pwd  # должно показать путь к obsidian/

# 2. Проверьте наличие Dockerfile
ls -la backend/Dockerfile
ls -la frontend/Dockerfile

# 3. Если запускаете из другой директории
cd /path/to/obsidian
docker-compose up -d
```

### Error: "version is obsolete"

**Решение:** Это просто предупреждение, не критично. Уже исправлено в новой версии docker-compose.yml

```bash
# Используйте новую версию без поля version
docker-compose up -d
```

### Error: "Cannot connect to Docker daemon"

**Решение:**
```bash
# Linux
sudo systemctl start docker
sudo systemctl status docker

# Windows/Mac
# Запустите Docker Desktop

# Проверьте
docker info
```

## Build Errors

### Frontend: "npm install fails"

**Решение:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Backend: "pip install fails"

**Решение:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
```

## Port Already in Use

### Error: "port 80 is already allocated"

**Решение:**
```bash
# Найти процесс использующий порт 80
# Linux/Mac
sudo lsof -i :80
sudo kill -9 <PID>

# Windows
netstat -ano | findstr :80
taskkill /PID <PID> /F

# Или измените порт в docker-compose.yml
ports:
  - "8080:80"  # Вместо "80:80"
```

### Error: "port 8000 is already allocated"

**Решение:**
```bash
# Остановите другие контейнеры
docker-compose down
docker ps -a
docker stop <container_id>

# Или измените порт
ports:
  - "8001:8000"
```

## CORS Errors

### Error: "CORS policy blocked"

**Решение:**
```bash
# 1. Проверьте CORS_ORIGINS в docker-compose.yml
environment:
  - CORS_ORIGINS=http://0.0.0.0:80,http://localhost:80

# 2. Перезапустите backend
docker-compose restart backend

# 3. Проверьте в браузере
# Откройте DevTools -> Network -> Headers
# Убедитесь что Origin совпадает с CORS_ORIGINS
```

## Database Errors

### Error: "database locked"

**Решение:**
```bash
# 1. Остановите все сервисы
docker-compose down

# 2. Удалите lock файлы
rm -f data/*.db-shm
rm -f data/*.db-wal

# 3. Запустите снова
docker-compose up -d
```

### Error: "table does not exist"

**Решение:**
```bash
# Пересоздайте базу данных
docker-compose down
rm -f data/app.db
docker-compose up -d

# База создастся автоматически при первом запуске
```

## Authentication Issues

### Error: "Invalid token"

**Решение:**
```bash
# 1. Очистите localStorage в браузере
# DevTools -> Application -> Local Storage -> Clear

# 2. Перелогиньтесь

# 3. Проверьте SECRET_KEY
docker-compose exec backend env | grep SECRET_KEY
```

### Error: "User not found"

**Решение:**
```bash
# Зарегистрируйте пользователя заново
# Или проверьте базу данных

docker-compose exec backend python -c "
from app.database import SessionLocal
from app.models import User
db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f'{u.id}: {u.username} - {u.email}')
"
```

## Performance Issues

### Slow Build Times

**Решение:**
```bash
# Используйте BuildKit
export DOCKER_BUILDKIT=1
docker-compose build

# Очистите кеш
docker builder prune

# Используйте кеш слоев
docker-compose build --parallel
```

### High Memory Usage

**Решение:**
```bash
# Ограничьте память в docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 512M

# Очистите неиспользуемые образы
docker system prune -a
```

## File Permission Issues

### Error: "Permission denied"

**Решение:**
```bash
# Linux
sudo chown -R $USER:$USER data/
chmod -R 755 data/

# Docker
docker-compose down
sudo rm -rf data/
mkdir data
docker-compose up -d
```

## Network Issues

### Error: "Cannot connect to backend"

**Решение:**
```bash
# 1. Проверьте что backend запущен
docker-compose ps

# 2. Проверьте логи
docker-compose logs backend

# 3. Проверьте network
docker network ls
docker network inspect obsidian-network

# 4. Пересоздайте сеть
docker-compose down
docker network prune
docker-compose up -d
```

## Debugging

### View Logs

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f frontend

# Последние 100 строк
docker-compose logs --tail=100 backend
```

### Access Container Shell

```bash
# Backend
docker-compose exec backend /bin/bash

# Frontend
docker-compose exec frontend /bin/sh

# Run commands inside
docker-compose exec backend python
docker-compose exec backend pytest
```

### Check Container Health

```bash
# Status
docker-compose ps

# Health checks
docker inspect obsidian-backend | grep -A 10 Health
docker inspect obsidian-frontend | grep -A 10 Health

# Restart unhealthy containers
docker-compose restart backend
```

## Clean Start

Если ничего не помогает, попробуйте чистый старт:

```bash
# 1. Остановите и удалите всё
docker-compose down -v
docker system prune -a --volumes

# 2. Удалите данные (ОСТОРОЖНО!)
rm -rf data/
rm -rf backend/__pycache__
rm -rf backend/.pytest_cache

# 3. Пересоздайте
mkdir data
docker-compose build --no-cache
docker-compose up -d

# 4. Проверьте статус
docker-compose ps
docker-compose logs -f
```

## Still Having Issues?

1. **Проверьте README.md** - основная документация
2. **Проверьте DEPLOYMENT.md** - детали деплоя
3. **Посмотрите Issues на GitHub** - возможно проблема уже решена
4. **Создайте новый Issue** с подробным описанием:
   - Ваша ОС и версия
   - Docker версия: `docker --version`
   - docker-compose версия: `docker-compose --version`
   - Полный вывод ошибки
   - Логи: `docker-compose logs`

## Quick Commands Reference

```bash
# Полезные команды для отладки
docker-compose config          # Проверить конфигурацию
docker-compose build --no-cache # Пересобрать без кеша
docker-compose up --force-recreate # Пересоздать контейнеры
docker-compose restart         # Перезапустить
docker stats                   # Использование ресурсов
docker-compose exec backend env # Посмотреть env переменные
```


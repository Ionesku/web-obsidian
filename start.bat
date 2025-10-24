@echo off
REM Obsidian Web - Quick Start Script for Windows

echo.
echo Starting Obsidian Web...
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)

REM Stop existing containers
echo Stopping existing containers...
docker-compose down

REM Build images
echo Building Docker images...
docker-compose build

if errorlevel 1 (
    echo.
    echo Build failed! Please check the errors above.
    echo.
    echo Common issues:
    echo - Make sure you are in the project root directory
    echo - Check if Dockerfile exists in backend/ and frontend/ folders
    echo - Ensure all dependencies are properly configured
    pause
    exit /b 1
)

REM Start services
echo Starting services...
docker-compose up -d

REM Wait for services
echo Waiting for services to start...
timeout /t 5 /nobreak >nul

REM Check status
echo.
echo Services status:
docker-compose ps

echo.
echo ================================
echo Obsidian Web is running!
echo ================================
echo.
echo Access the application:
echo   Frontend: http://0.0.0.0:80
echo   Backend API: http://0.0.0.0:8000
echo   API Docs: http://0.0.0.0:8000/docs
echo.
echo View logs:
echo   docker-compose logs -f
echo.
echo Stop services:
echo   docker-compose down
echo.
pause


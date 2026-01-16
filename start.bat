@echo off
REM Script to start the Book Manager server

echo 🚀 Starting Book Manager...

REM Check if node_modules exists
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

REM Check if dbpath.conf exists
if not exist "dbpath.conf" (
    echo ⚠️  dbpath.conf not found!
    echo Please copy dbpath.conf.example to dbpath.conf and update the database path.
    pause
    exit /b 1
)

REM Start the server
echo 📚 Server starting on http://localhost:3100
call npm start

pause

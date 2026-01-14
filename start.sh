#!/bin/bash

# Script to start the Urania Web Book Manager server

echo "🚀 Starting Urania Book Manager..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if dbpath.conf exists
if [ ! -f "dbpath.conf" ]; then
    echo "⚠️  dbpath.conf not found!"
    echo "Please copy dbpath.conf.example to dbpath.conf and update the database path."
    exit 1
fi

# Start the server
echo "📚 Server starting on http://localhost:3100"
npm start

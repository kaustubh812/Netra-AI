#!/bin/bash
# Netra — Setup Script
echo "═══════════════════════════════════════════"
echo "  Netra (नेत्र) — Setup"
echo "  The eye that sees the market"
echo "═══════════════════════════════════════════"
echo ""

# Backend
echo "[1/2] Installing Python dependencies..."
cd backend
pip install -r requirements.txt
cd ..

# Frontend
echo "[2/2] Installing Node.js dependencies..."
cd frontend
npm install
cd ..

echo ""
echo "Setup complete! Next steps:"
echo "  1. make fetch-data   — Download market data"
echo "  2. make train        — Train ML models"
echo "  3. make backend      — Start API server (terminal 1)"
echo "  4. make frontend     — Start web UI (terminal 2)"

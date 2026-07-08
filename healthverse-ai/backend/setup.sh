#!/bin/bash
# Backend setup - run this instead of typing each step by hand.
# From the backend/ directory: bash setup.sh
set -e

echo "== Creating virtual environment =="
python3 -m venv venv
source venv/bin/activate

echo "== Installing dependencies =="
pip install -r requirements.txt

if [ ! -f .env ]; then
  echo "== Creating .env from template =="
  cp .env.example .env
  echo "  -> Edit .env now and paste in your real OpenAI API key before continuing."
else
  echo "== .env already exists, leaving it alone =="
fi

echo ""
echo "== Running smoke test (verifies the code itself, not the server) =="
python3 -m app.smoke_test

echo ""
echo "Setup complete. Next steps:"
echo "  1. Make sure .env has your real OpenAI key (not the placeholder)"
echo "  2. source venv/bin/activate    (if this shell isn't already in the venv)"
echo "  3. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo "  4. Open http://localhost:8000/docs to confirm it's running"

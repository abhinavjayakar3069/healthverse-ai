#!/bin/bash
# Run from the healthverse-ai root: bash run.sh
set -e

echo "== Backend =="
cd backend
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install -r requirements.txt -q
[ -f .env ] || cp .env.example .env
python3 -m app.smoke_test
echo ""
echo "!! Add your real OpenAI key to backend/.env now if you haven't. !!"
echo ""
echo "Starting backend on :8000 in the background..."
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/healthverse-backend.log 2>&1 &
echo "Backend PID: $!  (logs: /tmp/healthverse-backend.log)"
sleep 2
curl -s http://localhost:8000/ && echo "" && echo "Backend is up."
cd ..

echo ""
echo "== Mobile =="
echo "Backend is running in the background. Now:"
echo "  1. cd mobile && bash setup.sh"
echo "  2. Copy App.js + src/ into the generated healthverse-mobile/ project"
echo "  3. In src/api/client.js, set API_BASE_URL to this machine's LAN IP"
echo "     (run 'ipconfig getifaddr en0' on Mac / 'hostname -I' on Linux to find it)"
echo "  4. cd healthverse-mobile && npx expo start"
echo ""
echo "To stop the backend later: kill $!"

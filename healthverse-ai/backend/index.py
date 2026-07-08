"""
Vercel's Python runtime looks for an entrypoint file named app.py, index.py,
server.py, main.py, wsgi.py, or asgi.py sitting at the root of whatever
"Root Directory" is configured in Project Settings, and expects a top-level
variable called `app` there. Our real FastAPI app lives one level deeper, at
app/main.py (so it can be imported cleanly as `app.main` from tests, the
smoke test, etc.) - this file just re-exports it so Vercel can find it
without moving anything.

This has no effect on Render, which uses `uvicorn app.main:app` directly per
render.yaml and never looks at this file.
"""
from app.main import app  # noqa: F401  (re-exported for Vercel's entrypoint detection)

# Deployment Guide

## Architecture

- Deploy the FastAPI backend on Render.
- Deploy the React frontend on Vercel.
- Point the Vercel app to the Render API by setting `VITE_API_BASE_URL`.
- Back the API with PostgreSQL by setting `DATABASE_URL` on the backend service.

## Render Backend

### Option 1: Use `render.yaml`

1. Push this repository to GitHub.
2. In Render, choose `New +` -> `Blueprint`.
3. Select the repository.
4. Render will pick up [render.yaml](render.yaml) and create the backend service.

### Option 2: Create the web service manually

- Root directory: `backend`
- Runtime: `Python 3.11`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### Required Render environment variables

- `DATABASE_URL=postgresql://...`
- `LMS_DATA_DIR=/var/data`

### Optional Render environment variables

- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_DEPLOYMENT`
- `AZURE_OPENAI_API_VERSION`

### Important Render note

This app now stores application data in PostgreSQL, but curriculum uploads still write to local storage. Keep the persistent disk mounted at `/var/data` if you use file uploads. The provided [render.yaml](render.yaml) keeps that disk attached.

## Vercel Frontend

1. Import the same GitHub repository into Vercel.
2. Set the project root to `frontend`.
3. Framework preset: `Vite`.
4. Build command: `npm run build`
5. Output directory: `dist`

### Required Vercel environment variable

- `VITE_API_BASE_URL=https://YOUR-RENDER-SERVICE.onrender.com`

Example:

```env
VITE_API_BASE_URL=https://lms-nomination-backend.onrender.com
```

## Post-deploy checks

1. Open the Render URL and verify `/docs` loads.
2. Open the Vercel URL and verify login works.
3. Create a course request and confirm dashboard/API data loads.
4. Upload a curriculum file and confirm the download link opens from the Render domain.

## Notes

- Local Vite proxy is only for development. Production traffic uses `VITE_API_BASE_URL`.
- If you change the Render backend URL later, update `VITE_API_BASE_URL` in Vercel and redeploy.
- The backend reads PostgreSQL from `DATABASE_URL` and falls back to local SQLite only when that variable is not set.
- If Azure OpenAI variables are missing, the portal still runs but AI-powered features fall back or return limited behavior depending on the endpoint.
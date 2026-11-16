# Photosort

Photosort groups similar images, flags blurry photos, and exports your selected images as a ZIP.

## Requirements

- Python 3.10 or newer
- Node.js 20.9 or newer

## Run locally

1. Install the backend packages from `backend/requirements.txt` in a virtual environment.
2. Start the API from `backend/` with `python -m uvicorn main:app --reload`.
3. Copy `frontend/.env.example` to `frontend/.env.local` and set `NEXT_PUBLIC_API_URL` to the API origin.
4. In `frontend/`, run `npm ci` and `npm run dev`.

The first backend run downloads the pretrained Torch vision model weights. Set `CORS_ORIGINS` to a comma-separated list of frontend origins when running across separate hosts.

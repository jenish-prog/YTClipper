# YTClipper ✂️▶️

A fast, modern web application for downloading and trimming YouTube videos in any available quality (up to 4K/60fps) or audio formats. Powered by **FastAPI**, **yt-dlp**, **FFmpeg**, and **React 19 (Vite)**.

![YTClipper](https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Supported-2496ED?style=for-the-badge&logo=docker&logoColor=white)

---

## ✨ Features

- 🎥 **High Quality Video Downloads**: Download videos up to 4K/60fps with merged audio track.
- 🎵 **Audio Extraction**: Download standalone audio tracks in MP3/M4A format.
- ✂️ **Precision Trimming**: Specify custom start and end timestamps to download only the clip you need.
- ⚡ **Streamed Downloads**: Automatic HTTP content disposition and clean temporary file cleanup.
- 🎨 **Modern Aesthetic UI**: Vibrant dark mode UI with interactive format selector and duration preview.
- 🐳 **Docker-Ready**: Multi-stage Docker build ready for instant single-container deployment on Railway.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Modern CSS3
- **Backend**: FastAPI, `yt-dlp`, Uvicorn, Python 3.11
- **Media Engine**: FFmpeg (handles audio extraction and video stream merging)
- **Deployment**: Docker, Railway, Render, Vercel

---

## 🚀 Quick Start (Local Development)

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** (v18+)
- **Python** (v3.10+)
- **FFmpeg** (`brew install ffmpeg` on macOS or `sudo apt install ffmpeg` on Linux)

---

### 1. Clone the Repository

```bash
git clone https://github.com/jenish-prog/YTClipper.git
cd YTClipper
```

---

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start FastAPI dev server
uvicorn main:app --reload --port 8000
```

The backend server will run on `http://127.0.0.1:8000`.

---

### 3. Frontend Setup

In a new terminal window:

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The frontend application will open at `http://localhost:5173`.

---

## 🐳 Docker Deployment (Railway / Render / Self-Hosted)

YTClipper includes a multi-stage `Dockerfile` that builds the React frontend and packages it inside a unified FastAPI container with FFmpeg pre-installed.

### Run with Docker Locally

```bash
# Build the Docker image
docker build -t ytclipper .

# Run the container
docker run -p 8000:8000 ytclipper
```

Access your complete full-stack app at `http://localhost:8000`.

---

## ☁️ Deploying to Railway (Recommended)

1. Push this repository to your GitHub account.
2. Log into [Railway.app](https://railway.app) and create a **New Project**.
3. Select **Deploy from GitHub repo** and pick `YTClipper`.
4. Railway will automatically detect the root `Dockerfile`, build the application, and expose port `8000`.
5. Under **Settings -> Networking**, click **Generate Domain** to get your public live URL!

---

## 📡 API Reference

### 1. Fetch Video Metadata
```http
POST /api/info
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

### 2. Download / Trim Video
```http
POST /api/download
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "format_id": "313",
  "start_time": 0,
  "end_time": 30
}
```

### 3. System Health Check
```http
GET /api/health
```

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more details.

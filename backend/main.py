import os
import re
import ssl
import uuid
import time
import asyncio
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import yt_dlp

# Fix SSL certificates on macOS
try:
    import certifi
    os.environ['SSL_CERT_FILE'] = certifi.where()
except ImportError:
    pass

# Fallback: disable SSL verification if certificates are not available
try:
    ssl._create_default_https_context = ssl._create_unverified_context
except AttributeError:
    pass

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="YouTube Downloader API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Temp directory for downloads
TEMP_DIR = Path(tempfile.gettempdir()) / "ytc_downloads"
TEMP_DIR.mkdir(exist_ok=True)

# ─── Models ───────────────────────────────────────────────────────────────────

class VideoURLRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format_id: str
    start_time: Optional[float] = None
    end_time: Optional[float] = None

class FormatInfo(BaseModel):
    format_id: str
    label: str
    ext: str
    has_audio: bool
    has_video: bool
    filesize: Optional[int] = None
    quality_sort: int = 0

class VideoInfo(BaseModel):
    video_id: str
    title: str
    thumbnail: str
    duration: int
    channel: str
    formats: list[FormatInfo]

# ─── Helpers ──────────────────────────────────────────────────────────────────

YOUTUBE_URL_REGEX = re.compile(
    r'(https?://)?(www\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)[\w-]+'
)

def validate_youtube_url(url: str) -> bool:
    return bool(YOUTUBE_URL_REGEX.match(url))

DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

# Browser to use for cookie authentication (override with COOKIE_BROWSER env var)
# Set to a browser name (e.g. "brave", "chrome") to enable cookie usage locally
_COOKIE_BROWSER = os.environ.get("COOKIE_BROWSER", "")
if _COOKIE_BROWSER:
    print(f"[YTClipper] Will use cookies from: {_COOKIE_BROWSER}")
else:
    print("[YTClipper] Cookie-based auth disabled. Set COOKIE_BROWSER=brave to enable.")

def get_base_ydl_opts() -> dict:
    opts = {
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": True,
        "user_agent": DEFAULT_USER_AGENT,
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "ios", "mweb", "web"],
            }
        },
    }
    if _COOKIE_BROWSER:
        opts["cookiesfrombrowser"] = (_COOKIE_BROWSER,)
    return opts

def format_resolution_label(f: dict) -> str:
    """Create a human-readable label for a format."""
    height = f.get("height")
    fps = f.get("fps")
    acodec = f.get("acodec", "none")
    vcodec = f.get("vcodec", "none")

    has_video = vcodec != "none" and vcodec is not None
    has_audio = acodec != "none" and acodec is not None

    if has_video and height:
        label = f"{height}p"
        if height >= 2160:
            label += " (4K)"
        elif height >= 1440:
            label += " (2K)"
        if fps and fps > 30:
            label += f" {fps}fps"
        if has_audio:
            label += " • has audio"
        return label
    elif has_audio and not has_video:
        abr = f.get("abr") or f.get("tbr")
        ext = f.get("ext", "?")
        if abr:
            return f"Audio Only • {int(abr)}kbps ({ext})"
        return f"Audio Only ({ext})"
    else:
        return f.get("format", "Unknown")

def get_quality_sort_key(f: dict) -> int:
    """Higher number = higher quality. Used for sorting."""
    height = f.get("height") or 0
    vcodec = f.get("vcodec", "none")
    has_video = vcodec != "none" and vcodec is not None
    if has_video:
        return int(height * 100 + (f.get("fps") or 30))
    # Audio-only gets negative sort so it shows at the end
    return int(-(f.get("abr") or f.get("tbr") or 0))

def cleanup_old_files():
    """Delete temp files older than 10 minutes."""
    cutoff = time.time() - 600
    if TEMP_DIR.exists():
        for item in TEMP_DIR.iterdir():
            try:
                if item.stat().st_mtime < cutoff:
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        item.unlink()
            except Exception:
                pass

def cleanup_path(path: Path):
    """Delete a specific file or directory."""
    try:
        if path.is_dir():
            shutil.rmtree(path)
        elif path.exists():
            path.unlink()
    except Exception:
        pass

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/api/info", response_model=VideoInfo)
async def get_video_info(request: VideoURLRequest):
    """Fetch video metadata and available formats."""
    url = request.url.strip()

    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL. Please provide a valid YouTube video link.")

    ydl_opts = get_base_ydl_opts()
    ydl_opts["skip_download"] = True

    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, lambda: _extract_info(url, ydl_opts))
    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if "Private video" in error_msg or "private" in error_msg.lower():
            raise HTTPException(status_code=403, detail="This video is private and cannot be accessed.")
        elif "age" in error_msg.lower() and "restricted" in error_msg.lower():
            raise HTTPException(status_code=403, detail="This video is age-restricted and cannot be downloaded without authentication.")
        elif "unavailable" in error_msg.lower() or "not available" in error_msg.lower():
            raise HTTPException(status_code=404, detail="This video is unavailable. It may have been removed or is not accessible in your region.")
        elif "Sign in" in error_msg:
            raise HTTPException(status_code=403, detail="This video requires sign-in to access.")
        else:
            raise HTTPException(status_code=400, detail=f"Could not fetch video info: {error_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

    if not info:
        raise HTTPException(status_code=404, detail="Could not retrieve video information.")

    # Process formats - deduplicate and create clean list
    raw_formats = info.get("formats", [])
    seen_labels = set()
    formats = []

    # Sort by quality (highest first for video, highest bitrate first for audio)
    sorted_formats = sorted(raw_formats, key=lambda f: get_quality_sort_key(f), reverse=True)

    for f in sorted_formats:
        vcodec = f.get("vcodec", "none")
        acodec = f.get("acodec", "none")
        has_video = vcodec != "none" and vcodec is not None
        has_audio = acodec != "none" and acodec is not None

        # Skip formats with no audio and no video, or storyboard formats
        if not has_video and not has_audio:
            continue
        if f.get("format_note", "").lower() == "storyboard":
            continue

        label = format_resolution_label(f)

        # Deduplicate by label (keep first = highest quality for that resolution)
        if label in seen_labels:
            continue
        seen_labels.add(label)

        formats.append(FormatInfo(
            format_id=f.get("format_id", ""),
            label=label,
            ext=f.get("ext", "mp4"),
            has_audio=has_audio,
            has_video=has_video,
            filesize=f.get("filesize") or f.get("filesize_approx"),
            quality_sort=get_quality_sort_key(f),
        ))

    # Get the best thumbnail
    thumbnails = info.get("thumbnails", [])
    thumbnail = info.get("thumbnail", "")
    if thumbnails:
        # Pick the highest resolution thumbnail
        best_thumb = max(thumbnails, key=lambda t: (t.get("width", 0) or 0) * (t.get("height", 0) or 0))
        thumbnail = best_thumb.get("url", thumbnail)

    return VideoInfo(
        video_id=info.get("id", ""),
        title=info.get("title", "Unknown Title"),
        thumbnail=thumbnail,
        duration=info.get("duration", 0) or 0,
        channel=info.get("channel", info.get("uploader", "Unknown")),
        formats=formats,
    )


def _extract_info(url: str, opts: dict) -> dict:
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False)


def _make_download_range(start: float, end: float):
    """Create a download_ranges callback for yt-dlp to download only a segment."""
    def callback(info_dict, ydl):
        return [{"start_time": start, "end_time": end}]
    return callback


@app.post("/api/download")
async def download_video(request: DownloadRequest, background_tasks: BackgroundTasks):
    """Download, optionally trim, and return the video file."""
    url = request.url.strip()

    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL.")

    # Create a unique temp directory for this download
    task_id = str(uuid.uuid4())[:8]
    task_dir = TEMP_DIR / task_id
    task_dir.mkdir(exist_ok=True)

    # Schedule cleanup after download completes
    background_tasks.add_task(cleanup_path, task_dir)
    background_tasks.add_task(cleanup_old_files)

    try:
        # First, get format info to determine if we need to merge audio
        info_opts = get_base_ydl_opts()
        info_opts["skip_download"] = True
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, lambda: _extract_info(url, info_opts))

        selected_format = None
        for f in info.get("formats", []):
            if f.get("format_id") == request.format_id:
                selected_format = f
                break

        if not selected_format:
            raise HTTPException(status_code=400, detail="Selected format is no longer available.")

        has_video = (selected_format.get("vcodec", "none") != "none" and 
                     selected_format.get("vcodec") is not None)
        has_audio = (selected_format.get("acodec", "none") != "none" and 
                     selected_format.get("acodec") is not None)

        video_title = re.sub(r'[^\w\s-]', '', info.get("title", "video")).strip()
        video_title = re.sub(r'\s+', '_', video_title)

        # Build yt-dlp options
        output_template = str(task_dir / "%(id)s.%(ext)s")

        # Determine if trimming is needed
        needs_trim = (
            request.start_time is not None and 
            request.end_time is not None and
            (request.start_time > 0 or request.end_time < (info.get("duration", 0) or 0))
        )

        ydl_opts = get_base_ydl_opts()
        ydl_opts["outtmpl"] = output_template

        if has_video and not has_audio:
            # Video-only: download selected video + best audio and merge
            ydl_opts["format"] = f"{request.format_id}+bestaudio/best"
            ydl_opts["merge_output_format"] = "mp4"
        elif not has_video and has_audio:
            # Audio-only
            ydl_opts["format"] = request.format_id
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]
        else:
            # Has both audio and video
            ydl_opts["format"] = request.format_id

        # If trimming, use yt-dlp's --download-sections to only download the segment
        # This avoids downloading the entire video first
        if needs_trim:
            ydl_opts["download_ranges"] = _make_download_range(request.start_time, request.end_time)
            ydl_opts["force_keyframes_at_cuts"] = True

        # Download the file (with trim baked in if needed)
        await loop.run_in_executor(None, lambda: _download(url, ydl_opts))

        # Find the downloaded file
        downloaded_files = [f for f in task_dir.iterdir() if not f.name.startswith('.')]
        if not downloaded_files:
            raise HTTPException(status_code=500, detail="Download failed - no output file produced.")

        downloaded_file = downloaded_files[0]

        # Determine content type
        ext = downloaded_file.suffix.lstrip(".")
        content_type_map = {
            "mp4": "video/mp4",
            "webm": "video/webm",
            "mkv": "video/x-matroska",
            "mp3": "audio/mpeg",
            "m4a": "audio/mp4",
            "ogg": "audio/ogg",
            "opus": "audio/opus",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")
        filename = f"{video_title}.{ext}"
        ascii_title = re.sub(r'[^\x00-\x7F]+', '_', video_title).strip('_')
        if not ascii_title:
            ascii_title = "video"
        ascii_filename = f"{ascii_title}.{ext}"
        encoded_filename = quote(filename)

        # Stream the file back
        return FileResponse(
            path=str(downloaded_file),
            media_type=content_type,
            filename=filename,
            headers={
                "Content-Disposition": f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )

    except HTTPException:
        raise
    except yt_dlp.utils.DownloadError as e:
        raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


def _download(url: str, opts: dict):
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])


@app.post("/api/thumbnail")
async def download_thumbnail(request: VideoURLRequest):
    """Download and return the video's thumbnail image."""
    url = request.url.strip()

    if not validate_youtube_url(url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL.")

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "nocheckcertificate": True,
    }

    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, lambda: _extract_info(url, ydl_opts))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not fetch video info: {str(e)}")

    if not info:
        raise HTTPException(status_code=404, detail="Could not retrieve video information.")

    # Get the best thumbnail URL
    thumbnails = info.get("thumbnails", [])
    thumbnail_url = info.get("thumbnail", "")
    if thumbnails:
        best_thumb = max(thumbnails, key=lambda t: (t.get("width", 0) or 0) * (t.get("height", 0) or 0))
        thumbnail_url = best_thumb.get("url", thumbnail_url)

    if not thumbnail_url:
        raise HTTPException(status_code=404, detail="No thumbnail available for this video.")

    # Download the thumbnail image
    import urllib.request

    try:
        req = urllib.request.Request(thumbnail_url, headers={"User-Agent": "Mozilla/5.0"})
        # Try with default SSL first, fall back to no-verify if needed
        try:
            ctx = ssl.create_unverified_context()
        except AttributeError:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        thumb_response = await loop.run_in_executor(None, lambda: urllib.request.urlopen(req, context=ctx))
        image_data = await loop.run_in_executor(None, thumb_response.read)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download thumbnail: {str(e)}")

    # Determine filename
    video_title = re.sub(r'[^\w\s-]', '', info.get("title", "thumbnail")).strip()
    video_title = re.sub(r'\s+', '_', video_title)

    # Detect content type from URL
    content_type = "image/jpeg"
    ext = "jpg"
    if ".webp" in thumbnail_url:
        content_type = "image/webp"
        ext = "webp"
    elif ".png" in thumbnail_url:
        content_type = "image/png"
        ext = "png"

    filename = f"{video_title}_thumbnail.{ext}"
    ascii_title = re.sub(r'[^\x00-\x7F]+', '_', video_title).strip('_')
    if not ascii_title:
        ascii_title = "thumbnail"
    ascii_filename = f"{ascii_title}_thumbnail.{ext}"
    encoded_filename = quote(filename)

    return StreamingResponse(
        iter([image_data]),
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{encoded_filename}',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


# ─── Startup / Shutdown ──────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    cleanup_old_files()

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    # Check if ffmpeg is available
    try:
        subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
        ffmpeg_available = True
    except Exception:
        ffmpeg_available = False

    return {
        "status": "ok",
        "ffmpeg": ffmpeg_available,
        "yt_dlp_version": yt_dlp.version.__version__,
    }


# ─── Static Frontend Serving ──────────────────────────────────────────────────

static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    assets_dir = static_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        file_path = static_dir / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")


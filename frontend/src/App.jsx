import { useState, useCallback } from 'react'
import URLInput from './components/URLInput.jsx'
import VideoPreview from './components/VideoPreview.jsx'
import QualitySelector from './components/QualitySelector.jsx'
import TimeRangePicker from './components/TimeRangePicker.jsx'
import DownloadButton from './components/DownloadButton.jsx'
import ErrorMessage from './components/ErrorMessage.jsx'
import { API_BASE } from './utils.js'

export default function App() {
  // ── State ────────────────────────────────────────────────────────────────
  const [videoInfo, setVideoInfo] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [selectedFormat, setSelectedFormat] = useState('')
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStage, setDownloadStage] = useState('')
  const [error, setError] = useState(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)

  // ── Fetch Video Info ─────────────────────────────────────────────────────
  const handleFetchInfo = useCallback(async (url) => {
    setIsLoading(true)
    setError(null)
    setVideoInfo(null)
    setDownloadSuccess(false)
    setVideoUrl(url)

    try {
      const response = await fetch(`${API_BASE}/api/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Server error (${response.status})`)
      }

      const data = await response.json()
      setVideoInfo(data)

      // Default to highest quality video format
      if (data.formats && data.formats.length > 0) {
        const videoFormats = data.formats.filter(f => f.has_video)
        if (videoFormats.length > 0) {
          setSelectedFormat(videoFormats[0].format_id)
        } else {
          setSelectedFormat(data.formats[0].format_id)
        }
      }

      // Set time range to full video
      setStartTime(0)
      setEndTime(data.duration || 0)
    } catch (err) {
      setError(err.message || 'Failed to fetch video info. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Download Video ───────────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!videoInfo || !selectedFormat) return

    setIsDownloading(true)
    setDownloadStage('Downloading...')
    setError(null)
    setDownloadSuccess(false)

    try {
      // Brief delay to show the downloading stage before switching
      setTimeout(() => {
        setDownloadStage('Processing...')
      }, 3000)

      const response = await fetch(`${API_BASE}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: videoUrl,
          format_id: selectedFormat,
          start_time: startTime,
          end_time: endTime,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Download failed (${response.status})`)
      }

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'download.mp4'
      if (contentDisposition) {
        const utf8Match = contentDisposition.match(/filename\*=utf-8''([^;]+)/i)
        if (utf8Match) {
          try {
            filename = decodeURIComponent(utf8Match[1])
          } catch {
            filename = utf8Match[1]
          }
        } else {
          const match = contentDisposition.match(/filename="?([^";]+)"?/i)
          if (match) filename = match[1]
        }
      }

      // Create blob and trigger download
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

      setDownloadSuccess(true)
    } catch (err) {
      setError(err.message || 'Download failed. Please try again.')
    } finally {
      setIsDownloading(false)
      setDownloadStage('')
    }
  }, [videoInfo, videoUrl, selectedFormat, startTime, endTime])

  // ── Time Range Handler ───────────────────────────────────────────────────
  const handleTimeChange = useCallback((start, end) => {
    setStartTime(start)
    setEndTime(end)
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Animated background */}
      <div className="app-background">
        <div className="bg-orb-3" />
      </div>

      <div className="app-container">
        {/* Header */}
        <header className="app-header">
          <div className="app-logo">
            <div className="logo-icon">▶</div>
          </div>
          <h1 className="app-title">YTClipper</h1>
          <p className="app-subtitle">Download &amp; trim YouTube videos in any quality</p>
        </header>

        {/* Error message */}
        <ErrorMessage error={error} onDismiss={() => setError(null)} />

        {/* URL Input */}
        <URLInput onSubmit={handleFetchInfo} isLoading={isLoading} />

        {/* Loading state */}
        {isLoading && (
          <div className="loading-section">
            <div className="spinner spinner-large" />
            <p className="loading-text">Fetching video information...</p>
          </div>
        )}

        {/* Video info sections (shown after fetch) */}
        {videoInfo && !isLoading && (
          <>
            <VideoPreview videoInfo={videoInfo} videoUrl={videoUrl} />

            <QualitySelector
              formats={videoInfo.formats}
              selectedFormat={selectedFormat}
              onSelect={setSelectedFormat}
            />

            {videoInfo.duration > 0 && (
              <TimeRangePicker
                duration={videoInfo.duration}
                startTime={startTime}
                endTime={endTime}
                onChange={handleTimeChange}
              />
            )}

            <DownloadButton
              onClick={handleDownload}
              isDownloading={isDownloading}
              downloadStage={downloadStage}
            />

            {downloadSuccess && (
              <div className="success-message">
                <span className="success-icon">✅</span>
                <span className="success-text">Download complete! Check your downloads folder.</span>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="app-footer">
          <p className="footer-text">
            YTClipper — Powered by yt-dlp &amp; ffmpeg
          </p>
        </footer>
      </div>
    </>
  )
}

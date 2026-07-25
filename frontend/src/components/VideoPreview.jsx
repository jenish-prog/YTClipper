import { useState } from 'react'
import { formatDuration, API_BASE } from '../utils.js'

export default function VideoPreview({ videoInfo, videoUrl }) {
  const [isDownloadingThumb, setIsDownloadingThumb] = useState(false)

  if (!videoInfo) return null

  const handleThumbnailDownload = async () => {
    setIsDownloadingThumb(true)
    try {
      const response = await fetch(`${API_BASE}/api/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || `Failed to download thumbnail (${response.status})`)
      }

      // Extract filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'thumbnail.jpg'
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

      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error('Thumbnail download failed:', err)
      alert(err.message || 'Failed to download thumbnail.')
    } finally {
      setIsDownloadingThumb(false)
    }
  }

  return (
    <section className="video-preview">
      <div className="glass-card">
        <div className="preview-inner">
          <div className="thumbnail-wrapper">
            <img
              className="thumbnail-img"
              src={videoInfo.thumbnail}
              alt={videoInfo.title}
              loading="eager"
            />
            <div className="thumbnail-overlay" />
            <span className="duration-badge">
              {formatDuration(videoInfo.duration)}
            </span>
          </div>
          <div className="video-meta">
            <h2 className="video-title">{videoInfo.title}</h2>
            <p className="video-channel">
              <span>📺</span>
              {videoInfo.channel}
            </p>
            <button
              className="thumbnail-download-btn"
              onClick={handleThumbnailDownload}
              disabled={isDownloadingThumb}
              id="thumbnail-download-btn"
            >
              {isDownloadingThumb ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Downloading...
                </>
              ) : (
                <>
                  <span className="thumb-btn-icon">🖼️</span>
                  Download Thumbnail
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

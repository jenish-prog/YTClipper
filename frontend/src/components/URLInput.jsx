import { useState } from 'react'

export default function URLInput({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (url.trim() && !isLoading) {
      onSubmit(url.trim())
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch {
      // Clipboard API may not be available
    }
  }

  return (
    <section className="url-input-section">
      <div className="glass-card">
        <form className="url-form" onSubmit={handleSubmit}>
          <div className="url-input-wrapper">
            <span className="url-input-icon">🔗</span>
            <input
              id="youtube-url-input"
              type="text"
              className="url-input"
              placeholder="Paste a YouTube URL here..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
              autoFocus
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="fetch-btn"
            disabled={!url.trim() || isLoading}
            id="fetch-video-btn"
          >
            {isLoading ? <span className="spinner" /> : 'Fetch Video'}
          </button>
        </form>
      </div>
    </section>
  )
}

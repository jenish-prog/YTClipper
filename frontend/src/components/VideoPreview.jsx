import { formatDuration } from '../utils.js'

export default function VideoPreview({ videoInfo }) {
  if (!videoInfo) return null

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
          </div>
        </div>
      </div>
    </section>
  )
}

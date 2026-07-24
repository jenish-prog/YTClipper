import { formatFileSize } from '../utils.js'

export default function QualitySelector({ formats, selectedFormat, onSelect }) {
  if (!formats || formats.length === 0) return null

  // Separate video and audio-only formats
  const videoFormats = formats.filter(f => f.has_video)
  const audioFormats = formats.filter(f => !f.has_video && f.has_audio)

  return (
    <section className="quality-section">
      <div className="glass-card">
        <h3 className="section-title">📐 Quality</h3>

        {videoFormats.length > 0 && (
          <>
            <div className="quality-group-label">Video</div>
            <div className="quality-grid">
              {videoFormats.map((fmt) => (
                <div className="quality-option" key={fmt.format_id}>
                  <input
                    type="radio"
                    name="quality"
                    id={`quality-${fmt.format_id}`}
                    value={fmt.format_id}
                    checked={selectedFormat === fmt.format_id}
                    onChange={() => onSelect(fmt.format_id)}
                  />
                  <label htmlFor={`quality-${fmt.format_id}`} className="quality-label">
                    <span className="quality-label-text">{fmt.label}</span>
                    {fmt.filesize && (
                      <span className="quality-label-size">
                        ~{formatFileSize(fmt.filesize)}
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </>
        )}

        {audioFormats.length > 0 && (
          <>
            <div className="quality-group-label">Audio Only</div>
            <div className="quality-grid">
              {audioFormats.map((fmt) => (
                <div className="quality-option" key={fmt.format_id}>
                  <input
                    type="radio"
                    name="quality"
                    id={`quality-${fmt.format_id}`}
                    value={fmt.format_id}
                    checked={selectedFormat === fmt.format_id}
                    onChange={() => onSelect(fmt.format_id)}
                  />
                  <label htmlFor={`quality-${fmt.format_id}`} className="quality-label">
                    <span className="quality-label-text">{fmt.label}</span>
                    {fmt.filesize && (
                      <span className="quality-label-size">
                        ~{formatFileSize(fmt.filesize)}
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

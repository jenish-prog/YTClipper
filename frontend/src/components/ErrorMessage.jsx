export default function ErrorMessage({ error, onDismiss }) {
  if (!error) return null

  return (
    <div className="error-message" role="alert">
      <span className="error-icon">⚠️</span>
      <div className="error-content">
        <p className="error-title">Something went wrong</p>
        <p className="error-detail">{error}</p>
      </div>
      <button
        className="error-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss error"
        id="dismiss-error-btn"
      >
        ✕
      </button>
    </div>
  )
}

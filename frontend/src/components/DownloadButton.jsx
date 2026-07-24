export default function DownloadButton({ onClick, isDownloading, downloadStage }) {
  return (
    <section className="download-section">
      <button
        className="download-btn"
        onClick={onClick}
        disabled={isDownloading}
        id="download-btn"
      >
        <span>
          {isDownloading ? (
            <>
              <span className="spinner" style={{ marginRight: 8, verticalAlign: 'middle' }} />
              {downloadStage || 'Processing...'}
            </>
          ) : (
            <>⬇ Download</>
          )}
        </span>
      </button>

      {isDownloading && (
        <div className="download-progress">
          <div className="progress-bar-wrapper">
            <div className="progress-bar-fill indeterminate" />
          </div>
          <p className="progress-text">
            {downloadStage === 'Downloading...'
              ? 'Downloading video from YouTube...'
              : downloadStage === 'Trimming...'
                ? 'Trimming and processing your clip...'
                : 'Preparing your file...'}
          </p>
        </div>
      )}
    </section>
  )
}

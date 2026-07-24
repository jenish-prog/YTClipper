import { useState, useCallback, useEffect, useRef } from 'react'
import { formatDuration, parseDuration } from '../utils.js'

export default function TimeRangePicker({ duration, startTime, endTime, onChange }) {
  const [startInput, setStartInput] = useState(formatDuration(startTime))
  const [endInput, setEndInput] = useState(formatDuration(endTime))
  const startRef = useRef(null)
  const endRef = useRef(null)

  // Sync inputs when props change (from slider)
  useEffect(() => {
    setStartInput(formatDuration(startTime))
  }, [startTime])

  useEffect(() => {
    setEndInput(formatDuration(endTime))
  }, [endTime])

  const handleStartSlider = useCallback((e) => {
    const val = parseFloat(e.target.value)
    const newStart = Math.min(val, endTime - 1)
    onChange(Math.max(0, newStart), endTime)
  }, [endTime, onChange])

  const handleEndSlider = useCallback((e) => {
    const val = parseFloat(e.target.value)
    const newEnd = Math.max(val, startTime + 1)
    onChange(startTime, Math.min(duration, newEnd))
  }, [startTime, duration, onChange])

  const handleStartInputBlur = useCallback(() => {
    const parsed = parseDuration(startInput)
    if (parsed !== null && parsed >= 0 && parsed < endTime) {
      onChange(parsed, endTime)
    } else {
      setStartInput(formatDuration(startTime))
    }
  }, [startInput, startTime, endTime, onChange])

  const handleEndInputBlur = useCallback(() => {
    const parsed = parseDuration(endInput)
    if (parsed !== null && parsed > startTime && parsed <= duration) {
      onChange(startTime, parsed)
    } else {
      setEndInput(formatDuration(endTime))
    }
  }, [endInput, startTime, endTime, duration, onChange])

  const handleKeyDown = (e, handler) => {
    if (e.key === 'Enter') handler()
  }

  const resetToFull = () => {
    onChange(0, duration)
  }

  const selectedDuration = endTime - startTime
  const startPercent = (startTime / duration) * 100
  const endPercent = (endTime / duration) * 100

  return (
    <section className="time-range-section">
      <div className="glass-card">
        <h3 className="section-title">✂️ Trim Range</h3>

        {/* Dual-handle range slider */}
        <div className="time-range-slider-container">
          <div className="time-range-track" />
          <div
            className="time-range-fill"
            style={{
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
            }}
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={startTime}
            onChange={handleStartSlider}
            ref={startRef}
            aria-label="Start time"
            id="start-time-slider"
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={1}
            value={endTime}
            onChange={handleEndSlider}
            ref={endRef}
            aria-label="End time"
            id="end-time-slider"
          />
        </div>

        {/* Time input fields */}
        <div className="time-inputs">
          <div className="time-input-group">
            <label className="time-input-label" htmlFor="start-time-input">Start</label>
            <input
              id="start-time-input"
              type="text"
              className="time-input"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              onBlur={handleStartInputBlur}
              onKeyDown={(e) => handleKeyDown(e, handleStartInputBlur)}
              placeholder="00:00:00"
            />
          </div>
          <span className="time-separator">→</span>
          <div className="time-input-group">
            <label className="time-input-label" htmlFor="end-time-input">End</label>
            <input
              id="end-time-input"
              type="text"
              className="time-input"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              onBlur={handleEndInputBlur}
              onKeyDown={(e) => handleKeyDown(e, handleEndInputBlur)}
              placeholder="00:00:00"
            />
          </div>
        </div>

        {/* Info row */}
        <div className="time-range-info">
          <span className="selected-duration">
            Selected: {formatDuration(selectedDuration)}
            {selectedDuration < duration ? ' (trimmed)' : ' (full video)'}
          </span>
          {selectedDuration < duration && (
            <button
              type="button"
              className="full-video-btn"
              onClick={resetToFull}
              id="full-video-btn"
            >
              Reset to Full
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

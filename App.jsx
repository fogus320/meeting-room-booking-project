import { useEffect, useState } from 'react'
import './App.css'

const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
  .replace(/\/+$/, '')

function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function getDefaultBookingTimes() {
  const start = new Date()
  start.setMinutes(Math.ceil((start.getMinutes() + 1) / 30) * 30, 0, 0)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)

  return {
    start_time: toLocalDateTimeValue(start),
    end_time: toLocalDateTimeValue(end),
  }
}

function App() {
  const [rooms, setRooms] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [bookingForm, setBookingForm] = useState({
    title: '',
    start_time: '',
    end_time: '',
  })
  const [bookingError, setBookingError] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [minimumStartTime, setMinimumStartTime] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    async function loadRooms() {
      setIsLoading(true)
      setError('')

      try {
        const response = await fetch(`${apiBaseUrl}/api/rooms`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`เซิร์ฟเวอร์ตอบกลับด้วยสถานะ ${response.status}`)
        }

        const result = await response.json()
        if (!result.success || !Array.isArray(result.data)) {
          throw new Error('รูปแบบข้อมูลห้องประชุมจากเซิร์ฟเวอร์ไม่ถูกต้อง')
        }

        setRooms(result.data)
      } catch (requestError) {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadRooms()
    return () => controller.abort()
  }, [refreshKey])

  function openBookingForm(room) {
    setSelectedRoom(room)
    setBookingForm({ title: '', ...getDefaultBookingTimes() })
    setBookingError('')
    setBookingSuccess('')
    setMinimumStartTime(toLocalDateTimeValue(new Date()))
  }

  function closeBookingForm() {
    if (!isSubmitting) {
      setSelectedRoom(null)
      setBookingError('')
    }
  }

  async function submitBooking(event) {
    event.preventDefault()
    if (!selectedRoom || isSubmitting) return

    setIsSubmitting(true)
    setBookingError('')
    setBookingSuccess('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 1,
          room_id: selectedRoom.room_id,
          title: bookingForm.title.trim(),
          start_time: new Date(bookingForm.start_time).toISOString(),
          end_time: new Date(bookingForm.end_time).toISOString(),
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || `เซิร์ฟเวอร์ตอบกลับด้วยสถานะ ${response.status}`)
      }

      setBookingSuccess(`${result.message} (หมายเลขการจอง ${result.booking_id})`)
      setSelectedRoom(null)
    } catch (requestError) {
      setBookingError(
        requestError.message || 'ไม่สามารถส่งคำขอจองได้ กรุณาลองอีกครั้ง',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Meeting Room Booking หน้าแรก">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>Meeting Room<span className="brand-light">Booking</span></span>
        </a>
        <span className="topbar-label">ระบบจองห้องประชุม</span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">ประชุมได้ง่าย จัดการได้สะดวก</p>
          <h1 id="page-title">ค้นหาห้องประชุม</h1>
          <p className="intro-copy">
            เลือกห้องที่เหมาะกับทีมและการประชุมครั้งถัดไปของคุณ
          </p>
        </section>

        {bookingSuccess && (
          <div className="booking-notice" role="status">
            <span className="notice-check" aria-hidden="true">✓</span>
            <span>{bookingSuccess}</span>
            <button
              type="button"
              aria-label="ปิดข้อความยืนยัน"
              onClick={() => setBookingSuccess('')}
            >
              ×
            </button>
          </div>
        )}

        <section className="rooms-section" aria-labelledby="rooms-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">พื้นที่สำหรับทุกไอเดีย</p>
              <h2 id="rooms-title">ห้องประชุมทั้งหมด</h2>
            </div>
            {!isLoading && !error && (
              <span className="room-count">{rooms.length} ห้อง</span>
            )}
          </div>

          {isLoading && (
            <p className="state-message" role="status">กำลังโหลดรายการห้องประชุม...</p>
          )}

          {!isLoading && error && (
            <div className="state-card error-card" role="alert">
              <div>
                <h3>โหลดข้อมูลไม่สำเร็จ</h3>
                <p>{error}</p>
                <p className="hint">
                  ตรวจสอบว่า Backend กำลังทำงาน แล้วลองอีกครั้ง
                </p>
              </div>
              <button
                className="button button-secondary"
                onClick={() => setRefreshKey((key) => key + 1)}
                type="button"
              >
                ลองอีกครั้ง
              </button>
            </div>
          )}

          {!isLoading && !error && rooms.length === 0 && (
            <p className="state-message">ยังไม่มีห้องประชุมที่เปิดให้บริการ</p>
          )}

          {!isLoading && !error && rooms.length > 0 && (
            <div className="room-grid">
              {rooms.map((room) => (
                <article className="room-card" key={room.room_id}>
                  <div className="room-card-top">
                    <span className="room-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
                        <path d="M8 9h8M8 12h8M8 15h4" />
                      </svg>
                    </span>
                    <span className="room-id">ROOM {String(room.room_id).padStart(2, '0')}</span>
                  </div>

                  <h3>{room.name}</h3>
                  <p className="room-description">
                    {room.description || 'พื้นที่พร้อมสำหรับการประชุมของคุณ'}
                  </p>

                  <div className="room-details">
                    <span>
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 20v-1.5A3.5 3.5 0 0 1 7.5 15h9a3.5 3.5 0 0 1 3.5 3.5V20M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                      </svg>
                      {room.capacity} ที่นั่ง
                    </span>
                    {room.location && (
                      <span>
                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
                          <circle cx="12" cy="10" r="2.25" />
                        </svg>
                        {room.location}
                      </span>
                    )}
                  </div>

                  <button
                    className="button button-primary"
                    onClick={() => openBookingForm(room)}
                    type="button"
                  >
                    จองห้องนี้
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedRoom && (
          <div
            className="modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeBookingForm()
            }}
          >
            <section
              aria-labelledby="booking-title"
              aria-modal="true"
              className="booking-dialog"
              role="dialog"
            >
              <div className="dialog-heading">
                <div>
                  <p className="eyebrow">ส่งคำขอจองห้อง</p>
                  <h2 id="booking-title">{selectedRoom.name}</h2>
                </div>
                <button
                  aria-label="ปิดแบบฟอร์ม"
                  className="dialog-close"
                  disabled={isSubmitting}
                  onClick={closeBookingForm}
                  type="button"
                >
                  ×
                </button>
              </div>

              <p className="booking-room-summary">
                {selectedRoom.capacity} ที่นั่ง
                {selectedRoom.location ? ` · ${selectedRoom.location}` : ''}
              </p>

              <form className="booking-form" onSubmit={submitBooking}>
                <label>
                  หัวข้อการประชุม
                  <input
                    autoFocus
                    maxLength={255}
                    onChange={(event) => setBookingForm({
                      ...bookingForm,
                      title: event.target.value,
                    })}
                    placeholder="เช่น ประชุมทีมประจำสัปดาห์"
                    required
                    type="text"
                    value={bookingForm.title}
                  />
                </label>

                <div className="datetime-fields">
                  <label>
                    วันและเวลาเริ่ม
                    <input
                      min={minimumStartTime}
                      onChange={(event) => setBookingForm({
                        ...bookingForm,
                        start_time: event.target.value,
                      })}
                      required
                      type="datetime-local"
                      value={bookingForm.start_time}
                    />
                  </label>
                  <label>
                    วันและเวลาสิ้นสุด
                    <input
                      min={bookingForm.start_time}
                      onChange={(event) => setBookingForm({
                        ...bookingForm,
                        end_time: event.target.value,
                      })}
                      required
                      type="datetime-local"
                      value={bookingForm.end_time}
                    />
                  </label>
                </div>

                <p className="form-note">
                  ระบบจะตรวจสอบเวลาซ้ำก่อนยืนยันการจอง
                </p>

                {bookingError && (
                  <p className="form-error" role="alert">{bookingError}</p>
                )}

                <div className="form-actions">
                  <button
                    className="button button-cancel"
                    disabled={isSubmitting}
                    onClick={closeBookingForm}
                    type="button"
                  >
                    ยกเลิก
                  </button>
                  <button
                    className="button button-submit"
                    disabled={isSubmitting}
                    type="submit"
                  >
                    {isSubmitting ? 'กำลังส่งคำขอ...' : 'ยืนยันการจอง'}
                  </button>
                </div>
              </form>

              <p className="demo-user-note">
                กำลังจองด้วยบัญชีตัวอย่าง Demo User
              </p>
            </section>
          </div>
        )}
      </main>

      <footer className="footer">
        <span>Meeting Room Booking</span>
        <span>จัดพื้นที่ที่ดี ให้ทุกการประชุมไปได้ไกล</span>
      </footer>
    </div>
  )
}

export default App

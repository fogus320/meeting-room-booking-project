const db = require('../config/db');

exports.createBooking = async (req, res) => {
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  const { user_id, room_id, title, start_time, end_time } = body;
  const isPositiveInteger = (value) => Number.isSafeInteger(value) && value > 0;
  const parseDateTime = (value) => {
    if (typeof value !== 'string') {
      return null;
    }

    const parts = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|([+-])(\d{2}):(\d{2}))$/
    );
    if (!parts) {
      return null;
    }

    const [, year, month, day, hour, minute, second, , offsetHour, offsetMinute] = parts;
    const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
    if (Number(year) < 1000 || Number(month) < 1 || Number(month) > 12 || Number(day) < 1 ||
      Number(day) > daysInMonth || Number(hour) > 23 ||
      Number(minute) > 59 || Number(second) > 59 ||
      (offsetHour !== undefined && (Number(offsetHour) > 23 || Number(offsetMinute) > 59))) {
      return null;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
  };
  const startTimestamp = parseDateTime(start_time);
  const endTimestamp = parseDateTime(end_time);

  if (!isPositiveInteger(user_id) || !isPositiveInteger(room_id) ||
    typeof title !== 'string' || !title.trim() ||
    startTimestamp === null || endTimestamp === null) {
    return res.status(400).json({
      success: false,
      message: 'กรุณาระบุ user_id, room_id, title และวันเวลาในรูปแบบ ISO 8601 ที่มี timezone ให้ถูกต้อง'
    });
  }

  if (startTimestamp >= endTimestamp) {
    return res.status(400).json({
      success: false,
      message: 'เวลาเริ่มต้นต้องอยู่ก่อนเวลาสิ้นสุด'
    });
  }

  const toMysqlUtc = (timestamp) => new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');
  const startTimeUtc = toMysqlUtc(startTimestamp);
  const endTimeUtc = toMysqlUtc(endTimestamp);

  try {
    const checkOverlapQuery = `
      SELECT booking_id FROM bookings
      WHERE room_id = ?
        AND status = 'confirmed'
        AND (start_time < ? AND end_time > ?)
    `;

    const [results] = await db.query(checkOverlapQuery, [room_id, endTimeUtc, startTimeUtc]);

    if (results.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'ช่วงเวลาดังกล่าวถูกจองแล้ว กรุณาเลือกช่วงเวลาอื่น'
      });
    }

    const insertQuery = `
      INSERT INTO bookings (user_id, room_id, title, start_time, end_time, status)
      VALUES (?, ?, ?, ?, ?, 'confirmed')
    `;

    const [result] = await db.query(insertQuery, [
      user_id,
      room_id,
      title.trim(),
      startTimeUtc,
      endTimeUtc
    ]);

    return res.status(201).json({
      success: true,
      message: 'จองห้องประชุมสำเร็จ',
      booking_id: result.insertId
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

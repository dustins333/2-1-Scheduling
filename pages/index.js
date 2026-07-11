import { useState, useEffect, useMemo } from "react";
import {
  formatDateLabel,
  todayStr,
  monthStr,
  shiftMonth,
  monthLabel,
  getMonthGrid,
} from "../lib/dateUtils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SarahPage() {
  const today = todayStr();
  const todayDate = new Date(today + "T00:00:00");

  const [viewYear, setViewYear] = useState(todayDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayDate.getMonth() + 1);
  const [availableDates, setAvailableDates] = useState([]);
  const [monthLoading, setMonthLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [daySlots, setDaySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isCurrentViewMonth =
    viewYear === todayDate.getFullYear() && viewMonth === todayDate.getMonth() + 1;

  function shiftView(delta) {
    setViewYear((y) => {
      const next = shiftMonth(y, viewMonth, delta);
      if (next.year < todayDate.getFullYear() ||
        (next.year === todayDate.getFullYear() && next.month < todayDate.getMonth() + 1)) {
        return y;
      }
      setViewMonth(next.month);
      return next.year;
    });
  }

  useEffect(() => {
    let cancelled = false;
    setMonthLoading(true);
    fetch(`/api/slots?month=${monthStr(viewYear, viewMonth)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setAvailableDates(data.availableDates || []);
      })
      .catch(() => {
        if (!cancelled) setAvailableDates([]);
      })
      .finally(() => {
        if (!cancelled) setMonthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewYear, viewMonth]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/slots?date=${selectedDate}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError("Couldn't load times for this day. Please try again.");
          setDaySlots([]);
        } else {
          setDaySlots(data.slots);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't load times for this day. Please try again.");
          setDaySlots([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  function toggleSlot(slot) {
    setSelectedSlots((current) => {
      const already = current.some((s) => s.id === slot.id);
      if (already) return current.filter((s) => s.id !== slot.id);
      return [...current, slot];
    });
  }

  function isSelected(slotId) {
    return selectedSlots.some((s) => s.id === slotId);
  }

  const smsHref = useMemo(() => {
    if (selectedSlots.length === 0 || !name || !phone) return null;
    const slotIds = selectedSlots.map((s) => s.id).join(",");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/invite?slots=${encodeURIComponent(
      slotIds
    )}&ref=${encodeURIComponent(phone)}&refName=${encodeURIComponent(name)}`;
    const body =
      `Hey! My gym gave me an opportunity to have you come in and try a session with me. ` +
      `I've already selected some times that will work for me. check out this link to see if these will work for you: ${inviteUrl}`;
    return `sms:?body=${encodeURIComponent(body)}`;
  }, [selectedSlots, name, phone]);

  const weeks = getMonthGrid(viewYear, viewMonth);

  return (
    <div className="page">
      <img src="/kova-logo.png" alt="Kova Strength" className="logo" />
      <h1>Pick a few times for a friend</h1>
      <p className="subtitle">
        Choose a day, tap 2-3 times that could work, then send it to a friend.
      </p>

      <label>Pick a day</label>
      <div className="calendar">
        <div className="calendar-header">
          <button
            type="button"
            className="day-nav-arrow"
            onClick={() => shiftView(-1)}
            disabled={isCurrentViewMonth}
            aria-label="Previous month"
          >
            &#8592;
          </button>
          <span className="calendar-month-label">{monthLabel(viewYear, viewMonth)}</span>
          <button
            type="button"
            className="day-nav-arrow"
            onClick={() => shiftView(1)}
            aria-label="Next month"
          >
            &#8594;
          </button>
        </div>

        <div className="calendar-weekdays">
          {WEEKDAY_LABELS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {weeks.map((week, i) => (
            <div className="calendar-week" key={i}>
              {week.map((cell, j) => {
                if (!cell) return <span key={j} className="calendar-cell empty" />;
                const isPast = cell.dateStr < today;
                const isAvailable = availableDates.includes(cell.dateStr);
                const isSelectedDay = cell.dateStr === selectedDate;
                return (
                  <button
                    key={j}
                    type="button"
                    className={`calendar-cell${isSelectedDay ? " selected" : ""}${
                      isPast ? " past" : ""
                    }`}
                    disabled={isPast}
                    onClick={() => setSelectedDate(cell.dateStr)}
                  >
                    {cell.day}
                    {isAvailable && !isPast && <span className="calendar-dot" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="slot-group">
        <h3>{formatDateLabel(selectedDate)}</h3>
        {loading ? (
          <p className="empty-state">Loading times...</p>
        ) : error ? (
          <p className="empty-state">{error}</p>
        ) : daySlots.length === 0 ? (
          <p className="empty-state">No open times this day. Try another day.</p>
        ) : (
          <div className="slot-grid">
            {daySlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className={`slot-button${isSelected(slot.id) ? " selected" : ""}`}
                onClick={() => toggleSlot(slot)}
              >
                {slot.time}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSlots.length > 0 && (
        <div className="selected-summary">
          <h3>Your picked times</h3>
          <ul>
            {selectedSlots.map((s) => (
              <li key={s.id}>
                {formatDateLabel(s.date)} at {s.time}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedSlots.length > 0 && (
        <>
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            type="text"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label htmlFor="phone">Your phone number</label>
          <input
            id="phone"
            type="tel"
            placeholder="(555) 555-5555"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </>
      )}

      <a href={smsHref || undefined}>
        <button className="primary-button" type="button" disabled={!smsHref}>
          Send to friend
        </button>
      </a>
    </div>
  );
}

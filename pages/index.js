import { useState, useEffect, useMemo } from "react";
import { formatDateLabel, todayStr, addDays } from "../lib/dateUtils";

export default function SarahPage() {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [phone, setPhone] = useState("");

  const [daySlots, setDaySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function shiftDate(delta) {
    setSelectedDate((current) => {
      const next = addDays(current, delta);
      return next < todayStr() ? current : next;
    });
  }

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
    if (selectedSlots.length === 0 || !phone) return null;
    const slotIds = selectedSlots.map((s) => s.id).join(",");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const inviteUrl = `${origin}/invite?slots=${encodeURIComponent(
      slotIds
    )}&ref=${encodeURIComponent(phone)}`;
    const body =
      `Hey! My gym gave me an opportunity to have you come in and try a session with me. ` +
      `I've already selected some times that will work for me. check out this link to see if these will work for you: ${inviteUrl}`;
    return `sms:?body=${encodeURIComponent(body)}`;
  }, [selectedSlots, phone]);

  return (
    <div className="page">
      <h1>Pick a few times for a friend</h1>
      <p className="subtitle">
        Choose a day, tap 2-3 times that could work, then send it to a friend.
      </p>

      <label>Pick a day</label>
      <div className="day-nav">
        <button
          type="button"
          className="day-nav-arrow"
          onClick={() => shiftDate(-1)}
          disabled={selectedDate <= todayStr()}
          aria-label="Previous day"
        >
          &#8592;
        </button>
        <span className="day-nav-label">{formatDateLabel(selectedDate)}</span>
        <button
          type="button"
          className="day-nav-arrow"
          onClick={() => shiftDate(1)}
          aria-label="Next day"
        >
          &#8594;
        </button>
      </div>

      {selectedDate && (
        <div className="slot-group">
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
      )}

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

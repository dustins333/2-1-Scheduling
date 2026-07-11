import { useState, useEffect } from "react";
import { formatDateLabel } from "../lib/dateUtils";
import { GYM_TIMEZONE } from "../lib/timezone";

function slotFromIso(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-CA", { timeZone: GYM_TIMEZONE });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: GYM_TIMEZONE,
  });
  return { id: iso, date, time };
}

export default function FriendPage() {
  const [slots, setSlots] = useState([]);
  const [ref, setRef] = useState("");
  const [refName, setRefName] = useState("");
  const [linkChecked, setLinkChecked] = useState(false);

  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slotIds = (params.get("slots") || "").split(",").filter(Boolean);
    const resolved = slotIds.map(slotFromIso).filter(Boolean);
    setSlots(resolved);
    setRef(params.get("ref") || "");
    setRefName(params.get("refName") || "");
    setLinkChecked(true);
  }, []);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          consent,
          startTime: selectedSlotId,
          ref,
          refName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.error === "slot_taken") {
          setSelectedSlotId(null);
          setSubmitError(data.message);
          return;
        }
        throw new Error(data.error || "Booking failed");
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError("Something went wrong booking your session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = Boolean(
    selectedSlotId && name.trim() && phone.trim() && consent && !submitting
  );

  if (!linkChecked) return null;

  if (submitted) {
    const slot = slots.find((s) => s.id === selectedSlotId);
    return (
      <div className="page">
        <img src="/kova-logo.png" alt="Kova Strength" className="logo" />
        <div className="confirmation">
          <h2>You're booked!</h2>
          <p>
            {slot ? `${formatDateLabel(slot.date)} at ${slot.time}` : ""}
            <br />
            We'll see you then, {name.split(" ")[0]}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <img src="/kova-logo.png" alt="Kova Strength" className="logo" />
      <h1>Grab a session time</h1>
      <p className="subtitle">
        Your friend had the opportunity to invite someone in for a free
        workout. Check out the times below and take advantage of this offer!
      </p>

      {slots.length === 0 ? (
        <p className="empty-state">
          This link doesn't have any times on it. Ask your friend to send a
          new one.
        </p>
      ) : (
        <div className="slot-group">
          <div className="slot-grid">
            {slots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                className={`slot-button${
                  selectedSlotId === slot.id ? " selected" : ""
                }`}
                onClick={() => setSelectedSlotId(slot.id)}
              >
                {formatDateLabel(slot.date)}
                <br />
                {slot.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedSlotId && (
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

          <div className="consent-row">
            <input
              id="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <label htmlFor="consent">
              I agree to receive marketing messages from Kova Fitness at the
              phone number provided above. Message frequency may vary and
              data rates may apply. Reply STOP to opt out.
            </label>
          </div>
        </>
      )}

      {submitError && <p className="empty-state">{submitError}</p>}

      <button
        className="primary-button"
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
      >
        {submitting ? "Booking..." : "Book my session"}
      </button>
    </div>
  );
}

const GLM_API_BASE = "https://services.leadconnectorhq.com";
const GLM_API_VERSION = "2021-04-15";

async function glmFetch(path, options = {}) {
  const token = process.env.GLM_API_TOKEN;
  const res = await fetch(`${GLM_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GLM_API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`GLM ${path} failed: ${res.status}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}

function splitName(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, phone, consent, startTime, ref, refName } = req.body || {};

  if (!name || !phone || !startTime) {
    return res.status(400).json({ error: "Missing name, phone, or startTime" });
  }
  if (!consent) {
    return res.status(400).json({ error: "Consent to text messages is required" });
  }

  const locationId = process.env.GLM_LOCATION_ID;
  const calendarId = process.env.GLM_CALENDAR_ID;

  try {
    const { firstName, lastName } = splitName(name);
    const friendUpsert = await glmFetch("/contacts/upsert", {
      method: "POST",
      body: JSON.stringify({ locationId, firstName, lastName, phone }),
    });
    const friendContactId = friendUpsert.contact.id;

    await glmFetch(`/contacts/${friendContactId}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags: ["Referral-Lead"] }),
    });

    let friendAppointment;
    try {
      friendAppointment = await glmFetch("/calendars/events/appointments", {
        method: "POST",
        body: JSON.stringify({
          calendarId,
          locationId,
          contactId: friendContactId,
          startTime,
          title: `Referral Intro Session - ${name}`,
          appointmentStatus: "confirmed",
        }),
      });
    } catch (err) {
      if (err.status === 400 && /no longer available/i.test(err.details?.message || "")) {
        return res.status(409).json({
          error: "slot_taken",
          message: "That time was just booked by someone else. Please pick a different time.",
        });
      }
      throw err;
    }

    let referrerAppointment = null;
    if (ref) {
      const { firstName: refFirstName, lastName: refLastName } = splitName(refName || "");
      const referrerUpsert = await glmFetch("/contacts/upsert", {
        method: "POST",
        body: JSON.stringify({
          locationId,
          phone: ref,
          firstName: refFirstName,
          lastName: refLastName,
        }),
      });
      const referrerContactId = referrerUpsert.contact.id;
      await glmFetch(`/contacts/${referrerContactId}/tags`, {
        method: "POST",
        body: JSON.stringify({ tags: ["Referral-Client"] }),
      });

      try {
        referrerAppointment = await glmFetch("/calendars/events/appointments", {
          method: "POST",
          body: JSON.stringify({
            calendarId,
            locationId,
            contactId: referrerContactId,
            startTime,
            title: `Referral Intro Session - ${refName || "Referring member"} (bringing a friend)`,
            appointmentStatus: "confirmed",
          }),
        });
      } catch (err) {
        referrerAppointment = { error: err.message, details: err.details };
      }
    }

    return res.status(200).json({ ok: true, friendAppointment, referrerAppointment });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
}

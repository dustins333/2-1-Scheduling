import { GYM_TIMEZONE } from "../../lib/timezone";

const GLM_API_BASE = "https://services.leadconnectorhq.com";
const GLM_API_VERSION = "2021-04-15";

async function fetchFreeSlots(startDate, endDate, timezone) {
  const token = process.env.GLM_API_TOKEN;
  const calendarId = process.env.GLM_CALENDAR_ID;

  const url = new URL(`${GLM_API_BASE}/calendars/${calendarId}/free-slots`);
  url.searchParams.set("startDate", String(startDate));
  url.searchParams.set("endDate", String(endDate));
  url.searchParams.set("timezone", timezone);

  const glmRes = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GLM_API_VERSION,
      Accept: "application/json",
    },
  });
  const data = await glmRes.json();
  if (!glmRes.ok) {
    const err = new Error("GLM request failed");
    err.status = glmRes.status;
    err.details = data;
    throw err;
  }
  return data;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { date, month } = req.query;
  const timezone = GYM_TIMEZONE;

  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: "Invalid month query param (expected YYYY-MM)" });
    }
    const [year, mon] = month.split("-").map(Number);
    const lastDay = daysInMonth(year, mon);
    const firstDayStr = `${month}-01`;
    const lastDayStr = `${month}-${String(lastDay).padStart(2, "0")}`;
    const startDate = new Date(`${firstDayStr}T00:00:00`).getTime();
    const endDate = new Date(`${lastDayStr}T23:59:59`).getTime();

    let data;
    try {
      data = await fetchFreeSlots(startDate, endDate, timezone);
    } catch (err) {
      return res.status(err.status || 502).json({ error: "GLM request failed", details: err.details });
    }

    const availableDates = Object.keys(data).filter(
      (key) => key !== "traceId" && (data[key]?.slots?.length || 0) > 0
    );
    return res.status(200).json({ availableDates });
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Missing or invalid date query param (expected YYYY-MM-DD)" });
  }

  const startDate = new Date(`${date}T00:00:00`).getTime();
  const endDate = new Date(`${date}T23:59:59`).getTime();

  let data;
  try {
    data = await fetchFreeSlots(startDate, endDate, timezone);
  } catch (err) {
    return res.status(err.status || 502).json({ error: "GLM request failed", details: err.details });
  }

  const dayData = data[date];
  const isoTimes = dayData?.slots || [];
  const slots = isoTimes.map((iso) => ({
    id: iso,
    date,
    time: new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone,
    }),
  }));

  return res.status(200).json({ slots });
}

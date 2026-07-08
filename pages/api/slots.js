import { GYM_TIMEZONE } from "../../lib/timezone";

const GLM_API_BASE = "https://services.leadconnectorhq.com";
const GLM_API_VERSION = "2021-04-15";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Missing or invalid date query param (expected YYYY-MM-DD)" });
  }

  const token = process.env.GLM_API_TOKEN;
  const calendarId = process.env.GLM_CALENDAR_ID;
  const timezone = GYM_TIMEZONE;

  const startDate = new Date(`${date}T00:00:00`).getTime();
  const endDate = new Date(`${date}T23:59:59`).getTime();

  const url = new URL(`${GLM_API_BASE}/calendars/${calendarId}/free-slots`);
  url.searchParams.set("startDate", String(startDate));
  url.searchParams.set("endDate", String(endDate));
  url.searchParams.set("timezone", timezone);

  let glmRes;
  let data;
  try {
    glmRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Version: GLM_API_VERSION,
        Accept: "application/json",
      },
    });
    data = await glmRes.json();
  } catch (err) {
    return res.status(502).json({ error: "Could not reach GLM", details: String(err) });
  }

  if (!glmRes.ok) {
    return res.status(glmRes.status).json({ error: "GLM request failed", details: data });
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

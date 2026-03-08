const { google } = require("googleapis");

function getServiceAccount() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON mancante");
  try {
    return JSON.parse(raw);
  } catch (_) {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    return JSON.parse(decoded);
  }
}

async function appendPreferenceRow(payload, plan, emailStatus) {
  const sheetId = process.env.GOOGLE_SHEET_ID || "1mi0SD4Ebr9l1RYMjn4F3Bk_9kAgheYZbJLnaL0ujJgM";
  if (!sheetId) throw new Error("GOOGLE_SHEET_ID mancante");

  const sa = getServiceAccount();
  const auth = new google.auth.JWT(
    sa.client_email,
    null,
    sa.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  await auth.authorize();

  const sheets = google.sheets({ version: "v4", auth });
  const values = [[
    new Date().toISOString(),
    payload.email || "",
    payload.hasChildren ? "SI" : "NO",
    (payload.childrenAges || []).join(","),
    payload.arrivalTime || "",
    (payload.interests || []).join(","),
    (payload.freeText || "").slice(0, 500),
    plan.itinerary.map((i) => `${i.start}-${i.end} ${i.activity}`).join(" | "),
    emailStatus,
  ]];

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: process.env.GOOGLE_SHEET_RANGE || "Sheet1!A:I",
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

module.exports = { appendPreferenceRow };

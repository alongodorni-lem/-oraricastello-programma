function parseChildrenAges(input) {
  if (!input.trim()) return [];
  return input
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));
}

const LAST_ENTRY = "15:00";
const PARK_CLOSE = "17:30";
const DEFAULT_FINAL_NOTE =
  "Durante la giornata puoi ritirare presso la postazione del fotografo - all'interno del Castello - una copia stampata della tua foto di famiglia in omaggio (servizio offerto dal fotografo)";

function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function refreshStayDurationOptions() {
  const arrivalInput = document.getElementById("arrivalTime");
  const select = document.getElementById("stayDuration");
  const arrival = toMinutes(arrivalInput.value);
  const maxAvailable = toMinutes(PARK_CLOSE) - arrival;
  const rules = [
    { id: "at_least_2_5h", min: 150 },
    { id: "between_2_5h_4h", min: 150 },
    { id: "over_4h", min: 241 },
  ];

  let firstEnabled = null;
  Array.from(select.options).forEach((opt) => {
    const rule = rules.find((r) => r.id === opt.value);
    const enabled = rule ? maxAvailable >= rule.min : true;
    opt.disabled = !enabled;
    if (enabled && firstEnabled === null) firstEnabled = opt.value;
  });

  if (select.options[select.selectedIndex]?.disabled && firstEnabled) {
    select.value = firstEnabled;
  }
}

function selectedInterests() {
  return Array.from(document.querySelectorAll(".chips input:checked")).map((el) => el.value);
}

function renderPlan(plan) {
  const container = document.getElementById("result");
  const finalNote = plan.finalNote || DEFAULT_FINAL_NOTE;
  const rows = plan.itinerary
    .map(
      (s, i) => `
      <div class="step">
        <strong>${i + 1}. ${s.start} - ${s.end}</strong><br>
        ${s.activity}<br>
        <span style="color:#556080">${s.location}</span><br>
        <span style="color:#556080">${s.note || ""}</span>
      </div>
    `
    )
    .join("");
  container.innerHTML = `<p>${plan.summary}</p>${rows}<p><strong>${finalNote}</strong></p>`;
}

function downloadPdf(base64) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "programma-personalizzato.pdf";
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("planner-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById("submitBtn");
  const status = document.getElementById("status");
  submitBtn.disabled = true;
  status.textContent = "Generazione in corso...";

  const payload = {
    email: document.getElementById("email").value.trim(),
    arrivalTime: document.getElementById("arrivalTime").value,
    stayDuration: document.getElementById("stayDuration").value,
    hasChildren: document.getElementById("hasChildren").value === "yes",
    childrenAges: parseChildrenAges(document.getElementById("childrenAges").value),
    interests: selectedInterests(),
    freeText: document.getElementById("freeText").value.trim(),
  };

  const arrivalMins = toMinutes(payload.arrivalTime);
  if (arrivalMins > toMinutes(LAST_ENTRY)) {
    submitBtn.disabled = false;
    status.textContent = "Errore: ultimo ingresso alle 15:00.";
    return;
  }
  const maxAvailable = toMinutes(PARK_CLOSE) - arrivalMins;
  if (payload.stayDuration === "over_4h" && maxAvailable <= 240) {
    submitBtn.disabled = false;
    status.textContent = "Errore: con questo orario di arrivo non puoi selezionare oltre 4 ore.";
    return;
  }

  try {
    const res = await fetch("/api/personalize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Errore durante la generazione.");

    renderPlan(data.plan);
    if (data.pdfBase64) downloadPdf(data.pdfBase64);
    status.textContent = `Completato. PDF scaricato. Sheets: ${data.sheetsStatus}.`;
  } catch (err) {
    status.textContent = `Errore: ${err.message}`;
  } finally {
    submitBtn.disabled = false;
  }
});

document.getElementById("arrivalTime").addEventListener("change", refreshStayDurationOptions);
refreshStayDurationOptions();

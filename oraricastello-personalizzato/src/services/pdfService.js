const PDFDocument = require("pdfkit");

function buildPlanPdf(plan) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("OrariCastello - Programma Personalizzato", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(11).text(plan.event);
    doc.text(plan.summary);
    doc.moveDown(0.5);

    doc.fontSize(12).text("Dettagli utente", { underline: true });
    doc.fontSize(10).text(`Arrivo: ${plan.metadata.arrivalTime}`);
    doc.text(`Bambini: ${plan.metadata.hasChildren ? "Si" : "No"}`);
    doc.text(`Eta bambini: ${plan.metadata.childrenAges.join(", ") || "-"}`);
    doc.text(`Interessi: ${plan.metadata.interests.join(", ") || "-"}`);
    doc.moveDown(0.8);

    doc.fontSize(12).text("Itinerario consigliato", { underline: true });
    plan.itinerary.forEach((step, i) => {
      doc.moveDown(0.4);
      doc
        .fontSize(10)
        .text(`${i + 1}. ${step.start} - ${step.end} | ${step.activity}`, { continued: false });
      doc.fontSize(10).text(`   Luogo: ${step.location}`);
      if (step.note) doc.text(`   Nota: ${step.note}`);
    });

    if (plan.finalNote) {
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(10).text(plan.finalNote);
      doc.font("Helvetica");
    }

    doc.end();
  });
}

module.exports = { buildPlanPdf };

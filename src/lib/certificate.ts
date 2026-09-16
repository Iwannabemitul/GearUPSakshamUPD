/**
 * Result-page completion certificate (Workstream C.5).
 * Generates a one-page A4 PDF entirely client-side with pdf-lib.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const NAVY = rgb(0.086, 0.137, 0.184);
const TEAL = rgb(0.055, 0.486, 0.482);
const INK = rgb(0.11, 0.141, 0.188);
const SOFT = rgb(0.294, 0.333, 0.388);

export async function downloadCertificate(opts: {
  employeeName: string;
  designation: string;
  department: string;
  assessmentTitle: string;
  competency: string;
  score: number;
  levelName: string;
  dateIso: string;
}): Promise<void> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 portrait
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();

  // Border frame
  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: NAVY,
    borderWidth: 2,
  });
  page.drawRectangle({
    x: 28,
    y: 28,
    width: width - 56,
    height: height - 56,
    borderColor: TEAL,
    borderWidth: 0.75,
  });

  const cx = width / 2;

  // Heading
  page.drawText("GOVERNMENT OF PUNJAB", {
    x: cx - bold.widthOfTextAtSize("GOVERNMENT OF PUNJAB", 11) / 2,
    y: height - 90,
    size: 11,
    font: bold,
    color: SOFT,
  });
  page.drawText("Saksham Skill Intelligence", {
    x: cx - bold.widthOfTextAtSize("Saksham Skill Intelligence", 22) / 2,
    y: height - 122,
    size: 22,
    font: bold,
    color: NAVY,
  });
  page.drawText("Certificate of Assessment Completion", {
    x: cx - regular.widthOfTextAtSize("Certificate of Assessment Completion", 14) / 2,
    y: height - 150,
    size: 14,
    font: regular,
    color: TEAL,
  });

  // Recipient
  page.drawText("This certifies that", {
    x: cx - regular.widthOfTextAtSize("This certifies that", 11) / 2,
    y: height - 210,
    size: 11,
    font: regular,
    color: SOFT,
  });
  page.drawText(opts.employeeName, {
    x: cx - bold.widthOfTextAtSize(opts.employeeName, 26) / 2,
    y: height - 248,
    size: 26,
    font: bold,
    color: NAVY,
  });
  const subtitle = `${opts.designation} · ${opts.department}`;
  page.drawText(subtitle, {
    x: cx - regular.widthOfTextAtSize(subtitle, 11) / 2,
    y: height - 270,
    size: 11,
    font: regular,
    color: SOFT,
  });

  // Assessment summary
  page.drawText("has completed the assessment", {
    x: cx - regular.widthOfTextAtSize("has completed the assessment", 11) / 2,
    y: height - 320,
    size: 11,
    font: regular,
    color: SOFT,
  });
  page.drawText(opts.assessmentTitle, {
    x: cx - bold.widthOfTextAtSize(opts.assessmentTitle, 18) / 2,
    y: height - 352,
    size: 18,
    font: bold,
    color: INK,
  });
  const summary = `Competency: ${opts.competency}      Score: ${opts.score}%      Level: ${opts.levelName}`;
  page.drawText(summary, {
    x: cx - regular.widthOfTextAtSize(summary, 12) / 2,
    y: height - 385,
    size: 12,
    font: regular,
    color: INK,
  });

  // Divider
  page.drawLine({
    start: { x: cx - 120, y: height - 420 },
    end: { x: cx + 120, y: height - 420 },
    thickness: 1,
    color: TEAL,
  });

  // Date + platform line
  const dateStr = new Date(opts.dateIso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  page.drawText(`Date: ${dateStr}`, {
    x: cx - regular.widthOfTextAtSize(`Date: ${dateStr}`, 11) / 2,
    y: height - 452,
    size: 11,
    font: regular,
    color: SOFT,
  });
  page.drawText(
    "Proctored attempt completed under the Saksham assessment policy. Prototype document.",
    {
      x:
        cx -
        regular.widthOfTextAtSize(
          "Proctored attempt completed under the Saksham assessment policy. Prototype document.",
          9,
        ) /
          2,
      y: 60,
      size: 9,
      font: regular,
      color: SOFT,
    },
  );

  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `saksham-certificate-${opts.assessmentTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

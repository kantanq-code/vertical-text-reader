import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

export async function exportReaderToPdf(
  element: HTMLElement,
  filename: string,
) {
  // Render the entire scrollable reader (including horizontal overflow).
  const canvas = await html2canvas(element, {
    backgroundColor: getComputedStyle(element).backgroundColor || "#ffffff",
    scale: 2,
    useCORS: true,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    width: element.scrollWidth,
    height: element.scrollHeight,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Vertical Japanese pages usually read right-to-left across wide canvas.
  // Slice the canvas into page-sized horizontal chunks (right → left order).
  const canvasRatio = canvas.height / canvas.width;
  // How wide (in canvas px) one PDF page represents:
  const pxPerPage = Math.floor((pageW / pageH) * canvas.height);

  const totalPages = Math.max(1, Math.ceil(canvas.width / pxPerPage));

  for (let i = 0; i < totalPages; i++) {
    // Right-to-left: first PDF page = rightmost slice
    const sliceIndex = totalPages - 1 - i;
    const sx = sliceIndex * pxPerPage;
    const sw = Math.min(pxPerPage, canvas.width - sx);

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = sw;
    pageCanvas.height = canvas.height;
    const ctx = pageCanvas.getContext("2d")!;
    ctx.fillStyle = getComputedStyle(element).backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, sw, canvas.height);
    ctx.drawImage(canvas, sx, 0, sw, canvas.height, 0, 0, sw, canvas.height);

    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);

    // Fit slice into PDF page, preserving aspect ratio, centered.
    const sliceRatio = pageCanvas.height / pageCanvas.width;
    let drawW = pageW;
    let drawH = pageW * sliceRatio;
    if (drawH > pageH) {
      drawH = pageH;
      drawW = pageH / sliceRatio;
    }
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;

    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, "JPEG", x, y, drawW, drawH);
  }

  // Silence unused var lint (canvasRatio helps if we later size dynamically)
  void canvasRatio;

  pdf.save(`${sanitize(filename)}.pdf`);
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "tategaki";
}

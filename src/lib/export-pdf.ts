import { jsPDF } from "jspdf";
import { toCanvas } from "html-to-image";

export async function exportReaderToPdf(
  element: HTMLElement,
  filename: string,
) {
  // Đợi font Nhật load xong để không chụp nhầm font hệ thống.
  if (document.fonts && "ready" in document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const bg = getComputedStyle(element).backgroundColor || "#ffffff";

  // html-to-image dùng SVG <foreignObject> nên hỗ trợ oklch/color-mix
  // (Tailwind v4) — html2canvas thì không.
  const canvas = await toCanvas(element, {
    backgroundColor: bg,
    pixelRatio: 2,
    cacheBust: true,
    width: element.scrollWidth,
    height: element.scrollHeight,
    style: {
      // Ép kích thước khi render vào foreignObject
      width: `${element.scrollWidth}px`,
      height: `${element.scrollHeight}px`,
    },
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Cắt canvas thành các trang A4 theo chiều ngang, phải → trái.
  const pxPerPage = Math.floor((pageW / pageH) * canvas.height);
  const totalPages = Math.max(1, Math.ceil(canvas.width / pxPerPage));

  for (let i = 0; i < totalPages; i++) {
    const sliceIndex = totalPages - 1 - i;
    const sx = sliceIndex * pxPerPage;
    const sw = Math.min(pxPerPage, canvas.width - sx);

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = sw;
    pageCanvas.height = canvas.height;
    const ctx = pageCanvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, sw, canvas.height);
    ctx.drawImage(canvas, sx, 0, sw, canvas.height, 0, 0, sw, canvas.height);

    const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);

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

  pdf.save(`${sanitize(filename)}.pdf`);
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "tategaki";
}

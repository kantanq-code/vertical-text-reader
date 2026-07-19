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

  // Kích thước một "màn" đọc = một trang PDF.
  const pageWidthCss = element.clientWidth;
  const pageHeightCss = element.clientHeight;
  const totalWidthCss = Math.max(element.scrollWidth, pageWidthCss);
  const totalPages = Math.max(1, Math.ceil(totalWidthCss / pageWidthCss));

  // PDF theo tỉ lệ đúng của reader → chữ không bị bóp nhỏ.
  const pdf = new jsPDF({
    orientation: pageWidthCss >= pageHeightCss ? "landscape" : "portrait",
    unit: "pt",
    format: [pageWidthCss, pageHeightCss],
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // Chụp từng trang riêng bằng cách dịch nội dung qua transform, thay vì
  // dựng một canvas khổng lồ (bị trình duyệt giới hạn ~16k/32k px và khiến
  // toàn bộ chữ bị dồn thành lưới li ti).
  for (let i = 0; i < totalPages; i++) {
    // vertical-rl: cột đầu tiên nằm bên phải → trang PDF đầu = slice phải nhất.
    const rightEdge = totalWidthCss - i * pageWidthCss;
    const tx = -(rightEdge - pageWidthCss);

    const canvas = await toCanvas(element, {
      backgroundColor: bg,
      pixelRatio: 2,
      cacheBust: true,
      width: pageWidthCss,
      height: pageHeightCss,
      style: {
        transform: `translateX(${tx}px)`,
        transformOrigin: "top left",
      },
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage([pageWidthCss, pageHeightCss]);
    pdf.addImage(imgData, "JPEG", 0, 0, pageW, pageH);
  }

  pdf.save(`${sanitize(filename)}.pdf`);
}

function sanitize(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "tategaki";
}

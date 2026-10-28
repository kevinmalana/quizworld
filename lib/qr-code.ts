import QRCode from "qrcode";

export async function generateQrSvg(value: string): Promise<string> {
  const svg = await QRCode.toString(value, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
  });
  // Only library-generated SVG is used; the encoded value is never HTML.
  return svg.replace("<svg ", '<svg width="100%" height="100%" ');
}

"use client";

import { useEffect, useState } from "react";
import { generateQrSvg } from "@/lib/qr-code";

type QrCodeProps = {
  value: string;
  size?: number;
  label?: string;
  className?: string;
};

type QrResult = { value: string; svg: string | null };

export function QrCode({ value, size = 260, label = "Scan to join", className }: QrCodeProps) {
  const [result, setResult] = useState<QrResult | null>(null);

  useEffect(() => {
    let active = true;
    generateQrSvg(value).then(
      (svg) => { if (active) setResult({ value, svg }); },
      () => { if (active) setResult({ value, svg: null }); },
    );
    return () => { active = false; };
  }, [value]);

  // Never show a previous room's QR while a new value is being generated.
  const current = result?.value === value ? result : null;
  const boxProps = { role: "img", "aria-label": label, className, style: { width: size, height: size } };

  if (current?.svg) {
    return <div {...boxProps} dangerouslySetInnerHTML={{ __html: current.svg }} />;
  }

  return <div {...boxProps}>{current ? value : null}</div>;
}

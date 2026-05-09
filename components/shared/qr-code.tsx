import { qrCodeUrl } from "@/lib/config/public";

type QrCodeProps = {
  value: string;
  size?: number;
  label?: string;
  className?: string;
};

export function QrCode({ value, size = 260, label = "Scan to join", className }: QrCodeProps) {
  return (
    <img
      src={qrCodeUrl(value, size)}
      alt={label}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

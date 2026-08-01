import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Generate the invite QR entirely in the browser; no URL is sent to a QR service. */
export function InviteQRCode({ url }: { url: string }) {
  const [dataURL, setDataURL] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(url, {
      width: 512,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#14120f', light: '#ffffff' },
    }).then((value) => {
      if (active) setDataURL(value);
    });
    return () => {
      active = false;
    };
  }, [url]);

  if (!dataURL) {
    return <div className="h-52 w-52 animate-pulse rounded-2xl bg-white/30" aria-label="Generating QR code" />;
  }

  return (
    <img
      src={dataURL}
      alt="Scannable QR code for this private Bwend invite"
      className="h-52 w-52 rounded-2xl bg-white p-2 shadow-lg"
    />
  );
}

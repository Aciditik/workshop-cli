"use client";

import { useRef } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCode, Printer } from "lucide-react";

interface QRCodeModalProps {
    tournamentId: string;
    tournamentName: string;
    tournamentLogoUrl?: string;
    eventDate?: string;
}

function formatEventDate(iso?: string): string {
    if (!iso) return "";
    // Accept YYYY-MM-DD or full ISO; render in French long form.
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export function QRCodeModal({ tournamentId, tournamentName, tournamentLogoUrl, eventDate }: QRCodeModalProps) {
    const qrRef = useRef<HTMLDivElement>(null);

    const url = typeof window !== "undefined"
        ? `${window.location.origin}/t/${tournamentId}`
        : `/t/${tournamentId}`;

    const cdfLogoAbsolute = typeof window !== "undefined"
        ? `${window.location.origin}/cdf-logo.png`
        : "/cdf-logo.png";

    // Keep data: and absolute http(s) URLs as-is; only resolve site-relative paths
    // (those starting with "/") against the current origin.
    const tournamentLogoAbsolute = (() => {
        if (!tournamentLogoUrl) return "";
        if (typeof window === "undefined") return tournamentLogoUrl;
        if (tournamentLogoUrl.startsWith("/")) return `${window.location.origin}${tournamentLogoUrl}`;
        return tournamentLogoUrl;
    })();

    const handlePrint = () => {
        const svg = qrRef.current?.querySelector("svg");
        if (!svg) return;
        const svgString = new XMLSerializer().serializeToString(svg);

        const w = window.open("", "_blank", "width=900,height=1200");
        if (!w) return;

        const dateText = formatEventDate(eventDate);

        w.document.write(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${tournamentName} — QR code</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 25mm 20mm;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    text-align: center;
  }
  .logos { display: flex; align-items: center; justify-content: center; gap: 40px; margin-bottom: 30px; }
  .logos img { height: 120px; width: auto; object-fit: contain; }
  h1 { font-size: 42px; margin: 10px 0 8px; font-weight: 700; letter-spacing: 0.5px; }
  .date { font-size: 22px; color: #333; margin-bottom: 40px; }
  .qr { background: #fff; padding: 20px; border: 1px solid #e5e5e5; border-radius: 12px; }
  .qr svg { width: 320px; height: 320px; display: block; }
  .hint { margin-top: 30px; font-size: 16px; color: #444; max-width: 140mm; }
  @media print {
    .noprint { display: none !important; }
  }
  .noprint { position: fixed; top: 12px; right: 12px; }
  .noprint button { padding: 8px 14px; font-size: 14px; cursor: pointer; }
</style>
</head>
<body>
  <div class="noprint"><button onclick="window.print()">Imprimer</button></div>
  <div class="page">
    <div class="logos">
      <img src="${cdfLogoAbsolute}" alt="CdF" />
      ${tournamentLogoAbsolute ? `<img src="${tournamentLogoAbsolute}" alt="Logo" />` : ""}
    </div>
    <h1>${tournamentName.replace(/</g, "&lt;")}</h1>
    ${dateText ? `<div class="date">${dateText}</div>` : ""}
    <div class="qr">${svgString}</div>
    <div class="hint">Scannez ce code pour sélectionner votre table et saisir vos scores.</div>
  </div>
  <script>
    (function () {
      var imgs = Array.prototype.slice.call(document.images);
      var pending = imgs.filter(function (i) { return !i.complete; }).length;
      function go() { window.focus(); window.print(); }
      if (pending === 0) { setTimeout(go, 200); return; }
      imgs.forEach(function (i) {
        if (i.complete) return;
        i.addEventListener("load", function () { if (--pending === 0) setTimeout(go, 200); });
        i.addEventListener("error", function () { if (--pending === 0) setTimeout(go, 200); });
      });
    })();
  </script>
</body>
</html>`);
        w.document.close();
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8 text-xs font-prototype">
                    <QrCode className="w-3.5 h-3.5" />
                    Voir le QR code
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">{tournamentName}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-6 space-y-6">
                    <div ref={qrRef} className="bg-white p-4 rounded-xl shadow-sm">
                        <QRCode
                            value={url}
                            size={200}
                            className="w-full h-auto"
                        />
                    </div>
                    <p className="text-center font-mono text-sm break-all text-muted-foreground bg-muted p-3 rounded-md select-all">
                        {url}
                    </p>
                    <p className="text-sm text-center text-muted-foreground">
                        Les joueurs peuvent scanner ce code pour sélectionner leur table et saisir leurs scores.
                    </p>
                    <Button onClick={handlePrint} variant="secondary" className="gap-2 w-full font-prototype">
                        <Printer className="w-4 h-4" />
                        Imprimer
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

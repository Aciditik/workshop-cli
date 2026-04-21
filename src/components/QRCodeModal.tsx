import QRCode from "react-qr-code";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QrCode } from "lucide-react";

interface QRCodeModalProps {
    tournamentId: string;
    tournamentName: string;
}

export function QRCodeModal({ tournamentId, tournamentName }: QRCodeModalProps) {
    const url = typeof window !== 'undefined'
        ? `${window.location.origin}/t/${tournamentId}`
        : `/t/${tournamentId}`;

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
                    <div className="bg-white p-4 rounded-xl shadow-sm">
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
                </div>
            </DialogContent>
        </Dialog>
    );
}

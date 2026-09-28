"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { BOARDS } from "@/lib/boards";
import { Map as MapIcon } from "lucide-react";

interface BoardSelectModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    roundLabel: string;
    defaultBoard?: string;
    onConfirm: (board: string) => void;
}

// Modal shown before generating a round (round 1, 2, 3, or quarts/demies/finale
// for the bracket format) so the organizer picks which Terraforming Mars board
// all tables will play on for that round.
export function BoardSelectModal({ open, onOpenChange, roundLabel, defaultBoard, onConfirm }: BoardSelectModalProps) {
    const [selected, setSelected] = useState<string>(defaultBoard || BOARDS[0]);
    // Reset the selection whenever the modal transitions to open, without an
    // effect (adjusting state during render per React's recommended pattern).
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setSelected(defaultBoard || BOARDS[0]);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-prototype">
                        <MapIcon className="w-5 h-5 text-primary" />
                        Plateau — {roundLabel}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground font-prototype">
                        Choisissez le plateau sur lequel les joueurs vont jouer pour cette ronde.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {BOARDS.map(board => (
                            <button
                                key={board}
                                type="button"
                                onClick={() => setSelected(board)}
                                className={`p-3 rounded-lg border text-sm font-prototype text-left transition-colors ${
                                    selected === board
                                        ? "border-primary bg-primary/10"
                                        : "border-border hover:bg-accent/40"
                                }`}
                            >
                                {board}
                            </button>
                        ))}
                    </div>
                    <Button
                        onClick={() => { onConfirm(selected); onOpenChange(false); }}
                        className="w-full gap-2 font-prototype"
                    >
                        Confirmer et lancer la ronde
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

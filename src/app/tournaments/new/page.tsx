"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTournaments } from "@/lib/store";
import { Tournament } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Trophy, ChevronLeft, Save, Upload } from "lucide-react";
import Link from "next/link";

export default function NewTournament() {
    const router = useRouter();
    const { addTournament } = useTournaments();
    const [name, setName] = useState("");
    const [size, setSize] = useState<number>(8);
    const [logoUrl, setLogoUrl] = useState("");
    const [logoFileName, setLogoFileName] = useState("");
    const [eventDate, setEventDate] = useState("");

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (PNG, JPG, SVG, etc.)');
            return;
        }

        // Validate file size (max 800KB)
        if (file.size > 800 * 1024) {
            alert('File size must be less than 800KB');
            return;
        }

        setLogoFileName(file.name);

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
            setLogoUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) return;

        const newTournament: Tournament = {
            id: crypto.randomUUID(),
            name: name.trim(),
            logoUrl: logoUrl.trim() || undefined,
            eventDate: eventDate || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: "draft",
            participants: [],
            matches: [],
            size,
            currentRound: 0,
        };

        addTournament(newTournament);
        router.push(`/tournaments/${newTournament.id}`);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/">
                    <Button variant="ghost" size="icon">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Create Tournament</h1>
                    <p className="text-muted-foreground text-lg">
                        Set up the structure for your new competition.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                        <Trophy className="w-5 h-5" />
                        Tournament Details
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="name" className="text-sm font-medium">
                                Tournament Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Summer Championship 2026"
                                className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="eventDate" className="text-sm font-medium">
                                Event Date
                            </label>
                            <input
                                id="eventDate"
                                type="date"
                                value={eventDate}
                                onChange={(e) => setEventDate(e.target.value)}
                                className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium block">
                                Logo de votre agence
                            </label>
                            <div className="relative">
                                <input
                                    id="logoUpload"
                                    type="file"
                                    accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="logoUpload"
                                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-muted/20"
                                >
                                    <Upload className="w-8 h-8 text-primary mb-2" />
                                    <span className="text-sm font-medium text-foreground">
                                        {logoFileName || "Téléchargez le logo"}
                                    </span>
                                    <span className="text-xs text-muted-foreground mt-1">
                                        Formats : PNG, SVG
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Taille max : 800 ko
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        Fond transparent recommandé
                                    </span>
                                </label>
                                {logoUrl && (
                                    <div className="mt-3 flex items-center justify-center">
                                        <img 
                                            src={logoUrl} 
                                            alt="Logo preview" 
                                            className="max-h-16 max-w-32 object-contain"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium block">
                                Tournament Size (Participants)
                            </label>
                            <input
                                id="size"
                                type="number"
                                min="3"
                                step="1"
                                max="1000"
                                value={size}
                                onChange={(e) => setSize(parseInt(e.target.value) || 4)}
                                className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-2">
                                Players will be distributed into tables of 3 or 4 automatically.
                            </p>
                        </div>

                        <div className="pt-4 border-t border-border flex justify-end gap-3">
                            <Link href="/">
                                <Button variant="ghost" type="button">
                                    Cancel
                                </Button>
                            </Link>
                            <Button type="submit" size="lg" className="gap-2">
                                <Save className="w-4 h-4" />
                                Create & Add Players
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

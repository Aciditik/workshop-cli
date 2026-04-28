"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useTournaments } from "@/lib/store";
import { useAuth, getApiUrl } from "@/lib/auth";
import { Tournament, Participant } from "@/lib/types";
import { getFormat, getMaxRounds, getQualifiedCount, getFormatLabel, isRecommendedSize, generateRound1 } from "@/lib/qualifier-rules";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Trophy, ChevronLeft, Upload, Info, Plus, X, Play, Users } from "lucide-react";
import Link from "next/link";

export default function NewTournament() {
    const router = useRouter();
    const { addTournament } = useTournaments();
    const { user, token } = useAuth();
    const [name, setName] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [logoFileName, setLogoFileName] = useState("");
    const [eventDate, setEventDate] = useState("");
    const [players, setPlayers] = useState<Array<{firstname: string; name: string; email: string; phone: string}>>([]);
    const [firstnameInput, setFirstnameInput] = useState("");
    const [playerInput, setPlayerInput] = useState("");
    const [emailInput, setEmailInput] = useState("");
    const [phoneInput, setPhoneInput] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const [organizers, setOrganizers] = useState<{ id: string; name: string; email: string; city?: string }[]>([]);
    const [selectedOwnerId, setSelectedOwnerId] = useState("");

    const isAdmin = user?.role === "admin";

    useEffect(() => {
        if (!isAdmin || !token) return;
        fetch(`${getApiUrl()}/api/auth/users`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => res.ok ? res.json() : [])
            .then(data => setOrganizers(data))
            .catch(() => {});
    }, [isAdmin, token]);

    const size = players.length;
    const canLaunch = name.trim() && eventDate && size >= 8;
    const canCreateDraft = name.trim() && eventDate;

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { alert("Merci d'uploader une image (PNG, JPG, SVG)"); return; }
        if (file.size > 800 * 1024) { alert("Fichier trop lourd (max 800 ko)"); return; }
        setLogoFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => setLogoUrl(reader.result as string);
        reader.readAsDataURL(file);
    };

    const addPlayer = () => {
        const firstname = firstnameInput.trim();
        const name = playerInput.trim();
        const email = emailInput.trim();
        const phone = phoneInput.trim();
        if (!firstname || !name || !email || !phone) return;
        setPlayers(prev => [...prev, { firstname, name, email, phone }]);
        setFirstnameInput("");
        setPlayerInput("");
        setEmailInput("");
        setPhoneInput("");
        inputRef.current?.focus();
    };

    const removePlayer = (index: number) => {
        setPlayers(prev => prev.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") { e.preventDefault(); addPlayer(); }
    };

    const handleCreateDraft = () => {
        if (!canCreateDraft) return;

        const tournamentId = crypto.randomUUID();
        const participants: Participant[] = players.map(p => ({
            id: crypto.randomUUID(),
            firstname: p.firstname,
            name: p.name,
            email: p.email,
            phone: p.phone,
            score: 0,
        }));

        const newTournament: Tournament = {
            id: tournamentId,
            name: name.trim(),
            logoUrl: logoUrl || undefined,
            eventDate,
            createdAt: new Date().toISOString(),
            status: "brouillon",
            format: "swiss",
            participants,
            matches: [],
            size: participants.length,
            currentRound: 0,
            maxRounds: 3,
            qualifiedCount: 2,
            ...(isAdmin && selectedOwnerId ? { ownerId: selectedOwnerId } : {}),
        };

        addTournament(newTournament);
        router.push(`/tournaments/${newTournament.id}`);
    };

    const handleLaunch = () => {
        if (!canLaunch) return;

        const participants: Participant[] = players.map(p => ({
            id: crypto.randomUUID(),
            firstname: p.firstname,
            name: p.name,
            email: p.email,
            phone: p.phone,
            score: 0,
        }));

        const tournamentId = crypto.randomUUID();
        const format = getFormat(size);
        const maxRounds = getMaxRounds(size);
        const round1Matches = generateRound1(tournamentId, participants, size);

        const newTournament: Tournament = {
            id: tournamentId,
            name: name.trim(),
            logoUrl: logoUrl || undefined,
            eventDate,
            createdAt: new Date().toISOString(),
            status: "en_cours",
            format,
            participants,
            matches: round1Matches,
            size,
            currentRound: 1,
            maxRounds,
            qualifiedCount: getQualifiedCount(size),
            ...(isAdmin && selectedOwnerId ? { ownerId: selectedOwnerId } : {}),
        };

        addTournament(newTournament);
        router.push(`/tournaments/${newTournament.id}`);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8">
            <div className="flex items-center gap-3 sm:gap-4">
                <Link href="/">
                    <Button variant="ghost" size="icon" className="shrink-0">
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </Link>
                <div className="text-center space-y-4 mb-8">
                    <h1 className="text-4xl font-extrabold tracking-tight font-prototype">Nouveau Tournoi</h1>
                    <p className="text-muted-foreground font-prototype text-sm sm:text-lg">Renseignez les informations et ajoutez les joueurs.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary font-prototype">
                        <Trophy className="w-5 h-5" />
                        Informations
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Tournament name */}
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-prototype">Nom du tournoi</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="ex. Summer Championship 2026"
                            className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                    </div>

                    {/* Event date */}
                    <div className="space-y-2">
                        <label htmlFor="eventDate" className="text-sm font-prototype">Date de l&apos;événement</label>
                        <input
                            id="eventDate"
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                    </div>

                    {/* Organizer selector (admin only) */}
                    {isAdmin && organizers.length > 0 && (
                        <div className="space-y-2">
                            <label htmlFor="owner" className="text-sm font-prototype">Organisateur</label>
                            <select
                                id="owner"
                                value={selectedOwnerId}
                                onChange={(e) => setSelectedOwnerId(e.target.value)}
                                className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                <option value="">Moi-même (admin)</option>
                                {organizers.map(o => (
                                    <option key={o.id} value={o.id}>
                                        {o.city ? `${o.name} (${o.city})` : o.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs font-prototype text-muted-foreground">L&apos;organisateur sélectionné pourra voir et gérer ce tournoi.</p>
                        </div>
                    )}

                    {/* Logo */}
                    <div className="space-y-2">
                        <label className="text-sm font-prototype block">Logo de votre boutique / association</label>
                        <div className="relative">
                            <input id="logoUpload" type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" onChange={handleLogoUpload} className="hidden" />
                            <label htmlFor="logoUpload" className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-muted/20">
                                <Upload className="w-7 h-7 text-primary mb-1" />
                                <span className="text-sm font-prototype text-foreground">{logoFileName || "Téléchargez le logo"}</span>
                                <span className="text-xs font-prototype text-muted-foreground mt-0.5">PNG, SVG • max 800 ko • fond transparent recommandé</span>
                            </label>
                            {logoUrl && (
                                <div className="mt-3 flex items-center justify-center">
                                    <img src={logoUrl} alt="Logo preview" className="max-h-16 max-w-32 object-contain" />
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Players section */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary font-prototype">
                        <Users className="w-5 h-5" />
                        Liste de joueurs
                        {size > 0 && <span className="ml-auto text-sm font-prototype text-muted-foreground">{size} joueur{size > 1 ? "s" : ""}</span>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add player input */}
                    <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={firstnameInput}
                                onChange={(e) => setFirstnameInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Prénom *"
                                required
                                className="flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                            <input
                                type="text"
                                value={playerInput}
                                onChange={(e) => setPlayerInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Nom *"
                                required
                                className="flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                            <input
                                type="email"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Email *"
                                required
                                className="flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                            <input
                                type="tel"
                                value={phoneInput}
                                onChange={(e) => setPhoneInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Téléphone *"
                                required
                                className="flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>
                        <Button type="button" onClick={addPlayer} className="gap-1 w-full md:w-auto font-prototype">
                            <Plus className="w-4 h-4" /> Ajouter le joueur
                        </Button>
                    </div>

                    {/* Player list */}
                    {players.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {players.map((player, index) => (
                                <div key={index} className="flex items-center justify-between px-3 py-2 rounded-md border bg-card/50 text-sm group">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs font-prototype text-muted-foreground shrink-0">
                                            {index + 1}
                                        </span>
                                        <span className="font-prototype">{player.firstname} {player.name}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removePlayer(index)}
                                        className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 ml-2"
                                        title="Supprimer"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {players.length === 0 && (
                        <p className="text-sm font-prototype text-muted-foreground text-center py-4 border border-dashed rounded-lg">
                            Aucun joueur ajouté pour l&apos;instant
                        </p>
                    )}

                    {/* Format info — shown once there's at least 1 player */}
                    {size >= 1 && (
                        <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm ${
                            size < 8
                                ? "bg-red-500/5 border-red-500/20 text-red-400"
                                : isRecommendedSize(size)
                                    ? "bg-green-500/5 border-green-500/20 text-green-400"
                                    : "bg-yellow-500/5 border-yellow-500/20 text-yellow-400"
                        }`}>
                            <Info className="w-4 h-4 mt-0.5 shrink-0" />
                            <div className="space-y-0.5">
                                {size < 8 ? (
                                    <p className="font-prototype">Minimum 8 joueurs requis ({8 - size} manquant{8 - size > 1 ? "s" : ""})</p>
                                ) : (
                                    <>
                                        <p className="font-prototype">
                                            {getFormatLabel(size)}
                                            {!isRecommendedSize(size) && " (non recommandé)"}
                                        </p>
                                        <p className="text-xs font-prototype opacity-80">
                                            {getQualifiedCount(size)} joueur{getQualifiedCount(size) > 1 ? "s" : ""} qualifié{getQualifiedCount(size) > 1 ? "s" : ""} · {getMaxRounds(size)} rondes
                                        </p>
                                        {size <= 28 && (
                                            <p className="text-xs font-prototype opacity-80">Ronde 1 : tables aléatoires · Ronde 2 : tables croisées selon résultats</p>
                                        )}
                                        {size > 28 && (
                                            <p className="text-xs font-prototype opacity-80">Format suisse : classement par points cumulés</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Footer actions */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-8">
                <Link href="/" className="order-2 sm:order-1">
                    <Button variant="ghost" className="w-full sm:w-auto font-prototype">Annuler</Button>
                </Link>
                <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2">
                    <Button
                        size="lg"
                        variant="outline"
                        className="gap-2 w-full sm:w-auto font-prototype"
                        disabled={!canCreateDraft}
                        onClick={handleCreateDraft}
                    >
                        <Trophy className="w-4 h-4" />
                        Créer le tournoi sans joueurs
                    </Button>
                    <Button
                        size="lg"
                        className="gap-2 w-full sm:w-auto font-prototype"
                        disabled={!canLaunch}
                        onClick={handleLaunch}
                    >
                        <Play className="w-4 h-4 fill-white" />
                        Lancer le tournoi ({size} joueur{size !== 1 ? "s" : ""})
                    </Button>
                </div>
            </div>
        </div>
    );
}

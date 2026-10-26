"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Participant, Team } from "@/lib/types";
import { playerDisplayName } from "@/lib/playerName";
import { TEAM_TAGS, TEAM_PRESETS } from "@/lib/team-tags";
import { Plus, Trash2, Users, Search, GripVertical, X } from "lucide-react";

interface TeamManagerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teams: Team[];
    participants: Participant[];
    usePseudo: boolean;
    onSave: (teams: Team[], participants: Participant[]) => void;
}

const TEAM_CAPACITY = 5;

// Finale-only admin tool: build teams from the preset tag icons (no free-form
// creation — presets already cover every available icon) and drag players
// from the unassigned pool onto a team, 5 members max. Local-draft-then-save
// so partial edits don't persist until "Enregistrer" is clicked.
export function TeamManagerModal({ open, onOpenChange, teams, participants, usePseudo, onSave }: TeamManagerModalProps) {
    const [draftTeams, setDraftTeams] = useState<Team[]>(teams);
    const [draftAssignments, setDraftAssignments] = useState<Record<string, string | undefined>>(
        Object.fromEntries(participants.map(p => [p.id, p.teamId]))
    );
    const [playerSearch, setPlayerSearch] = useState("");
    const [playerFilter, setPlayerFilter] = useState<"unassigned" | "all">("unassigned");
    const [showPresetPicker, setShowPresetPicker] = useState(false);
    const [dragPlayerId, setDragPlayerId] = useState<string | null>(null);
    const [dragOverTeamId, setDragOverTeamId] = useState<string | null>(null);
    const [renamingTeamId, setRenamingTeamId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

    // Re-sync the draft whenever the modal (re)opens, without an effect.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setDraftTeams(teams);
            setDraftAssignments(Object.fromEntries(participants.map(p => [p.id, p.teamId])));
            setPlayerSearch("");
            setPlayerFilter("unassigned");
            setShowPresetPicker(false);
        }
    }

    const memberCount = (teamId: string) => Object.values(draftAssignments).filter(t => t === teamId).length;
    const isTeamFull = (teamId: string) => memberCount(teamId) >= TEAM_CAPACITY;
    const getTeam = (teamId?: string) => draftTeams.find(t => t.id === teamId);

    const addPreset = (preset: { tag: string; label: string }) => {
        setDraftTeams(prev => [...prev, { id: crypto.randomUUID(), name: preset.label, tag: preset.tag }]);
        setShowPresetPicker(false);
    };

    const removeTeam = (teamId: string) => {
        setDraftTeams(prev => prev.filter(t => t.id !== teamId));
        setDraftAssignments(prev => {
            const next = { ...prev };
            for (const pid of Object.keys(next)) {
                if (next[pid] === teamId) next[pid] = undefined;
            }
            return next;
        });
    };

    const renameTeam = (teamId: string, name: string) => {
        const trimmed = name.trim();
        if (trimmed) setDraftTeams(prev => prev.map(t => (t.id === teamId ? { ...t, name: trimmed } : t)));
        setRenamingTeamId(null);
    };

    const assignPlayer = (participantId: string, teamId: string) => {
        if (isTeamFull(teamId) && draftAssignments[participantId] !== teamId) return;
        setDraftAssignments(prev => ({ ...prev, [participantId]: teamId }));
    };

    const unassignPlayer = (participantId: string) => {
        setDraftAssignments(prev => ({ ...prev, [participantId]: undefined }));
    };

    const filteredParticipants = participants.filter(p => {
        if (playerFilter === "unassigned" && draftAssignments[p.id]) return false;
        const search = playerSearch.trim().toLowerCase();
        if (!search) return true;
        return `${p.firstname} ${p.name}`.toLowerCase().includes(search) || (p.pseudo || "").toLowerCase().includes(search);
    });
    const unassignedCount = participants.filter(p => !draftAssignments[p.id]).length;

    const handleSave = () => {
        const updatedParticipants = participants.map(p => ({ ...p, teamId: draftAssignments[p.id] || undefined }));
        onSave(draftTeams, updatedParticipants);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-prototype">
                        <Users className="w-5 h-5 text-primary" />
                        Gérer les équipes
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Teams column */}
                    <div className="space-y-3 min-w-0">
                        <div className="flex items-center justify-between">
                            <h3 className="font-prototype text-lg">Équipes</h3>
                            <div className="relative">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5 font-prototype"
                                    onClick={() => setShowPresetPicker(v => !v)}
                                >
                                    <Plus className="w-4 h-4" />
                                    Nouvelle équipe
                                </Button>
                                {showPresetPicker && (
                                    <div className="absolute right-0 z-10 mt-2 w-64 max-h-64 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg p-1.5 grid grid-cols-2 gap-1">
                                        {TEAM_PRESETS.map(preset => {
                                            const alreadyAdded = draftTeams.some(t => t.tag === preset.tag && t.name === preset.label);
                                            return (
                                                <button
                                                    key={preset.tag}
                                                    type="button"
                                                    onClick={() => addPreset(preset)}
                                                    disabled={alreadyAdded}
                                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-prototype text-left transition-colors ${
                                                        alreadyAdded ? "text-muted-foreground cursor-default" : "hover:bg-accent/40"
                                                    }`}
                                                >
                                                    <Image src={TEAM_TAGS[preset.tag]} alt={preset.tag} width={18} height={18} className="object-contain shrink-0" />
                                                    <span className="truncate">{preset.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[28rem] overflow-y-auto pr-1">
                            {draftTeams.length === 0 && (
                                <p className="text-sm text-muted-foreground font-prototype">Aucune équipe pour l&apos;instant — cliquez sur &quot;Nouvelle équipe&quot;.</p>
                            )}
                            {draftTeams.map(team => {
                                const members = participants.filter(p => draftAssignments[p.id] === team.id);
                                const count = members.length;
                                const full = count >= TEAM_CAPACITY;
                                const isDragOver = dragOverTeamId === team.id;
                                return (
                                    <div
                                        key={team.id}
                                        onDragOver={(e) => { if (dragPlayerId && !full) { e.preventDefault(); setDragOverTeamId(team.id); } }}
                                        onDragLeave={() => setDragOverTeamId(prev => (prev === team.id ? null : prev))}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            setDragOverTeamId(null);
                                            if (dragPlayerId) assignPlayer(dragPlayerId, team.id);
                                            setDragPlayerId(null);
                                        }}
                                        className={`p-3 rounded-lg border bg-card/40 transition-colors ${isDragOver ? "border-primary bg-primary/10" : "border-border"}`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            {TEAM_TAGS[team.tag] && (
                                                <Image src={TEAM_TAGS[team.tag]} alt={team.tag} width={28} height={28} className="object-contain rounded-full shrink-0" />
                                            )}
                                            {renamingTeamId === team.id ? (
                                                <input
                                                    autoFocus
                                                    value={renameValue}
                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                    onBlur={() => renameTeam(team.id, renameValue)}
                                                    onKeyDown={(e) => { if (e.key === "Enter") renameTeam(team.id, renameValue); if (e.key === "Escape") setRenamingTeamId(null); }}
                                                    className="flex-1 min-w-0 h-7 rounded-md border border-input bg-background px-2 text-sm font-prototype focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                />
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => { setRenamingTeamId(team.id); setRenameValue(team.name); }}
                                                    className="flex-1 min-w-0 text-left font-prototype truncate hover:underline decoration-dotted"
                                                    title="Renommer l'équipe"
                                                >
                                                    {team.name}
                                                </button>
                                            )}
                                            <span className={`text-sm font-prototype shrink-0 ${full ? "text-green-500" : "text-muted-foreground"}`}>
                                                {count}/{TEAM_CAPACITY}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeTeam(team.id)}
                                                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                                title="Supprimer l'équipe"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {Array.from({ length: TEAM_CAPACITY }).map((_, slot) => {
                                                const member = members[slot];
                                                if (member) {
                                                    return (
                                                        <div
                                                            key={member.id}
                                                            draggable
                                                            onDragStart={() => setDragPlayerId(member.id)}
                                                            onDragEnd={() => setDragPlayerId(null)}
                                                            className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-accent/50 text-xs font-prototype cursor-grab active:cursor-grabbing group"
                                                        >
                                                            <GripVertical className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                                                            <span className="flex-1 min-w-0 truncate">{playerDisplayName(member, usePseudo)}</span>
                                                            <button
                                                                type="button"
                                                                onClick={() => unassignPlayer(member.id)}
                                                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                                                                title="Retirer de l'équipe"
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div
                                                        key={slot}
                                                        className="px-2 py-1.5 rounded-md border border-dashed border-border text-xs font-prototype text-muted-foreground text-center"
                                                    >
                                                        {dragPlayerId ? "Déposer ici" : "Vide"}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Players column */}
                    <div className="space-y-3 min-w-0">
                        <div className="flex items-center justify-between">
                            <h3 className="font-prototype text-lg">Joueurs</h3>
                            <span className="text-xs text-muted-foreground font-prototype">{unassignedCount} non assigné{unassignedCount !== 1 ? "s" : ""}</span>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                value={playerSearch}
                                onChange={(e) => setPlayerSearch(e.target.value)}
                                placeholder="Rechercher un joueur..."
                                className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {(["unassigned", "all"] as const).map(f => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setPlayerFilter(f)}
                                    className={`px-3 py-1 rounded-full border text-xs font-prototype transition-colors ${
                                        playerFilter === f ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {f === "unassigned" ? "Non assignés" : "Tous"}
                                </button>
                            ))}
                        </div>
                        <div
                            onDragOver={(e) => { if (dragPlayerId) e.preventDefault(); }}
                            onDrop={(e) => { e.preventDefault(); if (dragPlayerId) unassignPlayer(dragPlayerId); setDragPlayerId(null); }}
                            className="max-h-[22rem] overflow-y-auto divide-y divide-border border border-border rounded-lg"
                        >
                            {filteredParticipants.map(p => {
                                const team = getTeam(draftAssignments[p.id]);
                                return (
                                    <div
                                        key={p.id}
                                        draggable
                                        onDragStart={() => setDragPlayerId(p.id)}
                                        onDragEnd={() => setDragPlayerId(null)}
                                        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
                                    >
                                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                        <span className="flex-1 min-w-0 font-prototype truncate text-sm">{playerDisplayName(p, usePseudo)}</span>
                                        {team ? (
                                            <span className="flex items-center gap-1 text-xs font-prototype text-muted-foreground shrink-0">
                                                {TEAM_TAGS[team.tag] && (
                                                    <Image src={TEAM_TAGS[team.tag]} alt={team.tag} width={16} height={16} className="object-contain rounded-full" />
                                                )}
                                                {team.name}
                                            </span>
                                        ) : (
                                            <select
                                                value=""
                                                onChange={(e) => { if (e.target.value) assignPlayer(p.id, e.target.value); }}
                                                className="h-7 rounded-md border border-input bg-background px-1.5 text-xs font-prototype focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                                            >
                                                <option value="">Assigner...</option>
                                                {draftTeams.filter(t => !isTeamFull(t.id)).map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                );
                            })}
                            {filteredParticipants.length === 0 && (
                                <p className="text-sm text-muted-foreground font-prototype p-3 text-center">Aucun joueur à afficher.</p>
                            )}
                        </div>
                    </div>
                </div>

                <Button onClick={handleSave} className="w-full font-prototype">
                    Enregistrer
                </Button>
            </DialogContent>
        </Dialog>
    );
}

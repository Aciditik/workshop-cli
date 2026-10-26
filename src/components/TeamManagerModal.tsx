"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { Participant, Team } from "@/lib/types";
import { playerDisplayName } from "@/lib/playerName";
import { TEAM_TAGS, TEAM_TAG_NAMES, TEAM_PRESETS } from "@/lib/team-tags";
import { Plus, Trash2, Users } from "lucide-react";

interface TeamManagerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    teams: Team[];
    participants: Participant[];
    usePseudo: boolean;
    // Called once with the full new team list + the participants with their
    // teamId updated — caller persists both in a single tournament update.
    onSave: (teams: Team[], participants: Participant[]) => void;
}

// Finale-only admin tool: create named teams (each picks a TM card-tag icon
// as its emblem, since there's no team-logo upload) and assign existing
// players to one. Local-draft-then-save so partial edits don't persist
// until "Enregistrer" is clicked.
export function TeamManagerModal({ open, onOpenChange, teams, participants, usePseudo, onSave }: TeamManagerModalProps) {
    const [draftTeams, setDraftTeams] = useState<Team[]>(teams);
    const [draftAssignments, setDraftAssignments] = useState<Record<string, string | undefined>>(
        Object.fromEntries(participants.map(p => [p.id, p.teamId]))
    );
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamTag, setNewTeamTag] = useState(TEAM_TAG_NAMES[0]);
    const [playerSearch, setPlayerSearch] = useState("");

    // Re-sync the draft whenever the modal (re)opens, without an effect.
    const [wasOpen, setWasOpen] = useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) {
            setDraftTeams(teams);
            setDraftAssignments(Object.fromEntries(participants.map(p => [p.id, p.teamId])));
            setNewTeamName("");
            setPlayerSearch("");
        }
    }

    const addTeam = () => {
        const name = newTeamName.trim();
        if (!name) return;
        setDraftTeams(prev => [...prev, { id: crypto.randomUUID(), name, tag: newTeamTag }]);
        setNewTeamName("");
    };

    const addPreset = (preset: { tag: string; label: string }) => {
        setDraftTeams(prev => [...prev, { id: crypto.randomUUID(), name: preset.label, tag: preset.tag }]);
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

    const memberCount = (teamId: string) => Object.values(draftAssignments).filter(t => t === teamId).length;

    const filteredParticipants = participants.filter(p => {
        const search = playerSearch.trim().toLowerCase();
        if (!search) return true;
        return `${p.firstname} ${p.name}`.toLowerCase().includes(search) || (p.pseudo || "").toLowerCase().includes(search);
    });

    const handleSave = () => {
        const updatedParticipants = participants.map(p => ({ ...p, teamId: draftAssignments[p.id] || undefined }));
        onSave(draftTeams, updatedParticipants);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-prototype">
                        <Users className="w-5 h-5 text-primary" />
                        Gérer les équipes
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Existing teams */}
                    <div className="space-y-2">
                        {draftTeams.length === 0 && (
                            <p className="text-sm text-muted-foreground font-prototype">Aucune équipe pour l&apos;instant.</p>
                        )}
                        {draftTeams.map(team => (
                            <div key={team.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border">
                                {TEAM_TAGS[team.tag] && (
                                    <Image src={TEAM_TAGS[team.tag]} alt={team.tag} width={28} height={28} className="object-contain shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-prototype truncate">{team.name}</p>
                                    <p className="text-xs text-muted-foreground font-prototype">{memberCount(team.id)} joueur{memberCount(team.id) !== 1 ? "s" : ""}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeTeam(team.id)}
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                                    title="Supprimer l'équipe"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Quick-add presets — one "Team <Nom>" per available tag icon */}
                    <div className="space-y-2">
                        <label className="text-xs font-prototype text-muted-foreground">Équipes prédéfinies</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1 border border-border rounded-lg">
                            {TEAM_PRESETS.map(preset => {
                                const alreadyAdded = draftTeams.some(t => t.tag === preset.tag && t.name === preset.label);
                                return (
                                    <button
                                        key={preset.tag}
                                        type="button"
                                        onClick={() => addPreset(preset)}
                                        disabled={alreadyAdded}
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md border text-sm font-prototype text-left transition-colors ${
                                            alreadyAdded ? "border-border bg-muted/20 text-muted-foreground cursor-default" : "border-border hover:bg-accent/40"
                                        }`}
                                    >
                                        <Image src={TEAM_TAGS[preset.tag]} alt={preset.tag} width={20} height={20} className="object-contain shrink-0" />
                                        <span className="truncate">{preset.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* New team form */}
                    <div className="space-y-2 p-3 rounded-lg border border-dashed border-border">
                        <label className="text-xs font-prototype text-muted-foreground">Équipe personnalisée</label>
                        <input
                            type="text"
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                            placeholder="Nom de l'équipe..."
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                        <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5 max-h-28 overflow-y-auto p-1">
                            {TEAM_TAG_NAMES.map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => setNewTeamTag(tag)}
                                    title={tag}
                                    className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${newTeamTag === tag ? "border-primary bg-primary/10" : "border-border hover:bg-accent/40"}`}
                                >
                                    <Image src={TEAM_TAGS[tag]} alt={tag} width={22} height={22} className="object-contain" />
                                </button>
                            ))}
                        </div>
                        <Button onClick={addTeam} disabled={!newTeamName.trim()} className="w-full gap-2 font-prototype" size="sm">
                            <Plus className="w-4 h-4" />
                            Ajouter l&apos;équipe
                        </Button>
                    </div>

                    {/* Player assignment */}
                    <div className="space-y-2">
                        <label className="text-xs font-prototype text-muted-foreground">Assigner les joueurs</label>
                        <input
                            type="text"
                            value={playerSearch}
                            onChange={(e) => setPlayerSearch(e.target.value)}
                            placeholder="Rechercher un joueur..."
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-prototype ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                        <div className="max-h-64 overflow-y-auto divide-y divide-border border border-border rounded-lg">
                            {filteredParticipants.map(p => (
                                <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                                    <span className="flex-1 min-w-0 font-prototype truncate text-sm">{playerDisplayName(p, usePseudo)}</span>
                                    <select
                                        value={draftAssignments[p.id] || ""}
                                        onChange={(e) => setDraftAssignments(prev => ({ ...prev, [p.id]: e.target.value || undefined }))}
                                        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-prototype focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                                    >
                                        <option value="">— Aucune équipe —</option>
                                        {draftTeams.map(team => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                            {filteredParticipants.length === 0 && (
                                <p className="text-sm text-muted-foreground font-prototype p-3 text-center">Aucun joueur ne correspond à la recherche.</p>
                            )}
                        </div>
                    </div>

                    <Button onClick={handleSave} className="w-full font-prototype">
                        Enregistrer
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

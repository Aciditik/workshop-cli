"use client";

import { useState, useEffect } from "react";
import { Tournament } from "./types";

export function useTournaments() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const fetchTournaments = async () => {
        try {
            const res = await fetch('/api/tournaments');
            if (res.ok) {
                const data = await res.json();
                setTournaments(data);
            }
        } catch (e) {
            console.error("Failed to fetch tournaments", e);
        } finally {
            setIsLoaded(true);
        }
    };

    useEffect(() => {
        fetchTournaments();
    }, []);

    const addTournament = async (tournament: Tournament) => {
        // Optimistic update
        setTournaments(prev => [...prev, tournament]);

        try {
            await fetch('/api/tournaments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(tournament)
            });
        } catch (e) {
            console.error("Failed to add tournament", e);
            // Revert optimism on error
            await fetchTournaments();
        }
    };

    const updateTournament = async (updatedTournament: Tournament) => {
        // Optimistic update
        setTournaments(prev => prev.map(t =>
            t.id === updatedTournament.id ? updatedTournament : t
        ));

        try {
            await fetch(`/api/tournaments/${updatedTournament.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTournament)
            });
        } catch (e) {
            console.error("Failed to update tournament", e);
            await fetchTournaments();
        }
    };

    const deleteTournament = async (id: string) => {
        // Optimistic update
        setTournaments(prev => prev.filter(t => t.id !== id));

        try {
            await fetch(`/api/tournaments/${id}`, {
                method: 'DELETE'
            });
        } catch (e) {
            console.error("Failed to delete tournament", e);
            await fetchTournaments();
        }
    };

    const getTournament = (id: string) => tournaments.find((t) => t.id === id);

    return {
        tournaments,
        isLoaded,
        addTournament,
        updateTournament,
        deleteTournament,
        getTournament,
        refresh: fetchTournaments
    };
}

"use client";

import { useState, useEffect } from "react";
import { Tournament } from "./types";
import { getApiUrl } from "./auth";

const API_URL = getApiUrl();

function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
}

function authHeaders(): Record<string, string> {
    const token = getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
}

export function useTournaments() {
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const fetchTournaments = async () => {
        try {
            const res = await fetch(`${API_URL}/api/tournaments`, {
                headers: authHeaders(),
            });
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
        if (getToken()) {
            fetchTournaments();
        } else {
            setIsLoaded(true);
        }
    }, []);

    const addTournament = async (tournament: Tournament) => {
        // Optimistic update
        setTournaments(prev => [...prev, tournament]);

        try {
            await fetch(`${API_URL}/api/tournaments`, {
                method: 'POST',
                headers: authHeaders(),
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
            await fetch(`${API_URL}/api/tournaments/${updatedTournament.id}`, {
                method: 'PUT',
                headers: authHeaders(),
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
            await fetch(`${API_URL}/api/tournaments/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
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

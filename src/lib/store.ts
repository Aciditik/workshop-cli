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
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for Render
            
            const res = await fetch(`${API_URL}/api/tournaments`, {
                headers: authHeaders(),
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (res.ok) {
                const data = await res.json();
                setTournaments(data);
            } else if (res.status === 401) {
                // Clear invalid token and reload
                localStorage.removeItem("token");
                window.location.reload();
            }
        } catch (e) {
            console.error("Failed to fetch tournaments", e);
            // Don't show error to user for network issues (common on Render)
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
        console.log("=== STORE UPDATE TOURNAMENT ===");
        console.log("Tournament ID:", updatedTournament.id);
        console.log("Data being sent:", {
            name: updatedTournament.name,
            currentRound: updatedTournament.currentRound,
            status: updatedTournament.status,
            participantCount: updatedTournament.participants?.length || 0,
            matchCount: updatedTournament.matches?.length || 0,
            hasParticipants: !!updatedTournament.participants,
            hasMatches: !!updatedTournament.matches
        });
        
        // Optimistic update
        setTournaments(prev => prev.map(t =>
            t.id === updatedTournament.id ? updatedTournament : t
        ));

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for Render
            
            const res = await fetch(`${API_URL}/api/tournaments/${updatedTournament.id}`, {
                method: 'PUT',
                headers: authHeaders(),
                body: JSON.stringify(updatedTournament),
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }
            
            // Only refresh if critical update (not every time to avoid Render issues)
            if (updatedTournament.status === "completed" || updatedTournament.currentRound !== tournaments.find(t => t.id === updatedTournament.id)?.currentRound) {
                await fetchTournaments();
            }
        } catch (e: any) {
            console.error("Failed to update tournament", e);
            // Only revert on network errors, not timeouts
            if (e.name !== 'AbortError') {
                await fetchTournaments();
            }
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

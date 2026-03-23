import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Tournament } from '@/lib/types';

const dataFilePath = path.join(process.cwd(), 'data.json');

const readData = (): Tournament[] => {
    if (!fs.existsSync(dataFilePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    } catch {
        return [];
    }
};

const writeData = (data: Tournament[]) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string, tableId: string }> }
) {
    try {
        const resolvedParams = await params;
        const { results, scorecards } = await request.json();
        const tournaments = readData();

        const tIndex = tournaments.findIndex(t => t.id === resolvedParams.id);
        if (tIndex === -1) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

        const tournament = tournaments[tIndex];
        const mIndex = tournament.matches.findIndex(m => m.id === resolvedParams.tableId);

        if (mIndex === -1) return NextResponse.json({ error: 'Table not found' }, { status: 404 });

        // Update the match with the submitted results.
        // We set a custom flag `isPendingReview` to true so the admin knows they need to approve it.
        // We do NOT set `isCompleted` yet; the admin does that.
        tournaments[tIndex].matches[mIndex] = {
            ...tournament.matches[mIndex],
            results,
            scorecards: scorecards || tournament.matches[mIndex].scorecards,
            isPendingReview: true
        };

        writeData(tournaments);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to submit table result' }, { status: 500 });
    }
}

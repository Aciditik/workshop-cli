import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Tournament } from '@/lib/types';

const dataFilePath = path.join(process.cwd(), 'data.json');

const readData = (): Tournament[] => {
    if (!fs.existsSync(dataFilePath)) return [];
    try {
        return JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
    } catch (_e) {
        return [];
    }
};

const writeData = (data: Tournament[]) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const updatedTournament: Tournament = await request.json();

        const tournaments = readData();
        const index = tournaments.findIndex(t => t.id === resolvedParams.id);

        if (index === -1) {
            return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
        }

        tournaments[index] = updatedTournament;
        writeData(tournaments);
        return NextResponse.json(updatedTournament);
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to update tournament' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const tournaments = readData();
        const filteredTournaments = tournaments.filter(t => t.id !== resolvedParams.id);

        writeData(filteredTournaments);
        return NextResponse.json({ success: true });
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to delete tournament' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Tournament } from '@/lib/types';

const dataFilePath = path.join(process.cwd(), 'data.json');

// Helper to read data safely
const readData = (): Tournament[] => {
    if (!fs.existsSync(dataFilePath)) {
        return [];
    }
    try {
        const fileContent = fs.readFileSync(dataFilePath, 'utf-8');
        return JSON.parse(fileContent);
    } catch (e) {
        console.error("Failed to read data.json", e);
        return [];
    }
};

// Helper to write data safely
const writeData = (data: Tournament[]) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

export async function GET() {
    return NextResponse.json(readData());
}

export async function POST(request: Request) {
    try {
        const newTournament: Tournament = await request.json();
        const tournaments = readData();
        tournaments.push(newTournament);
        writeData(tournaments);
        return NextResponse.json(newTournament, { status: 201 });
    } catch (_error) {
        return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
    }
}

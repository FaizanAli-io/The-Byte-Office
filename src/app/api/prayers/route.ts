import { createPrayer, isUniqueViolation, listPrayers } from '@/lib/db/personal';
import { validatePrayerInput } from '@/lib/personal-validation';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json(await listPrayers());
  } catch (cause) {
    console.error('GET /api/prayers error:', cause);
    return NextResponse.json({ error: 'Failed to load prayers' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const parsed = validatePrayerInput(await req.json());
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    return NextResponse.json(await createPrayer(parsed.data), { status: 201 });
  } catch (cause) {
    if (isUniqueViolation(cause)) {
      return NextResponse.json({ error: 'That namaaz already exists' }, { status: 409 });
    }
    console.error('POST /api/prayers error:', cause);
    return NextResponse.json({ error: 'Failed to create prayer' }, { status: 500 });
  }
}

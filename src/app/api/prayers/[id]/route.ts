import { deletePrayer, getPrayer, isUniqueViolation, updatePrayer } from '@/lib/db/personal';
import { validatePrayerUpdate } from '@/lib/personal-validation';
import { NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const prayer = await getPrayer(id);
    return prayer ? NextResponse.json(prayer) : NextResponse.json({ error: 'Prayer not found' }, { status: 404 });
  } catch (cause) {
    console.error('GET /api/prayers/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to load prayer' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const parsed = validatePrayerUpdate(await req.json());
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const prayer = await updatePrayer(id, parsed.data);
    return prayer ? NextResponse.json(prayer) : NextResponse.json({ error: 'Prayer not found' }, { status: 404 });
  } catch (cause) {
    if (isUniqueViolation(cause)) {
      return NextResponse.json({ error: 'That namaaz already exists' }, { status: 409 });
    }
    console.error('PUT /api/prayers/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to update prayer' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const deleted = await deletePrayer(id);
    return deleted
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Prayer not found' }, { status: 404 });
  } catch (cause) {
    console.error('DELETE /api/prayers/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to delete prayer' }, { status: 500 });
  }
}

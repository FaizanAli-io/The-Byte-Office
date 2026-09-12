import { deleteHealthTracking, getHealthTracking, updateHealthTracking } from '@/lib/db/personal';
import { validateHealthTrackingUpdate } from '@/lib/personal-validation';
import { NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const entry = await getHealthTracking(id);
    return entry
      ? NextResponse.json(entry)
      : NextResponse.json({ error: 'Health tracking entry not found' }, { status: 404 });
  } catch (cause) {
    console.error('GET /api/health-tracking/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to load health tracking entry' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const parsed = validateHealthTrackingUpdate(await req.json());
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const entry = await updateHealthTracking(id, parsed.data);
    return entry
      ? NextResponse.json(entry)
      : NextResponse.json({ error: 'Health tracking entry not found' }, { status: 404 });
  } catch (cause) {
    console.error('PUT /api/health-tracking/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to update health tracking entry' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const deleted = await deleteHealthTracking(id);
    return deleted
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Health tracking entry not found' }, { status: 404 });
  } catch (cause) {
    console.error('DELETE /api/health-tracking/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to delete health tracking entry' }, { status: 500 });
  }
}

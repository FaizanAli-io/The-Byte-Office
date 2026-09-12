import { createHealthTracking, listHealthTracking } from '@/lib/db/personal';
import { validateHealthTrackingInput } from '@/lib/personal-validation';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const metric = new URL(req.url).searchParams.get('metric')?.trim() || undefined;
    return NextResponse.json(await listHealthTracking(metric));
  } catch (cause) {
    console.error('GET /api/health-tracking error:', cause);
    return NextResponse.json({ error: 'Failed to load health tracking' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const parsed = validateHealthTrackingInput(await req.json());
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    return NextResponse.json(await createHealthTracking(parsed.data), { status: 201 });
  } catch (cause) {
    console.error('POST /api/health-tracking error:', cause);
    return NextResponse.json({ error: 'Failed to create health tracking entry' }, { status: 500 });
  }
}

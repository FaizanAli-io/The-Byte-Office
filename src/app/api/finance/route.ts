import { loadFinanceDoc, saveFinanceDoc } from '@/lib/db/queries';
import { validateFinanceDoc } from '@/lib/finance-validation';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json(await loadFinanceDoc());
  } catch (err) {
    console.error('GET /api/finance error:', err);
    return NextResponse.json({ error: 'Failed to load finance data' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!validateFinanceDoc(body)) {
      return NextResponse.json({ error: 'Invalid finance data' }, { status: 400 });
    }
    if ('_id' in body) delete body._id;
    // Return the saved document so the editor can adopt the IDs Postgres
    // assigned to newly inserted holdings. Without this the client would still
    // hold ID-less rows and the next save would insert them a second time.
    return NextResponse.json({ success: true, data: await saveFinanceDoc(body) });
  } catch (err) {
    console.error('POST /api/finance error:', err);
    return NextResponse.json({ error: 'Failed to update finance data' }, { status: 500 });
  }
}

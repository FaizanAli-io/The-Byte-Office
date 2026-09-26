import { createSnapshot, deleteSnapshot, listSnapshots } from '@/lib/db/queries';
import { validateSnapshotInput } from '@/lib/finance-validation';
import { NextResponse } from 'next/server';
import { FinanceDoc } from '@/types/finance';

export async function GET() {
  try {
    return NextResponse.json(await listSnapshots());
  } catch (err) {
    console.error('GET /api/finance/snapshots error:', err);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    const validationError = validateSnapshotInput(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const { data, grandTotal } = body as {
      data: FinanceDoc;
      grandTotal: number;
    };

    // A snapshot records values at a point in time, so live holding IDs are
    // stripped: the rows they point at can be edited or deleted later.
    const id = await createSnapshot(
      {
        name: data.name,
        mutualFunds: data.mutualFunds.map((group) => {
          const bank = Object.keys(group)[0];
          return {
            [bank]: (group[bank] ?? []).map(({ fund, value }) => ({ fund, value })),
          };
        }),
        remoteBanks: data.remoteBanks.map(({ name, amountUsd, exchangeRate }) => ({
          name,
          amountUsd,
          exchangeRate,
        })),
        localBanks: data.localBanks.map(({ name, amountPkr }) => ({ name, amountPkr })),
      },
      grandTotal
    );

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error('POST /api/finance/snapshots error:', err);
    return NextResponse.json({ error: 'Failed to create snapshot' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id }: { id?: string } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing snapshot id' }, { status: 400 });
    }

    const deleted = await deleteSnapshot(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/snapshots error:', err);
    return NextResponse.json({ error: 'Failed to delete snapshot' }, { status: 500 });
  }
}

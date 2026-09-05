import {
  createSnapshot,
  deleteSnapshot,
  listSnapshots,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { FinanceDoc } from "@/types/finance";

export async function GET() {
  try {
    return NextResponse.json(await listSnapshots());
  } catch (err) {
    console.error("GET /api/finance/snapshots error:", err);
    return NextResponse.json(
      { error: "Failed to fetch snapshots" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const { data, grandTotal }: { data: FinanceDoc; grandTotal: number } =
      await req.json();

    const id = await createSnapshot(
      {
        name: data.name,
        mutualFunds: data.mutualFunds,
        remoteBanks: data.remoteBanks,
        localBanks: data.localBanks,
      },
      grandTotal,
    );

    return NextResponse.json({ success: true, id });
  } catch (err) {
    console.error("POST /api/finance/snapshots error:", err);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { id }: { id?: string } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "Missing snapshot id" },
        { status: 400 },
      );
    }

    const deleted = await deleteSnapshot(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/snapshots error:", err);
    return NextResponse.json(
      { error: "Failed to delete snapshot" },
      { status: 500 },
    );
  }
}

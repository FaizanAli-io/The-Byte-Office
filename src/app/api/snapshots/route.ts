import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { FinanceDoc, FinanceSnapshot } from "@/types/finance";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("finance");
    const collection = db.collection<FinanceSnapshot>("snapshots");

    const snapshots = await collection
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json(snapshots);
  } catch (err) {
    console.error("GET /api/finance/snapshots error:", err);
    return NextResponse.json(
      { error: "Failed to fetch snapshots" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { data, grandTotal }: { data: FinanceDoc; grandTotal: number } =
      await req.json();

    const client = await clientPromise;
    const db = client.db("finance");
    const collection = db.collection<FinanceSnapshot>("snapshots");

    const snapshot: FinanceSnapshot = {
      timestamp: new Date(),
      data: {
        name: data.name,
        mutualFunds: data.mutualFunds,
        remoteBanks: data.remoteBanks,
        localBanks: data.localBanks
      },
      grandTotal
    };

    const result = await collection.insertOne(snapshot);

    return NextResponse.json({ success: true, id: result.insertedId });
  } catch (err) {
    console.error("POST /api/finance/snapshots error:", err);
    return NextResponse.json(
      { error: "Failed to create snapshot" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { id }: { id?: string } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "Missing snapshot id" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db("finance");
    const collection = db.collection<FinanceSnapshot>("snapshots");

    const result = await collection.deleteOne({ _id: new ObjectId(id) } as any);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Snapshot not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/snapshots error:", err);
    return NextResponse.json(
      { error: "Failed to delete snapshot" },
      { status: 500 }
    );
  }
}

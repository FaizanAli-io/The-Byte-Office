import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { FinanceDoc } from "@/types/finance";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("finance");
    const collection = db.collection<FinanceDoc>("data");

    let doc = await collection.findOne({ name: "finance" });

    if (!doc) {
      const initialDoc: FinanceDoc = {
        name: "finance",
        mutualFunds: [],
        remoteBanks: [],
        localBanks: []
      };

      const result = await collection.insertOne(initialDoc);

      doc = await collection.findOne({ _id: result.insertedId });
    }

    return NextResponse.json(doc);
  } catch (err) {
    console.error("GET /api/finance error:", err);
    return NextResponse.json({ error: "Failed to fetch finance data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<FinanceDoc, "_id"> = await req.json();
    if ("_id" in body) delete body._id;

    const client = await clientPromise;
    const db = client.db("finance");
    const collection = db.collection<FinanceDoc>("data");

    await collection.updateOne({ name: "finance" }, { $set: body }, { upsert: true });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/finance error:", err);
    return NextResponse.json({ error: "Failed to update finance data" }, { status: 500 });
  }
}

import { loadFinanceDoc, saveFinanceDoc } from "@/lib/db/queries";
import { NextResponse } from "next/server";
import { FinanceDoc } from "@/types/finance";

const emptyDoc: FinanceDoc = {
  name: "finance",
  mutualFunds: [],
  remoteBanks: [],
  localBanks: [],
};

export async function GET() {
  try {
    return NextResponse.json(await loadFinanceDoc());
  } catch (err) {
    console.error("GET /api/finance error:", err);
    return NextResponse.json(emptyDoc, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<FinanceDoc, "_id"> = await req.json();
    if ("_id" in body) delete body._id;
    await saveFinanceDoc(body);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/finance error:", err);
    return NextResponse.json(
      { error: "Failed to update finance data" },
      { status: 500 },
    );
  }
}

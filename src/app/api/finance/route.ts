import { loadFinanceDoc, saveFinanceDoc } from "@/lib/db/queries";
import { validateFinanceDoc } from "@/lib/finance-validation";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    return NextResponse.json(await loadFinanceDoc());
  } catch (err) {
    console.error("GET /api/finance error:", err);
    return NextResponse.json(
      { error: "Failed to load finance data" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!validateFinanceDoc(body)) {
      return NextResponse.json(
        { error: "Invalid finance data" },
        { status: 400 },
      );
    }
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

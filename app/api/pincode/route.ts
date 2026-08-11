import { NextResponse } from "next/server";
import { isValidIndianPincode, normalizeIndianPincode } from "../../../lib/indian-pincode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PostalApiEntry = {
  Status?: string;
  PostOffice?: Array<{
    State?: string;
    District?: string;
    Block?: string;
    Name?: string;
  }>;
};

export async function GET(request: Request) {
  const pincode = normalizeIndianPincode(new URL(request.url).searchParams.get("pincode") ?? "");
  if (!isValidIndianPincode(pincode)) {
    return NextResponse.json({ error: "Enter a valid 6-digit Indian pincode." }, { status: 400 });
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "Pincode lookup failed." }, { status: 502 });
    }

    const data = (await res.json()) as PostalApiEntry[];
    const entry = data[0];
    const office = entry?.Status === "Success" ? entry.PostOffice?.[0] : undefined;
    if (!office?.State) {
      return NextResponse.json({ error: "Pincode not found." }, { status: 404 });
    }

    const city = office.Block?.trim() || office.District?.trim() || office.Name?.trim() || "";

    return NextResponse.json({
      ok: true,
      pincode,
      state: office.State.trim(),
      district: office.District?.trim() ?? "",
      city,
    });
  } catch (error) {
    console.error("pincode lookup failed", error);
    return NextResponse.json({ error: "Pincode lookup failed." }, { status: 502 });
  }
}

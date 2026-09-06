import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getSessionSecret, SESSION_COOKIE, verifySessionPayload } from "../../../lib/auth-session";
import { readIngredientGalleryStore, writeIngredientGalleryStore, type IngredientImage } from "../../../lib/product-ingredient-gallery-store";
export const runtime = "nodejs";
async function admin(){ const s=getSessionSecret(),t=cookies().get(SESSION_COOKIE)?.value; return Boolean(s&&t&&(await verifySessionPayload(t,s))?.role==="admin"); }
export async function GET(request:Request){ const id=new URL(request.url).searchParams.get("productId")?.trim(); const store=await readIngredientGalleryStore(); return NextResponse.json({items:id?store.products[id]??[]:store.products}); }
export async function POST(request:Request){ if(!(await admin())) return NextResponse.json({error:"Admin sign-in required."},{status:401}); const body=await request.json() as {productId?:string;items?:IngredientImage[]}; const id=body.productId?.trim(); if(!id||!Array.isArray(body.items)) return NextResponse.json({error:"productId and items required"},{status:400}); const items=body.items.slice(0,4).map(x=>({name:String(x.name||"").trim(),imageUrl:String(x.imageUrl||"").trim(),scale:Math.max(50,Math.min(220,Number(x.scale)||100)),x:Math.max(0,Math.min(100,Number(x.x)||50)),y:Math.max(0,Math.min(100,Number(x.y)||50))})); const store=await readIngredientGalleryStore(); store.products[id]=items; await writeIngredientGalleryStore(store); revalidatePath(`/product/${id}`); return NextResponse.json({items}); }

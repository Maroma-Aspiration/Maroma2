import { notFound } from "next/navigation";
import { getOrderById } from "../../../../../lib/commerce-orders";
import {
  expandOrderGiftSets,
  orderHasGiftSets,
  orderRegularLines,
} from "../../../../../lib/gift-set-production";
import { isProductionView } from "../../../../../lib/production-view";
import ProductionSheetClient from "./production-sheet-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Production instructions | Maroma admin",
};

export default async function ProductionSheetPage({
  params,
  searchParams,
}: {
  params: { orderId: string };
  searchParams: { print?: string };
}) {
  const order = await getOrderById(params.orderId);
  if (!order) notFound();

  if (!orderHasGiftSets(order)) {
    notFound();
  }

  const giftSets = expandOrderGiftSets(order);
  const regularLines = orderRegularLines(order, giftSets);

  return (
    <ProductionSheetClient
      order={order}
      giftSets={giftSets}
      regularLines={regularLines}
      autoPrint={searchParams.print === "1"}
      productionView={isProductionView()}
    />
  );
}

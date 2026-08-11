import FulfillmentOrderClient from "./fulfillment-order-client";

export const metadata = {
  title: "Fulfillment | Maroma production",
};

export default function FulfillmentOrderPage({ params }: { params: { orderId: string } }) {
  return <FulfillmentOrderClient orderId={params.orderId} />;
}

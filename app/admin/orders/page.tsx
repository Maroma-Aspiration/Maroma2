import FulfillmentBoardClient from "./fulfillment-board-client";

export const metadata = {
  title: "Fulfillment board | Maroma production",
  appleWebApp: {
    capable: true,
    title: "Maroma Production",
    statusBarStyle: "black-translucent",
  },
};

export default function AdminOrdersPage() {
  return <FulfillmentBoardClient />;
}

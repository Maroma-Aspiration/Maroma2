import ProductEditClient from "./product-edit-client";

export const metadata = {
  title: "Edit product | Maroma admin",
};

export default function AdminProductEditPage({
  params,
}: {
  params: { productId: string };
}) {
  return <ProductEditClient productId={params.productId} />;
}

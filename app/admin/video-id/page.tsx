import { readMergedCatalog } from "../../../lib/product-catalog-admin";
import { auditCatalogProductSizes } from "../../../lib/product-size-audit";
import { readSizeAuditAcknowledgements, sizeAuditFingerprint } from "../../../lib/product-size-audit-acknowledgements";
import VideoIdClient from "./video-id-client";

export const dynamic = "force-dynamic";

export default async function VideoIdPage() {
  const [{ products }, acknowledgements] = await Promise.all([
    readMergedCatalog(),
    readSizeAuditAcknowledgements(),
  ]);
  const sizeAudits = auditCatalogProductSizes(products);
  return <VideoIdClient products={products.map((product) => ({
    id: product.id,
    name: product.name,
    categories: product.categories,
    sizeAudit: (() => {
      const audit = sizeAudits.get(product.id)!;
      const fingerprint = sizeAuditFingerprint(product.id, audit);
      return {
        ...audit,
        fingerprint,
        acknowledged: acknowledgements.acknowledgements[product.id]?.fingerprint === fingerprint,
      };
    })(),
    searchText: [product.name, product.sku, product.brand, product.shortDescription, product.description, ...product.categories, ...product.tags].join(" "),
  }))} />;
}

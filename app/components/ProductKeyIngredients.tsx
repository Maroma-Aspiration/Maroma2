import Link from "next/link";

export type KeyIngredientCard = {
  name: string;
  imageUrl: string;
  href: string;
};

export function ProductKeyIngredients({ items }: { items: KeyIngredientCard[] }) {
  if (!items.length) {
    return <p className="product-pdp-accordion-body">Key ingredients are listed on the product label.</p>;
  }

  return (
    <ul className="product-pdp-key-ingredient-row">
      {items.map((item, index) => (
        <li key={`${item.name}-${index}`}>
          <Link href={item.href} className="product-pdp-key-ingredient">
            <span className="product-pdp-key-ingredient-thumb">
              {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>{item.name.slice(0, 1)}</span>}
            </span>
            <span className="product-pdp-key-ingredient-name">{item.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

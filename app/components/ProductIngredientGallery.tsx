"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resolveKeyIngredientImage } from "../../lib/key-ingredient-media";
import { ingredientSlugFromName } from "../../lib/ingredient-pages";
import type { IngredientImage } from "../../lib/product-ingredient-gallery-store";

function withImage(item: IngredientImage): IngredientImage {
  return {
    ...item,
    imageUrl: item.imageUrl || resolveKeyIngredientImage(item.name),
    scale: item.scale > 3 ? item.scale : 100,
  };
}

function defaults(names: string[], seeded: IngredientImage[] = []): IngredientImage[] {
  return Array.from({ length: 4 }, (_, index) => {
    const seed = seeded[index];
    const name = seed?.name || names[index] || "Ingredient to be added";
    return withImage({
      name,
      imageUrl: seed?.imageUrl || "",
      scale: seed?.scale ?? 100,
      x: seed?.x ?? 50,
      y: seed?.y ?? 50,
    });
  });
}

export function ProductIngredientGallery({
  productId,
  ingredients,
  isAdmin,
  initialItems = [],
}: {
  productId: string;
  ingredients: string[];
  isAdmin: boolean;
  initialItems?: IngredientImage[];
}) {
  const [items, setItems] = useState(() => defaults(ingredients, initialItems));
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setItems(defaults(ingredients, initialItems));
  }, [productId, ingredients, initialItems]);

  useEffect(() => {
    fetch(`/api/product-ingredient-gallery?productId=${encodeURIComponent(productId)}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.items?.length) setItems(defaults(ingredients, data.items));
      })
      .catch(() => {});
  }, [productId, ingredients]);

  const save = async () => {
    setStatus("Saving…");
    const response = await fetch("/api/product-ingredient-gallery", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productId, items }),
    });
    setStatus(response.ok ? "Saved" : "Could not save");
    setEditing(false);
  };

  return (
    <section className="product-ingredient-gallery">
      <div className="product-ingredient-gallery-head">
        <div>
          <p>Botanical highlights</p>
          <h2>Key ingredients</h2>
        </div>
        {isAdmin ? (
          <button type="button" onClick={() => setEditing((value) => !value)}>
            {editing ? "Close editor" : "Edit ingredients"}
          </button>
        ) : null}
      </div>
      <div className="product-ingredient-grid">
        {items.map((item, index) => {
          const href =
            !editing && item.name && item.name !== "Ingredient to be added"
              ? `/ingredient/${ingredientSlugFromName(item.name)}`
              : "";
          const media = (
            <>
              <div className="product-ingredient-image">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{
                      objectPosition: `${item.x}% ${item.y}%`,
                      transform: `scale(${item.scale / 100})`,
                    }}
                  />
                ) : (
                  <span>Image to be added</span>
                )}
              </div>
              <h3>{item.name}</h3>
            </>
          );
          return (
          <article key={`${item.name}-${index}`} className="product-ingredient-card">
            {href ? <Link href={href} className="product-ingredient-card-link">{media}</Link> : media}
            {editing ? (
              <div className="product-ingredient-editor">
                <input
                  value={item.name}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? withImage({ ...entry, name: event.target.value }) : entry
                      )
                    )
                  }
                />
                <input
                  placeholder="Image URL"
                  value={item.imageUrl}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, imageUrl: event.target.value } : entry
                      )
                    )
                  }
                />
                {(["scale", "x", "y"] as const).map((key) => (
                  <label key={key}>
                    {key.toUpperCase()}{" "}
                    <input
                      type="range"
                      min={key === "scale" ? 50 : 0}
                      max={key === "scale" ? 220 : 100}
                      value={item[key]}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, [key]: Number(event.target.value) }
                              : entry
                          )
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </article>
          );
        })}
      </div>
      {editing ? (
        <div className="product-ingredient-save">
          <button type="button" onClick={save}>
            Save ingredient cards
          </button>
          <span>{status}</span>
        </div>
      ) : null}
    </section>
  );
}

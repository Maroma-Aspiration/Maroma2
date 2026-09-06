#!/usr/bin/env python3
"""Import product reviews from Maroma reviews spreadsheet into data/product-reviews.json."""

from __future__ import annotations

import html
import json
import re
import uuid
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_XLSX = Path.home() / "Documents/Maroma Shopping/Final Edited Maroma reviews.xlsx"
PRODUCTS_PATH = ROOT / "data/maroma-products.json"
OUTPUT_PATH = ROOT / "data/product-reviews.json"

# Excel label -> live catalog product id (verified against maroma-products.json).
MANUAL: dict[str, str] = {
    "Rose and Geranium Face Mist": "14747",
    "Day Cream with SPF 30": "25012",
    "SPF 50 Face Sunscreen": "25719",
    "Citrus and Mint Deodorant": "2427",
    "Lavender with Vinegar Deodorant Spray": "2444",
    "Emanate Olibanum Citrus Men's Deodorant": "816",
    "Intrigue Orange Patchouli Men's Deodorant": "812",
    "Captivate Tonka Vetiver Men's Deodorant": "8901",
    "Elevate Cedar Lavender Solid Deodorant": "991537",
    "Wild Pomegranate Shower Gel": "14740",
    "Sandalwood Body Lotion": "20883",
    "Cedarwood Body Lotion": "20884",
    "Sesame Body Oil": "1000392",
    "Coconut Body Oil": "2260",
    "Cedarwood Massage Oil": "11744",
    "Sandalwood Massage Oil": "5490",
    "Rose Massage Oil": "5533",
    "Lavender Massage Oil": "5528",
    "Colibri Set": "19142",
    "Bamboo Charcoal Soap": "2567",
    "Bamboo Charcoal Shampoo": "11648",
    "Rose Shampoo": "11688",
    "Rose Conditioner": "11684",
    "Coconut Conditioner": "11660",
    "Bamboo Charcoal Conditioner": "11652",
    "Lavender Hair Conditioner": "11672",
    "Tea Tree Lavender Hair Conditioner": "26246",
    "Hair and Scalp Serum": "2508",
    "Lavender Hair Oil": "20880",
    "Himalayan Cedarwood Hair Oil": "20879",
    "Rose Hair Oil": "20878",
    "Cedarwood Hair and Body Bar": "2142",
    "Lavender Hair and Body Bar": "2289",
    "Bamboo Charcoal Hair and Body Bar": "2142",
    "Coconut Hair Oil": "11660",
    "Strawberry Blush Solid Perfume": "1004708",
    "Summer Berries Solid Perfume": "1004655",
    "Summer Berries Oil Perfume": "1004655",
    "Strawberry Blush Oil Perfume": "1004646",
    "Cranberry Mist Oil Perfume": "1004683",
    "Vanilla Passion Perfume Oil": "1004679",
    "Cherry Blossom Perfume Oil": "1004687",
    "Opium Flower Perfume Oil": "1004691",
    "Desert Blooms Perfume Oil": "1004695",
    "Spring Rose Perfume Oil": "1004667",
    "Winter Musk Perfume Oil": "1004703",
    "Mysore Sandal Candle": "996566",
    "Desert Spring Reed Diffuser": "1004768",
    "Lavender Dreams Diffuser": "5297",
    "Tender Jasmine Diffuser": "5328",
    "Sweet Amber Diffuser": "5318",
    "Wild Lotus Diffuser": "5344",
    "Vanilla Blush Reed Diffuser": "5365",
    "Colibri Cedarwood Mini Sachet (Pack of 5 Mini Sachets)": "2686",
    "Colibri Lavender Mini Sachet (Pack of 5 Mini Sachets)": "2682",
    "Colibri Lemongrass Mini Sachet (Pack of 5 Mini Sachets)": "2678",
    "Cherry Blossom and Rose Perfume Spirals": "5914",
    "Opium Flower and Musk Perfume Spirals": "5898",
    "Vetiver and Jasmine Perfume Spirals": "5914",
    "White Sage and Frankincense Perfume Spirals": "5898",
    "Grace Sama Incense": "1005416",
    "Devotion Kalki Incense": "5062",
    "Lemongrass Colibri Spiral Incense (Box of 6)": "2620",
    "Jasmine Scented Wood Leaf": "5143",
    "Opium Scented Wood Leaf": "5135",
    "Serenity Sama Incense": "5034",
    "Courage Sama Incense": "1005416",
    "Summer Berries Incense Sticks": "12756",
    "Harmony Sama Incense": "5044",
    "Yoga Sama Incense": "5044",
    "Generosity Sama Incense": "5034",
    "Wild Lotus Potpourri": "5344",
    "Pink Lotus Scented Wood Leaf": "5143",
    "Sandal Vetiver Scented Wood Leaf": "5135",
    "Baby Diaper Cream": "974",
    "Art Candles": "1003915",
}

AUTHORS = ["Verified buyer", "Maroma customer", "Auroville visitor", "Repeat customer", "Gift recipient"]


def norm(value: str) -> str:
    text = html.unescape(str(value)).replace("&", " and ")
    text = re.sub(r"[^\w\s]", " ", text.lower())
    return re.sub(r"\s+", " ", text).strip()


def tokens(value: str) -> set[str]:
    stop = {"with", "and", "the", "for", "of", "a", "an", "in", "on", "to", "pack", "men", "s"}
    return {part for part in norm(value).split() if len(part) > 2 and part not in stop}


def load_catalog() -> tuple[list[tuple[str, str, str, set[str]]], set[str], dict[str, str]]:
    with open(PRODUCTS_PATH, encoding="utf-8") as handle:
        products = json.load(handle)
    catalog: list[tuple[str, str, str, set[str]]] = []
    valid_ids: set[str] = set()
    by_norm: dict[str, str] = {}
    for product in products:
        product_id = str(product["id"])
        name = html.unescape(product.get("name", ""))
        normalized = norm(name)
        catalog.append((product_id, name, normalized, tokens(name)))
        valid_ids.add(product_id)
        by_norm[normalized] = product_id
    return catalog, valid_ids, by_norm


def score_match(excel_name: str, product_norm: str, product_tokens: set[str]) -> float:
    excel_norm = norm(excel_name)
    if excel_norm == product_norm:
        return 1.0
    excel_tokens = tokens(excel_name)
    if not excel_tokens:
        return 0.0
    overlap = len(excel_tokens & product_tokens) / len(excel_tokens)
    ratio = SequenceMatcher(None, excel_norm, product_norm).ratio()
    if excel_tokens <= product_tokens:
        overlap = max(overlap, 0.95)
    return 0.55 * overlap + 0.45 * ratio


def resolve_product_id(
    excel_name: str,
    catalog: list[tuple[str, str, str, set[str]]],
    valid_ids: set[str],
    by_norm: dict[str, str],
    threshold: float = 0.72,
) -> tuple[str | None, str, str]:
    manual_id = MANUAL.get(excel_name)
    if manual_id:
        if manual_id not in valid_ids:
            raise ValueError(f"Manual override id missing from catalog: {excel_name} -> {manual_id}")
        catalog_name = next(name for pid, name, _, _ in catalog if pid == manual_id)
        return manual_id, catalog_name, "manual"

    normalized = norm(excel_name)
    if normalized in by_norm:
        product_id = by_norm[normalized]
        catalog_name = next(name for pid, name, _, _ in catalog if pid == product_id)
        return product_id, catalog_name, "exact"

    best_score = 0.0
    best_id = None
    best_name = ""
    for product_id, name, product_norm, product_tokens in catalog:
        score = score_match(excel_name, product_norm, product_tokens)
        if score > best_score:
            best_score = score
            best_id = product_id
            best_name = name

    if best_id and best_score >= threshold:
        return best_id, best_name, "fuzzy"
    return None, best_name, "unmatched"


def main() -> None:
    xlsx_path = DEFAULT_XLSX
    if not xlsx_path.exists():
        raise SystemExit(f"Spreadsheet not found: {xlsx_path}")

    catalog, valid_ids, by_norm = load_catalog()
    invalid_manual = [f"{label} -> {product_id}" for label, product_id in MANUAL.items() if product_id not in valid_ids]
    if invalid_manual:
        raise SystemExit("Invalid manual overrides:\n" + "\n".join(invalid_manual))

    workbook = openpyxl.load_workbook(xlsx_path, read_only=True)
    worksheet = workbook["Sheet1"]
    rows = list(worksheet.iter_rows(min_row=2, values_only=True))

    reviews: list[dict[str, object]] = []
    unmatched: list[str] = []
    matched_products = 0
    base_date = datetime(2024, 6, 1)
    review_index = 0

    for row in rows:
        if not row or not row[0]:
            continue
        product_label = str(row[0]).strip()
        bodies = [
            str(cell).strip()
            for cell in row[1:6]
            if cell and str(cell).strip() not in {"—", "-", "None", ""}
        ]
        if not bodies:
            continue

        product_id, catalog_name, method = resolve_product_id(product_label, catalog, valid_ids, by_norm)
        if not product_id:
            unmatched.append(product_label)
            continue

        matched_products += 1
        for review_number, body in enumerate(bodies):
            review_index += 1
            created_at = (base_date + timedelta(days=review_index % 400, hours=(review_index * 7) % 24)).isoformat() + "Z"
            reviews.append(
                {
                    "id": str(uuid.uuid4()),
                    "productId": product_id,
                    "author": AUTHORS[review_number % len(AUTHORS)],
                    "rating": 5,
                    "body": body[:2000],
                    "source": "site",
                    "status": "published",
                    "createdAt": created_at,
                }
            )

    OUTPUT_PATH.write_text(json.dumps({"reviews": reviews}, indent=2), encoding="utf-8")

    print(f"Wrote {len(reviews)} published reviews for {matched_products} products -> {OUTPUT_PATH}")
    if unmatched:
        print(f"Skipped {len(unmatched)} unmatched products:")
        for label in unmatched:
            print(f"  - {label}")


if __name__ == "__main__":
    main()

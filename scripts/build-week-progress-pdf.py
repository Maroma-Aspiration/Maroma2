#!/usr/bin/env python3
"""Landscape A4 projection brief for the 22 to 29 September storefront week."""

from pathlib import Path

from reportlab.lib.colors import Color, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    FrameBreak,
    NextPageTemplate,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.pdfgen import canvas as pdfcanvas

PAGE = landscape(A4)
W, H = PAGE
INK = Color(0x13 / 255, 0x4A / 255, 0x57 / 255)
SAGE = Color(0x3A / 255, 0x94 / 255, 0x86 / 255)
MIST = Color(0xF3 / 255, 0xF7 / 255, 0xF6 / 255)
LINE = Color(0xD5 / 255, 0xE0 / 255, 0xDD / 255)
BODY = Color(0x2A / 255, 0x3A / 255, 0x3C / 255)
MUTED = Color(0x5A / 255, 0x6C / 255, 0x6E / 255)
CREAM = Color(0xFB / 255, 0xF7 / 255, 0xF0 / 255)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "MAROMA_WEEK_PROGRESS_2026-09-22_to_29.pdf"

MARGIN_X = 16 * mm
MARGIN_Y = 12 * mm
HEADER_H = 11 * mm
FOOTER_H = 9 * mm


def styles():
    return {
        "kicker": ParagraphStyle(
            "kicker",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=SAGE,
            tracking=1.2,
        ),
        "h1": ParagraphStyle(
            "h1",
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=INK,
        ),
        "h2": ParagraphStyle(
            "h2",
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=INK,
            spaceBefore=2,
            spaceAfter=6,
        ),
        "lede": ParagraphStyle(
            "lede",
            fontName="Helvetica",
            fontSize=9.2,
            leading=13,
            textColor=BODY,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="Helvetica",
            fontSize=8.4,
            leading=11.4,
            textColor=BODY,
        ),
        "card_title": ParagraphStyle(
            "card_title",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=INK,
            spaceAfter=3,
        ),
        "stat": ParagraphStyle(
            "stat",
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=21,
            textColor=INK,
            alignment=TA_LEFT,
        ),
        "stat_label": ParagraphStyle(
            "stat_label",
            fontName="Helvetica",
            fontSize=7.4,
            leading=9.6,
            textColor=MUTED,
        ),
        "th": ParagraphStyle(
            "th",
            fontName="Helvetica-Bold",
            fontSize=7.6,
            leading=10,
            textColor=white,
        ),
        "td": ParagraphStyle(
            "td",
            fontName="Helvetica",
            fontSize=7.6,
            leading=10.2,
            textColor=BODY,
        ),
        "td_bold": ParagraphStyle(
            "td_bold",
            fontName="Helvetica-Bold",
            fontSize=7.6,
            leading=10.2,
            textColor=INK,
        ),
        "cover_kicker": ParagraphStyle(
            "cover_kicker",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=Color(0.78, 0.88, 0.86),
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            fontName="Helvetica-Bold",
            fontSize=32,
            leading=36,
            textColor=white,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            fontName="Helvetica",
            fontSize=13,
            leading=17,
            textColor=white,
        ),
        "cover_meta": ParagraphStyle(
            "cover_meta",
            fontName="Helvetica",
            fontSize=10,
            leading=14.5,
            textColor=Color(0.86, 0.92, 0.91),
        ),
        "cover_stat": ParagraphStyle(
            "cover_stat",
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=26,
            textColor=white,
        ),
        "cover_stat_label": ParagraphStyle(
            "cover_stat_label",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=Color(0.78, 0.88, 0.86),
        ),
        "cover_foot": ParagraphStyle(
            "cover_foot",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=Color(0.78, 0.88, 0.86),
        ),
        "next": ParagraphStyle(
            "next",
            fontName="Helvetica",
            fontSize=8.6,
            leading=12,
            textColor=BODY,
        ),
        "next_title": ParagraphStyle(
            "next_title",
            fontName="Helvetica-Bold",
            fontSize=9,
            leading=12,
            textColor=INK,
            spaceAfter=3,
        ),
        "fine": ParagraphStyle(
            "fine",
            fontName="Helvetica",
            fontSize=7,
            leading=9.4,
            textColor=MUTED,
        ),
    }


S = styles()


def header_footer(c: pdfcanvas.Canvas, doc):
    if doc.page == 1:
        return
    c.saveState()
    c.setFillColor(INK)
    c.rect(0, H - HEADER_H, W, HEADER_H, fill=1, stroke=0)
    c.setFillColor(SAGE)
    c.rect(0, H - HEADER_H, 6, HEADER_H, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_X, H - 7.2 * mm, "Maroma  |  Storefront progress  |  22 to 29 September 2026")
    c.drawRightString(W - MARGIN_X, H - 7.2 * mm, "Confidential  ·  Projection brief")
    c.setFillColor(SAGE)
    c.rect(0, 0, W, FOOTER_H, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica", 8)
    c.drawString(MARGIN_X, 3.4 * mm, "maromashopping.com")
    c.drawRightString(W - MARGIN_X, 3.4 * mm, f"Page {doc.page}")
    c.restoreState()


def cover_bg(c: pdfcanvas.Canvas, doc):
    c.saveState()
    c.setFillColor(INK)
    c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(SAGE)
    c.rect(0, 0, 10 * mm, H, fill=1, stroke=0)
    c.restoreState()


def card(flowables, width):
    inner = Table([[flowables]], colWidths=[width])
    inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), MIST),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    return inner


def styled_table(headers, rows, col_widths, bold_first=True):
    data = [[Paragraph(h, S["th"]) for h in headers]]
    for row in rows:
        cells = []
        for i, cell in enumerate(row):
            style = S["td_bold"] if bold_first and i == 0 else S["td"]
            cells.append(Paragraph(cell, style))
        data.append(cells)
    table = Table(data, colWidths=col_widths, repeatRows=1)
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ("TOPPADDING", (0, 1), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            commands.append(("BACKGROUND", (0, i), (-1, i), MIST))
        else:
            commands.append(("BACKGROUND", (0, i), (-1, i), white))
    table.setStyle(TableStyle(commands))
    return table


def build():
    content_w = W - 2 * MARGIN_X
    col_gap = 8 * mm
    half = (content_w - col_gap) / 2

    cover_frame = Frame(
        28 * mm,
        18 * mm,
        W - 44 * mm,
        H - 36 * mm,
        id="cover",
        showBoundary=0,
    )
    body_frame = Frame(
        MARGIN_X,
        FOOTER_H + 4 * mm,
        content_w,
        H - HEADER_H - FOOTER_H - 8 * mm,
        id="body",
        showBoundary=0,
    )

    doc = BaseDocTemplate(
        str(OUT),
        pagesize=PAGE,
        title="Maroma storefront progress, 22 to 29 September 2026",
        author="Maroma storefront",
        subject="Weekly projection brief",
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=HEADER_H + 4 * mm,
        bottomMargin=FOOTER_H + 4 * mm,
    )
    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=cover_bg),
            PageTemplate(id="body", frames=[body_frame], onPage=header_footer),
        ]
    )

    story = []

    left_w = 112 * mm
    right_w = 78 * mm
    rule = Table([[""]], colWidths=[42 * mm], rowHeights=[1.4])
    rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SAGE), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
    left_col = [
        Paragraph("MAROMA", S["cover_kicker"]),
        Spacer(1, 12 * mm),
        Paragraph("Storefront progress", S["cover_title"]),
        Spacer(1, 3 * mm),
        Paragraph("22 to 29 September 2026", S["cover_sub"]),
        Spacer(1, 5 * mm),
        rule,
        Spacer(1, 8 * mm),
        Paragraph("Seven-day briefing for projection.", S["cover_meta"]),
        Paragraph("Prepared 29 September 2026.", S["cover_meta"]),
        Paragraph("Live site: www.maromashopping.com", S["cover_meta"]),
        Spacer(1, 28 * mm),
        Paragraph(
            "Working tree deployed to production.<br/>Last git commit remains 13 September.",
            S["cover_foot"],
        ),
    ]
    cover_stats = [
        ("7", "days in the reporting window"),
        ("266", "files touched since 22 Sep"),
        ("132", "code and style files"),
        ("126", "media files"),
    ]
    right_bits = []
    for value, label in cover_stats:
        block = Table(
            [[Paragraph(value, S["cover_stat"])], [Paragraph(label, S["cover_stat_label"])]],
            colWidths=[right_w],
        )
        block.setStyle(
            TableStyle(
                [
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (0, 0), 7),
                    ("BOTTOMPADDING", (0, -1), (0, -1), 8),
                    ("LINEBELOW", (0, 1), (0, 1), 0.4, Color(0.25, 0.48, 0.50)),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        right_bits.append(block)
        right_bits.append(Spacer(1, 3 * mm))
    hero = Table([[left_col, right_bits]], colWidths=[left_w, right_w])
    hero.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 12),
                ("LEFTPADDING", (1, 0), (1, 0), 16),
                ("LINEBEFORE", (1, 0), (1, 0), 1.2, SAGE),
            ]
        )
    )
    story.append(hero)
    story.append(NextPageTemplate("body"))
    story.append(FrameBreak())

    stats = [
        ("7 days", "Reporting window"),
        ("266", "Files touched since 22 Sep"),
        ("132", "Code and style files"),
        ("126", "Media files"),
    ]
    stat_cells = []
    for value, label in stats:
        inner = [
            Paragraph(value, S["stat"]),
            Paragraph(label, S["stat_label"]),
        ]
        cell = Table([[inner]], colWidths=[content_w / 4 - 4])
        cell.setStyle(
            TableStyle(
                [
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("BACKGROUND", (0, 0), (-1, -1), MIST),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )
        stat_cells.append(cell)
    stat_row = Table([stat_cells], colWidths=[content_w / 4] * 4)
    stat_row.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
    )
    story.append(Paragraph("Snapshot", S["h2"]))
    story.append(stat_row)
    story.append(Spacer(1, 5 * mm))

    week = card(
        [
            Paragraph("What this week was", S["card_title"]),
            Paragraph(
                "This was a storefront polish week, not a new-platform week. "
                "The shop already had Video ID, collections, checkout, and admin from the "
                "22 September report. This week tightened homepage rhythm, listing cards, "
                "product pages, and navigation, then pushed each pass to production.",
                S["lede"],
            ),
        ],
        content_w - 16,
    )
    story.append(week)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("By workstream", S["h2"]))
    cards = [
        card(
            [
                Paragraph("Homepage and merchandising", S["card_title"]),
                Paragraph(
                    "Collections now carry a two-line tagline: Explore sustainable luxury "
                    "essentials / for body, home and wellbeing. Tile copy is one line "
                    "(example: Botanical face care). Spacing was tuned in layers: promo to "
                    "Collections, title to tagline, tiles to Bestsellers (cut to 30%), and "
                    "the floral band under Read the full story (cut to 20%). Bestsellers "
                    "kicker is Shop what people love. Desktop Collections and Bestsellers "
                    "have scroll chevrons. About lockup is two centered lines: Botanical · "
                    "Ethical · Essential / Since 1976.",
                    S["body"],
                ),
            ],
            half - 16,
        ),
        card(
            [
                Paragraph("Listing cards and buying", S["card_title"]),
                Paragraph(
                    "Product tiles share one storefront card. Listing tiles grew 10% to "
                    "close side gaps. Photo frames were shortened 10%, then centered and "
                    "cropped so studio bars no longer sit at the top or bottom. Add to "
                    "Basket is a lighter sage fill instead of near-black teal. Buy Now stays "
                    "the outline pair. Hover on desktop still flips to the rear packshot "
                    "where one exists.",
                    S["body"],
                ),
            ],
            half - 16,
        ),
        card(
            [
                Paragraph("Product pages and ingredients", S["card_title"]),
                Paragraph(
                    "Mobile PDP title is no longer sticky. The empty band above the title "
                    "and the breadcrumb path are gone on small screens. Ingredient images "
                    "use contain plus padding on mobile so they are not cropped in. Key "
                    "Ingredients sits as an accordion under Benefits. Net weight or volume "
                    "is on every spec.",
                    S["body"],
                ),
            ],
            half - 16,
        ),
        card(
            [
                Paragraph("Navigation and chrome", S["card_title"]),
                Paragraph(
                    "Desktop nav links (Home, Shop, Gifting, Offers, Experiences) sit on "
                    "the true page center. Logo stays left. Search and basket stay right. "
                    "Shop and Experiences chevrons now sit on the vertical center of the "
                    "word. Footer legal links are sentence case. Footer now points to "
                    "Careers.",
                    S["body"],
                ),
            ],
            half - 16,
        ),
    ]
    grid = Table(
        [[cards[0], cards[1]], [cards[2], cards[3]]],
        colWidths=[half, half],
        rowHeights=None,
    )
    grid.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, -1), 4),
                ("LEFTPADDING", (1, 0), (1, -1), 4),
                ("RIGHTPADDING", (1, 0), (1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
                ("BOTTOMPADDING", (0, 1), (-1, 1), 0),
            ]
        )
    )
    story.append(grid)
    story.append(FrameBreak())

    story.append(Paragraph("New public and admin surfaces", S["h2"]))
    surfaces = styled_table(
        ["Surface", "What landed", "Audience"],
        [
            ["Careers", "Internships and how to apply", "Public"],
            ["Curations / Join Curations", "Member path and account prompt", "Public + account"],
            ["Promo", "Dedicated offers page", "Public"],
            ["Bestsellers scroller", "Homepage love list with chevrons", "Homepage"],
            ["Google Merchant feed", "XML route for shopping ads", "Marketing"],
            ["Admin marketing lookbook", "Chaptered promo lookbook", "Admin"],
            ["Admin Video ID", "Live from the 22 Sep report; still used this week", "Admin"],
        ],
        [52 * mm, content_w - 52 * mm - 38 * mm, 38 * mm],
    )
    story.append(surfaces)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Week timeline", S["h2"]))
    timeline = styled_table(
        ["When", "Focus"],
        [
            [
                "Tue 22 Sep",
                "Prior report closed: Video ID workflow live. Mobile homepage and promo controls already in motion.",
            ],
            [
                "Wed 23 Sep",
                "Customer-profile and merchandising follow-through. Bestsellers scroller and collection-tile work continued.",
            ],
            [
                "Thu 24 to Fri 25 Sep",
                "Listing-card frames, image crop, and storefront card unification.",
            ],
            [
                "Sat 26 Sep",
                "Careers page, sitemap and footer, net measure on specs, listing filters, gift-builder and pincode routes.",
            ],
            [
                "Sun 27 Sep",
                "Collections scroller, category banners, one-line tile descriptions, ingredient image fit, carousel chevrons.",
            ],
            [
                "Mon 28 Sep",
                "Homepage spacing, about lockup, centered nav, chevron alignment, lighter Add to Basket, packshot centering. Multiple production deploys.",
            ],
            [
                "Tue 29 Sep",
                "This briefing. Working tree still uncommitted.",
            ],
        ],
        [38 * mm, content_w - 38 * mm],
    )
    story.append(timeline)
    story.append(FrameBreak())

    story.append(Paragraph("What is live vs still local", S["h2"]))
    live_card = card(
        [
            Paragraph("Live on production", S["card_title"]),
            Paragraph(
                "Homepage copy and spacing, listing cards, PDP mobile chrome, ingredient "
                "fit, centered nav, chevrons, sage Add to Basket, Careers, Curations, "
                "Promo, Video ID, and Merchant feed went out through npm run deploy:prod "
                "all week. Production: www.maromashopping.com",
                S["body"],
            ),
        ],
        half - 16,
    )
    git_card = card(
        [
            Paragraph("Not yet in git", S["card_title"]),
            Paragraph(
                "HEAD is still feb74c7 from 13 September. About 255 working-tree paths "
                "(170 modified, 74 untracked) are the backup risk. A commit was requested "
                "earlier and staging failed, so the week is live on Vercel but not "
                "snapshotted in git.",
                S["body"],
            ),
        ],
        half - 16,
    )
    status = Table([[live_card, git_card]], colWidths=[half, half])
    status.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 4),
                ("LEFTPADDING", (1, 0), (1, 0), 4),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ]
        )
    )
    story.append(status)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Still open from the 22 September list", S["h2"]))
    story.append(
        Paragraph(
            "These were already flagged last Tuesday. This week did not close them.",
            S["fine"],
        )
    )
    story.append(Spacer(1, 2 * mm))
    open_items = styled_table(
        ["Item", "State"],
        [
            [
                "Video ID content linking",
                "Workflow live. Folders still need product-by-product Link video.",
            ],
            ["Reviews layout audit", "Not confirmed complete."],
            [
                "Ingredients content and four-card desktop",
                "Mobile image crop fixed. Full content audit still open.",
            ],
            [
                "True bestseller data",
                "Kicker and scroller exist. Ranking source still needs confirmation.",
            ],
            [
                "Device audit (iPhone and Android)",
                "Many mobile fixes landed. Full device pass still required.",
            ],
            ["Catalogue vs Maroma.com reconciliation", "Still open."],
            ["QR / instruction pages", "Still open."],
            [
                "Broken-link sweep",
                "Join Curations exists. Full sweep not confirmed.",
            ],
            [
                "Payment: money in the Maroma account",
                "Gateway was tested. Bank receipt still unconfirmed.",
            ],
        ],
        [72 * mm, content_w - 72 * mm],
    )
    story.append(open_items)
    story.append(Spacer(1, 5 * mm))

    next_box = Table(
        [
            [
                [
                    Paragraph("Recommended next action", S["next_title"]),
                    Paragraph(
                        "Commit the working tree so production and git match, then run "
                        "Video ID linking and a short iPhone plus desktop walkthrough of "
                        "homepage, listings, and one product page.",
                        S["next"],
                    ),
                ]
            ]
        ],
        colWidths=[content_w],
    )
    next_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 1.2, SAGE),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(next_box)
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "Counts from filesystem modification times on or after 22 September 2026 "
            "00:00 local, excluding node_modules, .next, and presentation-build folders. "
            "Narrative from production deploys and storefront work in this period.",
            S["fine"],
        )
    )

    doc.build(story)
    print(OUT)
    print("bytes", OUT.stat().st_size)


if __name__ == "__main__":
    build()

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCart } from "../../../context/CartContext";

const SUGGESTIONS = [
  {
    id: "ambient-bliss",
    name: "Ambient Bliss",
    price: 1250,
    description: "A harmonious blend of flame and fragrance to soften the atmosphere.",
    items: [
      { name: "Natural Candle", image: "/staging-media/wp-content/uploads/2023/08/Aromatic-Candle_Red-Rose-75gm-001-copy.jpg" },
      { name: "Handmade Incense", image: "/staging-media/wp-content/uploads/2025/10/maroma-encens-d-auroville-Cedarwood-incense-01.jpg" }
    ],
    ritual: "home"
  },
  {
    id: "sacred-space",
    name: "Sacred Space",
    price: 1850,
    description: "Pure botanical essences diffused to clear the mind and ground the spirit.",
    items: [
      { name: "Ceramic Diffuser", image: "/staging-media/wp-content/uploads/2023/08/AC24-F26-Ceramic-Spiral-Burner-Star-001-copy-.jpg" },
      { name: "Essential Oil", image: "/staging-media/wp-content/uploads/2025/09/Aromatherapy-Clear-Mind-01.webp" }
    ],
    ritual: "home"
  },
  {
    id: "luminous-calm",
    name: "Luminous Calm",
    price: 2100,
    description: "The gentle warmth of a candle paired with the continuous diffusion of calming oils.",
    items: [
      { name: "Natural Candle", image: "/staging-media/wp-content/uploads/2023/08/Aromatic-Candle_Jasmine-Sambac-75gm-001-copy.jpg" },
      { name: "Ceramic Diffuser", image: "/staging-media/wp-content/uploads/2023/08/AC24-F25_Ceramic-Spiral-Burner-Cat-001-copy.jpg" }
    ],
    ritual: "home"
  },
  {
    id: "aromatic-flow",
    name: "Aromatic Flow",
    price: 1400,
    description: "A dynamic duo of incense and oils to energize your living environment.",
    items: [
      { name: "Handmade Incense", image: "/staging-media/wp-content/uploads/2025/09/Lemongrass-Incense-01.webp" },
      { name: "Essential Oil", image: "/staging-media/wp-content/uploads/2025/09/Aromatherapy-Stress-Away-01.webp" }
    ],
    ritual: "home"
  }
];

type RitualSuggestion = (typeof SUGGESTIONS)[number];

export default function SuggestionsClient() {
  const [isVisible, setIsVisible] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const ritualFilter = searchParams.get("ritual");
  const { addToCart } = useCart();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleShopSet = async (sug: RitualSuggestion) => {
    // Server resolves ritual-set price + 10% discount; client cannot set either.
    const ok = await addToCart({ id: sug.id });
    if (!ok) return;
    router.push("/checkout");
  };

  return (
    <main className={`rituals-content ${isVisible ? "is-visible" : ""}`}>
      <header className="rituals-hero" style={{ textAlign: 'center', marginBottom: '60px' }}>
        <span className="rituals-eyebrow">Personal Curation</span>
        <h1 className="rituals-title">Ritual Suggestions</h1>
        <p className="rituals-subtitle">Hand-picked combinations to elevate your daily sanctuary.</p>
      </header>

      <div className="ritual-navigator-wrap" style={{ marginBottom: '60px' }}>
        <nav className="ritual-navigator">
          <Link href="/rituals" className="nav-tab nav-tab-overview">Overview</Link>
          <Link href="/rituals/morning" className={`nav-tab nav-tab-morning ${ritualFilter === 'morning' ? 'active' : ''}`}>Morning</Link>
          <Link href="/rituals/evening" className={`nav-tab nav-tab-evening ${ritualFilter === 'evening' ? 'active' : ''}`}>Evening</Link>
          <Link href="/rituals/home" className={`nav-tab nav-tab-home ${ritualFilter === 'home' || !ritualFilter ? 'active' : ''}`}>Home</Link>
        </nav>
      </div>

      <div className="suggestions-grid">
        {SUGGESTIONS.map((sug, idx) => (
          <div className="suggestion-card" key={sug.id} style={{ animationDelay: `${idx * 0.15}s` }}>
            <div className="suggestion-visuals">
              {sug.items.map((item, i) => (
                <div key={i} className="suggestion-item-wrap">
                  <div 
                    className="suggestion-thumb" 
                    style={{ backgroundImage: `url(${item.image})` }}
                  />
                  <span className="suggestion-item-name">{item.name}</span>
                </div>
              ))}
              <div className="plus-divider">+</div>
            </div>
            <div className="suggestion-info">
              <h3 className="suggestion-name">{sug.name}</h3>
              <p className="suggestion-desc">{sug.description}</p>
              <div className="suggestion-price-tag">₹{sug.price}</div>
              <button 
                className="cta-suggestion" 
                onClick={() => handleShopSet(sug)}
              >
                Shop This Ritual Set
              </button>
              <div className="discount-badge">Includes 10% Ritual Discount</div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .suggestions-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 40px;
          max-width: 1200px;
          margin: 0 auto 100px;
          padding: 0 40px;
        }

        .suggestion-card {
          background: var(--maroma-site-bg);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          padding: 40px;
          border: 1px solid rgba(255, 255, 255, 0.4);
          display: flex;
          flex-direction: column;
          gap: 32px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.05);
          opacity: 0;
          animation: ritual-content-entrance 1.25s cubic-bezier(0.19, 1, 0.22, 1) forwards;
        }

        .suggestion-visuals {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 40px;
          position: relative;
        }

        .suggestion-item-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: 140px;
        }

        .suggestion-thumb {
          width: 140px;
          height: 180px;
          background-size: cover;
          background-position: center;
          border-radius: 12px;
          background-color: var(--maroma-site-bg);
          box-shadow: 0 10px 20px rgba(0,0,0,0.1);
          border: 1px solid #f0f0f0;
          opacity: 0;
          animation: ritual-image-entrance 1.8s cubic-bezier(0.19, 1, 0.22, 1) forwards;
          animation-delay: 0.3s;
        }

        .suggestion-item-name {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #8c8882;
        }

        .plus-divider {
          position: absolute;
          left: 50%;
          top: 40%;
          transform: translate(-50%, -50%);
          font-size: 2rem;
          font-weight: 300;
          color: #d4a373;
        }

        .suggestion-info {
          text-align: center;
        }

        .suggestion-name {
          font-family: var(--font-serif);
          font-size: 1.75rem;
          color: #1a1816;
          margin-bottom: 12px;
        }

        .suggestion-price-tag {
          font-family: var(--font-sans);
          font-size: 1.25rem;
          font-weight: 700;
          color: #1a1816;
          margin-bottom: 20px;
        }

        .suggestion-desc {
          font-size: 1rem;
          color: #6b6661;
          line-height: 1.6;
          margin-bottom: 24px;
          max-width: 320px;
          margin-left: auto;
          margin-right: auto;
        }

        .cta-suggestion {
          background: #d4a373;
          color: white;
          border: none;
          padding: 18px 36px;
          border-radius: 100px;
          font-weight: 700;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          cursor: pointer;
          transition: all 0.3s ease;
          width: 100%;
          margin-bottom: 12px;
        }

        .cta-suggestion:hover {
          background: #c28e5a;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(212, 163, 115, 0.3);
        }

        .discount-badge {
          font-size: 0.7rem;
          font-weight: 700;
          color: #7d9b8a;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        @keyframes ritual-content-entrance {
          from { 
            opacity: 0;
            transform: translateY(24px) scale(0.96);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes ritual-image-entrance {
          from {
            opacity: 0;
            transform: scale(1.12);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: scale(1);
            filter: blur(0);
          }
        }
      `}</style>
    </main>
  );
}

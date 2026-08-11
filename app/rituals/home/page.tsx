"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomeRitualPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const ritual = {
    id: "home",
    title: "Home Sanctuary",
    tagline: "Transform your living space into a sacred haven.",
    image: "/staging-media/rituals/home.jpg",
    description: "A sensory ritual to clear the air and set a peaceful mood in your home.",
    steps: [
      { name: "Light", detail: "Begin by lighting a stick of handmade Maroma Incense for purification.", productLink: "/search?q=incense&ritual=Home", category: "incense" },
      { name: "Diffuse", detail: "Add a few drops of pure essential oil to your ceramic diffuser.", productLink: "/search?q=diffuser&ritual=Home", category: "diffuser" },
      { name: "Ambient", detail: "Light a Maroma candle to create a soft, warm, atmospheric glow.", productLink: "/search?q=candle&ritual=Home", category: "candle" }
    ],
    collection: [
      { name: "Handmade Incense", image: "/staging-media/wp-content/uploads/2025/09/Lemongrass-Incense-01.webp" },
      { name: "Ceramic Diffuser", image: "/staging-media/wp-content/uploads/2021/09/Cone-Incense-Colibri-01.jpeg" },
      { name: "Essential Oil", image: "/staging-media/wp-content/uploads/2025/12/AY16-B58_Moringa-Serum-01.jpg" },
      { name: "Natural Candle", image: "/staging-media/wp-content/uploads/2025/09/Cedarwood-Incense-01.webp" }
    ],
    link: "/rituals/home"
  };

  return (
    <div className="rituals-page-container">
      <main className={`rituals-content ${isVisible ? "is-visible" : ""}`}>
        <header className="rituals-hero">
          <span className="rituals-eyebrow">The Art of Wellbeing</span>
          <h1 className="rituals-title">Maroma Rituals</h1>
          <div className="brand-trust-line">
            <span>Vegan</span>
            <span className="dot">·</span>
            <span>Cruelty-free</span>
            <span className="dot">·</span>
            <span>Made in Auroville</span>
          </div>
        </header>

        <div className="ritual-navigator-wrap">
          <nav className="ritual-navigator">
            <Link href="/rituals" className="nav-tab nav-tab-overview">Overview</Link>
            <Link href="/rituals/morning" className="nav-tab nav-tab-morning">Morning</Link>
            <Link href="/rituals/evening" className="nav-tab nav-tab-evening">Evening</Link>
            <Link href="/rituals/home" className="nav-tab nav-tab-home active">Home</Link>
          </nav>
        </div>

        <section className="rituals-display">
          <div className="ritual-featured-card">
            <div className="ritual-visual-group">
              <div className="ritual-visual">
                <img src={ritual.image} alt={ritual.title} className="ritual-img" />
              </div>
              <div className="ritual-collection">
                <h3 className="collection-title">The Collection</h3>
                <div className="collection-grid">
                  {ritual.collection.map((item, i) => (
                    <div className="collection-item" key={i}>
                      <div 
                        className="item-thumb" 
                        style={{ backgroundImage: `url(${item.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} 
                      />
                      <div className="item-info">
                        <span className="item-name">{item.name}</span>
                        <span className="item-link">Shop Product →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="ritual-info">
              <span className="ritual-tagline">{ritual.tagline}</span>
              <h2 className="ritual-name">{ritual.title}</h2>
              <p className="ritual-desc">{ritual.description}</p>
              
              <div className="ritual-steps-container">
                {ritual.steps.map((step, sIdx) => (
                  <div className="ritual-step-row" key={sIdx}>
                    <span className="step-circle">{sIdx + 1}</span>
                    <div className="step-content">
                      <span className="step-label">{step.name}</span>
                      <p className="step-body">{step.detail}</p>
                      <Link href={step.productLink} className="discovery-link-box">
                        <span className="discovery-text">View our {step.category} range</span>
                        <span className="discovery-arrow">→</span>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ritual-actions">
              <Link href="/rituals/suggestions?ritual=home" className="cta-primary">
                View Ritual Suggestions
              </Link>
            </div>
          </div>
        </section>

        <div className="back-hub">
          <Link href="/rituals" className="text-link">← All Rituals</Link>
        </div>
      </main>
    </div>
  );
}

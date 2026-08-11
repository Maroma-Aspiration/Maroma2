"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function EveningRitualPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const ritual = {
    id: "evening",
    title: "Evening Unwind",
    tagline: "Release the day and enter a state of deep rest.",
    image: "/staging-media/rituals/evening.jpg",
    description: "A calming ritual focused on soothing the body and quieting the mind before sleep.",
    steps: [
      { name: "Bathe", detail: "Use our nourishing Body Wash in a warm shower or bath to release tension.", productLink: "/search?q=body+wash&ritual=Evening", category: "body wash" },
      { name: "Anoint", detail: "Massage Body Oil into damp skin to lock in moisture and calm the nervous system.", productLink: "/search?q=body+oil&ritual=Evening", category: "body oil" },
      { name: "Settle", detail: "A final touch of Calming Perfume on pulse points for deep relaxation.", productLink: "/search?q=perfume&ritual=Evening", category: "calming perfume" }
    ],
    collection: [
      { name: "Body Wash", image: "/staging-media/wp-content/uploads/2025/08/auroville-maroma-body-care-100-natural-hair-scalp-serum-50ml-01.webp" },
      { name: "Body Oil", image: "/staging-media/wp-content/uploads/2025/12/auroville-maroma-body-care-saffron-serum-01.jpg" },
      { name: "Calming Perfume", image: "/staging-media/wp-content/uploads/2023/08/maroma-hemp-face-serum-image1-copy.jpg" },
      { name: "Pillow Mist", image: "/staging-media/wp-content/uploads/2025/08/auroville-maroma-face-care-water-lily-flower-100-natural-under-eye-serum-30gm-01.jpg" }
    ],
    link: "/rituals/evening"
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
            <Link href="/rituals/evening" className="nav-tab nav-tab-evening active">Evening</Link>
            <Link href="/rituals/home" className="nav-tab nav-tab-home">Home</Link>
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
              <Link href="/rituals/suggestions?ritual=evening" className="cta-primary">
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

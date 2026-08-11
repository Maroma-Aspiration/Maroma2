"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function RitualsPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("morning");

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const rituals = [
    {
      id: "morning",
      title: "Morning Awakening",
      tagline: "Fresh botanicals to awaken skin and mind.",
      image: "/staging-media/rituals/morning.jpg",
      description: "A refreshing sequence designed to awaken your senses and prepare your skin for the day ahead.",
      steps: [
        { name: "Cleanse", detail: "Start with our Daily Face Wash to remove overnight impurities and prep skin.", productLink: "/search?q=face+wash&ritual=Morning", category: "face wash" },
        { name: "Tone", detail: "Use our hydrating face and body mists to balance and refresh.", productLink: "/search?q=mists&ritual=Morning", category: "mists" },
        { name: "Energise", detail: "Apply Serum for a natural, healthy, botanical glow.", productLink: "/search?q=serum&ritual=Morning", category: "serum" }
      ],
      collection: [
        { name: "Face Wash", image: "/staging-media/wp-content/uploads/2025/09/Wild-Sage-Cleansing-01.webp" },
        { name: "Mists", image: "/staging-media/wp-content/uploads/2023/11/Day-Nighr-Cream.jpg" },
        { name: "Serums", image: "/staging-media/wp-content/uploads/2023/08/maroma-hemp-face-serum-image1-copy.jpg" },
        { name: "Face Cream", image: "/staging-media/wp-content/uploads/2025/08/auroville-maroma-face-care-turmeric-day-cream-50gm-01.jpg" }
      ],
      link: "/rituals/morning"
    },
    {
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
    },
    {
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
    }
  ];

  return (
    <div className="rituals-page-container">
      <main className={`rituals-content ${isVisible ? "is-visible" : ""}`}>
        <header className="rituals-hero">
          <span className="rituals-eyebrow">The Art of Wellbeing</span>
          <h1 className="rituals-title">Maroma Rituals</h1>
          <p className="rituals-subtitle">Transforming daily care into sacred moments of presence.</p>
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
            <Link href="/rituals" className="nav-tab nav-tab-overview active">Overview</Link>
            <Link href="/rituals/morning" className="nav-tab nav-tab-morning">Morning</Link>
            <Link href="/rituals/evening" className="nav-tab nav-tab-evening">Evening</Link>
            <Link href="/rituals/home" className="nav-tab nav-tab-home">Home</Link>
          </nav>
        </div>

        <section className="rituals-display">
          {rituals.filter(r => r.id === activeTab).map((ritual) => (
            <div className="ritual-featured-card" key={ritual.id}>
              <div className="ritual-visual-group">
                <div className="ritual-visual">
                  <img src={ritual.image} alt={ritual.title} className="ritual-img" />
                </div>
                <div className="ritual-collection">
                  <h3 className="collection-title">The Collection</h3>
                  <div className="collection-grid">
                    {ritual.collection?.map((item, i) => (
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
                  {ritual.steps.map((step: any, sIdx: number) => (
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
                <Link href={`/rituals/suggestions?ritual=${ritual.id}`} className="cta-primary">
                  View Ritual Suggestions
                </Link>
              </div>
            </div>
          ))}
        </section>

      </main>
    </div>
  );
}

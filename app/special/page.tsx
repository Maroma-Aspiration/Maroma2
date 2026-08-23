"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SpecialPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0); // 0: Start, 1: Who, 2: Target, 3: Intent, 4: Results
  const [choices, setChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const categories = [
    { name: "Face Care", slug: "face-care", image: "/staging-media/admin-category-banners/face-care-1776928521609.png" },
    { name: "Body Care", slug: "body-care", image: "/staging-media/admin-category-banners/body-care-1776932025032.png" },
    { name: "Hair Care", slug: "hair-care", image: "/staging-media/admin-category-banners/hair-care-1776932050901.png" },
    { name: "Perfumes", slug: "perfumes", image: "/staging-media/admin-category-banners/perfumes-1776932080574.png" },
    { name: "Home Essentials", slug: "home-essentials", image: "/staging-media/admin-category-banners/home-essentials-1776932101259.png" },
    { name: "Gifting", slug: "gifting", image: "/staging-media/admin-category-banners/gifting-1776932133753.png" },
  ];

  const handleChoice = (key: string, value: string, nextStep: number) => {
    setChoices(prev => ({ ...prev, [key]: value }));
    setStep(nextStep);
  };

  return (
    <div className="special-page-container">
      <main className={`special-content ${isVisible ? "is-visible" : ""}`}>
        <div
          className="special-hero"
          data-review="Special finder"
          data-review-id="special-hero"
          data-review-files="app/special/page.tsx"
        >
          <span className="special-eyebrow">Personalized Selection</span>
          
          <div className="assistant-container">
            {step === 0 && (
              <div className="assistant-step" key="step-0">
                <h1 className="special-title">Let&apos;s find something special for you</h1>
                <p className="special-subtitle">Would you you like help finding the perfect Maroma product?</p>
                <div className="assistant-actions">
                  <button className="assistant-btn primary" onClick={() => setStep(1)}>Yes, please</button>
                  <button className="assistant-btn secondary" onClick={() => setStep(4)}>I&apos;ll just browse</button>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="assistant-step" key="step-1">
                <h1 className="special-title">Who are you shopping for?</h1>
                <div className="assistant-actions">
                  <button className="assistant-btn" onClick={() => handleChoice('for', 'myself', 3)}>For Myself</button>
                  <button className="assistant-btn" onClick={() => handleChoice('for', 'someone', 2)}>Someone Else</button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="assistant-step" key="step-2">
                <h1 className="special-title">That&apos;s lovely. Who is the lucky person?</h1>
                <div className="assistant-actions">
                  <button className="assistant-btn" onClick={() => handleChoice('who', 'partner', 3)}>A Partner</button>
                  <button className="assistant-btn" onClick={() => handleChoice('who', 'parent', 3)}>A Parent</button>
                  <button className="assistant-btn" onClick={() => handleChoice('who', 'friend', 3)}>A Friend</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="assistant-step" key="step-3">
                <h1 className="special-title">Do you have something in mind or are you just browsing?</h1>
                <div className="assistant-actions">
                  <button className="assistant-btn" onClick={() => handleChoice('intent', 'specific', 4)}>I have an idea</button>
                  <button className="assistant-btn" onClick={() => handleChoice('intent', 'browsing', 4)}>Just exploring</button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="assistant-results" key="step-4">
                <h1 className="special-title">
                  {Object.keys(choices).length === 0 
                    ? "For your browsing pleasure" 
                    : (choices.for === 'someone' ? "Thoughtful choices for them" : "Curated for your wellbeing")}
                </h1>
                <p className="special-subtitle">
                  {Object.keys(choices).length === 0 
                    ? "Enjoy exploring our product range!" 
                    : "Based on your preferences, we recommend exploring these products."}
                </p>
              </div>
            )}
          </div>
        </div>

        {step === 4 && (
          <div className="special-options-grid">
            {categories.map((item) => (
              <Link 
                key={item.name} 
                href={`/${item.slug}`}
                className="special-option-card"
              >
                <div className="special-option-visual">
                  <img src={item.image} alt={item.name} className="special-option-img" />
                  <div className="special-option-overlay" />
                  <div className="special-option-content">
                    <span className="special-option-label">{item.name}</span>
                    <span className="special-option-cta">Discover Selection</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="special-footer">
          <Link href="/" className="back-link">Back to Home</Link>
          {step > 0 && step < 4 && (
             <button className="restart-link" onClick={() => setStep(0)}>Start Over</button>
          )}
        </div>
      </main>

      <style jsx>{`
        .special-page-container {
          min-height: 100vh;
          background: url('/staging-media/backgrounds/shopping-bg.png') no-repeat center center fixed;
          background-size: cover;
          color: #2c2824;
        }

        .special-content {
          max-width: 1400px;
          margin: 0 auto;
          padding: 160px 4vw;
        }

        .special-hero {
          text-align: center;
          margin-bottom: 20px;
        }

        .assistant-container {
          position: relative;
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .assistant-step {
          animation: springIn 1.2s cubic-bezier(0.23, 1, 0.32, 1) both;
        }

        .assistant-results {
          animation: springIn 1.2s cubic-bezier(0.23, 1, 0.32, 1) both;
        }

        @keyframes springIn {
          0% {
            opacity: 0;
            transform: scale(0.6) translateY(60px);
            filter: blur(10px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0px);
          }
        }

        .special-eyebrow {
          display: block;
          font-family: var(--font-sans), sans-serif;
          text-transform: uppercase;
          letter-spacing: 0.3em;
          font-size: 0.75rem;
          color: #2c2824;
          opacity: 0.7;
          margin-bottom: 32px;
          font-weight: 500;
        }

        .special-title {
          font-family: var(--font-serif), serif;
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          line-height: 1.1;
          font-weight: 400;
          margin-bottom: 32px;
          letter-spacing: -0.02em;
          color: #1a1816;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }

        .special-subtitle {
          font-size: 1.4rem;
          color: #2c2824;
          opacity: 0.8;
          font-weight: 300;
          letter-spacing: 0.01em;
          margin-bottom: 24px;
        }

        .assistant-actions {
          display: flex;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .assistant-btn {
          padding: 18px 40px;
          border-radius: 40px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          background: var(--maroma-site-bg);
          color: #1a1816;
          font-family: var(--font-sans), sans-serif;
          font-size: 0.9rem;
          font-weight: 500;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .assistant-btn:hover {
          background: var(--maroma-site-bg);
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
          border-color: rgba(0, 0, 0, 0.2);
        }

        .assistant-btn.primary {
          background: #1a1816;
          color: #fff;
          border-color: #1a1816;
        }

        .assistant-btn.primary:hover {
          background: #333;
          border-color: #333;
        }

        .special-options-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 60px;
          animation: springIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }

        .special-option-card {
          text-decoration: none;
          transition: transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .special-option-visual {
          position: relative;
          width: 100%;
          height: 320px;
          border-radius: 20px;
          overflow: hidden;
          background: #000;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
          transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.6s ease;
        }

        .special-option-card:hover .special-option-visual {
          transform: translateY(-8px);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.15);
        }

        .special-option-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 1.2s ease;
          opacity: 0.9;
        }

        .special-option-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%);
          z-index: 1;
          transition: opacity 0.6s ease;
        }

        .special-option-card:hover .special-option-overlay {
          opacity: 0.8;
        }

        .special-option-content {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 40px;
          z-index: 2;
          text-align: center;
        }

        .special-option-label {
          display: block;
          font-family: var(--font-serif), serif;
          font-size: clamp(2rem, 3.5vw, 3.5rem);
          color: #fff;
          line-height: 1.1;
          margin-bottom: 12px;
          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .special-option-cta {
          font-size: 0.8rem;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          opacity: 0;
          font-weight: 500;
          transform: translateY(10px);
          transition: all 0.4s ease;
          display: inline-block;
          border-bottom: 1px solid rgba(255, 255, 255, 0.5);
          padding-bottom: 4px;
        }

        .special-option-card:hover .special-option-cta {
          opacity: 1;
          transform: translateY(0);
        }

        .special-footer {
          margin-top: 120px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .back-link, .restart-link {
          color: #2c2824;
          opacity: 0.6;
          text-decoration: none;
          font-size: 1rem;
          font-weight: 400;
          font-family: var(--font-serif), serif;
          font-style: italic;
          transition: all 0.3s;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }

        .back-link:hover, .restart-link:hover {
          opacity: 1;
          transform: translateY(-1px);
        }

        @media (max-width: 1024px) {
          .special-options-grid {
            grid-template-columns: 1fr;
            gap: 40px;
          }
        }

        @media (max-width: 768px) {
          .special-content {
            padding: 120px 6vw;
          }
          .special-option-content {
            padding: 30px;
          }
          .special-option-label {
            font-size: 2rem;
          }
          .special-title {
            font-size: 2.2rem;
          }
        }
      `}</style>
    </div>
  );
 }

import Link from "next/link";
import {
  approaches,
  avoidWords,
  contentIdeas,
  creativeLines,
  dimensions,
  hesitations,
  purchases,
  secondaryMarkets,
  voiceSteps,
  worldImages,
} from "../../../lib/marketing/profile";
import { promos, shopUrl } from "../../../lib/marketing/promos";
import { Figure } from "./figure";

function ChapterHeading({
  index,
  kicker,
  title,
  intro,
}: {
  index: string;
  kicker: string;
  title: string;
  intro?: string;
}) {
  return (
    <header className="ml-chapter-head">
      <p className="ml-eyebrow">
        <span className="ml-chapter-index">{index}</span>
        {kicker}
      </p>
      <h2 className="ml-chapter-title">{title}</h2>
      {intro ? <p className="ml-chapter-intro">{intro}</p> : null}
    </header>
  );
}

export function Lookbook() {
  return (
    <main>
      <section id="meet" className="ml-hero">
        <div className="ml-hero-image">
          <img
            src="/marketing/ananya-cover.jpg"
            alt="Portrait of Ananya, 39, standing by a window in late afternoon light."
          />
        </div>
        <div className="ml-hero-copy">
          <div>
            <p className="ml-eyebrow">The woman we write for</p>
            <h1 className="ml-hero-name">Ananya</h1>
            <p className="ml-hero-meta">39 · Bengaluru · Working persona</p>
          </div>
          <div className="ml-hero-quote">
            <p>“I want to enjoy beautiful things and feel good about choosing them.”</p>
            <p>
              She is a thoughtful urban woman who wants the things she buys to feel
              beautiful, work well and reflect her values. She enjoys fragrance,
              personal care and meaningful gifts, and wants to feel confident about
              the people and practices behind them.
            </p>
          </div>
        </div>
      </section>

      <section className="ml-chapter">
        <div className="ml-wrap ml-who">
          <div className="ml-who-main">
            <p className="ml-eyebrow">Who she is</p>
            <p className="ml-who-lead">
              An established professional with a busy life and some disposable
              income. Selective about what she brings into her home.
            </p>
            <p className="ml-who-body">
              She enjoys discovering brands with character, appreciates good design
              and will pay more when she understands what makes a product worthwhile.
              She wants small moments of pleasure within an ordinary day: an inviting
              fragrance when she comes home, a body-care ritual after a shower, or a
              thoughtful gift that feels personal.
            </p>
          </div>
          <aside className="ml-who-aside">
            <p className="ml-eyebrow">How to use this</p>
            <p>
              Personal details are illustrative. Her motivations should be tested
              against actual customers. This lookbook is the first working brief for
              Maroma’s marketing: speak to her as if beauty, pleasure and
              responsibility already belong together.
            </p>
          </aside>
        </div>
      </section>

      <section id="world" className="ml-chapter ml-world">
        <div className="ml-wrap">
          <ChapterHeading
            index="02"
            kicker="Her world"
            title="Objects she would keep, rituals she would repeat."
            intro="Show products in inviting, believable settings. She should be able to picture owning them, using them and giving them."
          />
          <div className="ml-world-grid">
            {worldImages.map((image) => (
              <Figure
                key={image.src}
                src={image.src}
                alt={image.alt}
                caption={image.caption}
                layout={image.layout}
                ratio={image.ratio}
              />
            ))}
          </div>
        </div>
      </section>

      <section id="profile" className="ml-chapter">
        <div className="ml-wrap">
          <ChapterHeading
            index="03"
            kicker="Working profile"
            title="The best-fit customer wants beauty that is also genuinely ethical."
            intro="Primary market: environmentally and socially conscious women aged about 28-60, mainly in urban India, who value natural skincare, distinctive fragrance, wellness, ethical production and premium gifting."
          />
          <div className="ml-profile-grid">
            <div className="ml-profile-main">
              <p className="ml-eyebrow">Dimensions</p>
              <dl className="ml-dims">
                {dimensions.map((item) => (
                  <div key={item.title} className="ml-dim">
                    <dt>{item.title}</dt>
                    <dd>{item.body}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="ml-profile-side">
              <p className="ml-eyebrow">Secondary markets</p>
              <ul className="ml-markets">
                {secondaryMarkets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="desire" className="ml-chapter">
        <div className="ml-wrap">
          <ChapterHeading
            index="04"
            kicker="What she is really buying"
            title="One purchase serves several needs at once."
          />
          <ol className="ml-purchases">
            {purchases.map((item, index) => (
              <li key={item.title}>
                <p className="ml-num">{String(index + 1).padStart(2, "0")}</p>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </li>
            ))}
          </ol>
          <div className="ml-hesitate">
            <h3>What makes her hesitate, and what marketing should answer</h3>
            {hesitations.map((item) => (
              <div key={item.question} className="ml-hesitate-row">
                <p>{item.question}</p>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="voice" className="ml-chapter">
        <div className="ml-wrap">
          <ChapterHeading
            index="05"
            kicker="How to speak to her"
            title="Warm, assured and specific."
            intro="Invite her to imagine the experience, then give her the information she needs to choose confidently. Avoid relying on broad words to do all the persuasion."
          />
          <div className="ml-voice-grid">
            {voiceSteps.map((step, index) => (
              <article key={step.title} className="ml-voice-step">
                <p className="ml-num">{String(index + 1).padStart(2, "0")}</p>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          <div className="ml-lines">
            <p className="ml-eyebrow">Lines to test</p>
            <ul>
              {creativeLines.map((item) => (
                <li key={item.use}>
                  <p className="ml-line-use">{item.use}</p>
                  <p className="ml-line">{item.line}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="ml-voice-close">
            <div>
              <p className="ml-eyebrow">What to avoid</p>
              <h3>Do not let empty words carry the sale.</h3>
            </div>
            <div>
              <p>
                Give each promise a tangible meaning. If you say a product is
                natural, say what that means in this formula. If you say it is
                worth the price, show size, craft and ingredients. If you tell an
                ethical story, show the people and the process.
              </p>
              <ul className="ml-avoid">
                {avoidWords.map((word) => (
                  <li key={word}>{word}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="approach" className="ml-chapter">
        <div className="ml-wrap">
          <ChapterHeading
            index="06"
            kicker="Suggested approaches"
            title="Make the product desirable, then make its value understandable."
          />
          <div className="ml-approach-grid">
            {approaches.map((item) => (
              <article key={item.title} className="ml-approach-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
          <div className="ml-content-grid">
            {contentIdeas.map((item) => (
              <article key={item.title}>
                <p className="ml-eyebrow">{item.title}</p>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="promos" className="ml-chapter">
        <div className="ml-wrap">
          <ChapterHeading
            index="07"
            kicker="Suggested promos"
            title="Test one ritual, one fragrance and one gift."
            intro="Drawn from live products on maromashopping.com. Each promo answers a specific Ananya need, then names the platform and the format to make."
          />
          <p className="ml-promos-note">
            Shop the live catalogue from{" "}
            <Link href={shopUrl}>maromashopping.com</Link>. Keep personal
            pleasure and gifting as separate messages.
          </p>
          <div>
            {promos.map((promo) => (
              <article key={promo.id} className="ml-promo">
                <div className="ml-promo-grid">
                  <div className="ml-promo-copy">
                    <p className="ml-eyebrow">{promo.theme}</p>
                    <h3>{promo.headline}</h3>
                    <p className="ml-promo-body">{promo.body}</p>
                    <p className="ml-promo-why">{promo.why}</p>
                    <p>
                      <Link href={promo.url} className="ml-promo-product">
                        {promo.product} · {promo.price}
                      </Link>
                    </p>
                    <p className="ml-promo-fact">{promo.fact}</p>
                  </div>
                  <div className="ml-promo-media">
                    <figure>
                      <div className="ml-figure-frame ml-ratio-portrait">
                        <img src={promo.productImage} alt={`${promo.product}, Maroma`} />
                      </div>
                      <figcaption className="ml-caption">
                        Live product photo from maromashopping.com
                      </figcaption>
                    </figure>
                    <figure>
                      <div className={`ml-figure-frame ml-ratio-${promo.formatRatio}`}>
                        <img
                          src={promo.formatImage}
                          alt={`${promo.formatLabel} for ${promo.product}`}
                        />
                      </div>
                      <figcaption className="ml-caption">{promo.formatLabel}</figcaption>
                    </figure>
                  </div>
                </div>
                <ul className="ml-promo-platforms">
                  {promo.platforms.map((item) => (
                    <li key={item.name}>
                      <p>{item.name}</p>
                      <p>{item.format}</p>
                      <p>{item.note}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <div className="ml-format-note">
            <figure>
              <div className="ml-figure-frame ml-ratio-square">
                <img
                  src="/marketing/promos/format-square-bliss.jpg"
                  alt="Square Bliss pack shot for WhatsApp and carousel"
                />
              </div>
              <figcaption className="ml-caption">
                Bliss square pack shot · 1:1 · WhatsApp and carousel
              </figcaption>
            </figure>
            <div className="ml-format-copy">
              <p className="ml-eyebrow">Format note</p>
              <p>Put the real pack in the frame. Then add one line and the scent notes.</p>
              <p>
                Lifestyle frames should still show the Encens d’Auroville packet, the
                Bliss carton, or the Champak box as they are. Do not invent new
                packaging.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="brief" className="ml-chapter ml-brief">
        <div className="ml-wrap">
          <p className="ml-brief-kicker">08 · Internal brief</p>
          <p className="ml-brief-lead">
            Speak to a woman with considered taste who wants beauty, pleasure and
            responsible choices to belong together. Make the product desirable, make
            its value understandable, and make its story credible.
          </p>
          <div className="ml-brief-grid">
            <div>
              <p>Validate next</p>
              <p>
                Test this persona with customer conversations and purchase patterns,
                especially whether first purchases are driven mainly by fragrance,
                personal care, gifting or ethical values. That will tell you which
                message deserves the strongest emphasis.
              </p>
            </div>
            <div>
              <p>Platform</p>
              <p>
                This is Guide 01 of the Maroma Marketing Platform. Later guides can
                take the same voice into campaigns, content systems and channel work,
                always returning to Ananya before the work begins.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="ml-footer">
        <div className="ml-wrap ml-footer-inner">
          <img
            src="/marketing/maroma-wordmark.png"
            alt="Maroma"
            width={2992}
            height={721}
            className="ml-footer-mark"
          />
          <p className="ml-footer-meta">Customer profile · Working persona · 16.09.26</p>
        </div>
      </footer>
    </main>
  );
}

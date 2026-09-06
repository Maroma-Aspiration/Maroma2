import Link from "next/link";

const IMAGES = {
  hero: "/staging-media/about/hero-gallery.jpg",
  timeline: "/staging-media/about/story-timeline.webp",
  workshop: "/staging-media/about/workshop-craft.webp",
  paul: "/staging-media/about/paul-pinthon.jpg",
  laura: "/staging-media/about/laura-reddy.jpg",
  vision: "/staging-media/about/vision-mission.webp",
  fairTradeCert: "/staging-media/about/fair-trade-certification.jpg",
  fairTradeLogo: "/staging-media/about/fair-trade-logo.jpg",
  fairTradeWorkplace: "/staging-media/about/fair-trade-workplace.webp",
  fairTradeTeam: "/staging-media/about/fair-trade-team.webp",
  auroville: "/staging-media/about/maroma-auroville.jpg",
  community: "/staging-media/about/community-celebration.webp",
  aurovillePlan: "/staging-media/about/auroville-galaxy-plan.jpg",
  closeJourney: "/staging-media/about/join-journey.webp",
  tsunamiRelief: "/staging-media/about/tsunami-relief.jpg",
} as const;

const TIMELINE = [
  { year: "1976", text: "A handful of young Auroville pioneers begin Maroma under a thatched roof, handcrafting incense from nature." },
  { year: "1989", text: "The workshop moves from thatch into a lasting building, still in Kuilapalayam." },
  { year: "1993", text: "The first flagship boutique, Kalki, opens in Pondicherry." },
  { year: "2010", text: "Fair Trade certified in India by Fair Trade Forum India." },
  { year: "2012", text: "Certified by the World Fair Trade Organization." },
  { year: "2014", text: "Thirty kilowatts of solar panels cut energy use by about a third." },
  { year: "2015", text: "Maroma becomes a World Fair Trade Guaranteed member." },
] as const;

const FAIR_TRADE = [
  { title: "Opportunity for producers", body: "Most of our team are women from neighbouring villages, in a region with few other paths to independent work." },
  { title: "Transparency", body: "Maroma is held by a Trust, not private owners. Accounts are audited. Employees receive salary slips. Annual reports are public." },
  { title: "Fair trading", body: "Long relationships with workers, suppliers, and clients, plus committees for welfare and a safe workplace." },
  { title: "Fair payment", body: "Suppliers are paid above the local rate. Employees receive at least Tamil Nadu minimum wages, ESIC, provident fund, insurance, leave, and yearly increments." },
  { title: "No child or forced labour", body: "Everyone who works with us is over 18." },
  { title: "Equity and respect", body: "Pay follows skill, not gender. Talent is welcome regardless of religion, nationality, or politics." },
  { title: "Good working conditions", body: "Fire and first-aid training, sanitation, meals, filtered water, and the Auroville health centre a short walk away." },
  { title: "Capacity building", body: "People move across roles. Gardeners have become supervisors. Typists have become managers of export and sourcing." },
  { title: "Promoting Fair Trade", body: "Yearly awareness training for staff and local suppliers, and the same story told in our shops and catalogues." },
  { title: "Respect for the environment", body: "Recycling, reused wax and perfume, soak-pit water, solar lighting, cruelty-free formulas, and mostly vegan recipes." },
] as const;

const CHAPTERS = [
  { href: "#story", num: "01", label: "Our story" },
  { href: "#founders", num: "02", label: "The founders" },
  { href: "#values", num: "03", label: "Mission & vision" },
  { href: "#fair-trade", num: "04", label: "Fair Trade" },
  { href: "#community", num: "05", label: "Community" },
] as const;

type MagPhotoProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  variant?: "inset" | "spread" | "portrait" | "inline";
};

function MagPhoto({ src, alt, width, height, caption, variant = "inset" }: MagPhotoProps) {
  return (
    <figure className={`about-mag-photo about-mag-photo--${variant}`}>
      <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export function AboutMaroma() {
  return (
    <article className="about-mag">
      <header className="about-mag-cover">
        <div className="about-mag-cover-inner">
          <p className="about-mag-kicker">Auroville, South India · Est. 1976</p>
          <h1 className="about-mag-title">
            <span className="about-mag-title-line">Every scent</span>
            <span className="about-mag-title-line about-mag-title-line--emphasis">tells a story</span>
          </h1>
          <p className="about-mag-deck">
            Maroma crafts sustainable, ethical, high-quality fragrance, home, and body care from our home
            in Auroville. Every product carries a journey worth celebrating.
          </p>
          <nav className="about-mag-index" aria-label="On this page">
            {CHAPTERS.map((item) => (
              <a key={item.href} href={item.href} className="about-mag-index-link">
                <span className="about-mag-index-num">{item.num}</span>
                <span className="about-mag-index-label">{item.label}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>

      <MagPhoto
        src={IMAGES.hero}
        alt="Maroma team gathered in a heart formation on the lawn at Auroville"
        width={1024}
        height={728}
        caption="The Maroma team at Auroville — a community shaped by craft, care, and Fair Trade practice."
        variant="spread"
      />

      <section className="about-mag-chapter" id="story">
        <header className="about-mag-chapter-head">
          <span className="about-mag-chapter-num">01</span>
          <p className="about-mag-kicker">Our story</p>
          <h2>Born from a vision of creativity with purpose</h2>
        </header>
        <div className="about-mag-layout about-mag-layout--split">
          <div className="about-mag-prose">
            <p>
              Maroma began as a small incense workshop inspired by the beauty and quiet of the land around
              us. Over the years we grew into a globally recognised maison, still faithful to Fair Trade,
              sustainability, and community.
            </p>
            <p>
              From those early handmade sticks to vegan, eco-conscious care today, each formula holds
              decades of craft, ethical sourcing, and a wish for sustainable living.
            </p>
            <blockquote className="about-mag-pullquote">
              What we make is more than fragrance or skincare. It is an extension of Auroville&apos;s vision:
              to uplift, to inspire, and to leave the world a little better.
            </blockquote>
          </div>
          <aside className="about-mag-aside">
            <MagPhoto
              src={IMAGES.timeline}
              alt="Maroma timeline from 1976 to today"
              width={1200}
              height={800}
              variant="inline"
            />
            <MagPhoto
              src={IMAGES.workshop}
              alt="Handcrafting fragrance at the Maroma workshop"
              width={900}
              height={600}
              variant="inline"
            />
            <ol className="about-mag-timeline">
              {TIMELINE.map((item) => (
                <li key={item.year}>
                  <span>{item.year}</span>
                  <p>{item.text}</p>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <section className="about-mag-chapter about-mag-chapter--band" id="founders">
        <header className="about-mag-chapter-head about-mag-chapter-head--center">
          <span className="about-mag-chapter-num">02</span>
          <p className="about-mag-kicker">The founders</p>
          <h2>Vision, chemistry, and a gift for connection</h2>
        </header>
        <div className="about-mag-duo">
          <article className="about-mag-profile">
            <MagPhoto src={IMAGES.paul} alt="Paul Pinthon, Maroma co-founder" width={650} height={433} variant="portrait" />
            <h3>Paul Pinthon</h3>
            <p className="about-mag-role">Chemist and craftsman</p>
            <p>
              In 1976, Paul, a chemist by training, joined Auroville&apos;s ideals of unity and sustainability
              to his science. He began with natural incense that was both beautiful and kind to the earth.
            </p>
          </article>
          <article className="about-mag-profile">
            <MagPhoto src={IMAGES.laura} alt="Laura Reddy, Maroma co-founder" width={650} height={415} variant="portrait" />
            <h3>Laura Reddy</h3>
            <p className="about-mag-role">Voice, design, and reach</p>
            <p>
              In the early 1980s Laura arrived with a talent for communication and a designer&apos;s eye. She
              helped carry Maroma from a small workshop to a brand known around the world.
            </p>
          </article>
        </div>
        <p className="about-mag-lede about-mag-lede--center">
          Together they pictured Maroma as more than a business: a way to empower artisans, fund Auroville,
          and invite a more sustainable way of living.
        </p>
      </section>

      <MagPhoto
        src={IMAGES.workshop}
        alt="Maroma artisans at work in Kuilapalayam"
        width={1300}
        height={867}
        caption="Luxury with a lighter footprint — materials, making, and community at the heart of every formula."
        variant="spread"
      />

      <section className="about-mag-chapter" id="values">
        <header className="about-mag-chapter-head">
          <span className="about-mag-chapter-num">03</span>
          <p className="about-mag-kicker">Mission &amp; vision</p>
          <h2>Quality, integrity, and the Auroville Charter</h2>
        </header>
        <div className="about-mag-layout about-mag-layout--values">
          <MagPhoto
            src={IMAGES.vision}
            alt="Maroma mission and vision in Auroville"
            width={1200}
            height={700}
            variant="inset"
          />
          <div className="about-mag-values">
            <blockquote>
              <p className="about-mag-kicker">Mission</p>
              <p>
                We keep a creative commitment to a unique range of fragrance-based home and body care,
                choosing the highest quality natural ingredients and upholding earth-friendly Fair Trade
                practice as a matter of course.
              </p>
            </blockquote>
            <blockquote>
              <p className="about-mag-kicker">Vision</p>
              <p>
                As set out in the Auroville Charter, we work with social integrity and environmental
                responsibility. The profit we generate benefits the whole Auroville community, and the
                villages around it.
              </p>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="about-mag-chapter about-mag-chapter--band" id="fair-trade">
        <header className="about-mag-chapter-head">
          <span className="about-mag-chapter-num">04</span>
          <p className="about-mag-kicker">Fair Trade</p>
          <h2>People before machines</h2>
        </header>
        <div className="about-mag-layout about-mag-layout--split">
          <div className="about-mag-prose">
            <p>
              That has been Maroma&apos;s motto from the beginning. We are members of the World Fair Trade
              Organization and Fair Trade Forum India — a partnership of dialogue, transparency, and respect.
            </p>
            <figure className="about-mag-logo-mark">
              <img src={IMAGES.fairTradeLogo} alt="World Fair Trade Organization guaranteed member" width={300} height={300} />
            </figure>
          </div>
          <div className="about-mag-stack">
            <MagPhoto src={IMAGES.fairTradeCert} alt="Maroma Fair Trade certification" width={680} height={906} variant="inline" />
            <MagPhoto src={IMAGES.fairTradeWorkplace} alt="Maroma team at the workshop" width={1300} height={864} variant="inline" />
          </div>
        </div>
        <ol className="about-mag-principles">
          {FAIR_TRADE.map((item, index) => (
            <li key={item.title}>
              <span className="about-mag-principle-num">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="about-mag-chapter" id="community">
        <header className="about-mag-chapter-head">
          <span className="about-mag-chapter-num">05</span>
          <p className="about-mag-kicker">Community</p>
          <h2>A part of Auroville, and of the villages around it</h2>
        </header>
        <div className="about-mag-gallery">
          <MagPhoto src={IMAGES.auroville} alt="Maroma and Auroville landscape" width={650} height={813} variant="portrait" />
          <MagPhoto src={IMAGES.community} alt="Maroma community celebration in Auroville" width={1300} height={867} variant="inline" />
        </div>
        <div className="about-mag-trio">
          <article>
            <MagPhoto src={IMAGES.aurovillePlan} alt="Auroville galaxy plan" width={800} height={500} variant="inline" />
            <h3>Auroville</h3>
            <p>
              Maroma is Auroville&apos;s largest employer and a major contributor to its development. Abroad,
              the brand carries Auroville&apos;s values into the world.
            </p>
          </article>
          <article>
            <MagPhoto src={IMAGES.fairTradeTeam} alt="Maroma team members at work" width={1300} height={867} variant="inline" />
            <h3>Neighbouring villages</h3>
            <p>
              In Kuilapalayam we have helped improve local infrastructure, living conditions, and access
              to school — supporting the advancement of women&apos;s education in the region.
            </p>
          </article>
          <article>
            <h3>A wider India</h3>
            <p>
              Maroma has given financial and practical aid in two national moments of need: the Kargil War
              in 1999, and the Indian Ocean tsunami in 2004.
            </p>
            <MagPhoto src={IMAGES.tsunamiRelief} alt="Fishing boats after the 2004 Indian Ocean tsunami" width={785} height={1024} variant="portrait" />
          </article>
        </div>
      </section>

      <footer className="about-mag-finale">
        <MagPhoto
          src={IMAGES.closeJourney}
          alt="Maroma fragrance and home care crafted by hand in Auroville"
          width={1300}
          height={867}
          variant="spread"
        />
        <div className="about-mag-finale-copy">
          <p className="about-mag-kicker">Join the journey</p>
          <h2>Crafted in Auroville, made for the world</h2>
          <p>A legacy guided by purpose, passion, and respect for the planet and its people.</p>
          <div className="about-mag-finale-actions">
            <Link href="/#shop" className="button primary">
              Shop collections
            </Link>
            <Link href="/blog" className="button secondary">
              Read the journal
            </Link>
          </div>
        </div>
      </footer>
    </article>
  );
}

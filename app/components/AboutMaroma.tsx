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
  {
    title: "Opportunity for producers",
    body: "Most of our team are women from neighbouring villages, in a region with few other paths to independent work.",
  },
  {
    title: "Transparency",
    body: "Maroma is held by a Trust, not private owners. Accounts are audited. Employees receive salary slips. Annual reports are public.",
  },
  {
    title: "Fair trading",
    body: "Long relationships with workers, suppliers, and clients, plus committees for welfare and a safe workplace.",
  },
  {
    title: "Fair payment",
    body: "Suppliers are paid above the local rate. Employees receive at least Tamil Nadu minimum wages, ESIC, provident fund, insurance, leave, and yearly increments.",
  },
  {
    title: "No child or forced labour",
    body: "Everyone who works with us is over 18.",
  },
  {
    title: "Equity and respect",
    body: "Pay follows skill, not gender. Talent is welcome regardless of religion, nationality, or politics.",
  },
  {
    title: "Good working conditions",
    body: "Fire and first-aid training, sanitation, meals, filtered water, and the Auroville health centre a short walk away.",
  },
  {
    title: "Capacity building",
    body: "People move across roles. Gardeners have become supervisors. Typists have become managers of export and sourcing.",
  },
  {
    title: "Promoting Fair Trade",
    body: "Yearly awareness training for staff and local suppliers, and the same story told in our shops and catalogues.",
  },
  {
    title: "Respect for the environment",
    body: "Recycling, reused wax and perfume, soak-pit water, solar lighting, cruelty-free formulas, and mostly vegan recipes.",
  },
] as const;

const PILLARS = [
  { href: "#story", label: "Our story", detail: "From incense under thatch to a global maison of botanical care." },
  { href: "#founders", label: "The founders", detail: "Paul's craft and Laura's voice, joined in Auroville." },
  { href: "#values", label: "Mission & vision", detail: "Quality, earth-friendly practice, and the Auroville Charter." },
  { href: "#fair-trade", label: "Fair Trade", detail: "People before machines. Ten principles we live by." },
  { href: "#community", label: "Community", detail: "Auroville, neighbouring villages, and a wider India." },
] as const;

export function AboutMaroma() {
  return (
    <article className="about-maroma">
      <header className="about-hero">
        <p className="about-eyebrow">Auroville, South India · Since 1976</p>
        <h1 className="about-hero-title">Every scent tells a story</h1>
        <p className="about-hero-lead">
          Maroma crafts sustainable, ethical, high-quality fragrance, home, and body care from our home
          in Auroville. Welcome. Every product carries a journey worth celebrating.
        </p>
        <nav className="about-jump" aria-label="On this page">
          {PILLARS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <figure className="about-hero-media">
          <img
            src={IMAGES.hero}
            alt="Maroma team gathered in a circle on the lawn at Auroville"
            width={1300}
            height={867}
          />
        </figure>
      </header>

      <section className="about-section about-story" id="story">
        <div className="about-copy">
          <p className="about-eyebrow">Our story</p>
          <h2>Born from a vision of creativity with purpose</h2>
          <p>
            Maroma began as a small incense workshop inspired by the beauty and quiet of the land around
            us. Over the years we grew into a globally recognised maison, still faithful to Fair Trade,
            sustainability, and community.
          </p>
          <p>
            From those early handmade sticks to vegan, eco-conscious care today, each formula holds
            decades of craft, ethical sourcing, and a wish for sustainable living.
          </p>
          <p>
            Our path is bound to Auroville, a township devoted to human unity. What we make is more than
            fragrance or skincare. It is an extension of that vision: to uplift, to inspire, and to
            leave the world a little better.
          </p>
        </div>
        <div className="about-story-visuals">
          <figure className="about-photo about-photo-wide">
            <img src={IMAGES.timeline} alt="Maroma timeline from 1976 to today" width={1200} height={800} />
          </figure>
          <figure className="about-photo">
            <img src={IMAGES.workshop} alt="Handcrafting fragrance at the Maroma workshop" width={900} height={600} />
          </figure>
          <ol className="about-timeline">
            {TIMELINE.map((item) => (
              <li key={item.year}>
                <span className="about-timeline-year">{item.year}</span>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="about-section about-founders" id="founders">
        <p className="about-eyebrow">The founders</p>
        <h2>Vision, chemistry, and a gift for connection</h2>
        <div className="about-founders-grid">
          <article>
            <figure className="about-founder-photo">
              <img src={IMAGES.paul} alt="Paul Pinthon, Maroma co-founder" width={650} height={433} />
            </figure>
            <h3>Paul Pinthon</h3>
            <p className="about-role">Chemist and craftsman</p>
            <p>
              In 1976, Paul, a chemist by training, joined Auroville&apos;s ideals of unity and sustainability
              to his science. He began with natural incense that was both beautiful and kind to the
              earth, hoping the work could also support the township&apos;s growth.
            </p>
          </article>
          <article>
            <figure className="about-founder-photo">
              <img src={IMAGES.laura} alt="Laura Reddy, Maroma co-founder" width={650} height={415} />
            </figure>
            <h3>Laura Reddy</h3>
            <p className="about-role">Voice, design, and reach</p>
            <p>
              In the early 1980s Laura arrived with a talent for communication and a designer’s eye.
              She helped carry Maroma from a small workshop to a brand known around the world, always
              in conversation with the people who make and wear it.
            </p>
          </article>
        </div>
        <p className="about-founders-close">
          Together they pictured Maroma as more than a business: a way to empower artisans, fund
          Auroville, and invite a more sustainable way of living. Fair wages, safe work, and
          earth-friendly practice became the signature of the house. Membership of the World Fair Trade
          Organization later confirmed what they had practised from the start.
        </p>
      </section>

      <section className="about-section about-future" id="future">
        <p className="about-eyebrow">Looking ahead</p>
        <h2>Luxury with a lighter footprint</h2>
        <figure className="about-photo about-photo-banner">
          <img src={IMAGES.workshop} alt="Maroma artisans at work in Kuilapalayam" width={1300} height={867} />
        </figure>
        <div className="about-future-grid">
          <article>
            <h3>Materials and making</h3>
            <p>
              We keep designing eco-conscious products: biodegradable packaging, natural vegan
              ingredients where we can, and the same high quality our customers trust.
            </p>
          </article>
          <article>
            <h3>A community workplace</h3>
            <p>
              Education, medical support, and skill-building remain at the centre. We want a workshop
              that grows people, not only products.
            </p>
          </article>
          <article>
            <h3>Beauty and responsibility</h3>
            <p>
              With every candle, incense stick, and skincare ritual, we invite you to help shape a
              future that holds beauty, harmony, and care in the same hand.
            </p>
          </article>
        </div>
      </section>

      <section className="about-section about-values" id="values">
        <p className="about-eyebrow">Our values</p>
        <h2>Mission and vision</h2>
        <figure className="about-photo about-photo-values">
          <img src={IMAGES.vision} alt="Maroma mission and vision in Auroville" width={1200} height={700} />
        </figure>
        <div className="about-values-grid">
          <blockquote>
            <p className="about-values-label">Mission</p>
            <p>
              We keep a creative commitment to a unique range of fragrance-based home and body care.
              Whenever we can, we choose the highest quality natural or herbal ingredients, and we
              uphold earth-friendly and Fair Trade practice as a matter of course.
            </p>
          </blockquote>
          <blockquote>
            <p className="about-values-label">Vision</p>
            <p>
              As set out in the Auroville Charter, we work with social integrity and environmental
              responsibility. We strive for excellence and a total dedication to quality. The profit we
              generate benefits the whole Auroville community, and to some extent the surrounding
              villages.
            </p>
          </blockquote>
        </div>
      </section>

      <section className="about-section about-fair" id="fair-trade">
        <div className="about-fair-intro">
          <div className="about-copy">
            <p className="about-eyebrow">Fair Trade &amp; sustainability</p>
            <h2>People before machines</h2>
            <p>
              That has been Maroma’s motto from the beginning. We are members of the World Fair Trade
              Organization and Fair Trade Forum India. Fair Trade is a partnership of dialogue,
              transparency, and respect. It offers better conditions to producers and workers who are too
              often left at the margin.
            </p>
            <p>
              We follow that policy for everyone connected with the company: a clean, safe workplace, and
              the wellbeing of the people who make the work possible. The aim is not only a beautiful
              product, but a place where creativity can live.
            </p>
            <figure className="about-fair-logo">
              <img
                src={IMAGES.fairTradeLogo}
                alt="World Fair Trade Organization guaranteed member"
                width={300}
                height={300}
              />
            </figure>
          </div>
          <div className="about-fair-photos">
            <figure className="about-photo">
              <img src={IMAGES.fairTradeCert} alt="Maroma Fair Trade certification" width={680} height={906} />
            </figure>
            <figure className="about-photo">
              <img src={IMAGES.fairTradeWorkplace} alt="Maroma team at the workshop" width={1300} height={864} />
            </figure>
          </div>
        </div>
        <ol className="about-principles">
          {FAIR_TRADE.map((item, index) => (
            <li key={item.title}>
              <span className="about-principle-num">{String(index + 1).padStart(2, "0")}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="about-section about-community" id="community">
        <p className="about-eyebrow">Community</p>
        <h2>A part of Auroville, and of the villages around it</h2>
        <div className="about-community-banner">
          <figure className="about-photo">
            <img src={IMAGES.auroville} alt="Maroma and Auroville landscape" width={650} height={813} />
          </figure>
          <figure className="about-photo">
            <img src={IMAGES.community} alt="Maroma community celebration in Auroville" width={1300} height={867} />
          </figure>
        </div>
        <div className="about-community-grid">
          <article>
            <figure className="about-photo about-photo-inline">
              <img src={IMAGES.aurovillePlan} alt="Auroville galaxy plan" width={800} height={500} />
            </figure>
            <h3>Auroville</h3>
            <p>
              Maroma is Auroville’s largest employer and a major contributor to its development.
              Profits return to the township: education, and a free food link between Auroville farms
              and the community kitchen. Abroad, the brand carries Auroville’s values into the world.
            </p>
          </article>
          <article>
            <figure className="about-photo about-photo-inline">
              <img src={IMAGES.fairTradeTeam} alt="Maroma team members at work" width={1300} height={867} />
            </figure>
            <h3>Neighbouring villages</h3>
            <p>
              In Kuilapalayam we have helped improve local infrastructure, living conditions, and
              access to school. By asking for an education standard in hiring, Maroma has also
              supported the advancement of women’s education in the villages around Auroville.
            </p>
          </article>
          <article className="about-community-india">
            <h3>A wider India</h3>
            <p>
              Maroma has given financial and practical aid in two national moments of need: the Kargil
              War in 1999, and the Indian Ocean tsunami in 2004.
            </p>
            <figure className="about-photo about-photo-inline about-photo-india">
              <img
                src={IMAGES.tsunamiRelief}
                alt="Fishing boats displaced after the 2004 Indian Ocean tsunami"
                width={785}
                height={1024}
              />
            </figure>
          </article>
        </div>
      </section>

      <section className="about-close">
        <figure className="about-photo about-photo-close">
          <img
            src={IMAGES.closeJourney}
            alt="Maroma fragrance and home care crafted by hand in Auroville"
            width={1300}
            height={867}
          />
        </figure>
        <p className="about-eyebrow">Join the journey</p>
        <h2>Crafted in Auroville, made for the world</h2>
        <p>
          Maroma is a legacy guided by purpose, passion, and respect for the planet and its people.
        </p>
        <div className="about-close-actions">
          <Link href="/#shop" className="button primary">
            Shop collections
          </Link>
          <Link href="/blog" className="button secondary">
            Read the journal
          </Link>
        </div>
      </section>
    </article>
  );
}

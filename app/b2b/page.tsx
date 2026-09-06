import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata={title:"B2B partnerships | Maroma"};
const programmes=[
  ["White Label","Develop a distinctive collection with Maroma formulations, packaging guidance and production expertise."],
  ["Retailers","Bring naturally crafted Maroma products to your shelves, spa, boutique or online store."],
  ["Distributors","Build regional distribution with a broad, established catalogue and collaborative support."],
  ["Corporate Gifting","Create thoughtful, tailored gifts for teams, clients and events."],
];
export default function B2bIndexPage(){return <main className="b2b-landing"><section className="b2b-hero"><p>Maroma partnerships</p><h1>Made for meaningful business.</h1><span>From custom white-label collections to retail, distribution and corporate gifting, we create natural products and long-term partnerships with care.</span><div><Link href="/b2b/apply">Apply to partner</Link><Link href="/login?next=/b2b" className="secondary">Partner sign in</Link></div></section><section className="b2b-programmes">{programmes.map(([title,text],index)=><article key={title}><span>0{index+1}</span><h2>{title}</h2><p>{text}</p></article>)}</section><section className="b2b-detail"><div><p>Why Maroma</p><h2>Natural expertise, made in Auroville.</h2></div><div><p>Our partnership team can help shape a considered offering—from product selection and samples to custom concepts, gifting curation and commercial planning.</p><Link href="/b2b/apply">Start a conversation →</Link></div></section></main>}

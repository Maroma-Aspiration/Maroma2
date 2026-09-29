import Link from "next/link";

export function LookbookHeader() {
  return (
    <header className="ml-header">
      <div className="ml-wrap ml-header-inner">
        <div>
          <img
            src="/marketing/maroma-wordmark.png"
            alt="Maroma"
            width={2992}
            height={721}
            className="ml-wordmark"
          />
          <p className="ml-kicker">Marketing Platform</p>
        </div>
        <div className="ml-header-links">
          <Link href="/admin" className="ml-header-link">
            Admin
          </Link>
          <Link href="/?skipIntro=1" className="ml-header-link">
            View shop
          </Link>
          <div className="ml-header-meta">
            <p className="ml-eyebrow">Internal guide 01</p>
            <p className="ml-header-guide">Customer profile</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export const SCROLL_TO_SHOP_EVENT = "maroma:scroll-to-shop";

const SHOP_SCROLL_LOCK_CLASS = "shop-scroll-lock";
const ALIGN_PX = 6;
const LOCK_MS = 2800;

let shopScrollGeneration = 0;
let shopScrollLockCount = 0;
let shopScrollLockStyles: {
  htmlBehavior: string;
  bodyBehavior: string;
  padding: string;
} | null = null;

function visibleNavBottom(): number {
  const navs = document.querySelectorAll<HTMLElement>(".site-header .nav");
  let bottom = 0;
  navs.forEach((nav) => {
    const style = window.getComputedStyle(nav);
    if (style.display === "none" || style.visibility === "hidden") return;
    const rect = nav.getBoundingClientRect();
    if (rect.height < 8 || rect.width < 8) return;
    bottom = Math.max(bottom, rect.bottom);
  });
  const admin = document.querySelector<HTMLElement>(".admin-bar");
  if (admin) {
    const rect = admin.getBoundingClientRect();
    if (rect.height >= 8) bottom = Math.max(bottom, rect.bottom);
  }
  if (bottom < 40) {
    const header = document.querySelector<HTMLElement>(".site-header");
    if (header) bottom = header.getBoundingClientRect().bottom;
  }
  return Math.round(bottom) + 8;
}

function shopScrollTarget(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(".bestsellers-scroller") ||
    document.querySelector<HTMLElement>("#shop-search") ||
    document.querySelector<HTMLElement>("#shop .product-database-head") ||
    document.getElementById("shop")
  );
}

function scrollingRoot(): HTMLElement {
  return (document.scrollingElement as HTMLElement | null) || document.documentElement;
}

function lockInstantScroll(): () => void {
  const html = document.documentElement;
  const body = document.body;
  if (shopScrollLockCount === 0) {
    shopScrollLockStyles = {
      htmlBehavior: html.style.scrollBehavior,
      bodyBehavior: body.style.scrollBehavior,
      padding: html.style.scrollPaddingTop,
    };
    html.classList.add(SHOP_SCROLL_LOCK_CLASS);
    html.style.scrollBehavior = "auto";
    body.style.scrollBehavior = "auto";
    html.style.scrollPaddingTop = "0px";
  }
  shopScrollLockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    shopScrollLockCount = Math.max(0, shopScrollLockCount - 1);
    if (shopScrollLockCount > 0 || !shopScrollLockStyles) return;
    html.classList.remove(SHOP_SCROLL_LOCK_CLASS);
    html.style.scrollBehavior = shopScrollLockStyles.htmlBehavior;
    body.style.scrollBehavior = shopScrollLockStyles.bodyBehavior;
    html.style.scrollPaddingTop = shopScrollLockStyles.padding;
    shopScrollLockStyles = null;
  };
}

function snapShopToNav(): boolean {
  const el = shopScrollTarget();
  if (!el) return false;
  const offset = visibleNavBottom();
  const scroller = scrollingRoot();
  const nextTop = Math.max(
    0,
    Math.round((scroller.scrollTop || window.scrollY) + el.getBoundingClientRect().top - offset)
  );
  scroller.scrollTop = nextTop;
  document.documentElement.scrollTop = nextTop;
  document.body.scrollTop = nextTop;
  window.scrollTo(0, nextTop);
  return Math.abs(el.getBoundingClientRect().top - offset) <= ALIGN_PX;
}

export function ensureShopHash(): void {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (!params.get("skipIntro")) params.set("skipIntro", "1");
  const next = `${url.pathname}?${params.toString()}#shop`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current !== next) {
    window.history.replaceState(null, "", next);
  }
}

export function scrollShopIntoView(): boolean {
  return snapShopToNav();
}

export function requestShopScroll(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(SCROLL_TO_SHOP_EVENT));
  ensureShopHash();

  shopScrollGeneration += 1;
  const generation = shopScrollGeneration;
  let userCancelled = false;
  const unlock = lockInstantScroll();

  const stopForUser = () => {
    userCancelled = true;
  };
  window.addEventListener("wheel", stopForUser, { passive: true });
  window.addEventListener("touchmove", stopForUser, { passive: true });

  let alignedFrames = 0;
  const startedAt = performance.now();

  const finish = () => {
    window.removeEventListener("wheel", stopForUser);
    window.removeEventListener("touchmove", stopForUser);
    unlock();
  };

  const tick = () => {
    if (generation !== shopScrollGeneration) {
      window.removeEventListener("wheel", stopForUser);
      window.removeEventListener("touchmove", stopForUser);
      unlock();
      return;
    }
    if (userCancelled) {
      finish();
      return;
    }

    const aligned = snapShopToNav();
    alignedFrames = aligned ? alignedFrames + 1 : 0;
    const elapsed = performance.now() - startedAt;
    if ((alignedFrames >= 8 && elapsed >= 700) || elapsed >= LOCK_MS) {
      finish();
      return;
    }
    window.requestAnimationFrame(tick);
  };

  window.requestAnimationFrame(tick);
}

export function isShopHref(href: string, origin = window.location.origin): boolean {
  try {
    const url = new URL(href, origin);
    return url.origin === origin && url.hash === "#shop";
  } catch {
    return false;
  }
}

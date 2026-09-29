import { createHmac } from "crypto";

export function signNewsletterImageUrls(html: string, secret: string): string {
  return html.replace(
    /(\/api\/newsletter\/image\?src=)([^"&\s]+)/g,
    (_match, _prefix: string, encodedSource: string) => {
      const source = decodeURIComponent(encodedSource);
      const signature = createHmac("sha256", secret).update(source).digest("hex");
      const encodedPath = Buffer.from(source, "utf8").toString("base64url");
      return `/api/newsletter/image/${signature}/${encodedPath}`;
    },
  );
}

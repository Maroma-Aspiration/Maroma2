export type NewsletterSubscriber = {
  id: string;
  email: string;
  name: string;
  subscribedAt: string;
  /** ISO time when recipient unsubscribed (excluded from sends). */
  unsubscribedAt?: string;
};

/** Per-send metrics; ids arrays dedupe per subscriber for opens/clicks/unsubs. */
export type NewsletterCampaignMetrics = {
  id: string;
  subject: string;
  sentAt: string;
  recipientCount: number;
  openSubscriberIds: string[];
  clickCount: number;
  clickSubscriberIds: string[];
  unsubscribeSubscriberIds: string[];
};

export type NewsletterAudienceState = {
  subscribers: NewsletterSubscriber[];
  campaigns: NewsletterCampaignMetrics[];
};

/** Admin API: no raw emails in campaign rows; aggregate counts only. */
export type NewsletterCampaignSummary = {
  id: string;
  subject: string;
  sentAt: string;
  recipientCount: number;
  uniqueOpens: number;
  totalClicks: number;
  uniqueClickers: number;
  unsubscribes: number;
};

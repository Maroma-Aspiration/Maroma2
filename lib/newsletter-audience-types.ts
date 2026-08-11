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

export type NewsletterMailingList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  subscriberIds: string[];
};

export type NewsletterMailingListSummary = {
  id: string;
  name: string;
  activeCount: number;
  totalCount: number;
  updatedAt: string;
};

export type NewsletterAudienceState = {
  subscribers: NewsletterSubscriber[];
  mailingLists: NewsletterMailingList[];
  /** Which list Send campaign uses (persisted server-side). */
  selectedListId: string | null;
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

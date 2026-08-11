import { NextResponse } from "next/server";
import {
  countActiveSubscribers,
  getMailingListRecipients,
  importToMailingList,
  mergeNewsletterSubscribers,
  readNewsletterAudience,
  setSelectedMailingList,
  summarizeCampaigns,
  summarizeMailingLists,
} from "../../../../lib/newsletter-audience-storage";
import { resolveFromEmail } from "../../../../lib/newsletter-send";

export const dynamic = "force-dynamic";

function envHints() {
  return {
    postmarkConfigured: Boolean(process.env.POSTMARK_SERVER_TOKEN?.trim()),
    fromEmailConfigured: Boolean(resolveFromEmail()),
    trackingSecretConfigured: Boolean(process.env.NEWSLETTER_TRACKING_SECRET?.trim()),
    siteUrlConfigured: Boolean(process.env.NEXT_PUBLIC_SITE_URL?.trim()),
    fromAddress:
      resolveFromEmail() || "(invalid: set NEWSLETTER_FROM_EMAIL to production@miraculousmedia.in)",
    messageStream: process.env.POSTMARK_MESSAGE_STREAM?.trim() || "broadcast",
    readyToSend: Boolean(
      process.env.POSTMARK_SERVER_TOKEN?.trim() &&
        process.env.NEWSLETTER_TRACKING_SECRET?.trim() &&
        resolveFromEmail()
    ),
  };
}

export async function GET() {
  try {
    const state = await readNewsletterAudience();
    const mailingLists = summarizeMailingLists(state);
    const selectedListId = state.selectedListId;
    const selectedList = mailingLists.find((list) => list.id === selectedListId) ?? null;
    const selectedActive = selectedList?.activeCount ?? 0;
    return NextResponse.json({
      activeSubscribers: selectedActive,
      totalSubscribers: selectedList?.totalCount ?? 0,
      selectedListId,
      selectedListName: selectedList?.name ?? null,
      mailingLists,
      campaigns: summarizeCampaigns(state.campaigns),
      envHints: envHints(),
      globalActiveSubscribers: countActiveSubscribers(state.subscribers),
      globalTotalSubscribers: state.subscribers.length,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load audience." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      subscribers?: { email: string; name?: string }[];
      listName?: string;
      selectedListId?: string;
    };

    if (typeof body.selectedListId === "string" && body.selectedListId.trim()) {
      const state = await setSelectedMailingList(body.selectedListId.trim());
      const mailingLists = summarizeMailingLists(state);
      const selectedList = mailingLists.find((list) => list.id === state.selectedListId) ?? null;
      return NextResponse.json({
        selectedListId: state.selectedListId,
        selectedListName: selectedList?.name ?? null,
        activeSubscribers: selectedList?.activeCount ?? 0,
        totalSubscribers: selectedList?.totalCount ?? 0,
        mailingLists,
      });
    }

    const rows = Array.isArray(body.subscribers) ? body.subscribers : [];
    const listName = typeof body.listName === "string" ? body.listName.trim() : "";

    if (listName) {
      const result = await importToMailingList(listName, rows);
      const mailingLists = summarizeMailingLists(result.state);
      return NextResponse.json({
        listId: result.listId,
        listName: result.listName,
        added: result.added,
        updated: result.updated,
        importedRows: result.importedRows,
        activeSubscribers: result.listActiveCount,
        totalSubscribers:
          mailingLists.find((list) => list.id === result.listId)?.totalCount ?? result.listActiveCount,
        selectedListId: result.state.selectedListId,
        selectedListName: result.listName,
        mailingLists,
      });
    }

    const { state, added, updated } = await mergeNewsletterSubscribers(rows);
    const mailingLists = summarizeMailingLists(state);
    const selectedList = mailingLists.find((list) => list.id === state.selectedListId) ?? null;
    return NextResponse.json({
      added,
      updated,
      activeSubscribers: selectedList?.activeCount ?? countActiveSubscribers(state.subscribers),
      totalSubscribers: selectedList?.totalCount ?? state.subscribers.length,
      selectedListId: state.selectedListId,
      selectedListName: selectedList?.name ?? null,
      mailingLists,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update audience.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { notFound } from "next/navigation";
import MessagesInbox from "@/components/messaging/MessagesInbox";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const id = Number(conversationId);

  if (!/^\d+$/.test(conversationId) || !Number.isSafeInteger(id) || id <= 0) {
    notFound();
  }

  return <MessagesInbox activeConversationId={conversationId} />;
}

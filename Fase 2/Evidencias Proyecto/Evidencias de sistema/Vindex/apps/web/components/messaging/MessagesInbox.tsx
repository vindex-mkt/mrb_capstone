"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IconMessageCircle, IconSend } from "@/components/icons";
import { useToast } from "@/components/ToastProvider";
import { createClient } from "@/lib/supabase/client";

type ConversationRow = {
  id: number;
  product_id: number | null;
  buyer_id: string;
  seller_id: string;
  created_at: string;
};

type ConversationItem = ConversationRow & {
  otherName: string;
  productName: string;
  lastMessage: string | null;
  activityAt: string;
};

type ChatMessage = {
  id: string;
  conversation_id: number;
  sender_id: string;
  content: string;
  created_at: string;
};

function parseMessage(value: unknown): ChatMessage | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const id = row.id;
  const conversationId = Number(row.conversation_id);

  if (
    (typeof id !== "string" && typeof id !== "number") ||
    !Number.isSafeInteger(conversationId) ||
    typeof row.sender_id !== "string" ||
    typeof row.content !== "string" ||
    typeof row.created_at !== "string" ||
    !Number.isFinite(new Date(row.created_at).getTime())
  ) {
    return null;
  }

  return {
    id: String(id),
    conversation_id: conversationId,
    sender_id: row.sender_id,
    content: row.content,
    created_at: row.created_at,
  };
}

function sortConversations(items: ConversationItem[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.activityAt).getTime() - new Date(left.activityAt).getTime(),
  );
}

function formatMessageTime(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function MessagesInbox({
  activeConversationId = null,
}: {
  activeConversationId?: string | null;
}) {
  const [supabase] = useState(createClient);
  const { showToast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isInboxLoading, setIsInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const activeConversationNumber = activeConversationId ? Number(activeConversationId) : null;
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationNumber,
  ) ?? null;

  useEffect(() => {
    let isCurrent = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isCurrent) return;
      setUserId(session?.user.id ?? null);
      setIsAuthLoading(false);
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!isCurrent) return;
      if (error) {
        console.error("No se pudo verificar la sesión de mensajería:", error);
        showToast("No se pudo verificar tu sesión.", "error");
        setUserId(null);
      } else {
        setUserId(data.user?.id ?? null);
      }
      setIsAuthLoading(false);
    });

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, [showToast, supabase]);

  useEffect(() => {
    let isCurrent = true;

    if (isAuthLoading) return () => { isCurrent = false; };
    if (!userId) {
      setConversations([]);
      setInboxError(null);
      setIsInboxLoading(false);
      return () => { isCurrent = false; };
    }

    const loadConversations = async () => {
      setIsInboxLoading(true);
      setInboxError(null);

      try {
        const { data, error } = await supabase
          .from("conversations")
          .select("id, product_id, buyer_id, seller_id, created_at")
          .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
          .order("created_at", { ascending: false });
        if (error) throw error;

        const rows = (data ?? []) as ConversationRow[];
        if (rows.length === 0) {
          if (isCurrent) setConversations([]);
          return;
        }

        const profileIds = [...new Set(rows.map((row) =>
          row.buyer_id === userId ? row.seller_id : row.buyer_id,
        ))];
        const productIds = [...new Set(rows.flatMap((row) =>
          row.product_id === null ? [] : [row.product_id],
        ))];
        const conversationIds = rows.map((row) => row.id);

        const [profilesResult, productsResult, messagesResult] = await Promise.all([
          supabase.from("profiles").select("id, full_name").in("id", profileIds),
          productIds.length
            ? supabase.from("products").select("id, name").in("id", productIds)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("messages")
            .select("conversation_id, created_at")
            .in("conversation_id", conversationIds)
            .order("created_at", { ascending: false }),
        ]);

        if (profilesResult.error) throw profilesResult.error;
        if (productsResult.error) throw productsResult.error;
        if (messagesResult.error) throw messagesResult.error;

        const namesByProfile = new Map(
          (profilesResult.data ?? []).map((profile) => [profile.id, profile.full_name]),
        );
        const namesByProduct = new Map(
          (productsResult.data ?? []).map((product) => [product.id, product.name]),
        );
        const latestActivityByConversation = new Map<number, string>();
        for (const message of messagesResult.data ?? []) {
          const id = Number(message.conversation_id);
          if (!latestActivityByConversation.has(id)) {
            latestActivityByConversation.set(id, message.created_at);
          }
        }

        const items = rows.map((row) => {
          const activityAt = latestActivityByConversation.get(row.id) ?? row.created_at;
          return {
            ...row,
            otherName: namesByProfile.get(row.buyer_id === userId ? row.seller_id : row.buyer_id)
              || "Usuario",
            productName: row.product_id === null
              ? "Producto no disponible"
              : namesByProduct.get(row.product_id) || "Producto no disponible",
            lastMessage: null,
            activityAt,
          };
        });

        if (isCurrent) setConversations(sortConversations(items));
      } catch (error) {
        if (!isCurrent) return;
        console.error("No se pudieron cargar las conversaciones:", error);
        setInboxError("No se pudieron cargar tus conversaciones.");
        showToast("No se pudieron cargar tus conversaciones.", "error");
      } finally {
        if (isCurrent) setIsInboxLoading(false);
      }
    };

    void loadConversations();
    return () => {
      isCurrent = false;
    };
  }, [isAuthLoading, showToast, supabase, userId]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => {
      if (current.some((existing) => existing.id === message.id)) return current;
      return [...current, message].sort(
        (left, right) =>
          new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      );
    });
    setConversations((current) => sortConversations(current.map((conversation) =>
      conversation.id === message.conversation_id
        ? {
            ...conversation,
            lastMessage: message.content,
            activityAt: message.created_at,
          }
        : conversation,
    )));
  }, []);

  useEffect(() => {
    const conversationId = activeConversationNumber;
    if (!userId || conversationId === null || !Number.isSafeInteger(conversationId)) {
      setMessages([]);
      setThreadError(null);
      setIsThreadLoading(false);
      return;
    }

    let isCurrent = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    setMessages([]);
    setThreadError(null);
    setRealtimeError(false);
    setIsThreadLoading(true);

    const loadThread = async () => {
      try {
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .select("id")
          .eq("id", conversationId)
          .maybeSingle();
        if (conversationError) throw conversationError;
        if (!isCurrent) return;
        if (!conversation) {
          throw new Error("La conversación no existe o no tienes acceso a ella.");
        }

        channel = supabase
          .channel(`messages:${conversationId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `conversation_id=eq.${conversationId}`,
            },
            (payload) => {
              const message = parseMessage(payload.new);
              if (message?.conversation_id === conversationId) appendMessage(message);
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              if (isCurrent) setRealtimeError(false);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              console.error(`La suscripción Realtime de la conversación ${conversationId} falló: ${status}`);
              if (isCurrent) setRealtimeError(true);
            }
          });

        const { data, error } = await supabase
          .from("messages")
          .select("id, conversation_id, sender_id, content, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (!isCurrent) return;

        const history = (data ?? []).flatMap((row) => {
          const message = parseMessage(row);
          return message ? [message] : [];
        });
        if (isCurrent) {
          setMessages((current) => {
            const merged = new Map(history.map((message) => [message.id, message]));
            for (const message of current) merged.set(message.id, message);
            return [...merged.values()].sort(
              (left, right) =>
                new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
            );
          });
        }
      } catch (error) {
        if (!isCurrent) return;
        console.error("No se pudo cargar la conversación:", error);
        setThreadError("No se pudo cargar esta conversación.");
        showToast("No se pudo cargar esta conversación.", "error");
      } finally {
        if (isCurrent) setIsThreadLoading(false);
      }
    };

    void loadThread();
    return () => {
      isCurrent = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [activeConversationNumber, appendMessage, showToast, supabase, userId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !userId || activeConversationNumber === null || isSending) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeConversationNumber,
          sender_id: userId,
          content,
        })
        .select("id, conversation_id, sender_id, content, created_at")
        .single();
      if (error) throw error;

      const sentMessage = parseMessage(data);
      if (!sentMessage) {
        throw new Error("La base de datos devolvió un mensaje con formato inválido.");
      }
      appendMessage(sentMessage);
      setDraft("");
    } catch (error) {
      console.error("No se pudo enviar el mensaje:", error);
      showToast("No se pudo enviar el mensaje. Inténtalo nuevamente.", "error");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="container-site py-8 sm:py-10">
        <div className="mb-6">
          <p className="eyebrow">Tu cuenta</p>
          <h1 className="section-title mt-1">Mensajes</h1>
        </div>

        <div className="grid min-h-[34rem] overflow-hidden rounded-2xl border border-border bg-surface md:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="border-b border-border md:border-b-0 md:border-r" aria-label="Conversaciones">
            <div className="border-b border-border px-4 py-4">
              <h2 className="font-semibold text-foreground">Conversaciones</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                
              </p>
            </div>

            {isAuthLoading || isInboxLoading ? (
              <p className="px-4 py-6 text-sm text-muted-foreground" role="status">
                Cargando conversaciones...
              </p>
            ) : !userId ? (
              <div className="px-4 py-6">
                <p className="text-sm text-muted-foreground">Inicia sesión para ver tus mensajes.</p>
                <Link className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800" href="/login">
                  Iniciar sesión
                </Link>
              </div>
            ) : inboxError ? (
              <p className="px-4 py-6 text-sm text-muted-foreground" role="alert">{inboxError}</p>
            ) : conversations.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Aún no tienes conversaciones.
              </p>
            ) : (
              <ul className="max-h-[22rem] overflow-y-auto md:max-h-[38rem]">
                {conversations.map((conversation) => {
                  const selected = conversation.id === activeConversationNumber;
                  return (
                    <li key={conversation.id} className="border-b border-border last:border-b-0">
                      <Link
                        href={`/messages/${conversation.id}`}
                        aria-current={selected ? "page" : undefined}
                        className={`block px-4 py-4 transition-colors hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring ${
                          selected ? "bg-brand-50" : ""
                        }`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-foreground">
                              {conversation.otherName}
                            </span>
                            <span className="mt-1 block truncate text-sm text-muted-foreground">
                              {conversation.productName}
                            </span>
                            {conversation.lastMessage && (
                              <span className="mt-1 block truncate text-xs text-muted-foreground">
                                {conversation.lastMessage}
                              </span>
                            )}
                          </span>
                          <time className="shrink-0 text-xs text-muted-foreground" dateTime={conversation.activityAt}>
                            {formatMessageTime(conversation.activityAt)}
                          </time>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="flex min-h-[28rem] min-w-0 flex-col" aria-label="Chat">
            {isAuthLoading ? (
              <p className="m-auto px-6 text-sm text-muted-foreground" role="status">Cargando...</p>
            ) : !userId ? (
              <div className="m-auto max-w-sm px-6 py-10 text-center">
                <IconMessageCircle className="mx-auto size-10 text-brand-700" />
                <h2 className="mt-4 text-lg font-semibold text-foreground">Tus mensajes, en un solo lugar</h2>
                <p className="mt-2 text-sm text-muted-foreground">Inicia sesión para comunicarte con otros usuarios.</p>
              </div>
            ) : activeConversationId === null ? (
              <div className="m-auto max-w-sm px-6 py-10 text-center">
                <IconMessageCircle className="mx-auto size-10 text-brand-700" />
                <h2 className="mt-4 text-lg font-semibold text-foreground">Selecciona una conversación</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Elige un chat de la lista o contacta a un vendedor desde un producto.
                </p>
              </div>
            ) : threadError ? (
              <p className="m-auto px-6 text-center text-sm text-muted-foreground" role="alert">{threadError}</p>
            ) : (
              <>
                <header className="border-b border-border px-5 py-4">
                  <h2 className="font-semibold text-foreground">
                    {activeConversation?.otherName ?? "Conversación"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeConversation?.productName ?? "Cargando producto..."}
                  </p>
                </header>

                {realtimeError && (
                  <p className="border-b border-border bg-muted px-5 py-2 text-sm text-muted-foreground" role="status">
                    La conexión en tiempo real se interrumpió. Los mensajes enviados seguirán apareciendo.
                  </p>
                )}

                <div ref={messagesContainerRef} className="flex max-h-[60vh] min-h-[18rem] flex-1 flex-col gap-3 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
                  {isThreadLoading && messages.length === 0 ? (
                    <p className="m-auto text-sm text-muted-foreground" role="status">Cargando mensajes...</p>
                  ) : messages.length === 0 ? (
                    <p className="m-auto text-center text-sm text-muted-foreground">
                      No hay mensajes todavía. Escribe el primero.
                    </p>
                  ) : messages.map((message) => {
                    const isMine = message.sender_id === userId;
                    return (
                      <article
                        key={message.id}
                        className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[75%] ${
                          isMine
                            ? "self-end bg-brand-600 text-white"
                            : "self-start border border-border bg-background text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
                        <time
                          dateTime={message.created_at}
                          className={`mt-1 block text-right text-xs ${
                            isMine ? "text-white/80" : "text-muted-foreground"
                          }`}
                        >
                          {formatMessageTime(message.created_at)}
                        </time>
                      </article>
                    );
                  })}
                </div>

                <form className="flex items-end gap-3 border-t border-border p-4 sm:p-5" onSubmit={(event) => void sendMessage(event)}>
                  <Textarea
                    aria-label="Escribe tu mensaje"
                    placeholder="Escribe un mensaje..."
                    rows={2}
                    maxLength={4000}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    disabled={isThreadLoading || Boolean(threadError) || isSending}
                    className="min-h-12 max-h-32 flex-1 resize-y bg-background"
                  />
                  <Button
                    type="submit"
                    aria-label="Enviar mensaje"
                    disabled={!draft.trim() || isThreadLoading || Boolean(threadError) || isSending}
                    className="min-h-12 bg-brand-600 text-white hover:bg-brand-700"
                  >
                    <IconSend className="size-4" />
                    <span className="hidden sm:inline">{isSending ? "Enviando..." : "Enviar"}</span>
                  </Button>
                </form>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

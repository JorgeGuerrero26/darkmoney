import { useEffect, useRef, useState } from "react";
import type { AssistantMessage, AssistantReply } from "../lib/assistant-contract";
import { newChatId, parseChatStore, removeChat, renameChat, upsertChat, type ChatStore, type StoredChat } from "../lib/chat-store";

type Turn = AssistantMessage & { id: string; response?: AssistantReply };
type State = { key: string | null; chats: StoredChat[]; activeId: string; turns: Turn[]; readError: string };
export function assistantChatsKey(userId?: string, workspaceId?: number) {
  return userId && workspaceId ? `darkmoney.assistant.chats.${encodeURIComponent(userId)}.${workspaceId}` : null;
}
function read(key: string | null, fresh: boolean): State {
  let store: ChatStore = { activeId: null, chats: [] }, readError = "";
  try {
    if (key) {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const shape = JSON.parse(raw);
        if (!shape || !Array.isArray(shape.chats)) throw new Error("Invalid chat store");
        store = parseChatStore(raw);
      }
    }
  }
  catch { readError = "No pudimos leer las conversaciones guardadas en este navegador."; }
  const active = fresh ? null : store.chats.find(chat => chat.id === store.activeId);
  return { key, chats: store.chats, activeId: active?.id ?? newChatId(), turns: active?.items ?? [], readError };
}

/** Only text/role is persisted. Evidence and executable proposals belong to a fresh response. */
export function useAssistantChats(userId?: string, workspaceId?: number, fresh = false) {
  const key = assistantChatsKey(userId, workspaceId);
  const scope = useRef(key); scope.current = key;
  const [state, setState] = useState<State>(() => read(key, fresh));
  const [writeError, setWriteError] = useState<{ key: string | null; message: string } | null>(null);
  useEffect(() => { setState(current => current.key === key ? current : read(key, fresh)); }, [key, fresh]);
  useEffect(() => {
    if (!key || state.key !== key || state.readError) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({ activeId: state.activeId, chats: state.chats }));
      setWriteError(null);
    } catch { setWriteError({ key, message: "No pudimos guardar el chat localmente. La conversación sigue disponible en esta pantalla." }); }
  }, [key, state.key, state.activeId, state.chats, state.readError]);
  const current = state.key === key ? state : null;
  function update(apply: (state: State) => State) {
    if (scope.current !== key) return;
    setState(previous => previous.key === key ? apply(previous) : previous);
  }
  function append(messages: Array<AssistantMessage & { response?: AssistantReply }>) {
    update(previous => {
      if (previous.activeId !== current?.activeId) return previous;
      const turns = [...previous.turns, ...messages.map((message, i) => ({ ...message, id: `${previous.activeId}:${Date.now()}:${previous.turns.length + i}` }))];
      const textOnly = turns.map(({ id, role, content }) => ({ id, role, content }));
      return { ...previous, turns, chats: upsertChat(previous.chats, previous.activeId, textOnly) };
    });
  }
  function startNew() { update(previous => previous.turns.length ? { ...previous, activeId: newChatId(), turns: [] } : previous); }
  function select(id: string) {
    update(previous => {
      const chat = previous.chats.find(row => row.id === id);
      return !chat || previous.activeId === id ? previous : { ...previous, activeId: id, turns: chat.items };
    });
  }
  function rename(id: string, title: string) { update(previous => ({ ...previous, chats: renameChat(previous.chats, id, title) })); }
  function remove(id: string) {
    update(previous => ({ ...previous, chats: removeChat(previous.chats, id),
      ...(previous.activeId === id ? { activeId: newChatId(), turns: [] } : {}) }));
  }
  return { turns: current?.turns ?? [], chats: current?.chats ?? [], activeId: current?.activeId ?? "", ready: current !== null,
    error: current?.readError || (writeError?.key === key ? writeError.message : ""), append, startNew, select, rename, remove };
}

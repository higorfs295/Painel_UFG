"use client";

// Avisos (RF-24) + marcador de "não lido". O marcador fica no navegador: é conveniência
// de leitura, não estado da conta (e não justifica uma tabela nova no banco).
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { announcements } from "@/lib/api/endpoints";

const SEEN_KEY = "painel-avisos-vistos";
const SEEN_EVENT = "avisos:vistos";

function readSeen() {
  try { return Number(localStorage.getItem(SEEN_KEY) ?? 0) || 0; } catch { return 0; }
}

export function useAnnouncements(enabled = true) {
  const query = useQuery({ queryKey: ["announcements"], queryFn: announcements.feed, staleTime: 60_000, enabled });
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    setSeen(readSeen());
    const sync = () => setSeen(readSeen());
    window.addEventListener(SEEN_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(SEEN_EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);

  // v12: um aviso agendado "chega" na publicação, não na criação — é essa data que conta
  const isNew = useCallback((publishedAt: string) => new Date(publishedAt).getTime() > seen, [seen]);
  const unread = (query.data ?? []).filter((a) => isNew(a.publishAt ?? a.createdAt)).length;

  const markAllSeen = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* sem storage: vale só nesta aba */ }
    window.dispatchEvent(new Event(SEEN_EVENT));
  }, []);

  return { ...query, unread, isNew, markAllSeen };
}

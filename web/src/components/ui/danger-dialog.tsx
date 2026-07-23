"use client";

// Confirmação em duas etapas para ações destrutivas (RF-28).
//
// Etapa 1: mostra o que será perdido — números concretos, não um "tem certeza?".
// Etapa 2: exige que a pessoa digite a palavra-chave (o slug do curso).
// O mesmo texto é reenviado ao servidor, que também confere: a UI é a segunda trava.
import { useEffect, useRef, useState } from "react";
import Button from "./button";
import { inputCls } from "./index";
import { IconX } from "./icons";
import { cn } from "@/lib/utils";

export function DangerDialog({
  open, title, children, keyword, confirmLabel, pending, error, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  /** palavra que precisa ser digitada para liberar a ação */
  keyword: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: (typed: string) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setStep(1); setTyped(""); } }, [open]);
  useEffect(() => { if (step === 2) inputRef.current?.focus(); }, [step]);

  // Esc fecha — uma ação destrutiva nunca deve prender a pessoa no diálogo
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const armed = typed.trim() === keyword;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-5 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className="bg-popover border-t-lock w-full max-w-lg rounded-xl border border-t-2 p-6 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-display text-foreground text-xl font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground cursor-pointer p-1"><IconX /></button>
        </div>

        <div className="text-muted-foreground text-sm">{children}</div>

        {step === 2 && (
          <label className="text-muted-foreground mt-4 flex flex-col gap-1.5 text-[0.7rem] font-semibold tracking-[0.12em] uppercase">
            <span>Para confirmar, digite <code className="text-foreground text-sm normal-case">{keyword}</code></span>
            <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)}
              autoComplete="off" spellCheck={false} placeholder={keyword} className={cn(inputCls, "font-mono")} />
          </label>
        )}

        {error && <p className="text-lock mt-3 text-sm" role="alert">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {step === 1 ? (
            <Button variant="danger" onClick={() => setStep(2)}>Entendi, continuar</Button>
          ) : (
            <Button variant="danger" disabled={!armed || pending} onClick={() => onConfirm(typed.trim())}>
              {pending ? "Aplicando…" : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Confirmação em duas etapas para ações destrutivas (RF-28).
//
// Etapa 1: mostra o que será perdido — números concretos, não um "tem certeza?".
// Etapa 2: exige que a pessoa digite a palavra-chave (o slug do curso). Só então o botão libera.
// O mesmo texto é reenviado ao servidor, que também confere: a UI é a segunda trava, não a única.
import { useEffect, useRef, useState } from "react";
import Button from "./Button";
import { IconX } from "./Icons";

type Props = {
  open: boolean;
  title: string;
  /** o que acontece — pode ser texto ou uma lista de números de impacto */
  children: React.ReactNode;
  /** palavra que precisa ser digitada para liberar a ação */
  keyword: string;
  confirmLabel: string;
  pending?: boolean;
  error?: string;
  onConfirm: (typed: string) => void;
  onClose: () => void;
};

export default function DangerDialog({
  open, title, children, keyword, confirmLabel, pending, error, onConfirm, onClose,
}: Props) {
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
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal danger" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3 className="danger-title">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><IconX /></button>
        </div>

        <div className="modal-body">{children}</div>

        {step === 2 && (
          <label className="field mt">
            Para confirmar, digite <code>{keyword}</code>
            <input ref={inputRef} value={typed} onChange={(e) => setTyped(e.target.value)}
              autoComplete="off" spellCheck={false} placeholder={keyword} />
          </label>
        )}

        {error && <div className="err mt" role="alert">{error}</div>}

        <div className="row mt" style={{ gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {step === 1 ? (
            <Button variant="warn" onClick={() => setStep(2)}>Entendi, continuar</Button>
          ) : (
            <Button variant="warn" disabled={!armed || pending} onClick={() => onConfirm(typed.trim())}>
              {pending ? "Aplicando…" : confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

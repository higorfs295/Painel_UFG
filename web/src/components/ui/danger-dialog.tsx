"use client";

// Confirmação em duas etapas para ações destrutivas (RF-28), no Tremor Raw Dialog (Radix:
// foco preso, Esc fecha, papel `dialog`).
//
// Etapa 1: mostra o que será perdido — números concretos, não um "tem certeza?".
// Etapa 2: exige que a pessoa digite a palavra-chave (o slug do curso).
// O mesmo texto é reenviado ao servidor, que também confere: a UI é a segunda trava.
import { useEffect, useState } from "react";
import { Button } from "@/components/tremor/Button";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/tremor/Dialog";
import { Input } from "@/components/tremor/Input";
import { Label } from "@/components/tremor/Label";

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

  useEffect(() => { if (open) { setStep(1); setTyped(""); } }, [open]);
  const armed = typed.trim() === keyword;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{children}</div>
          </DialogDescription>
        </DialogHeader>

        {step === 2 && (
          <div className="mt-4">
            <Label htmlFor="danger-keyword">
              Para confirmar, digite <code>{keyword}</code>
            </Label>
            <Input id="danger-keyword" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)}
              autoComplete="off" spellCheck={false} placeholder={keyword} className="mt-2 font-mono" />
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>}

        <DialogFooter className="mt-6 gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">Cancelar</Button>
          </DialogClose>
          {step === 1 ? (
            <Button variant="destructive" className="w-full sm:w-fit" onClick={() => setStep(2)}>Entendi, continuar</Button>
          ) : (
            <Button variant="destructive" className="w-full sm:w-fit" disabled={!armed} isLoading={pending}
              loadingText="Aplicando…" onClick={() => onConfirm(typed.trim())}>
              {confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

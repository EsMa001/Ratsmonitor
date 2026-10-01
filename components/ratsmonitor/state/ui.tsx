import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface UiValue {
  saveDialogOpen: boolean;
  openSaveDialog: () => void;
  closeSaveDialog: () => void;
  /** Gespeicherte Suche, die in der Liste kurz hervorgehoben wird */
  flashSaved: string;
  setFlashSaved: (id: string) => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [saveDialogOpen, setOpen] = useState(false);
  const [flashSaved, setFlashSaved] = useState("");
  const value = useMemo<UiValue>(
    () => ({ saveDialogOpen, openSaveDialog: () => setOpen(true), closeSaveDialog: () => setOpen(false), flashSaved, setFlashSaved }),
    [saveDialogOpen, flashSaved],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiValue {
  const v = useContext(UiContext);
  if (!v) throw new Error("useUi außerhalb von UiProvider");
  return v;
}

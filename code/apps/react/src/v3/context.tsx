import { createContext, useContext, type ReactNode } from "react";
import type { Command, Role, Workspace } from "./types";
export interface Field {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "select" | "checks";
  value?: string | number;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
  maxLength?: number;
  options?: {
    value: string;
    label: string;
    disabled?: boolean;
    checked?: boolean;
  }[];
}
export interface FormSpec {
  kind: "form";
  title: string;
  fields: Field[];
  note?: ReactNode;
  label?: string;
  command: (data: FormData) => Command;
  after?: (next: Workspace) => void;
}
export type ModalSpec =
  | FormSpec
  | { kind: "product" | "alarm" | "ota"; id: string }
  | { kind: "search" | "notifications" | "reset" }
  | { kind: "info"; title: string; body: ReactNode };
export interface Context {
  store: Workspace;
  apply: (command: Command) => Workspace;
  show: (modal: ModalSpec) => void;
  close: (saved?: boolean) => void;
  notify: (text: string) => void;
  dirty: boolean;
  setDirty: (value: boolean) => void;
  scenario: string;
  setScenario: (value: string) => void;
  go: (path: string) => void;
  setRole: (role: Role) => void;
  reset: () => void;
}
export const WorkspaceContext = createContext<Context | null>(null);
export function useWorkspace() {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error("Missing V3 workspace context");
  return c;
}
export const value = (form: FormData, key: string) =>
  String(form.get(key) ?? "");
export const options = (items: string[]) =>
  items.map((value) => ({ value, label: value }));

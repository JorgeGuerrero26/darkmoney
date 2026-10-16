import { useEffect, useRef, useState } from "react";

import type { AccountSummary } from "../../../types/domain";
import {
  buildFormStateFromAccount,
  createDefaultFormState,
  type AccountFormState,
} from "../lib/account-validation";
import { getTypePreset } from "../lib/account-options";

export type AccountEditorMode = "create" | "edit";

export const accountEditorDraftKey = (userId: string, workspaceId: number) => `darkmoney.account-editor.v1.${encodeURIComponent(userId)}.${workspaceId}`;
const ACCOUNT_EDITOR_DRAFT_MAX_AGE_MS = 10 * 60 * 1000;

type PersistedAccountEditorState = {
  editorMode: AccountEditorMode;
  formState: AccountFormState;
  isEditorOpen: boolean;
  savedAt: number;
  selectedAccountId: number | null;
  userId: string;
  workspaceId: number;
};

function readPersistedAccountEditorState(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(key);
    if (!rawValue) return null;
    const value = JSON.parse(rawValue) as PersistedAccountEditorState;
    if (!value || !["create", "edit"].includes(value.editorMode) || typeof value.isEditorOpen !== "boolean" ||
      !Number.isFinite(value.savedAt) || value.savedAt > Date.now() || value.savedAt < 0 ||
      (value.selectedAccountId !== null && (!Number.isSafeInteger(value.selectedAccountId) || value.selectedAccountId <= 0)) ||
      !value.formState || Object.entries(createDefaultFormState("PEN")).some(([field, fallback]) => typeof value.formState[field as keyof AccountFormState] !== typeof fallback)) return null;
    return value;
  } catch {
    return null;
  }
}

export function clearPersistedAccountEditorState(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  try { window.sessionStorage.removeItem(key); } catch { /* Editing remains available without storage. */ }
}

function persistAccountEditorState(key: string, value: PersistedAccountEditorState) {
  if (typeof window === "undefined") {
    return;
  }

  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Keep the draft in memory. */ }
}

export function useAccountEditor({
  accounts,
  baseCurrencyCode,
  isLoadingWorkspace,
  userId,
  workspaceId,
}: {
  accounts: AccountSummary[];
  baseCurrencyCode: string;
  isLoadingWorkspace: boolean;
  userId?: string;
  workspaceId?: number;
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [editorMode, setEditorMode] = useState<AccountEditorMode>("create");
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [formState, setFormState] = useState<AccountFormState>(() =>
    createDefaultFormState(baseCurrencyCode),
  );
  const hasHydratedEditorDraft = useRef(false);
  const isEditorDraftReady = useRef(false);
  const storageKey = userId && workspaceId ? accountEditorDraftKey(userId, workspaceId) : null;

  const selectedAccount =
    selectedAccountId !== null
      ? accounts.find((account) => account.id === selectedAccountId) ?? null
      : null;

  useEffect(() => {
    if (!workspaceId) {
      if (!isLoadingWorkspace) {
        setIsEditorOpen(false);
        setSelectedAccountId(null);
      }
      return;
    }

    if (!isEditorOpen || editorMode !== "create") {
      return;
    }

    setFormState((currentState) => ({
      ...currentState,
      currencyCode: currentState.currencyCode || baseCurrencyCode,
    }));
  }, [baseCurrencyCode, editorMode, isEditorOpen, isLoadingWorkspace, workspaceId]);

  useEffect(() => {
    if (hasHydratedEditorDraft.current || !workspaceId || !userId || !storageKey || isLoadingWorkspace) {
      return;
    }

    hasHydratedEditorDraft.current = true;
    const persistedState = readPersistedAccountEditorState(storageKey);

    if (!persistedState) {
      isEditorDraftReady.current = true;
      return;
    }

    const isExpired = Date.now() - persistedState.savedAt > ACCOUNT_EDITOR_DRAFT_MAX_AGE_MS;
    const isWrongScope =
      persistedState.userId !== userId || persistedState.workspaceId !== workspaceId;

    if (isExpired || isWrongScope) {
      clearPersistedAccountEditorState(storageKey);
      isEditorDraftReady.current = true;
      return;
    }

    setEditorMode(persistedState.editorMode);
    setSelectedAccountId(persistedState.selectedAccountId);
    setFormState({ ...createDefaultFormState(baseCurrencyCode), ...persistedState.formState });
    setIsEditorOpen(persistedState.isEditorOpen);
    setIsDirty(persistedState.isEditorOpen);
    isEditorDraftReady.current = true;
  }, [userId, workspaceId, storageKey, isLoadingWorkspace]);

  useEffect(() => {
    if (!isEditorDraftReady.current || !workspaceId || !userId || !storageKey) {
      return;
    }

    if (!isEditorOpen) {
      clearPersistedAccountEditorState(storageKey);
      return;
    }

    persistAccountEditorState(storageKey, {
      editorMode,
      formState,
      isEditorOpen,
      savedAt: Date.now(),
      selectedAccountId,
      userId,
      workspaceId,
    });
  }, [editorMode, formState, isEditorOpen, selectedAccountId, userId, workspaceId, storageKey]);

  useEffect(() => {
    if (!isEditorOpen || editorMode !== "edit" || !selectedAccount || isDirty) {
      return;
    }

    setFormState(buildFormStateFromAccount(selectedAccount));
  }, [editorMode, isEditorOpen, selectedAccount, isDirty]);

  function openCreateEditor() {
    if (!workspaceId) {
      return;
    }

    setEditorMode("create");
    setSelectedAccountId(null);
    setFormState(createDefaultFormState(baseCurrencyCode));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(account: AccountSummary) {
    setEditorMode("edit");
    setSelectedAccountId(account.id);
    setFormState(buildFormStateFromAccount(account));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function updateFormState<Field extends keyof AccountFormState>(
    field: Field,
    value: AccountFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function handleAccountTypeChange(nextType: string) {
    const currentPreset = getTypePreset(formState.type);
    const nextPreset = getTypePreset(nextType);

    setIsDirty(true);
    setFormState((currentState) => ({
      ...currentState,
      type: nextType,
      statementDay: nextType === "credit_card" ? currentState.statementDay : "",
      paymentDay: nextType === "credit_card" ? currentState.paymentDay : "",
      creditLimit: nextType === "credit_card" ? currentState.creditLimit : "",
      color:
        currentState.color === currentPreset.color ? nextPreset.color : currentState.color,
      icon:
        currentState.icon === currentPreset.icon ? nextPreset.icon : currentState.icon,
    }));
  }

  function replaceFormState(nextFormState: AccountFormState) {
    setFormState(nextFormState);
    setIsDirty(false);
  }

  function closeEditor() {
    if (storageKey) clearPersistedAccountEditorState(storageKey);
    setIsEditorOpen(false);
    setSelectedAccountId(null);
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isDirty) {
      setShowUnsavedDialog(true);
      return;
    }

    closeEditor();
  }

  return {
    closeEditor,
    editorMode,
    formState,
    handleAccountTypeChange,
    isDirty,
    isEditorOpen,
    openCreateEditor,
    openEditEditor,
    replaceFormState,
    requestCloseEditor,
    selectedAccount,
    selectedAccountId,
    setShowUnsavedDialog,
    showUnsavedDialog,
    updateFormState,
  };
}

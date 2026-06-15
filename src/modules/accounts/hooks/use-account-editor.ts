import { useEffect, useRef, useState } from "react";

import type { AccountSummary } from "../../../types/domain";
import {
  buildFormStateFromAccount,
  createDefaultFormState,
  type AccountFormState,
} from "../lib/account-validation";

export type AccountEditorMode = "create" | "edit";

const ACCOUNT_EDITOR_DRAFT_STORAGE_KEY = "darkmoney-account-editor-draft";
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

function readPersistedAccountEditorState() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(ACCOUNT_EDITOR_DRAFT_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PersistedAccountEditorState;
  } catch {
    window.sessionStorage.removeItem(ACCOUNT_EDITOR_DRAFT_STORAGE_KEY);
    return null;
  }
}

export function clearPersistedAccountEditorState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(ACCOUNT_EDITOR_DRAFT_STORAGE_KEY);
}

function persistAccountEditorState(value: PersistedAccountEditorState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(ACCOUNT_EDITOR_DRAFT_STORAGE_KEY, JSON.stringify(value));
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
    if (hasHydratedEditorDraft.current || !workspaceId || !userId) {
      return;
    }

    hasHydratedEditorDraft.current = true;
    const persistedState = readPersistedAccountEditorState();

    if (!persistedState) {
      isEditorDraftReady.current = true;
      return;
    }

    const isExpired = Date.now() - persistedState.savedAt > ACCOUNT_EDITOR_DRAFT_MAX_AGE_MS;
    const isWrongScope =
      persistedState.userId !== userId || persistedState.workspaceId !== workspaceId;

    if (isExpired || isWrongScope) {
      clearPersistedAccountEditorState();
      isEditorDraftReady.current = true;
      return;
    }

    setEditorMode(persistedState.editorMode);
    setSelectedAccountId(persistedState.selectedAccountId);
    setFormState(persistedState.formState);
    setIsEditorOpen(persistedState.isEditorOpen);
    isEditorDraftReady.current = true;
  }, [userId, workspaceId]);

  useEffect(() => {
    if (!isEditorDraftReady.current || !workspaceId || !userId) {
      return;
    }

    if (!isEditorOpen) {
      clearPersistedAccountEditorState();
      return;
    }

    persistAccountEditorState({
      editorMode,
      formState,
      isEditorOpen,
      savedAt: Date.now(),
      selectedAccountId,
      userId,
      workspaceId,
    });
  }, [editorMode, formState, isEditorOpen, selectedAccountId, userId, workspaceId]);

  useEffect(() => {
    if (!isEditorOpen || editorMode !== "edit" || !selectedAccount) {
      return;
    }

    setFormState(buildFormStateFromAccount(selectedAccount));
  }, [editorMode, isEditorOpen, selectedAccount]);

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

  function replaceFormState(nextFormState: AccountFormState) {
    setFormState(nextFormState);
    setIsDirty(false);
  }

  function closeEditor() {
    clearPersistedAccountEditorState();
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

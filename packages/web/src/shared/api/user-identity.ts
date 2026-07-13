const LOCAL_USER_ID = "local";
const USER_ID_STORAGE_KEY = "monitor.userId";
const USER_EMAIL_STORAGE_KEY = "monitor.userEmail";

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function normalizeStoredUserId(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed && trimmed !== LOCAL_USER_ID ? trimmed : null;
}

let currentUserId: string | null = normalizeStoredUserId(
  readStored(USER_ID_STORAGE_KEY),
);
let currentUserEmail: string | null = currentUserId
  ? readStored(USER_EMAIL_STORAGE_KEY)
  : null;

export function getUserId(): string | null {
  return currentUserId;
}

export function getUserEmail(): string | null {
  return currentUserEmail;
}

export function setUserIdentity(userId: string, email: string): void {
  currentUserId = userId;
  currentUserEmail = email;
  try {
    window.localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    window.localStorage.setItem(USER_EMAIL_STORAGE_KEY, email);
  } catch {
    return;
  }
}

/** 현재 신원을 지우고 로컬 단독 사용자 상태로 되돌린다. */
export function clearUserIdentity(): void {
  currentUserId = null;
  currentUserEmail = null;
  try {
    window.localStorage.removeItem(USER_ID_STORAGE_KEY);
    window.localStorage.removeItem(USER_EMAIL_STORAGE_KEY);
  } catch {
    return;
  }
}

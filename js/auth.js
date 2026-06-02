const AUTH_KEY = "rpg-life-auth-v1";
const REMEMBER_KEY = "rpg-life-remember-v1";
const SESSION_USER_KEY = "rpg-life-session-user";
const REMEMBER_PREF_KEY = "rpg-life-remember-pref";
const LEGACY_SAVE_KEY = "rpg-life-save-v3";

function readAuthStore() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return { users: [], sessionUserId: null, pendingLegacySave: null };
    const data = JSON.parse(raw);
    return {
      users: data.users ?? [],
      sessionUserId: data.sessionUserId ?? null,
      pendingLegacySave: data.pendingLegacySave ?? null,
    };
  } catch {
    return { users: [], sessionUserId: null, pendingLegacySave: null };
  }
}

function writeAuthStore(store) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(store));
}

function readRemember() {
  try {
    const raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeRemember(data) {
  localStorage.setItem(REMEMBER_KEY, JSON.stringify(data));
}

export function clearRemember() {
  localStorage.removeItem(REMEMBER_KEY);
}

export function getRememberPreference() {
  const pref = localStorage.getItem(REMEMBER_PREF_KEY);
  if (pref === "0") return false;
  return true;
}

export function setRememberPreference(remember) {
  localStorage.setItem(REMEMBER_PREF_KEY, remember ? "1" : "0");
}

export function getSavedUsername() {
  const rem = readRemember();
  if (rem?.username) return rem.username;
  return localStorage.getItem("rpg-life-last-username") ?? "";
}

function saveLastUsername(username) {
  localStorage.setItem("rpg-life-last-username", username.trim());
}

export async function hashPassword(username, password) {
  const enc = new TextEncoder();
  const data = enc.encode(`${username.trim().toLowerCase()}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashRememberToken(token, userId) {
  const enc = new TextEncoder();
  const data = enc.encode(`${userId}:${token}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function createRememberToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function createUserId() {
  return `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function captureLegacySaveIfNeeded(store) {
  if (store.pendingLegacySave || store.users.length > 0) return store;
  const legacy = localStorage.getItem(LEGACY_SAVE_KEY);
  if (legacy) {
    store.pendingLegacySave = legacy;
  }
  return store;
}

function findUserById(userId) {
  return readAuthStore().users.find((u) => u.id === userId) ?? null;
}

function persistSession(userId, rememberMe) {
  const store = readAuthStore();
  store.sessionUserId = userId;
  writeAuthStore(store);

  if (rememberMe) {
    sessionStorage.removeItem(SESSION_USER_KEY);
  } else {
    sessionStorage.setItem(SESSION_USER_KEY, userId);
  }
}

async function attachRememberToken(user) {
  const token = createRememberToken();
  user.rememberTokenHash = await hashRememberToken(token, user.id);
  writeRemember({
    userId: user.id,
    username: user.username,
    token,
  });
  const store = readAuthStore();
  const idx = store.users.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    store.users[idx] = user;
    writeAuthStore(store);
  }
}

export function getCurrentUserId() {
  const fromSession = sessionStorage.getItem(SESSION_USER_KEY);
  if (fromSession && findUserById(fromSession)) return fromSession;

  const store = readAuthStore();
  if (store.sessionUserId && findUserById(store.sessionUserId)) {
    return store.sessionUserId;
  }

  return null;
}

export function getCurrentUser() {
  const id = getCurrentUserId();
  if (!id) return null;
  return findUserById(id);
}

export function listUsers() {
  return readAuthStore().users;
}

export function setSession(userId) {
  persistSession(userId, true);
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_USER_KEY);
  const store = readAuthStore();
  store.sessionUserId = null;
  writeAuthStore(store);
}

export function getSaveStorageKey(userId) {
  return `${LEGACY_SAVE_KEY}:${userId}`;
}

export function takePendingLegacySave() {
  const store = captureLegacySaveIfNeeded(readAuthStore());
  const legacy = store.pendingLegacySave;
  if (legacy) {
    store.pendingLegacySave = null;
    writeAuthStore(store);
    localStorage.removeItem(LEGACY_SAVE_KEY);
  }
  return legacy;
}

/** 启动时尝试恢复登录（记住我令牌 / 本会话 / 旧版持久会话） */
export async function tryAutoLogin() {
  const remember = readRemember();
  if (remember?.userId && remember?.token) {
    const user = findUserById(remember.userId);
    if (user?.rememberTokenHash) {
      const hash = await hashRememberToken(remember.token, user.id);
      if (hash === user.rememberTokenHash) {
        persistSession(user.id, true);
        return { ok: true, user, via: "remember" };
      }
    }
    clearRemember();
  }

  const sessionId = sessionStorage.getItem(SESSION_USER_KEY);
  if (sessionId) {
    const user = findUserById(sessionId);
    if (user) {
      persistSession(user.id, false);
      return { ok: true, user, via: "session" };
    }
    sessionStorage.removeItem(SESSION_USER_KEY);
  }

  const store = readAuthStore();
  if (store.sessionUserId) {
    const user = findUserById(store.sessionUserId);
    if (user) {
      return { ok: true, user, via: "legacy" };
    }
    store.sessionUserId = null;
    writeAuthStore(store);
  }

  return { ok: false };
}

export async function registerUser(username, password, rememberMe = true) {
  const name = username.trim();
  if (name.length < 2 || name.length > 20) {
    return { ok: false, error: "用户名需 2–20 个字符" };
  }
  if (password.length < 4) {
    return { ok: false, error: "密码至少 4 位" };
  }

  const store = captureLegacySaveIfNeeded(readAuthStore());
  if (store.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "该用户名已存在" };
  }

  const user = {
    id: createUserId(),
    username: name,
    passwordHash: await hashPassword(name, password),
    createdAt: Date.now(),
    rememberTokenHash: null,
  };
  store.users.push(user);
  writeAuthStore(store);

  setRememberPreference(rememberMe);
  saveLastUsername(name);

  if (rememberMe) {
    await attachRememberToken(user);
    persistSession(user.id, true);
  } else {
    clearRemember();
    persistSession(user.id, false);
  }

  return { ok: true, user };
}

export async function loginUser(username, password, rememberMe = true) {
  const name = username.trim();
  const store = readAuthStore();
  const user = store.users.find((u) => u.username.toLowerCase() === name.toLowerCase());
  if (!user) return { ok: false, error: "用户名不存在" };

  const hash = await hashPassword(name, password);
  if (hash !== user.passwordHash) {
    return { ok: false, error: "密码错误" };
  }

  setRememberPreference(rememberMe);
  saveLastUsername(name);

  if (rememberMe) {
    await attachRememberToken(user);
    persistSession(user.id, true);
  } else {
    clearRemember();
    user.rememberTokenHash = null;
    const idx = store.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      store.users[idx] = user;
      writeAuthStore(store);
    }
    persistSession(user.id, false);
  }

  return { ok: true, user };
}

export function logoutUser() {
  clearRemember();
  sessionStorage.removeItem(SESSION_USER_KEY);
  const store = readAuthStore();
  if (store.sessionUserId) {
    const user = store.users.find((u) => u.id === store.sessionUserId);
    if (user) {
      user.rememberTokenHash = null;
    }
    store.sessionUserId = null;
    writeAuthStore(store);
  }
}

export function hasPendingLegacy() {
  const store = captureLegacySaveIfNeeded(readAuthStore());
  return !!(store.pendingLegacySave || localStorage.getItem(LEGACY_SAVE_KEY));
}

import { BACKEND_URL, TOKEN_KEY } from '../constant.js';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function setToken(token) {
  if (!token) clearToken();
  else localStorage.setItem(TOKEN_KEY, token);
}

export function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function buildUrl(path) {
  if (!path) return BACKEND_URL;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_URL}${p}`;
}

export async function apiFetch(path, options = {}) {
  const url = buildUrl(path);

  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');

  const token = getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `Request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function loginUser({ email, password }) {
  return apiFetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser({ firstName, lastName, email, phone, password, passwordConfirm, role }) {
  return apiFetch('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ firstName, lastName, email, phone, password, passwordConfirm, role }),
  });
}

export async function forgotPassword({ email }) {
  return apiFetch('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword({ token, password, passwordConfirm }) {
  return apiFetch(`/api/v1/auth/reset-password/${encodeURIComponent(token)}`, {
    method: 'POST',
    body: JSON.stringify({ password, passwordConfirm }),
  });
}

export async function logoutUser() {
  clearToken();
  return apiFetch('/api/v1/auth/logout', { method: 'POST' });
}

export async function fetchMe() {
  return apiFetch('/api/v1/auth/me', { method: 'GET' });
}


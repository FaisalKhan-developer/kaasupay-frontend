/*
 * KaasuPay frontend
 * API route names are centralized below. If your backend uses a different route,
 * edit API_PATHS rather than searching through the whole file.
 */
const API_BASE = "https://kaasupay-backend.vercel.app/api/v1";
const API_PATHS = {
  signup: "/user/signup",
  login: "/user/signin",
  transfer: "/user/transfer",
  balance: "/wallet/balance",
  transactions: "/wallet/transactions",
  addMoneyOrder: "/wallet/add-money/order",
  addMoneyVerify: "/wallet/add-money/verify",
  bankAccounts: "/wallet/bank-accounts",
  withdraw: "/wallet/withdraw",
  withdrawals: "/wallet/withdrawals",
  adminWithdrawals: "/wallet/admin/withdrawals"
};

const state = { token: localStorage.getItem("kaasupay_token") || "", user: null, transactions: [], bankAccounts: [], withdrawals: [] };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showNotice(message, type = "info") {
  const box = $("#notice");
  box.className = `notice ${type}`;
  box.textContent = message;
  box.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearNotice() { $("#notice").classList.add("hidden"); }
function money(amountInPaise) {
  const value = Number(amountInPaise);
  if (!Number.isFinite(value)) return "₹ —";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value / 100);
}
function rupeesToPaise(value) { return Math.round(Number(value) * 100); }
function getArray(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  for (const key of keys) if (Array.isArray(payload?.[key])) return payload[key];
  return [];
}
function safeText(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}
function prettyStatus(value) {
  const s = safeText(value, "UNKNOWN").toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  let cls = s.toLowerCase();
  if (s === "SUCCESS" || s === "COMPLETED") cls = "success";
  else if (s === "NEEDS_REVIEW") cls = "review";
  else if (s === "REVERSED" || s === "FAILED") cls = s.toLowerCase();
  else if (s === "PENDING" || s === "PROCESSING") cls = s.toLowerCase();
  return `<span class="badge ${cls}">${s}</span>`;
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw }; }
  if (!response.ok) throw new Error(data.error || data.message || `Request failed (${response.status})`);
  return data;
}
function formObject(form) { return Object.fromEntries(new FormData(form).entries()); }
function setConnection(connected) {
  $("#connectionText").textContent = connected ? "API connected" : "API unavailable";
  $(".connection-pill .status-dot").classList.toggle("good", connected);
}
function setAuthTab(tab) {
  $$(".auth-tab").forEach(button => button.classList.toggle("active", button.dataset.auth === tab));
  $("#loginForm").classList.toggle("hidden", tab !== "login");
  $("#signupForm").classList.toggle("hidden", tab !== "signup");
}
function enterWorkspace(user = {}) {
  state.user = user;
  $("#authPanel").classList.add("hidden");
  $("#workspace").classList.remove("hidden");
  const name = user.firstName || user.username || user.email || "there";
  $("#welcomeName").textContent = name;
  $("#profileAvatar").textContent = String(name).charAt(0).toUpperCase();
  showView("dashboard");
  refreshDashboard();
}
function logout() {
  state.token = "";
  state.user = null;
  localStorage.removeItem("kaasupay_token");
  $("#workspace").classList.add("hidden");
  $("#authPanel").classList.remove("hidden");
  $("#walletBalance").textContent = "₹ —";
  showNotice("You have been logged out.", "success");
}
function showView(name) {
  const titleMap = { dashboard: "Dashboard", transfer: "Send money", "add-money": "Add money", bank: "Bank accounts", withdraw: "Withdraw", transactions: "Transactions", admin: "Admin tools" };
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
  $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));
  $("#pageTitle").textContent = titleMap[name] || "Dashboard";
  clearNotice();
  if (name === "bank") loadBankAccounts();
  if (name === "transactions") loadTransactions();
  if (name === "withdraw") { loadBankAccounts(); loadWithdrawals(); }
}
function renderTransactions(items, targetSelector) {
  const target = $(targetSelector);
  if (!items.length) { target.innerHTML = '<div class="empty-state">No transactions found, or the API returned an empty list.</div>'; return; }
  target.innerHTML = `<table class="data-table"><thead><tr><th>Type</th><th>Details</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>${items.map(item => {
    const type = safeText(item.type || item.transactionType || item.kind, "TRANSACTION");
    const amount = Number(item.amount);
    const isCredit = ["DEPOSIT", "TOPUP", "CREDIT", "REVERSAL"].includes(type.toUpperCase()) || item.direction === "CREDIT";
    const date = item.createdAt || item.date || item.updatedAt;
    const details = item.note || item.description || item.reference || item._id;
    return `<tr><td><b>${escapeHtml(type)}</b></td><td>${escapeHtml(details)}</td><td class="${isCredit ? "amount-credit" : "amount-debit"}">${isCredit ? "+" : "−"}${money(amount)}</td><td>${prettyStatus(item.status || "SUCCESS")}</td><td>${escapeHtml(date ? new Date(date).toLocaleString() : "—")}</td></tr>`;
  }).join("")}</tbody></table>`;
}
async function loadTransactions() {
  try {
    const data = await api(API_PATHS.transactions);
    state.transactions = getArray(data, ["transactions", "items", "data"]);
    renderTransactions(state.transactions, "#allTransactions");
    renderTransactions(state.transactions.slice(0, 5), "#recentTransactions");
    $("#transactionCount").textContent = state.transactions.length;
    setConnection(true);
  } catch (error) {
    $("#allTransactions").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}<br><br>Check API_PATHS.transactions in app.js.</div>`;
    $("#recentTransactions").innerHTML = `<div class="empty-state">Could not load transactions.</div>`;
    $("#transactionCount").textContent = "—";
    setConnection(false);
  }
}
async function loadBalance() {
  try {
    const data = await api(API_PATHS.balance);
    const wallet = data.wallet || data;
    const paise = wallet.balance ?? wallet.balanceInPaise ?? data.balance ?? data.balanceInPaise;
    if (paise !== undefined) $("#walletBalance").textContent = money(paise);
    else $("#walletBalance").textContent = "Balance unavailable";
    setConnection(true);
  } catch (error) {
    $("#walletBalance").textContent = "₹ —";
    setConnection(false);
  }
}
async function loadBankAccounts() {
  try {
    const data = await api(API_PATHS.bankAccounts);
    state.bankAccounts = getArray(data, ["bankAccounts", "accounts", "items", "data"]);
    $("#bankCount").textContent = state.bankAccounts.length;
    const target = $("#bankAccounts");
    if (!state.bankAccounts.length) target.innerHTML = '<div class="empty-state">No saved bank accounts yet. Add one using the form.</div>';
    else target.innerHTML = state.bankAccounts.map(account => {
      const last4 = account.last4 || String(account.accountNumber || "").slice(-4) || "••••";
      return `<div class="bank-item"><div class="bank-logo">▤</div><div><b>${escapeHtml(account.holderName || "Bank account")}</b><small>${escapeHtml(account.bankName || "Bank account")} · •••• ${escapeHtml(last4)} · ${escapeHtml(account.ifsc || "")}</small></div></div>`;
    }).join("");
    const select = $("#withdrawBankSelect");
    select.innerHTML = state.bankAccounts.length ? '<option value="">Select a bank account</option>' + state.bankAccounts.map(a => `<option value="${escapeHtml(a._id || a.id)}">${escapeHtml(a.holderName || "Account")} · •••• ${escapeHtml(a.last4 || String(a.accountNumber || "").slice(-4))}</option>`).join("") : '<option value="">Add a bank account first</option>';
  } catch (error) {
    $("#bankAccounts").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}<br><br>Check API_PATHS.bankAccounts in app.js.</div>`;
    $("#bankCount").textContent = "—";
    $("#withdrawBankSelect").innerHTML = '<option value="">Could not load bank accounts</option>';
  }
}
async function loadWithdrawals() {
  try {
    const data = await api(API_PATHS.withdrawals);
    state.withdrawals = getArray(data, ["withdrawals", "items", "data"]);
    renderWithdrawalTable(state.withdrawals, "#withdrawalsTable");
  } catch (error) {
    $("#withdrawalsTable").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}<br><br>Check API_PATHS.withdrawals in app.js.</div>`;
  }
}
function renderWithdrawalTable(items, selector) {
  const target = $(selector);
  if (!items.length) { target.innerHTML = '<div class="empty-state">No withdrawal records found.</div>'; return; }
  target.innerHTML = `<table class="data-table"><thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Created</th><th>Details</th></tr></thead><tbody>${items.map(item => `<tr><td><b>${escapeHtml(item.reference || item._id)}</b></td><td>${money(item.amount)}</td><td>${prettyStatus(item.status)}</td><td>${escapeHtml(item.createdAt ? new Date(item.createdAt).toLocaleString() : "—")}</td><td>${escapeHtml(item.failureReason || item.bankRef || "—")}</td></tr>`).join("")}</tbody></table>`;
}
async function refreshDashboard() {
  await Promise.all([loadBalance(), loadTransactions(), loadBankAccounts()]);
}
async function onForm(form, callback) {
  form.addEventListener("submit", async event => {
    event.preventDefault();
    clearNotice();
    const button = form.querySelector('button[type="submit"]');
    const original = button.innerHTML;
    button.disabled = true; button.textContent = "Please wait…";
    try { await callback(formObject(form)); }
    catch (error) { showNotice(error.message || "Something went wrong.", "error"); }
    finally { button.disabled = false; button.innerHTML = original; }
  });
}

$$(".auth-tab").forEach(button => button.addEventListener("click", () => setAuthTab(button.dataset.auth)));
$$("[data-view]").forEach(button => button.addEventListener("click", () => {
  const view = button.dataset.view;
  if (!state.token) { showNotice("Please sign in first to access your wallet.", "info"); return; }
  showView(view);
}));
$("#logoutBtn").addEventListener("click", logout);
$("#refreshBtn").addEventListener("click", refreshDashboard);
$("#loadTransactionsBtn").addEventListener("click", loadTransactions);
$("#loadWithdrawalsBtn").addEventListener("click", loadWithdrawals);
$$(".amount-chips button").forEach(button => button.addEventListener("click", () => { $("#addMoneyForm [name=amount]").value = button.dataset.amount; }));

onForm($("#loginForm"), async values => {
  const data = await api(API_PATHS.login, { method: "POST", body: JSON.stringify(values) });
  const token = data.token || data.accessToken || data.jwt;
  if (!token) throw new Error("Login response did not include a token. Check the login response field in app.js.");
  state.token = token; localStorage.setItem("kaasupay_token", token);
  enterWorkspace(data.user || data.profile || { username: values.username });
  showNotice("Signed in successfully.", "success");
});
onForm($("#signupForm"), async values => {
  const data = await api(API_PATHS.signup, { method: "POST", body: JSON.stringify(values) });
  showNotice(data.message || "Account created. Please sign in.", "success");
  setAuthTab("login"); $("#loginForm [name=username]").value = values.username;
});
onForm($("#transferForm"), async values => {
  const amount = Number(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  const body = { to: values.to.trim(), amount: rupeesToPaise(amount), note: values.note.trim() };
  const data = await api(API_PATHS.transfer, { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": crypto.randomUUID() } });
  $("#transferForm").reset();
  showNotice(data.message || "Transfer request submitted.", "success");
  await refreshDashboard();
});
onForm($("#bankForm"), async values => {
  const body = { holderName: values.holderName.trim(), accountNumber: values.accountNumber.trim(), ifsc: values.ifsc.trim().toUpperCase() };
  const data = await api(API_PATHS.bankAccounts, { method: "POST", body: JSON.stringify(body) });
  $("#bankForm").reset();
  showNotice(data.message || "Bank account saved.", "success");
  await loadBankAccounts();
});
onForm($("#withdrawForm"), async values => {
  if (!values.bankAccountId) throw new Error("Select a saved bank account.");
  const amount = Number(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  const body = { bankAccountId: values.bankAccountId, amount: rupeesToPaise(amount) };
  const data = await api(API_PATHS.withdraw, { method: "POST", body: JSON.stringify(body), headers: { "Idempotency-Key": crypto.randomUUID() } });
  $("#withdrawForm").reset();
  showNotice(data.message || "Withdrawal request submitted.", "success");
  await Promise.all([loadBalance(), loadWithdrawals()]);
});
onForm($("#addMoneyForm"), async values => {
  const amount = Number(values.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount.");
  const orderData = await api(API_PATHS.addMoneyOrder, { method: "POST", body: JSON.stringify({ amount: rupeesToPaise(amount) }) });
  if (!window.Razorpay) throw new Error("Razorpay checkout library did not load. Check your internet connection.");
  const order = orderData.order || orderData;
  const key = orderData.keyId || orderData.key || orderData.razorpayKeyId;
  const orderId = order.id || order.orderId || orderData.orderId;
  if (!key || !orderId) throw new Error("Order endpoint response must include keyId/key and order.id/orderId. Update the response mapping in app.js.");
  const checkout = new Razorpay({
    key, order_id: orderId, amount: order.amount || rupeesToPaise(amount),
    currency: order.currency || "INR", name: "KaasuPay", description: "Wallet top-up",
    handler: async payment => {
      try {
        const verifyBody = { ...payment, orderId, amount: rupeesToPaise(amount) };
        await api(API_PATHS.addMoneyVerify, { method: "POST", body: JSON.stringify(verifyBody) });
        showNotice("Payment verified. Refreshing wallet balance.", "success");
        await refreshDashboard();
      } catch (error) { showNotice(`Payment submitted, but verification needs attention: ${error.message}`, "error"); }
    },
    modal: { ondismiss: () => showNotice("Payment checkout closed. If you paid, check your transaction history before trying again.", "info") },
    prefill: { email: state.user?.username || "" },
    theme: { color: "#6856e8" }
  });
  checkout.open();
});
onForm($("#adminForm"), async values => {
  const status = values.status;
  const response = await fetch(`${API_BASE}${API_PATHS.adminWithdrawals}?status=${encodeURIComponent(status)}`, { headers: { "x-admin-key": values.adminKey } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || data.message || `Admin request failed (${response.status})`);
  const items = getArray(data, ["withdrawals", "items", "data"]);
  renderWithdrawalTable(items, "#adminWithdrawalsTable");
  showNotice(`Loaded ${items.length} withdrawal record(s).`, "success");
});

async function init() {
  try {
    const response = await fetch("https://kaasupay-backend.vercel.app/");
    const data = await response.json();

    setConnection(
      response.ok &&
      data.status === "KaasuPay backend is running"
    );
  } catch (error) {
    console.error("Backend connection error:", error);
    setConnection(false);
  }

  if (state.token) {
    enterWorkspace({ username: "Your account" });
  }
}

init();

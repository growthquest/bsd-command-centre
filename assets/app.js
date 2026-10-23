(() => {
  "use strict";
  const CFG = window.BSD_CONFIG;
  const TIERS = [
    { id: "p1", name: "Priority 1", sub: "Today, time-sensitive" },
    { id: "p2", name: "Priority 2", sub: "Next up" },
    { id: "p3", name: "Priority 3", sub: "This week" },
    { id: "p4", name: "Priority 4", sub: "Coming up" },
    { id: "admin", name: "Admin and onboarding", sub: "When there is a gap" },
    { id: "learning", name: "Learning and development", sub: "Ongoing" }
  ];
  const TIER_IDX = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));
  const MAX_FOCUS = 3;

  // ── DOM helpers ───────────────────────────────────────────────────
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const PATHS = {
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
    ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    meet: '<path d="m22 8-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    back: '<path d="m15 18-6-6 6-6"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    video: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    folder: '<path d="M4 5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7.5l-2-2.5A2 2 0 0 0 9 4H4z"/>',
    msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'
  };
  function icon(name) {
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
    s.setAttribute("stroke-width", "1.8"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = PATHS[name] || PATHS.doc;
    return s;
  }
  const safeUrl = (u) => (typeof u === "string" && /^https:\/\//i.test(u) ? u : null);
  const extLink = (href, cls, ...kids) => safeUrl(href) ? h("a", { class: cls, href, target: "_blank", rel: "noopener noreferrer" }, ...kids) : h("span", { class: cls }, ...kids);

  let toastTimer = null;
  function toast(msg, action) {
    const t = $("toast");
    t.replaceChildren(h("span", {}, msg), action ? h("button", { type: "button", onclick: () => { t.classList.remove("on"); action.fn(); } }, action.label) : null);
    t.classList.toggle("has-action", !!action);
    t.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), action ? 5000 : 2600);
  }

  // ── Dates ─────────────────────────────────────────────────────────
  const pad = (n) => String(n).padStart(2, "0");
  const isoOf = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const todayIso = () => isoOf(new Date());
  const tomorrowIso = () => { const d = new Date(); d.setDate(d.getDate() + 1); return isoOf(d); };
  const fmt = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }).replace(",", "");

  // ── Theme ─────────────────────────────────────────────────────────
  const THEMES = ["system", "light", "dark"];
  let theme = "system";
  try { const t = localStorage.getItem("bsd-theme"); if (t === "light" || t === "dark") theme = t; } catch (e) {}
  function applyTheme() {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", theme);
    try { if (theme === "system") localStorage.removeItem("bsd-theme"); else localStorage.setItem("bsd-theme", theme); } catch (e) {}
    const b = $("themeBtn");
    b.replaceChildren(icon(theme === "light" ? "sun" : theme === "dark" ? "moon" : "monitor"));
    const label = theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark";
    b.title = "Theme: " + label; b.setAttribute("aria-label", "Theme: " + label + ". Switch theme");
  }
  $("themeBtn").addEventListener("click", () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length]; applyTheme(); });
  applyTheme();

  // ── Supabase ──────────────────────────────────────────────────────
  if (!window.supabase || !CFG) {
    app.replaceChildren(h("div", { class: "boot" }, "The app could not load. Check your connection and reload the page."));
    return;
  }
  const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" }
  });

  const state = {
    authReady: false, session: null, allowed: false, loaded: false,
    tasks: [], clients: [], updates: [],
    filter: "open", justDone: new Set(), armedDelete: null, loginSent: null, loginError: null
  };
  try { state.filter = localStorage.getItem("bsd-filter") || "open"; } catch (e) {}
  let channel = null;

  // Errors from an expired or used sign-in link arrive in the hash.
  (function readAuthError() {
    const raw = location.hash.slice(1);
    if (!/error_description=/.test(raw)) return;
    const p = new URLSearchParams(raw);
    state.loginError = /expired|invalid/i.test(p.get("error_description") || "")
      ? "That sign-in link has expired or was already used. Send yourself a new one."
      : "Sign-in did not complete. Send yourself a new link.";
    history.replaceState(null, "", location.pathname + "#/priorities");
  })();

  // ── Routing ───────────────────────────────────────────────────────
  function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    if (/access_token=|error=|type=/.test(raw)) return { view: "priorities" };
    const parts = raw.split("/").filter(Boolean);
    if (parts[0] === "clients" && parts[1]) return { view: "client", key: decodeURIComponent(parts[1]) };
    if (parts[0] === "clients") return { view: "clients" };
    return { view: "priorities" };
  }
  window.addEventListener("hashchange", () => { state.justDone.clear(); render(); window.scrollTo(0, 0); });

  // ── Data ──────────────────────────────────────────────────────────
  async function loadTasks() {
    const { data, error } = await sb.from("tasks").select("*");
    if (!error) state.tasks = data || [];
    return !error;
  }
  async function loadClients() {
    const [c, u] = await Promise.all([
      sb.from("clients").select("*").order("sort", { ascending: true }),
      sb.from("updates").select("*").order("ts", { ascending: false }).limit(300)
    ]);
    if (!c.error) state.clients = c.data || [];
    if (!u.error) state.updates = u.data || [];
    return !c.error && !u.error;
  }
  function subscribe() {
    if (channel) return;
    let tTimer = null, cTimer = null;
    channel = sb.channel("command-centre")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        clearTimeout(tTimer); tTimer = setTimeout(async () => { await loadTasks(); render(); }, 250);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "updates" }, () => {
        clearTimeout(cTimer); cTimer = setTimeout(async () => { await loadClients(); render(); }, 250);
      })
      .subscribe();
  }
  function unsubscribe() { if (channel) { sb.removeChannel(channel); channel = null; } }

  async function onSession(session) {
    state.session = session;
    if (!session) {
      state.allowed = false; state.loaded = false; state.tasks = []; state.clients = []; state.updates = [];
      unsubscribe(); render(); return;
    }
    const { data: ok, error } = await sb.rpc("is_allowed");
    state.allowed = !error && ok === true;
    if (!state.allowed) { state.loaded = true; render(); return; }
    if (/access_token=/.test(location.hash)) history.replaceState(null, "", location.pathname + "#/priorities");
    const [a, b] = await Promise.all([loadTasks(), loadClients()]);
    state.loaded = true;
    state.loadFailed = !(a && b);
    subscribe();
    render();
  }
  let lastUserId;
  sb.auth.onAuthStateChange((event, session) => {
    const uid = session ? session.user.id : null;
    if (event === "TOKEN_REFRESHED" && uid === lastUserId) { state.session = session; return; }
    lastUserId = uid;
    state.authReady = true;
    setTimeout(() => onSession(session), 0);
  });

  // ── Task writes ───────────────────────────────────────────────────
  const writeError = (e) => (e && /row-level security|permission/i.test(e.message || "") ? "This account can view but not change tasks." : "That did not save. Check your connection and try again.");
  async function patchTask(t, patch, okMsg, action) {
    const before = { ...t };
    Object.assign(t, patch); render();
    const { error } = await sb.from("tasks").update(patch).eq("id", t.id);
    if (error) { Object.assign(t, before); state.justDone.delete(t.id); render(); toast(writeError(error)); }
    else if (okMsg) toast(okMsg, action);
  }
  // A task ticked off stays visible (struck through) in its list until the filter or page changes.
  function toggleDone(t) {
    const done = !t.done;
    if (done) state.justDone.add(t.id); else state.justDone.delete(t.id);
    const live = () => state.tasks.find((x) => x.id === t.id) || t;
    patchTask(t, { done, done_at: done ? new Date().toISOString() : null },
      done ? "Marked done" : "Moved back to open",
      done ? { label: "Undo", fn: () => toggleDone(live()) } : null);
  }
  function toggleFocus(t) {
    if (!t.focus && state.tasks.filter((x) => x.focus && !x.done).length >= MAX_FOCUS) { toast("Three tasks are already in focus. Unstar one first."); return; }
    patchTask(t, { focus: !t.focus }, t.focus ? "Removed from focus" : "Added to focus");
  }
  async function removeTask(t) {
    const prev = state.tasks;
    state.tasks = prev.filter((x) => x.id !== t.id); render();
    const { error } = await sb.from("tasks").delete().eq("id", t.id);
    if (error) { state.tasks = prev; render(); toast(writeError(error)); } else toast("Task deleted");
  }
  async function addTask(title, tier, due) {
    const row = { title, tier, due: due || null, note: "", links: [], done: false, focus: false, sort: Date.now() };
    const { data, error } = await sb.from("tasks").insert(row).select().single();
    if (error) { toast(writeError(error)); return false; }
    if (!state.tasks.some((x) => x.id === data.id)) state.tasks.push(data);
    ["addTitle", "addDue"].forEach((id) => { const el = $(id); if (el) el.value = ""; });
    render(); toast("Added to " + tierName(tier));
    return true;
  }

  // ── Task helpers ──────────────────────────────────────────────────
  const tierName = (id) => (TIERS[TIER_IDX[id]] || { name: "Other" }).name;
  const cmp = (a, b) =>
    (a.done - b.done) ||
    ((TIER_IDX[a.tier] ?? 99) - (TIER_IDX[b.tier] ?? 99)) ||
    ((a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : 0) ||
    ((a.sort || 0) - (b.sort || 0));
  function duePill(t) {
    if (t.done) return h("span", { class: "pill green" }, h("span", { class: "dot" }), "Done");
    if (!t.due) return null;
    const today = todayIso();
    if (t.due < today) return h("span", { class: "pill red" }, h("span", { class: "dot" }), "Overdue · " + fmt(t.due));
    if (t.due === today) return h("span", { class: "pill amber" }, h("span", { class: "dot" }), "Due today");
    if (t.due === tomorrowIso()) return h("span", { class: "pill blue" }, "Tomorrow");
    return h("span", { class: "pill neutral" }, fmt(t.due));
  }
  function taskLinks(t) {
    const ls = Array.isArray(t.links) ? t.links.filter((l) => l && safeUrl(l.u)) : [];
    if (!ls.length) return null;
    return h("div", { class: "tlinks" }, ls.map((l) => h("a", { href: l.u, target: "_blank", rel: "noopener noreferrer" }, l.l || "Link", icon("ext"))));
  }
  function starBtn(t) {
    const label = t.focus ? "Remove from focus" : "Add to focus";
    return h("button", { class: "mini star", type: "button", "aria-pressed": t.focus ? "true" : "false", "aria-label": label, title: label, onclick: () => toggleFocus(t) }, icon("star"));
  }
  function delBtn(t) {
    if (state.armedDelete === t.id) return h("button", { class: "confirm", type: "button", onclick: () => { state.armedDelete = null; removeTask(t); } }, "Delete?");
    return h("button", { class: "mini", type: "button", "aria-label": "Delete task", title: "Delete task", onclick: () => {
      state.armedDelete = t.id; render();
      setTimeout(() => { if (state.armedDelete === t.id) { state.armedDelete = null; render(); } }, 3500);
    } }, icon("trash"));
  }
  function taskRow(t) {
    const cid = "chk-" + t.id;
    const cb = h("input", { class: "check", type: "checkbox", id: cid, "aria-label": "Mark done: " + t.title, onchange: () => toggleDone(t) });
    cb.checked = !!t.done;
    return h("div", { class: "row" + (t.done ? " is-done" : "") },
      cb,
      h("div", { class: "body" }, h("label", { class: "t", for: cid }, t.title), t.note ? h("div", { class: "nt" }, t.note) : null, taskLinks(t)),
      h("div", { class: "side" }, duePill(t), h("span", { class: "sp" }), starBtn(t), delBtn(t)));
  }
  const tasksForClient = (c) => {
    const n = (c.name || "").toLowerCase();
    return n ? state.tasks.filter((t) => ((t.title || "") + " " + (t.note || "")).toLowerCase().includes(n)) : [];
  };

  // ── Views ─────────────────────────────────────────────────────────
  function viewLogin() {
    if (state.loginSent) {
      return h("div", { class: "login" }, h("div", { class: "login-card" },
        h("div", { class: "label" }, "Check your inbox"),
        h("h1", {}, "Sign-in link sent"),
        h("p", {}, "We sent a link to ", h("b", {}, state.loginSent), ". Open it on this device to sign in. It works once and expires after an hour."),
        h("button", { class: "ghost", type: "button", onclick: () => { state.loginSent = null; render(); } }, "Use a different email")));
    }
    const email = h("input", { class: "field", type: "email", id: "loginEmail", autocomplete: "email", required: true, placeholder: "you@bluesensedigital.com.au" });
    const btn = h("button", { class: "btn", type: "submit" }, "Email me a sign-in link");
    const err = state.loginError ? h("div", { class: "login-err", role: "alert" }, state.loginError) : null;
    const form = h("form", { class: "login-card", onsubmit: async (e) => {
      e.preventDefault();
      const addr = email.value.trim().toLowerCase();
      if (!addr) return;
      btn.disabled = true; btn.textContent = "Sending";
      const { error } = await sb.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: location.origin + location.pathname } });
      if (error) {
        state.loginError = /rate|limit|seconds/i.test(error.message || "") ? "Too many sign-in emails in a short time. Wait a minute, then try again." : "The link could not be sent. Check the address and try again.";
        render(); return;
      }
      state.loginError = null; state.loginSent = addr; render();
    } },
      h("div", { class: "label" }, "Command Centre"),
      h("h1", {}, "Sign in"),
      h("p", {}, "Your priorities and clients in one place. Enter your email and we will send you a sign-in link."),
      err,
      h("label", { for: "loginEmail" }, "Email"), email, btn);
    return h("div", { class: "login" }, form);
  }

  function viewDenied() {
    return h("div", { class: "login" }, h("div", { class: "login-card" },
      h("div", { class: "label" }, "No access"),
      h("h1", {}, "This account can't open the Command Centre"),
      h("p", {}, "You are signed in as ", h("b", {}, state.session.user.email || "an unknown email"), ". Sign out and use one of your BSD or GrowthQuest addresses."),
      h("button", { class: "btn", type: "button", onclick: () => sb.auth.signOut() }, "Sign out")));
  }

  function viewPriorities() {
    const tasks = state.tasks;
    const open = tasks.filter((t) => !t.done);
    const today = todayIso();
    const over = open.filter((t) => t.due && t.due < today).length;
    const dueToday = open.filter((t) => t.due === today).length;

    const ledger = h("div", { class: "ledger" },
      h("div", { class: "cell" }, h("div", { class: "label" }, "Open"), h("div", { class: "v num" }, open.length)),
      h("div", { class: "cell" }, h("div", { class: "label" }, "Overdue"), h("div", { class: "v num" + (over ? " bad" : "") }, over)),
      h("div", { class: "cell" }, h("div", { class: "label" }, "Due today"), h("div", { class: "v num" + (dueToday ? " warn" : "") }, dueToday)),
      h("div", { class: "cell" }, h("div", { class: "label" }, "Done"), h("div", { class: "v num" }, tasks.length - open.length)));

    // Focus
    let focus = open.filter((t) => t.focus).sort(cmp);
    const auto = !focus.length;
    if (auto) focus = open.slice().sort(cmp).slice(0, MAX_FOCUS);
    const cards = focus.map((t) => h("article", { class: "fcard" },
      h("div", { class: "top" }, h("span", { class: "label" }, tierName(t.tier)), starBtn(t)),
      h("div", { class: "t" }, t.title),
      t.note ? h("div", { class: "nt" }, t.note) : null,
      taskLinks(t),
      h("div", { class: "foot" }, duePill(t), h("button", { class: "ghost done-btn", type: "button", onclick: () => toggleDone(t) }, "Mark done"))));
    if (!focus.length) cards.push(h("div", { class: "slot" }, h("div", { class: "st" }, "All clear"), h("div", { class: "sd" }, "No open tasks. Add one below.")));
    else if (!auto && focus.length < MAX_FOCUS) {
      const free = MAX_FOCUS - focus.length;
      cards.push(h("div", { class: "slot" }, h("div", { class: "st" }, free + " focus slot" + (free > 1 ? "s" : "") + " free"), h("div", { class: "sd" }, "Star a task below to pin it here.")));
    }

    // Add form
    const title = h("input", { class: "field", type: "text", id: "addTitle", placeholder: "What needs doing?", "aria-label": "Task", maxlength: "240", autocomplete: "off" });
    const tier = h("select", { class: "field", id: "addTier", "aria-label": "Priority" }, TIERS.map((t) => h("option", { value: t.id }, t.name)));
    const due = h("input", { class: "field", type: "date", id: "addDue", "aria-label": "Due date" });
    const addBtn = h("button", { class: "btn", type: "submit", disabled: true }, icon("plus"), "Add task");
    title.addEventListener("input", () => { addBtn.disabled = !title.value.trim(); });
    const form = h("form", { class: "addbar", autocomplete: "off", onsubmit: async (e) => {
      e.preventDefault();
      const v = title.value.trim(); if (!v) return;
      addBtn.disabled = true;
      await addTask(v, tier.value, due.value);
    } }, title, tier, due, addBtn);

    const tabs = h("div", { class: "tabs", role: "group", "aria-label": "Show" },
      [["open", "Open"], ["all", "All"], ["done", "Done"]].map(([f, l]) =>
        h("button", { class: "tab", type: "button", "aria-pressed": state.filter === f ? "true" : "false", onclick: () => {
          state.filter = f; state.justDone.clear(); try { localStorage.setItem("bsd-filter", f); } catch (e) {} render();
        } }, l)));

    // Groups
    const vis = tasks.filter((t) => state.filter === "all" ? true : state.filter === "done" ? t.done : (!t.done || state.justDone.has(t.id)));
    const known = new Set(TIERS.map((t) => t.id));
    const groups = TIERS.concat(vis.some((t) => !known.has(t.tier)) ? [{ id: "__other", name: "Other", sub: "" }] : [])
      .map((tr) => ({ tr, items: vis.filter((t) => tr.id === "__other" ? !known.has(t.tier) : t.tier === tr.id).sort(cmp) }))
      .filter((g) => g.items.length)
      .map(({ tr, items }) => h("section", { class: "blk" },
        h("div", { class: "blk-h" }, h("h3", {}, tr.name), tr.sub ? h("span", { class: "sub" }, tr.sub) : null,
          h("span", { class: "count num" }, state.filter === "done" ? items.length + " done" : items.filter((t) => !t.done).length + " open")),
        h("div", { class: "list" }, items.map(taskRow))));
    if (!groups.length) {
      const msg = state.filter === "done" ? "Nothing ticked off yet." : "No open tasks. Add one above.";
      groups.push(h("section", { class: "blk" }, h("div", { class: "list" }, h("div", { class: "empty" }, msg))));
    }

    return [
      h("div", { class: "head" },
        h("div", { class: "label" }, new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })),
        h("h1", {}, "Top ", h("b", {}, "priorities")),
        h("p", { class: "lede" }, "Star up to three tasks to keep them in focus. Tick them off as you go."),
        ledger,
        state.loadFailed ? h("div", { class: "notice" }, "Some data did not load. Reload the page to try again.") : null),
      h("section", { class: "blk", "aria-labelledby": "focusH" },
        h("div", { class: "blk-h" }, h("h2", { id: "focusH" }, "In focus"), h("span", { class: "sub" }, auto ? "Nothing starred, so these are next by priority and due date" : "Starred tasks")),
        h("div", { class: "focus" }, cards)),
      h("section", { class: "blk", "aria-labelledby": "addH" },
        h("div", { class: "blk-h" }, h("h2", { id: "addH" }, "Add a task")), form, tabs),
      groups,
      h("div", { class: "pagefoot" }, "Changes save automatically and sync across your devices.")
    ];
  }

  function viewClients() {
    const cs = state.clients;
    const cap = CFG.clientCapacity || 4;
    const free = Math.max(0, cap - cs.length);
    const cards = cs.map((c) => {
      const openTasks = tasksForClient(c).filter((t) => !t.done).length;
      const meta = (Array.isArray(c.meta) ? c.meta : []).slice(0, 2);
      return h("a", { class: "card client-card", href: "#/clients/" + encodeURIComponent(c.key) },
        h("div", { class: "cc-top" }, h("div", { class: "cc-name" }, c.name),
          c.status ? h("span", { class: "pill " + (c.status_tone || "neutral") }, h("span", { class: "dot" }), c.status) : null),
        c.descriptor ? h("div", { class: "cc-desc" }, c.descriptor) : null,
        c.next_call ? h("div", { class: "nextcall" }, icon("calendar"), h("span", {}, h("span", { class: "label" }, "Next call"), " ", c.next_call.short || c.next_call.when)) : null,
        h("div", { class: "cc-meta" },
          meta.map((m) => h("span", {}, m.label + " ", h("b", {}, m.value))),
          h("span", {}, "Open tasks ", h("b", { class: "num" }, openTasks))));
    });
    for (let i = 0; i < free; i++) cards.push(h("div", { class: "slot" }, h("span", { class: "pill neutral" }, "Open slot"), h("div", { class: "st" }, "Available"), h("div", { class: "sd" }, "Awaiting your next assignment.")));
    return [
      h("div", { class: "head" },
        h("div", { class: "label" }, "Portfolio"),
        h("h1", {}, "Your ", h("b", {}, "clients")),
        h("p", { class: "lede" }, "Open a client for the brief, the numbers, the latest updates and every onboarding asset."),
        h("div", { class: "ledger" },
          h("div", { class: "cell" }, h("div", { class: "label" }, "Active"), h("div", { class: "v num" }, cs.length)),
          h("div", { class: "cell" }, h("div", { class: "label" }, "Open slots"), h("div", { class: "v num" }, free)),
          h("div", { class: "cell" }, h("div", { class: "label" }, "Capacity"), h("div", { class: "v num" }, cap)))),
      h("div", { class: "grid" }, cards),
      h("div", { class: "pagefoot" }, "Client updates arrive here when you brew coffee.")
    ];
  }

  function viewClient(key) {
    const c = state.clients.find((x) => x.key === key);
    const crumb = h("nav", { class: "crumb", "aria-label": "Breadcrumb" }, h("a", { href: "#/clients" }, icon("back"), "Clients"), h("span", {}, "/"), h("span", { class: "cur" }, c ? c.name : "Not found"));
    if (!c) return [crumb, h("div", { class: "head" }, h("h1", {}, "Client not found"), h("p", { class: "lede" }, "This client is not in your portfolio. Go back to Clients to pick another."))];
    const ups = state.updates.filter((u) => u.client_key === c.key).sort((a, b) => b.ts - a.ts);
    const ts = tasksForClient(c).sort(cmp);
    const arr = (x) => (Array.isArray(x) ? x : []);
    const blk = (title, ...body) => h("section", { class: "blk" }, h("div", { class: "blk-h" }, h("h2", {}, title)), ...body);
    return [
      crumb,
      h("div", { class: "d-head" }, h("h1", {}, c.name), c.status ? h("span", { class: "pill " + (c.status_tone || "neutral") }, h("span", { class: "dot" }), c.status) : null),
      arr(c.meta).length ? h("div", { class: "d-meta" }, arr(c.meta).map((m) => h("div", {}, h("div", { class: "label" }, m.label),
        h("div", { class: "v" }, safeUrl(m.href) ? extLink(m.href, null, m.value, " ", icon("ext")) : m.value)))) : null,
      c.next_call ? h("div", { class: "callbar" }, h("span", { class: "ci" }, icon("calendar")),
        h("div", { class: "cmeta" }, h("div", { class: "t1" }, c.next_call.title), h("div", { class: "t2" }, c.next_call.when)),
        safeUrl(c.next_call.join_url) ? h("a", { class: "btn", href: c.next_call.join_url, target: "_blank", rel: "noopener noreferrer" }, icon("meet"), "Join call") : null) : null,
      c.snapshot ? blk("Snapshot", h("p", { class: "oneliner" }, c.snapshot)) : null,
      ts.length ? blk("Your tasks", h("div", { class: "list" }, ts.map(taskRow))) : null,
      blk("Latest updates", ups.length
        ? h("div", { class: "feed" }, ups.map((u) => h("div", { class: "upd" },
            h("div", { class: "upd-top" }, h("span", { class: "upd-date" }, u.date_label || ""), u.channel ? h("span", { class: "upd-chan" }, u.channel) : null),
            h("div", { class: "upd-text" }, u.body),
            safeUrl(u.source_url) ? h("a", { class: "upd-src", href: u.source_url, target: "_blank", rel: "noopener noreferrer" }, icon("ext"), u.source_label || "Source") : null)))
        : h("div", { class: "feed-empty" }, "No updates yet. Say “brew coffee” and the latest client updates from Slack and email land here.")),
      arr(c.kpis).length ? blk("Key numbers", h("div", { class: "kpi" }, arr(c.kpis).map((k) => h("div", { class: "k" },
        h("div", { class: "label" }, k.label), h("div", { class: "kv num" + (k.bad ? " bad" : "") }, k.value), k.context ? h("div", { class: "kc" }, k.context) : null)))) : null,
      arr(c.priorities).length ? blk("First-week priorities", h("ul", { class: "clean" }, arr(c.priorities).map((p) => h("li", {}, h("b", {}, p.label), " - " + p.text)))) : null,
      arr(c.links).length ? blk("Workspace", h("div", { class: "linkgroup" }, arr(c.links).map((g) => h("div", { class: "lg" }, h("h4", {}, g.group),
        h("div", { class: "links" }, arr(g.items).map((it) => extLink(it.u, "lnk",
          h("span", { class: "ic" }, icon(it.ic)), h("span", { class: "tx" }, h("span", { class: "t1" }, it.t), h("span", { class: "t2" }, it.ty)), h("span", { class: "ext" }, icon("ext"))))))))) : null,
      arr(c.watchouts).length ? blk("Watch-outs", h("ul", { class: "clean warn" }, arr(c.watchouts).map((w) => h("li", {}, h("b", {}, w.label), " - " + w.text)))) : null,
      h("div", { class: "pagefoot" }, "Source of truth lives in Google Drive. Links open in a new tab.")
    ];
  }

  // ── Render ────────────────────────────────────────────────────────
  function render() {
    const signedIn = !!state.session && state.allowed;
    $("nav").hidden = !signedIn;
    $("whoami").hidden = !state.session;
    $("signOut").hidden = !state.session;
    $("whoEmail").textContent = state.session ? state.session.user.email || "" : "";

    const r = route();
    document.querySelectorAll("#nav a").forEach((a) => {
      const on = a.dataset.view === (r.view === "client" ? "clients" : r.view);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });

    let content;
    if (!state.authReady) content = h("div", { class: "boot" }, "Loading");
    else if (!state.session) { content = viewLogin(); document.title = "Sign in · BSD Command Centre"; }
    else if (!state.loaded) content = h("div", { class: "boot" }, "Loading your priorities");
    else if (!state.allowed) content = viewDenied();
    else if (r.view === "clients") { content = viewClients(); document.title = "Clients · BSD Command Centre"; }
    else if (r.view === "client") { content = viewClient(r.key); const c = state.clients.find((x) => x.key === r.key); document.title = (c ? c.name : "Client") + " · BSD Command Centre"; }
    else { content = viewPriorities(); document.title = "Priorities · BSD Command Centre"; }

    // Keep the add-task draft and focus across re-renders.
    const active = document.activeElement && document.activeElement.id;
    const draft = {};
    ["addTitle", "addTier", "addDue", "loginEmail"].forEach((id) => { const el = $(id); if (el) draft[id] = el.value; });
    app.replaceChildren(...[content].flat(Infinity).filter(Boolean));
    Object.entries(draft).forEach(([id, v]) => { const el = $(id); if (el) el.value = v; });
    const at = $("addTitle"); if (at) { const b = at.form && at.form.querySelector(".btn"); if (b) b.disabled = !at.value.trim(); }
    if (active && $(active)) $(active).focus();
  }

  $("signOut").addEventListener("click", async () => { await sb.auth.signOut(); location.hash = "#/priorities"; });

  render();
})();

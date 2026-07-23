#!/usr/bin/env python3
from pathlib import Path
import json
import os
from datetime import datetime

ROOT = Path(os.environ.get("IMAGE_LIBRARY_ROOT", "/srv/images"))
OUT = ROOT / "index.html"
ROOT.mkdir(parents=True, exist_ok=True)

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".svg"}

def titleize(value: str) -> str:
    return value.replace("-", " ").replace("_", " ").strip().title()

items = []

for p in sorted(ROOT.rglob("*")):
    if not p.is_file():
        continue

    if p.name == "index.html":
        continue

    if p.suffix.lower() not in IMAGE_EXTS:
        continue

    rel = p.relative_to(ROOT).as_posix()
    parts = rel.split("/")

    brand = "sonstige"
    product = "ohne-produktgruppe"

    if len(parts) >= 4 and parts[0] == "produkte":
        brand = parts[1]
        product = parts[2]
    elif len(parts) >= 2:
        brand = parts[0]
        product = parts[1] if len(parts) >= 3 else "ohne-produktgruppe"

    stat = p.stat()

    items.append({
        "path": rel,
        "file": p.name,
        "brand": brand,
        "brandLabel": titleize(brand),
        "product": product,
        "productLabel": titleize(product),
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
    })

payload = json.dumps(items, ensure_ascii=False)

html_template = r'''<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Image Library</title>
  <style>
    :root {
      --text: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --brand: #2563eb;
      --brand-dark: #1d4ed8;
      --ok: #16a34a;
      --danger: #dc2626;
      --danger-soft: #fef2f2;
      --shadow: 0 18px 45px rgba(15, 23, 42, .12);
      --radius: 18px;
    }

    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, .35), transparent 32rem),
        linear-gradient(135deg, #0f172a 0%, #111827 45%, #1e293b 100%);
      color: white;
      min-height: 100vh;
    }

    a {
      color: inherit;
    }

    code {
      padding: 2px 6px;
      border-radius: 7px;
      background: rgba(255, 255, 255, .12);
    }

    .shell {
      width: min(1440px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 48px;
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 24px;
      align-items: end;
      padding: 28px;
      border: 1px solid rgba(255,255,255,.14);
      background: linear-gradient(135deg, rgba(255,255,255,.14), rgba(255,255,255,.06));
      box-shadow: 0 24px 80px rgba(0,0,0,.28);
      border-radius: 28px;
      backdrop-filter: blur(16px);
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 11px;
      border-radius: 999px;
      background: rgba(255,255,255,.12);
      color: rgba(255,255,255,.82);
      font-size: 13px;
      font-weight: 700;
      letter-spacing: .02em;
      text-transform: uppercase;
    }

    h1 {
      margin: 14px 0 8px;
      font-size: clamp(34px, 5vw, 60px);
      line-height: .95;
      letter-spacing: -.05em;
    }

    .subtitle {
      margin: 0;
      max-width: 780px;
      color: rgba(255,255,255,.76);
      font-size: 16px;
      line-height: 1.65;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(110px, 1fr));
      gap: 10px;
      min-width: 380px;
    }

    .stat {
      padding: 16px;
      border-radius: 18px;
      background: rgba(255,255,255,.1);
      border: 1px solid rgba(255,255,255,.12);
    }

    .stat strong {
      display: block;
      font-size: 28px;
      letter-spacing: -.03em;
    }

    .stat span {
      display: block;
      margin-top: 2px;
      color: rgba(255,255,255,.68);
      font-size: 13px;
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      margin: 18px 0;
      padding: 14px;
      border-radius: 22px;
      background: rgba(15, 23, 42, .78);
      border: 1px solid rgba(255,255,255,.12);
      backdrop-filter: blur(18px);
      display: grid;
      grid-template-columns: minmax(220px, 1fr) 220px 180px auto;
      gap: 12px;
      box-shadow: 0 18px 48px rgba(0,0,0,.18);
    }

    .field {
      position: relative;
    }

    .field svg {
      position: absolute;
      left: 14px;
      top: 50%;
      transform: translateY(-50%);
      width: 18px;
      height: 18px;
      color: #94a3b8;
      pointer-events: none;
    }

    input,
    select {
      width: 100%;
      height: 46px;
      border: 1px solid rgba(255,255,255,.14);
      border-radius: 14px;
      background: rgba(255,255,255,.08);
      color: white;
      outline: none;
      padding: 0 14px;
      font: inherit;
    }

    input {
      padding-left: 42px;
    }

    select option {
      color: #0f172a;
    }

    .layout {
      display: grid;
      grid-template-columns: 260px minmax(0, 1fr);
      gap: 18px;
      align-items: start;
    }

    .sidebar {
      position: sticky;
      top: 92px;
      padding: 16px;
      border-radius: 22px;
      background: rgba(255,255,255,.08);
      border: 1px solid rgba(255,255,255,.12);
      max-height: calc(100vh - 110px);
      overflow: auto;
    }

    .sidebar-title {
      margin: 0 0 12px;
      color: rgba(255,255,255,.72);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
    }

    .nav-link {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 12px;
      text-decoration: none;
      color: rgba(255,255,255,.82);
      font-size: 14px;
    }

    .nav-link:hover {
      background: rgba(255,255,255,.1);
    }

    .nav-link span:last-child {
      color: rgba(255,255,255,.54);
      font-size: 12px;
    }

    .content {
      display: grid;
      gap: 18px;
    }

    .brand-section {
      background: rgba(248,250,252,.98);
      color: var(--text);
      border-radius: 26px;
      box-shadow: var(--shadow);
      overflow: hidden;
      border: 1px solid rgba(255,255,255,.45);
    }

    .brand-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 22px 24px;
      background: linear-gradient(180deg, #ffffff, #f8fafc);
      border-bottom: 1px solid var(--border);
    }

    .brand-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .brand-badge {
      width: 44px;
      height: 44px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 15px;
      background: #dbeafe;
      color: var(--brand);
      font-weight: 900;
      text-transform: uppercase;
    }

    .brand-title h2 {
      margin: 0;
      font-size: 25px;
      letter-spacing: -.03em;
    }

    .brand-title p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 14px;
    }

    .product-section {
      padding: 22px 24px 26px;
      border-top: 1px solid var(--border);
    }

    .product-section:first-of-type {
      border-top: 0;
    }

    .product-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 16px;
      margin-bottom: 14px;
    }

    .product-head h3 {
      margin: 0;
      font-size: 18px;
      letter-spacing: -.02em;
    }

    .product-head span {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 16px;
    }

    .card {
      overflow: hidden;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: white;
      box-shadow: 0 8px 24px rgba(15,23,42,.06);
      transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease;
    }

    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 30px rgba(15,23,42,.12);
      border-color: #bfdbfe;
    }

    .preview {
      display: block;
      height: 190px;
      padding: 12px;
      background:
        linear-gradient(45deg, #f1f5f9 25%, transparent 25%),
        linear-gradient(-45deg, #f1f5f9 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #f1f5f9 75%),
        linear-gradient(-45deg, transparent 75%, #f1f5f9 75%);
      background-size: 22px 22px;
      background-position: 0 0, 0 11px, 11px -11px, -11px 0;
    }

    .preview img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      border-radius: 12px;
      background: rgba(255,255,255,.72);
    }

    .meta {
      padding: 13px;
    }

    .file {
      font-weight: 800;
      font-size: 14px;
      line-height: 1.3;
      word-break: break-word;
    }

    .path {
      margin-top: 6px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
      word-break: break-all;
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr 42px 42px;
      gap: 8px;
      margin-top: 12px;
    }

    button {
      border: 0;
      border-radius: 12px;
      min-height: 40px;
      padding: 0 12px;
      cursor: pointer;
      font-weight: 800;
      font: inherit;
      transition: transform .12s ease, background .12s ease, opacity .12s ease;
    }

    button:hover {
      transform: translateY(-1px);
    }

    .copy-main {
      background: var(--brand);
      color: white;
    }

    .copy-main:hover {
      background: var(--brand-dark);
    }

    .copy-html {
      background: #f1f5f9;
      color: #334155;
    }

    .icon-button,
    .token-button {
      display: inline-grid;
      place-items: center;
      min-width: 42px;
      padding: 0 12px;
      background: rgba(255,255,255,.1);
      color: white;
      border: 1px solid rgba(255,255,255,.12);
    }

    .icon-button svg,
    .token-button svg {
      width: 18px;
      height: 18px;
      pointer-events: none;
    }

    .delete-image {
      background: var(--danger-soft);
      color: var(--danger);
    }

    .delete-image:hover,
    .delete-brand:hover {
      background: #fee2e2;
      color: #b91c1c;
    }

    .delete-brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      background: var(--danger-soft);
      color: var(--danger);
      white-space: nowrap;
    }

    .delete-brand svg {
      width: 17px;
      height: 17px;
    }

    dialog {
      width: min(460px, calc(100% - 28px));
      padding: 0;
      border: 0;
      border-radius: 22px;
      color: var(--text);
      box-shadow: 0 30px 90px rgba(15,23,42,.35);
    }

    dialog::backdrop {
      background: rgba(15,23,42,.7);
      backdrop-filter: blur(5px);
    }

    .dialog-body {
      padding: 24px;
    }

    .dialog-icon {
      width: 46px;
      height: 46px;
      display: grid;
      place-items: center;
      margin-bottom: 16px;
      border-radius: 15px;
      background: var(--danger-soft);
      color: var(--danger);
    }

    .dialog-icon svg {
      width: 22px;
      height: 22px;
    }

    dialog h2 {
      margin: 0 0 8px;
      font-size: 22px;
      letter-spacing: -.02em;
    }

    dialog p {
      margin: 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .dialog-field {
      display: block;
      margin-top: 18px;
      color: #334155;
      font-size: 13px;
      font-weight: 800;
    }

    .dialog-field input {
      height: 44px;
      margin-top: 7px;
      padding: 0 13px;
      border-color: var(--border);
      background: white;
      color: var(--text);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 9px;
      padding: 16px 24px;
      background: #f8fafc;
      border-top: 1px solid var(--border);
    }

    .dialog-cancel {
      background: white;
      color: #334155;
      border: 1px solid var(--border);
    }

    .dialog-confirm {
      background: var(--danger);
      color: white;
    }

    .dialog-confirm:disabled {
      cursor: not-allowed;
      opacity: .45;
    }

    .dialog-save {
      background: var(--brand);
      color: white;
    }

    .busy {
      opacity: .55;
      pointer-events: none;
    }

    button.done {
      background: var(--ok) !important;
      color: white !important;
    }

    .empty {
      padding: 44px;
      border-radius: 26px;
      background: rgba(255,255,255,.96);
      color: var(--text);
      text-align: center;
      box-shadow: var(--shadow);
    }

    .empty h2 {
      margin: 0 0 8px;
    }

    .empty p {
      margin: 0;
      color: var(--muted);
    }

    .toast {
      position: fixed;
      left: 50%;
      bottom: 22px;
      z-index: 100;
      transform: translateX(-50%) translateY(20px);
      opacity: 0;
      pointer-events: none;
      padding: 12px 16px;
      border-radius: 999px;
      background: #111827;
      color: white;
      box-shadow: 0 18px 48px rgba(0,0,0,.25);
      transition: .2s ease;
      font-weight: 800;
    }

    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }

    @media (max-width: 980px) {
      .hero,
      .layout,
      .toolbar {
        grid-template-columns: 1fr;
      }

      .stats {
        min-width: 0;
      }

      .sidebar {
        position: static;
        max-height: none;
      }
    }

    @media (max-width: 640px) {
      .shell {
        width: min(100% - 20px, 1440px);
        padding-top: 10px;
      }

      .hero {
        padding: 20px;
        border-radius: 22px;
      }

      .stats {
        grid-template-columns: 1fr;
      }

      .brand-head,
      .product-section {
        padding-left: 16px;
        padding-right: 16px;
      }

      .brand-head {
        align-items: flex-start;
      }

      .delete-brand span {
        display: none;
      }

      .grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <header class="hero">
      <div>
        <div class="eyebrow">Private Tailnet Image Library</div>
        <h1>Image Hosting</h1>
        <p class="subtitle">
          Bilder per Upload-API nach <code>/srv/images</code> schieben. Diese Übersicht gruppiert automatisch nach Marke und Produkt und erzeugt kopierbare URLs.
        </p>
      </div>

      <div class="stats">
        <div class="stat">
          <strong id="statImages">0</strong>
          <span>Bilder</span>
        </div>
        <div class="stat">
          <strong id="statBrands">0</strong>
          <span>Marken</span>
        </div>
        <div class="stat">
          <strong id="statProducts">0</strong>
          <span>Produkte</span>
        </div>
      </div>
    </header>

    <section class="toolbar" aria-label="Filter">
      <label class="field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <input id="search" type="search" placeholder="Suchen: Marke, Produkt, Dateiname ..." autocomplete="off">
      </label>

      <select id="brandFilter" aria-label="Marke filtern">
        <option value="">Alle Marken</option>
      </select>

      <select id="sortMode" aria-label="Sortierung">
        <option value="path">Nach Pfad</option>
        <option value="newest">Neueste zuerst</option>
        <option value="name">Dateiname A–Z</option>
      </select>

      <button id="tokenButton" class="token-button" type="button" title="API-Token verwalten" aria-label="API-Token verwalten">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="7.5" cy="15.5" r="5.5"></circle>
          <path d="m21 2-9.6 9.6M15 8l2 2m1-5 2 2"></path>
        </svg>
      </button>
    </section>

    <main class="layout">
      <aside class="sidebar">
        <p class="sidebar-title">Marken</p>
        <nav id="brandNav"></nav>
      </aside>

      <section id="content" class="content"></section>
    </main>
  </div>

  <div id="toast" class="toast">Kopiert</div>

  <dialog id="confirmDialog">
    <div class="dialog-body">
      <div class="dialog-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 11v5m4-5v5"></path>
        </svg>
      </div>
      <h2 id="confirmTitle">Wirklich löschen?</h2>
      <p id="confirmMessage"></p>
      <label id="confirmField" class="dialog-field" hidden>
        Zur Bestätigung eingeben: <strong id="confirmExpected"></strong>
        <input id="confirmInput" type="text" autocomplete="off">
      </label>
    </div>
    <div class="dialog-actions">
      <button id="confirmCancel" class="dialog-cancel" type="button">Abbrechen</button>
      <button id="confirmDelete" class="dialog-confirm" type="button">Löschen</button>
    </div>
  </dialog>

  <dialog id="tokenDialog">
    <form id="tokenForm">
      <div class="dialog-body">
        <h2>API-Token</h2>
        <p>Der Token wird nur für diese Browser-Sitzung gespeichert und zum Löschen benötigt.</p>
        <label class="dialog-field">
          Image Upload Token
          <input id="tokenInput" type="password" autocomplete="off" required>
        </label>
      </div>
      <div class="dialog-actions">
        <button id="tokenCancel" class="dialog-cancel" type="button">Abbrechen</button>
        <button class="dialog-save" type="submit">Token speichern</button>
      </div>
    </form>
  </dialog>

  <script>
    const IMAGES = __IMAGES_JSON__;

    const els = {
      content: document.querySelector("#content"),
      search: document.querySelector("#search"),
      brandFilter: document.querySelector("#brandFilter"),
      sortMode: document.querySelector("#sortMode"),
      brandNav: document.querySelector("#brandNav"),
      statImages: document.querySelector("#statImages"),
      statBrands: document.querySelector("#statBrands"),
      statProducts: document.querySelector("#statProducts"),
      toast: document.querySelector("#toast"),
      tokenButton: document.querySelector("#tokenButton"),
      tokenDialog: document.querySelector("#tokenDialog"),
      tokenForm: document.querySelector("#tokenForm"),
      tokenInput: document.querySelector("#tokenInput"),
      tokenCancel: document.querySelector("#tokenCancel"),
      confirmDialog: document.querySelector("#confirmDialog"),
      confirmTitle: document.querySelector("#confirmTitle"),
      confirmMessage: document.querySelector("#confirmMessage"),
      confirmField: document.querySelector("#confirmField"),
      confirmExpected: document.querySelector("#confirmExpected"),
      confirmInput: document.querySelector("#confirmInput"),
      confirmCancel: document.querySelector("#confirmCancel"),
      confirmDelete: document.querySelector("#confirmDelete"),
    };

    const fmtBytes = new Intl.NumberFormat("de-DE", {
      maximumFractionDigits: 1,
    });

    function escapeAttr(value) {
      return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    }

    function escapeText(value) {
      return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    }

    function fileSize(bytes) {
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return fmtBytes.format(bytes / 1024) + " KB";
      return fmtBytes.format(bytes / 1024 / 1024) + " MB";
    }

    function urlFor(path) {
      return new URL(path, location.origin + "/images/").href;
    }

    function htmlImgFor(path, file) {
      const url = urlFor(path);
      return `<img src="${url}" alt="${escapeAttr(file)}">`;
    }

    function jsString(value) {
      return JSON.stringify(value).replaceAll("'", "\\u0027");
    }

    function copyText(text, btn, label = "Kopiert") {
      navigator.clipboard.writeText(text).then(() => {
        const old = btn ? btn.textContent : "";
        if (btn) {
          btn.textContent = label;
          btn.classList.add("done");
        }
        showToast(label);
        setTimeout(() => {
          if (btn) {
            btn.textContent = old;
            btn.classList.remove("done");
          }
        }, 1200);
      });
    }

    function showToast(text) {
      els.toast.textContent = text;
      els.toast.classList.add("show");
      setTimeout(() => els.toast.classList.remove("show"), 1200);
    }

    let tokenResolver = null;
    let confirmResolver = null;

    function requestToken() {
      const saved = sessionStorage.getItem("imageApiToken");
      if (saved) return Promise.resolve(saved);

      els.tokenInput.value = "";
      els.tokenDialog.showModal();
      setTimeout(() => els.tokenInput.focus(), 0);
      return new Promise(resolve => {
        tokenResolver = resolve;
      });
    }

    function finishToken(value) {
      if (value) sessionStorage.setItem("imageApiToken", value);
      els.tokenDialog.close();
      tokenResolver?.(value || null);
      tokenResolver = null;
    }

    function askConfirmation({ title, message, expected = "" }) {
      els.confirmTitle.textContent = title;
      els.confirmMessage.textContent = message;
      els.confirmExpected.textContent = expected;
      els.confirmInput.value = "";
      els.confirmField.hidden = !expected;
      els.confirmDelete.disabled = Boolean(expected);
      els.confirmDialog.showModal();
      if (expected) setTimeout(() => els.confirmInput.focus(), 0);

      return new Promise(resolve => {
        confirmResolver = resolve;
      });
    }

    function finishConfirmation(confirmed) {
      els.confirmDialog.close();
      confirmResolver?.(confirmed);
      confirmResolver = null;
    }

    async function apiDelete(endpoint) {
      const token = await requestToken();
      if (!token) return null;

      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
        },
      });

      let body = {};
      try {
        body = await response.json();
      } catch (_) {
        // A proxy error may not return JSON.
      }

      if (!response.ok) {
        if (response.status === 401) sessionStorage.removeItem("imageApiToken");
        throw new Error(body.detail || `Löschen fehlgeschlagen (${response.status})`);
      }
      return body;
    }

    async function deleteImage(path, button) {
      const item = IMAGES.find(row => row.path === path);
      if (!item) return;
      const confirmed = await askConfirmation({
        title: "Bild löschen?",
        message: `„${item.file}“ wird dauerhaft aus der Bildbibliothek entfernt.`,
      });
      if (!confirmed) return;

      button.closest(".card")?.classList.add("busy");
      try {
        const result = await apiDelete(`/api/images/file?path=${encodeURIComponent(path)}`);
        if (!result) {
          button.closest(".card")?.classList.remove("busy");
          return;
        }
        const index = IMAGES.findIndex(row => row.path === path);
        if (index >= 0) IMAGES.splice(index, 1);
        setupFilters();
        render();
        showToast("Bild gelöscht");
      } catch (error) {
        button.closest(".card")?.classList.remove("busy");
        showToast(error.message);
      }
    }

    async function deleteBrand(brand, label, count, button) {
      const confirmed = await askConfirmation({
        title: `${label} löschen?`,
        message: `Die Marke und alle ${count} zugehörigen Bilder werden dauerhaft entfernt. Dieser Vorgang kann nicht rückgängig gemacht werden.`,
        expected: label,
      });
      if (!confirmed) return;

      button.closest(".brand-section")?.classList.add("busy");
      try {
        const result = await apiDelete(`/api/images/brand/${encodeURIComponent(brand)}`);
        if (!result) {
          button.closest(".brand-section")?.classList.remove("busy");
          return;
        }
        for (let index = IMAGES.length - 1; index >= 0; index--) {
          if (IMAGES[index].brand === brand) IMAGES.splice(index, 1);
        }
        setupFilters();
        render();
        showToast(`${result.images} Bilder gelöscht`);
      } catch (error) {
        button.closest(".brand-section")?.classList.remove("busy");
        showToast(error.message);
      }
    }

    function slug(value) {
      return value.toLowerCase().replace(/[^a-z0-9äöüß-]+/gi, "-");
    }

    function groupBy(items, key) {
      return items.reduce((acc, item) => {
        const value = item[key] || "sonstige";
        acc[value] ??= [];
        acc[value].push(item);
        return acc;
      }, {});
    }

    function getFilteredItems() {
      const q = els.search.value.trim().toLowerCase();
      const brand = els.brandFilter.value;
      const sort = els.sortMode.value;

      let result = IMAGES.filter(item => {
        const haystack = `${item.path} ${item.brandLabel} ${item.productLabel} ${item.file}`.toLowerCase();
        return (!brand || item.brand === brand) && (!q || haystack.includes(q));
      });

      result = result.toSorted((a, b) => {
        if (sort === "newest") return b.modified.localeCompare(a.modified);
        if (sort === "name") return a.file.localeCompare(b.file, "de");
        return a.path.localeCompare(b.path, "de");
      });

      return result;
    }

    function setupFilters() {
      const selected = els.brandFilter.value;
      const brands = Object.values(groupBy(IMAGES, "brand"))
        .map(items => items[0])
        .toSorted((a, b) => a.brandLabel.localeCompare(b.brandLabel, "de"));

      els.brandFilter.innerHTML = `<option value="">Alle Marken</option>`;
      for (const item of brands) {
        const option = document.createElement("option");
        option.value = item.brand;
        option.textContent = item.brandLabel;
        els.brandFilter.appendChild(option);
      }
      if (brands.some(item => item.brand === selected)) {
        els.brandFilter.value = selected;
      }
    }

    function renderStats(items) {
      const brands = new Set(items.map(item => item.brand));
      const products = new Set(items.map(item => `${item.brand}/${item.product}`));

      els.statImages.textContent = items.length;
      els.statBrands.textContent = brands.size;
      els.statProducts.textContent = products.size;
    }

    function renderNav(items) {
      const brands = groupBy(items, "brand");
      const entries = Object.entries(brands).toSorted(([, a], [, b]) =>
        a[0].brandLabel.localeCompare(b[0].brandLabel, "de")
      );

      els.brandNav.innerHTML = entries.map(([brand, rows]) => `
        <a class="nav-link" href="#brand-${slug(brand)}">
          <span>${escapeText(rows[0].brandLabel)}</span>
          <span>${rows.length}</span>
        </a>
      `).join("") || `<div class="nav-link"><span>Keine Treffer</span><span>0</span></div>`;
    }

    function render() {
      const items = getFilteredItems();
      renderStats(items);
      renderNav(items);

      if (!items.length) {
        els.content.innerHTML = `
          <div class="empty">
            <h2>Keine Bilder gefunden</h2>
            <p>Prüfe den Suchbegriff oder lade Bilder per API nach <code>/srv/images</code> hoch.</p>
          </div>
        `;
        return;
      }

      const brands = groupBy(items, "brand");

      els.content.innerHTML = Object.entries(brands)
        .toSorted(([, a], [, b]) => a[0].brandLabel.localeCompare(b[0].brandLabel, "de"))
        .map(([brand, brandItems]) => {
          const products = groupBy(brandItems, "product");

          const productHtml = Object.entries(products)
            .toSorted(([, a], [, b]) => a[0].productLabel.localeCompare(b[0].productLabel, "de"))
            .map(([product, productItems]) => `
              <section class="product-section">
                <div class="product-head">
                  <h3>${escapeText(productItems[0].productLabel)}</h3>
                  <span>${productItems.length} Bild${productItems.length === 1 ? "" : "er"}</span>
                </div>

                <div class="grid">
                  ${productItems.map(item => `
                    <article class="card">
                      <a class="preview" href="${escapeAttr(item.path)}" target="_blank" title="Original öffnen">
                        <img src="${escapeAttr(item.path)}" loading="lazy" alt="${escapeAttr(item.file)}">
                      </a>

                      <div class="meta">
                        <div class="file">${escapeText(item.file)}</div>
                        <div class="path">${escapeText(item.path)}</div>
                        <div class="path">${fileSize(item.size)} · geändert: ${escapeText(item.modified)}</div>

                        <div class="actions">
                          <button class="copy-main" type="button" onclick='copyText(urlFor(${jsString(item.path)}), this, "URL kopiert")'>URL kopieren</button>
                          <button class="copy-html" type="button" title="HTML img-Tag kopieren" onclick='copyText(htmlImgFor(${jsString(item.path)}, ${jsString(item.file)}), this, "HTML")'>&lt;/&gt;</button>
                          <button class="delete-image" type="button" title="Bild löschen" aria-label="${escapeAttr(item.file)} löschen" onclick='deleteImage(${jsString(item.path)}, this)'>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 11v5m4-5v5"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </article>
                  `).join("")}
                </div>
              </section>
            `).join("");

          return `
            <section class="brand-section" id="brand-${slug(brand)}">
              <header class="brand-head">
                <div class="brand-title">
                  <div class="brand-badge">${escapeText(brandItems[0].brandLabel.slice(0, 2))}</div>
                  <div>
                    <h2>${escapeText(brandItems[0].brandLabel)}</h2>
                    <p>${new Set(brandItems.map(item => item.product)).size} Produkte · ${brandItems.length} Bilder</p>
                  </div>
                </div>
                <div class="brand-actions">
                  <button class="delete-brand" type="button" onclick='deleteBrand(${jsString(brand)}, ${jsString(brandItems[0].brandLabel)}, ${brandItems.length}, this)'>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 11v5m4-5v5"></path>
                    </svg>
                    <span>Marke löschen</span>
                  </button>
                </div>
              </header>
              ${productHtml}
            </section>
          `;
        }).join("");
    }

    setupFilters();
    render();

    els.search.addEventListener("input", render);
    els.brandFilter.addEventListener("change", render);
    els.sortMode.addEventListener("change", render);
    els.tokenButton.addEventListener("click", () => {
      sessionStorage.removeItem("imageApiToken");
      requestToken().then(token => {
        if (token) showToast("Token gespeichert");
      });
    });
    els.tokenForm.addEventListener("submit", event => {
      event.preventDefault();
      finishToken(els.tokenInput.value.trim());
    });
    els.tokenCancel.addEventListener("click", () => finishToken(null));
    els.tokenDialog.addEventListener("cancel", event => {
      event.preventDefault();
      finishToken(null);
    });
    els.confirmInput.addEventListener("input", () => {
      els.confirmDelete.disabled = els.confirmInput.value.trim() !== els.confirmExpected.textContent;
    });
    els.confirmDelete.addEventListener("click", () => finishConfirmation(true));
    els.confirmCancel.addEventListener("click", () => finishConfirmation(false));
    els.confirmDialog.addEventListener("cancel", event => {
      event.preventDefault();
      finishConfirmation(false);
    });
  </script>
</body>
</html>
'''

OUT.write_text(html_template.replace("__IMAGES_JSON__", payload), encoding="utf-8")
print(f"Index gebaut: {OUT} mit {len(items)} Bildern")

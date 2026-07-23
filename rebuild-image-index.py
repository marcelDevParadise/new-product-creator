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

    /* Application shell */
    body {
      background: #f4f6fa;
      color: var(--text);
    }

    .app-shell {
      display: grid;
      grid-template-columns: 248px minmax(0, 1fr);
      min-height: 100vh;
    }

    .app-sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 22px 16px;
      background: #111827;
      color: white;
      border-right: 1px solid rgba(255,255,255,.07);
    }

    .app-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 4px 8px 26px;
    }

    .app-brand-mark {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      flex: 0 0 auto;
      border-radius: 12px;
      background: linear-gradient(135deg, #60a5fa, #2563eb);
      box-shadow: 0 10px 24px rgba(37,99,235,.34);
    }

    .app-brand-mark svg {
      width: 20px;
      height: 20px;
    }

    .app-brand strong,
    .app-brand span {
      display: block;
    }

    .app-brand strong {
      font-size: 15px;
    }

    .app-brand span {
      margin-top: 2px;
      color: #94a3b8;
      font-size: 11px;
    }

    .app-nav {
      display: grid;
      gap: 5px;
    }

    .app-nav-link {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 11px 12px;
      border-radius: 11px;
      color: #aeb9ca;
      text-decoration: none;
      font-size: 14px;
      font-weight: 700;
      transition: .16s ease;
    }

    .app-nav-link svg {
      width: 19px;
      height: 19px;
    }

    .app-nav-link:hover {
      color: white;
      background: rgba(255,255,255,.06);
    }

    .app-nav-link.active {
      color: white;
      background: rgba(37,99,235,.2);
      box-shadow: inset 3px 0 #60a5fa;
    }

    .sidebar-footer {
      margin-top: auto;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,.08);
    }

    .sidebar-token {
      width: 100%;
      display: flex;
      justify-content: flex-start;
      gap: 10px;
      color: #cbd5e1;
    }

    .app-main {
      min-width: 0;
      padding: 34px clamp(20px, 4vw, 54px) 60px;
    }

    .view {
      display: none;
      width: min(1480px, 100%);
      margin: 0 auto;
    }

    .view.active {
      display: block;
      animation: view-in .2s ease;
    }

    @keyframes view-in {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: none; }
    }

    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      margin-bottom: 26px;
    }

    .page-kicker {
      display: block;
      margin-bottom: 7px;
      color: var(--brand);
      font-size: 12px;
      font-weight: 900;
      letter-spacing: .09em;
      text-transform: uppercase;
    }

    .page-head h1 {
      margin: 0;
      color: var(--text);
      font-size: clamp(30px, 4vw, 43px);
      line-height: 1.05;
      letter-spacing: -.045em;
    }

    .page-head p {
      max-width: 680px;
      margin: 9px 0 0;
      color: var(--muted);
      line-height: 1.6;
    }

    .stats {
      min-width: 0;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-bottom: 22px;
    }

    .stat {
      position: relative;
      overflow: hidden;
      min-height: 132px;
      padding: 22px;
      color: var(--text);
      background: white;
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: 0 8px 25px rgba(15,23,42,.045);
    }

    .stat::after {
      content: "";
      position: absolute;
      right: -24px;
      bottom: -34px;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: #eff6ff;
    }

    .stat strong {
      position: relative;
      z-index: 1;
      font-size: 36px;
    }

    .stat span {
      position: relative;
      z-index: 1;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(300px, .75fr);
      gap: 20px;
    }

    .panel {
      overflow: hidden;
      background: white;
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: 0 8px 25px rgba(15,23,42,.045);
    }

    .panel-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 15px;
      padding: 19px 21px;
      border-bottom: 1px solid var(--border);
    }

    .panel-head h2 {
      margin: 0;
      font-size: 17px;
      letter-spacing: -.02em;
    }

    .text-link {
      color: var(--brand);
      text-decoration: none;
      font-size: 13px;
      font-weight: 800;
    }

    .recent-list {
      display: grid;
    }

    .recent-list > .empty {
      border-radius: 0;
      box-shadow: none;
    }

    .recent-row {
      display: grid;
      grid-template-columns: 54px minmax(0, 1fr) auto;
      gap: 13px;
      align-items: center;
      padding: 12px 20px;
      border-bottom: 1px solid #f1f5f9;
    }

    .recent-row:last-child {
      border-bottom: 0;
    }

    .recent-thumb {
      width: 54px;
      height: 48px;
      object-fit: contain;
      border-radius: 9px;
      background: #f8fafc;
      border: 1px solid #eef2f7;
    }

    .recent-name {
      overflow: hidden;
      font-size: 13px;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .recent-meta {
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
    }

    .recent-date {
      color: var(--muted);
      font-size: 11px;
      white-space: nowrap;
    }

    .brand-summary-list {
      display: grid;
      padding: 8px;
    }

    .brand-summary {
      display: grid;
      grid-template-columns: 38px minmax(0, 1fr) auto;
      gap: 11px;
      align-items: center;
      padding: 10px 11px;
      border-radius: 11px;
      cursor: pointer;
    }

    .brand-summary:hover {
      background: #f8fafc;
    }

    .mini-badge {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 11px;
      background: #eff6ff;
      color: var(--brand);
      font-size: 12px;
      font-weight: 900;
      text-transform: uppercase;
    }

    .brand-summary strong,
    .brand-summary span {
      display: block;
    }

    .brand-summary strong {
      overflow: hidden;
      font-size: 13px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .brand-summary span {
      margin-top: 3px;
      color: var(--muted);
      font-size: 11px;
    }

    .count-pill {
      padding: 5px 8px;
      border-radius: 999px;
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      font-weight: 800;
    }

    .toolbar {
      position: static;
      margin: 0 0 18px;
      background: white;
      border-color: var(--border);
      box-shadow: 0 8px 25px rgba(15,23,42,.045);
      backdrop-filter: none;
    }

    .toolbar input,
    .toolbar select {
      color: var(--text);
      background: #f8fafc;
      border-color: var(--border);
    }

    .toolbar .token-button {
      display: none;
    }

    .layout {
      grid-template-columns: 230px minmax(0, 1fr);
    }

    .sidebar {
      top: 20px;
      color: var(--text);
      background: white;
      border-color: var(--border);
      box-shadow: 0 8px 25px rgba(15,23,42,.045);
    }

    .sidebar-title {
      color: var(--muted);
    }

    .nav-link {
      width: 100%;
      color: #475569;
      background: transparent;
      text-align: left;
    }

    .nav-link:hover {
      background: #f1f5f9;
    }

    .nav-link span:last-child {
      color: #94a3b8;
    }

    .brand-section {
      box-shadow: 0 8px 25px rgba(15,23,42,.05);
    }

    .brands-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(285px, 1fr));
      gap: 16px;
    }

    .brand-manage-card {
      padding: 20px;
      background: white;
      border: 1px solid var(--border);
      border-radius: 17px;
      box-shadow: 0 8px 25px rgba(15,23,42,.04);
      transition: .16s ease;
    }

    .brand-manage-card:hover {
      transform: translateY(-2px);
      border-color: #bfdbfe;
      box-shadow: 0 12px 30px rgba(15,23,42,.08);
    }

    .brand-manage-top {
      display: flex;
      align-items: center;
      gap: 13px;
    }

    .brand-manage-top .brand-badge {
      width: 46px;
      height: 46px;
    }

    .brand-manage-top h2 {
      margin: 0;
      font-size: 17px;
    }

    .brand-manage-top p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 12px;
    }

    .brand-manage-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 18px 0;
    }

    .brand-manage-stat {
      padding: 11px;
      border-radius: 11px;
      background: #f8fafc;
    }

    .brand-manage-stat strong,
    .brand-manage-stat span {
      display: block;
    }

    .brand-manage-stat strong {
      font-size: 19px;
    }

    .brand-manage-stat span {
      margin-top: 2px;
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .brand-manage-actions {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
    }

    .view-brand {
      background: #eff6ff;
      color: var(--brand);
    }

    @media (max-width: 980px) {
      .layout,
      .toolbar {
        grid-template-columns: 1fr;
      }

      .dashboard-grid {
        grid-template-columns: 1fr;
      }

      .sidebar {
        position: static;
        max-height: none;
      }
    }

    @media (max-width: 760px) {
      .app-shell {
        display: block;
      }

      .app-sidebar {
        position: sticky;
        z-index: 50;
        height: auto;
        flex-direction: row;
        align-items: center;
        padding: 10px 12px;
      }

      .app-brand {
        padding: 0 10px 0 0;
      }

      .app-brand > div:last-child,
      .sidebar-token span {
        display: none;
      }

      .app-nav {
        display: flex;
        flex: 1;
        justify-content: center;
      }

      .app-nav-link {
        padding: 10px;
      }

      .app-nav-link span {
        display: none;
      }

      .app-nav-link.active {
        box-shadow: inset 0 -3px #60a5fa;
      }

      .sidebar-footer {
        margin: 0;
        padding: 0;
        border: 0;
      }

      .sidebar-token {
        width: 42px;
        justify-content: center;
      }

      .app-main {
        padding: 25px 15px 45px;
      }
    }

    @media (max-width: 640px) {
      .stats {
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
      }

      .stat {
        min-height: 102px;
        padding: 15px 12px;
      }

      .stat strong {
        font-size: 27px;
      }

      .page-head {
        margin-bottom: 20px;
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

      .recent-date {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="app-shell">
    <aside class="app-sidebar">
      <div class="app-brand">
        <div class="app-brand-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="4"></rect>
            <circle cx="9" cy="9" r="2"></circle>
            <path d="m21 15-5-5L5 21"></path>
          </svg>
        </div>
        <div>
          <strong>Image Library</strong>
          <span>Attribut Generator</span>
        </div>
      </div>

      <nav class="app-nav" aria-label="Hauptnavigation">
        <a class="app-nav-link" href="#/overview" data-route="overview">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          </svg>
          <span>Übersicht</span>
        </a>
        <a class="app-nav-link" href="#/library" data-route="library">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="3"></rect>
            <circle cx="9" cy="9" r="2"></circle>
            <path d="m21 15-5-5L5 21"></path>
          </svg>
          <span>Bibliothek</span>
        </a>
        <a class="app-nav-link" href="#/brands" data-route="brands">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 13 11 22l-9-9V4a2 2 0 0 1 2-2h9l7 7a3 3 0 0 1 0 4Z"></path>
            <circle cx="7.5" cy="7.5" r="1.5"></circle>
          </svg>
          <span>Marken</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <button id="tokenButton" class="token-button sidebar-token" type="button" title="API-Token verwalten">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="7.5" cy="15.5" r="5.5"></circle>
            <path d="m21 2-9.6 9.6M15 8l2 2m1-5 2 2"></path>
          </svg>
          <span>API-Token verwalten</span>
        </button>
      </div>
    </aside>

    <main class="app-main">
      <section id="view-overview" class="view">
        <header class="page-head">
          <div>
            <span class="page-kicker">Bildverwaltung</span>
            <h1>Alles im Blick.</h1>
            <p>Alle Bilder, Marken und Produktgruppen an einem Ort. Zuletzt geänderte Dateien und die größten Marken siehst du direkt hier.</p>
          </div>
        </header>

        <div class="stats">
          <div class="stat"><strong id="statImages">0</strong><span>Bilder insgesamt</span></div>
          <div class="stat"><strong id="statBrands">0</strong><span>Marken</span></div>
          <div class="stat"><strong id="statProducts">0</strong><span>Produktgruppen</span></div>
        </div>

        <div class="dashboard-grid">
          <section class="panel">
            <header class="panel-head">
              <h2>Zuletzt geändert</h2>
              <a class="text-link" href="#/library">Alle Bilder</a>
            </header>
            <div id="recentImages" class="recent-list"></div>
          </section>
          <section class="panel">
            <header class="panel-head">
              <h2>Größte Marken</h2>
              <a class="text-link" href="#/brands">Verwalten</a>
            </header>
            <div id="dashboardBrands" class="brand-summary-list"></div>
          </section>
        </div>
      </section>

      <section id="view-library" class="view">
        <header class="page-head">
          <div>
            <span class="page-kicker">Bibliothek</span>
            <h1>Alle Bilder</h1>
            <p>Durchsuche deine Dateien, kopiere URLs oder entferne nicht mehr benötigte Motive.</p>
          </div>
        </header>

        <section class="toolbar" aria-label="Filter">
          <label class="field">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <input id="search" type="search" placeholder="Marke, Produkt oder Dateiname suchen ..." autocomplete="off">
          </label>
          <select id="brandFilter" aria-label="Marke filtern"><option value="">Alle Marken</option></select>
          <select id="sortMode" aria-label="Sortierung">
            <option value="path">Nach Pfad</option>
            <option value="newest">Neueste zuerst</option>
            <option value="name">Dateiname A–Z</option>
          </select>
        </section>

        <div class="layout">
          <aside class="sidebar">
            <p class="sidebar-title">Schnellzugriff</p>
            <nav id="brandNav"></nav>
          </aside>
          <section id="content" class="content"></section>
        </div>
      </section>

      <section id="view-brands" class="view">
        <header class="page-head">
          <div>
            <span class="page-kicker">Verwaltung</span>
            <h1>Marken</h1>
            <p>Prüfe den Umfang jeder Marke, öffne ihre Bilder oder entferne eine Marke vollständig.</p>
          </div>
        </header>
        <div id="brandsContent" class="brands-grid"></div>
      </section>
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
      recentImages: document.querySelector("#recentImages"),
      dashboardBrands: document.querySelector("#dashboardBrands"),
      brandsContent: document.querySelector("#brandsContent"),
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
        renderAll();
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

      button.closest(".brand-section, .brand-manage-card")?.classList.add("busy");
      try {
        const result = await apiDelete(`/api/images/brand/${encodeURIComponent(brand)}`);
        if (!result) {
          button.closest(".brand-section, .brand-manage-card")?.classList.remove("busy");
          return;
        }
        for (let index = IMAGES.length - 1; index >= 0; index--) {
          if (IMAGES[index].brand === brand) IMAGES.splice(index, 1);
        }
        setupFilters();
        renderAll();
        showToast(`${result.images} Bilder gelöscht`);
      } catch (error) {
        button.closest(".brand-section, .brand-manage-card")?.classList.remove("busy");
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

    function openLibrary(brand = "") {
      els.brandFilter.value = brand;
      location.hash = "#/library";
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function renderDashboard() {
      renderStats(IMAGES);

      const newest = IMAGES.toSorted((a, b) => b.modified.localeCompare(a.modified)).slice(0, 7);
      els.recentImages.innerHTML = newest.map(item => `
        <div class="recent-row">
          <img class="recent-thumb" src="${escapeAttr(item.path)}" loading="lazy" alt="">
          <div>
            <div class="recent-name">${escapeText(item.file)}</div>
            <div class="recent-meta">${escapeText(item.brandLabel)} · ${escapeText(item.productLabel)}</div>
          </div>
          <span class="recent-date">${escapeText(item.modified)}</span>
        </div>
      `).join("") || `
        <div class="empty">
          <h2>Noch keine Bilder</h2>
          <p>Nach dem ersten Upload erscheinen die neuesten Dateien hier.</p>
        </div>
      `;

      const brands = Object.entries(groupBy(IMAGES, "brand"))
        .toSorted(([, a], [, b]) => b.length - a.length)
        .slice(0, 8);
      els.dashboardBrands.innerHTML = brands.map(([brand, rows]) => `
        <div class="brand-summary" role="button" tabindex="0" onclick='openLibrary(${jsString(brand)})' onkeydown='if(event.key === "Enter") openLibrary(${jsString(brand)})'>
          <div class="mini-badge">${escapeText(rows[0].brandLabel.slice(0, 2))}</div>
          <div>
            <strong>${escapeText(rows[0].brandLabel)}</strong>
            <span>${new Set(rows.map(item => item.product)).size} Produktgruppen</span>
          </div>
          <span class="count-pill">${rows.length}</span>
        </div>
      `).join("") || `<div class="brand-summary"><span>Keine Marken vorhanden</span></div>`;
    }

    function renderBrands() {
      const brands = Object.entries(groupBy(IMAGES, "brand"))
        .toSorted(([, a], [, b]) => a[0].brandLabel.localeCompare(b[0].brandLabel, "de"));

      els.brandsContent.innerHTML = brands.map(([brand, rows]) => {
        const productCount = new Set(rows.map(item => item.product)).size;
        const totalSize = rows.reduce((sum, item) => sum + item.size, 0);
        return `
          <article class="brand-manage-card">
            <div class="brand-manage-top">
              <div class="brand-badge">${escapeText(rows[0].brandLabel.slice(0, 2))}</div>
              <div>
                <h2>${escapeText(rows[0].brandLabel)}</h2>
                <p>${escapeText(brand)}</p>
              </div>
            </div>
            <div class="brand-manage-stats">
              <div class="brand-manage-stat"><strong>${rows.length}</strong><span>Bilder</span></div>
              <div class="brand-manage-stat"><strong>${productCount}</strong><span>Produkte</span></div>
              <div class="brand-manage-stat"><strong>${fileSize(totalSize)}</strong><span>Speicher</span></div>
            </div>
            <div class="brand-manage-actions">
              <button class="view-brand" type="button" onclick='openLibrary(${jsString(brand)})'>Bilder ansehen</button>
              <button class="delete-image" type="button" title="Marke löschen" aria-label="${escapeAttr(rows[0].brandLabel)} löschen" onclick='deleteBrand(${jsString(brand)}, ${jsString(rows[0].brandLabel)}, ${rows.length}, this)'>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M8 6V4h8v2m-9 0 1 15h8l1-15M10 11v5m4-5v5"></path>
                </svg>
              </button>
            </div>
          </article>
        `;
      }).join("") || `
        <div class="empty">
          <h2>Keine Marken vorhanden</h2>
          <p>Marken werden beim Hochladen automatisch angelegt.</p>
        </div>
      `;
    }

    function renderNav(items) {
      const brands = groupBy(items, "brand");
      const entries = Object.entries(brands).toSorted(([, a], [, b]) =>
        a[0].brandLabel.localeCompare(b[0].brandLabel, "de")
      );

      els.brandNav.innerHTML = entries.map(([brand, rows]) => `
        <button class="nav-link" type="button" onclick='document.querySelector("#brand-${slug(brand)}")?.scrollIntoView({ behavior: "smooth" })'>
          <span>${escapeText(rows[0].brandLabel)}</span>
          <span>${rows.length}</span>
        </button>
      `).join("") || `<div class="nav-link"><span>Keine Treffer</span><span>0</span></div>`;
    }

    function render() {
      const items = getFilteredItems();
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

    function renderAll() {
      render();
      renderDashboard();
      renderBrands();
    }

    function currentRoute() {
      const route = location.hash.replace(/^#\//, "");
      return ["overview", "library", "brands"].includes(route) ? route : "overview";
    }

    function renderRoute() {
      const route = currentRoute();
      document.querySelectorAll(".view").forEach(view => {
        view.classList.toggle("active", view.id === `view-${route}`);
      });
      document.querySelectorAll(".app-nav-link").forEach(link => {
        link.classList.toggle("active", link.dataset.route === route);
      });
      document.title = {
        overview: "Übersicht · Image Library",
        library: "Bibliothek · Image Library",
        brands: "Marken · Image Library",
      }[route];
    }

    setupFilters();
    renderAll();
    if (!location.hash.startsWith("#/")) {
      history.replaceState(null, "", "#/overview");
    }
    renderRoute();

    els.search.addEventListener("input", render);
    els.brandFilter.addEventListener("change", render);
    els.sortMode.addEventListener("change", render);
    window.addEventListener("hashchange", renderRoute);
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

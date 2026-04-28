#!/usr/bin/env python3
import json
import os
import re
import sqlite3
from pathlib import Path

import yfinance as yf


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = Path(
    os.environ.get("PORTFOLIO_DATA_DIR")
    or os.environ.get("RENDER_DISK_MOUNT_PATH")
    or ROOT / "data"
)
DB_PATH = Path(os.environ.get("PORTFOLIO_DB_PATH") or DATA_DIR / "portfolio.db")
ASSET_NAMES_PATH = DATA_DIR / "asset-names.json"
GENERATED_ASSET_NAMES_PATH = ROOT / "src" / "lib" / "assets" / "assetName.js"

SEED_SYMBOLS = [
    "AAPL",
    "MSFT",
    "GOOGL",
    "AMZN",
    "TSLA",
    "NVDA",
    "BTC-USD",
    "ETH-USD",
    "SOL-USD",
    "LINK-USD",
    "FET-USD",
    "VCB.VN",
    "FPT.VN",
    "VNM.VN",
    "SSB.VN",
    "CTR.VN",
    "RMS.PA",
    "MC.PA",
    "AIR.PA",
    "OR.PA",
]


def normalize_symbol(asset: str, asset_class: str) -> str:
    raw = asset.strip().upper()

    if asset_class == "CRYPTO":
        raw = raw.replace("/", "-")
        return raw if "-" in raw else f"{raw}-USD"

    if asset_class == "VN_STOCK":
        base = raw.replace(".VN", "")
        return f"{base}.VN"

    if asset_class == "FR_STOCK":
        base = raw.replace(".PA", "")
        return f"{base}.PA"

    return raw


def load_existing_names() -> dict[str, str]:
    names = load_generated_registry()

    if not ASSET_NAMES_PATH.exists():
        return names

    try:
        names.update(json.loads(ASSET_NAMES_PATH.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError):
        pass

    return names


def load_generated_registry() -> dict[str, str]:
    if not GENERATED_ASSET_NAMES_PATH.exists():
        return {}

    try:
        content = GENERATED_ASSET_NAMES_PATH.read_text(encoding="utf-8")
        match = re.search(r"Object\.freeze\((\{.*\})\);", content, re.DOTALL)
        if not match:
            return {}
        return json.loads(match.group(1))
    except (json.JSONDecodeError, OSError):
        return {}


def load_symbols_from_database() -> set[str]:
    if not DB_PATH.exists():
        return set()

    connection = sqlite3.connect(DB_PATH)
    try:
        rows = connection.execute(
            """
            SELECT DISTINCT asset, asset_class
            FROM transactions
            WHERE type IN ('BUY', 'SELL')
            """
        ).fetchall()
    except sqlite3.Error:
        return set()
    finally:
        connection.close()

    return {normalize_symbol(asset, asset_class) for asset, asset_class in rows}


def fetch_asset_name(symbol: str) -> str:
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info or {}
        return info.get("shortName") or info.get("longName") or symbol
    except Exception:
        return symbol


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing_names = load_existing_names()
    symbols = set(SEED_SYMBOLS)
    symbols.update(existing_names.keys())
    symbols.update(load_symbols_from_database())

    result = dict(existing_names)
    for symbol in sorted(symbols):
        if result.get(symbol) and result[symbol] != symbol:
            continue
        result[symbol] = fetch_asset_name(symbol)

    ASSET_NAMES_PATH.write_text(
        json.dumps(dict(sorted(result.items())), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(result)} asset names to {ASSET_NAMES_PATH}")


if __name__ == "__main__":
    main()

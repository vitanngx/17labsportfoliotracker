#!/usr/bin/env python3
import json
import math
import sys
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from io import StringIO
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def normalize_symbol(asset: str, asset_class: str) -> tuple[str, str]:
    raw = asset.strip().upper()

    if asset_class == "CRYPTO":
        raw = raw.replace("/", "-")
        yahoo_symbol = raw if "-" in raw else f"{raw}-USD"
        return raw, yahoo_symbol

    if asset_class == "VN_STOCK":
        base = raw.replace(".VN", "")
        return base, f"{base}.VN"

    if asset_class == "FR_STOCK":
        base = raw.replace(".PA", "")
        return base, f"{base}.PA"

    return raw, raw


def safe_float(value):
    if value is None:
        return None

    if isinstance(value, float) and math.isnan(value):
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_with_yfinance(symbol: str, days_back: int):
    try:
        import yfinance as yf
    except Exception:
        return None

    try:
        ticker = yf.Ticker(symbol)
        history = ticker.history(period=f"{max(days_back, 7)}d", interval="1d", auto_adjust=False)

        if history.empty:
            return None

        history_points = []
        closes = []
        for idx, row in history.iterrows():
            close_price = safe_float(row.get("Close"))
            if close_price is None:
                continue
            closes.append(close_price)
            history_points.append(
                {
                    "date": idx.strftime("%Y-%m-%d"),
                    "close": close_price,
                }
            )

        if not history_points:
            return None

        price = closes[-1]
        previous_close = closes[-2] if len(closes) > 1 else closes[-1]
        currency = None

        try:
            fast_info = ticker.fast_info
            currency = getattr(fast_info, "currency", None) or fast_info.get("currency")
            price = safe_float(fast_info.get("lastPrice")) or price
            previous_close = safe_float(fast_info.get("previousClose")) or previous_close
        except Exception:
            pass

        return {
            "price": price,
            "previous_close": previous_close,
            "currency": currency,
            "as_of": datetime.now(timezone.utc).isoformat(),
            "provider": "yfinance",
            "history": history_points,
        }
    except Exception:
        return None


def fetch_with_yahoo_http(symbol: str, days_back: int):
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?range={max(days_back, 7)}d&interval=1d&includePrePost=false&events=div%2Csplits"
    )
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )

    try:
        with urlopen(request, timeout=12) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, ValueError):
        return None

    chart = payload.get("chart", {})
    result = chart.get("result") or []
    if not result:
        return None

    frame = result[0]
    timestamps = frame.get("timestamp") or []
    quote = (((frame.get("indicators") or {}).get("quote") or [{}])[0]) or {}
    closes = quote.get("close") or []
    meta = frame.get("meta") or {}

    history = []
    cleaned_closes = []

    for timestamp, close in zip(timestamps, closes):
        close_price = safe_float(close)
        if close_price is None:
            continue
        cleaned_closes.append(close_price)
        history.append(
            {
                "date": datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d"),
                "close": close_price,
            }
        )

    if not history:
        return None

    return {
        "price": safe_float(meta.get("regularMarketPrice")) or history[-1]["close"],
        "previous_close": safe_float(meta.get("previousClose"))
        or (cleaned_closes[-2] if len(cleaned_closes) > 1 else cleaned_closes[-1]),
        "currency": meta.get("currency"),
        "as_of": datetime.now(timezone.utc).isoformat(),
        "provider": "yahoo_http",
        "history": history,
    }


def fetch_with_vnstock(symbol: str, days_back: int):
    start_date = (datetime.now() - timedelta(days=max(days_back, 30))).strftime("%Y-%m-%d")
    end_date = datetime.now().strftime("%Y-%m-%d")

    try:
        with redirect_stdout(StringIO()):
            from vnstock import stock_historical_data
    except Exception:
        stock_historical_data = None

    if stock_historical_data is not None:
        try:
            with redirect_stdout(StringIO()):
                frame = stock_historical_data(symbol, start_date, end_date, "1D", "stock")
            history = []
            for _, row in frame.iterrows():
                close_price = safe_float(row.get("close"))
                date_value = row.get("time") or row.get("date")
                if close_price is None or date_value is None:
                    continue
                history.append(
                    {
                        "date": str(date_value)[:10],
                        "close": close_price,
                    }
                )

            if history:
                return {
                    "price": history[-1]["close"],
                    "previous_close": history[-2]["close"] if len(history) > 1 else history[-1]["close"],
                    "currency": "VND",
                    "as_of": datetime.now(timezone.utc).isoformat(),
                    "provider": "vnstock",
                    "history": history,
                }
        except Exception:
            pass

    try:
        with redirect_stdout(StringIO()):
            from vnstock import Vnstock
    except Exception:
        return None

    try:
        with redirect_stdout(StringIO()):
            client = Vnstock().stock(symbol=symbol, source="VCI")
            frame = client.quote.history(start=start_date, end=end_date, interval="1D")
        history = []

        for _, row in frame.iterrows():
            close_price = safe_float(row.get("close"))
            date_value = row.get("time") or row.get("date")
            if close_price is None or date_value is None:
                continue
            history.append(
                {
                    "date": str(date_value)[:10],
                    "close": close_price,
                }
            )

        if not history:
            return None

        return {
            "price": history[-1]["close"],
            "previous_close": history[-2]["close"] if len(history) > 1 else history[-1]["close"],
            "currency": "VND",
            "as_of": datetime.now(timezone.utc).isoformat(),
            "provider": "vnstock",
            "history": history,
        }
    except Exception:
        return None


def fetch_quote(asset: dict, days_back: int):
    raw_symbol, yahoo_symbol = normalize_symbol(asset["asset"], asset["assetClass"])

    result = None
    errors = []

    if asset["assetClass"] == "VN_STOCK":
        result = fetch_with_vnstock(raw_symbol, days_back)
        if result is None:
            errors.append("vnstock unavailable")

    if result is None:
        result = fetch_with_yfinance(yahoo_symbol, days_back)
        if result is None:
            errors.append("yfinance unavailable")

    if result is None:
        result = fetch_with_yahoo_http(yahoo_symbol, days_back)
        if result is None:
            errors.append("Yahoo HTTP fallback unavailable")

    return {
        "asset": asset["asset"],
        "assetClass": asset["assetClass"],
        "currency": result.get("currency") or asset["currency"] if result else asset["currency"],
        "price": result.get("price") if result else None,
        "previousClose": result.get("previous_close") if result else None,
        "asOf": result.get("as_of") if result else None,
        "provider": result.get("provider") if result else None,
        "source": "live",
        "stale": False,
        "history": result.get("history") if result else [],
        "error": None if result else ", ".join(errors),
    }


def main():
    payload = json.load(sys.stdin)
    assets = payload.get("assets", [])
    days_back = int(payload.get("daysBack", 180))
    quotes = {}
    errors = []

    for asset in assets:
        key = f'{asset["assetClass"]}:{asset["asset"].strip().upper()}'
        quote = fetch_quote(asset, days_back)
        quotes[key] = quote

        if quote["price"] is None:
            errors.append(f'{asset["asset"]}: {quote.get("error") or "market data unavailable"}')

    response = {
        "ok": len(errors) < len(assets) if assets else True,
        "quotes": quotes,
        "errors": errors,
    }
    print(json.dumps(response))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "quotes": {},
                    "errors": [f"Python market data bridge failed: {exc}"],
                }
            )
        )
        sys.exit(0)

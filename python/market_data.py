#!/usr/bin/env python3
import json
import math
import re
import sys
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from io import StringIO
from typing import Optional
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


def normalize_interval(interval: Optional[str]) -> str:
    return (interval or "1d").lower()


def map_fetch_interval(interval: str) -> str:
    return {
        "15m": "15m",
        "1h": "60m",
        "4h": "60m",
        "1d": "1d",
        "3d": "1d",
    }.get(interval, "1d")


def interval_to_minutes(interval: str) -> int:
    return {
        "15m": 15,
        "60m": 60,
        "1h": 60,
        "4h": 240,
        "1d": 1440,
        "3d": 4320,
    }.get(interval, 1440)


def format_history_timestamp(value, interval: str) -> str:
    if hasattr(value, "to_pydatetime"):
        value = value.to_pydatetime()

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        value = value.astimezone(timezone.utc)
        if interval in {"15m", "1h", "4h"}:
            return value.strftime("%Y-%m-%dT%H:%M:%SZ")
        return value.strftime("%Y-%m-%d")

    text = str(value)
    return text[:19] if "T" in text else text[:10]


def resample_history_points(history_points, requested_interval: str, fetch_interval: str):
    if not history_points:
        return history_points

    requested_minutes = interval_to_minutes(requested_interval)
    fetch_minutes = interval_to_minutes(fetch_interval)

    if requested_minutes <= fetch_minutes:
        return history_points

    step = max(1, requested_minutes // fetch_minutes)
    sampled = [history_points[index] for index in range(0, len(history_points), step)]

    if sampled[-1]["date"] != history_points[-1]["date"]:
        sampled.append(history_points[-1])

    return sampled


def fetch_with_yfinance(symbol: str, days_back: int, history_range: str, history_interval: str):
    try:
        import yfinance as yf
    except Exception:
        return None

    try:
        ticker = yf.Ticker(symbol)
        fetch_interval = map_fetch_interval(history_interval)
        history = ticker.history(
            period=history_range or f"{max(days_back, 7)}d",
            interval=fetch_interval,
            auto_adjust=False,
        )

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
                    "date": format_history_timestamp(idx, fetch_interval),
                    "close": close_price,
                }
            )

        if not history_points:
            return None

        history_points = resample_history_points(history_points, history_interval, fetch_interval)

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


def fetch_with_yahoo_http(symbol: str, days_back: int, history_range: str, history_interval: str):
    fetch_interval = map_fetch_interval(history_interval)
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?range={history_range or f'{max(days_back, 7)}d'}&interval={fetch_interval}&includePrePost=false&events=div%2Csplits"
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
                "date": format_history_timestamp(
                    datetime.fromtimestamp(timestamp, tz=timezone.utc), fetch_interval
                ),
                "close": close_price,
            }
        )

    if not history:
        return None

    history = resample_history_points(history, history_interval, fetch_interval)

    return {
        "price": safe_float(meta.get("regularMarketPrice")) or history[-1]["close"],
        "previous_close": safe_float(meta.get("previousClose"))
        or (cleaned_closes[-2] if len(cleaned_closes) > 1 else cleaned_closes[-1]),
        "currency": meta.get("currency"),
        "as_of": datetime.now(timezone.utc).isoformat(),
        "provider": "yahoo_http",
        "history": history,
    }


def range_to_coingecko_days(history_range: str, days_back: int) -> str:
    normalized = (history_range or "").lower()
    return {
        "1d": "1",
        "7d": "7",
        "1mo": "30",
        "3mo": "90",
        "1y": "365",
    }.get(normalized, str(max(days_back, 7)))


def fetch_crypto_total_market_cap(days_back: int, history_range: str, history_interval: str):
    days = range_to_coingecko_days(history_range, days_back)
    url = (
        "https://api.coingecko.com/api/v3/global/market_cap_chart"
        f"?vs_currency=usd&days={days}"
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

    market_caps = payload.get("market_caps") or []
    history = []

    for timestamp_ms, value in market_caps:
        market_cap = safe_float(value)
        if market_cap is None:
            continue
        history.append(
            {
                "date": format_history_timestamp(
                    datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc),
                    history_interval,
                ),
                "close": market_cap,
            }
        )

    if not history:
        return None

    history = resample_history_points(history, history_interval, map_fetch_interval(history_interval))

    return {
        "price": history[-1]["close"],
        "previous_close": history[-2]["close"] if len(history) > 1 else history[-1]["close"],
        "currency": "USD",
        "as_of": datetime.now(timezone.utc).isoformat(),
        "provider": "coingecko",
        "history": history,
    }


def fetch_vnindex_countryeconomy(history_interval: str):
    url = "https://countryeconomy.com/stock-exchange/vietnam"
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html",
        },
    )

    try:
        with urlopen(request, timeout=12) as response:
            html = response.read().decode("utf-8", errors="ignore")
    except (HTTPError, URLError, TimeoutError, ValueError):
        return None

    rows = []
    pattern = re.compile(
        r"(?P<date>\d{2}/\d{2}/\d{4}|\d{4}/\d{2}/\d{2}|\d{4}-\d{2}-\d{2})"
        r".{0,240}?"
        r"(?P<level>\d{1,3}(?:,\d{3})*(?:\.\d+)?)",
        re.DOTALL,
    )

    for match in pattern.finditer(html):
        raw_date = match.group("date")
        raw_level = match.group("level")
        level = safe_float(raw_level.replace(",", ""))

        if level is None or level < 100:
            continue

        parsed_date = None
        for fmt in ("%m/%d/%Y", "%Y/%m/%d", "%Y-%m-%d"):
            try:
                parsed_date = datetime.strptime(raw_date, fmt)
                break
            except ValueError:
                continue

        if parsed_date is None:
            continue

        rows.append(
            {
                "date": format_history_timestamp(parsed_date.replace(tzinfo=timezone.utc), history_interval),
                "close": level,
            }
        )

    deduped = {}
    for row in rows:
        deduped[row["date"]] = row

    history = sorted(deduped.values(), key=lambda row: row["date"])

    if not history:
        return None

    return {
        "price": history[-1]["close"],
        "previous_close": history[-2]["close"] if len(history) > 1 else history[-1]["close"],
        "currency": "VND",
        "as_of": datetime.now(timezone.utc).isoformat(),
        "provider": "countryeconomy",
        "history": history,
    }


def fetch_with_vnstock(symbol: str, days_back: int, history_interval: str):
    start_date = (datetime.now() - timedelta(days=max(days_back, 30))).strftime("%Y-%m-%d")
    end_date = datetime.now().strftime("%Y-%m-%d")
    warning = None

    if history_interval in {"15m", "1h", "4h"}:
        warning = f"{symbol}: vnstock intraday history unavailable, fell back to daily data."
        history_interval = "1d"

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
                        "date": format_history_timestamp(date_value, history_interval),
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
                    "warning": warning,
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
                    "date": format_history_timestamp(date_value, history_interval),
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
            "warning": warning,
        }
    except Exception:
        return None


def fetch_quote(asset: dict, days_back: int, history_range: str, history_interval: str):
    raw_symbol, yahoo_symbol = normalize_symbol(asset["asset"], asset["assetClass"])

    result = None
    errors = []
    warning = None

    if raw_symbol == "CRYPTO_TOTAL_MARKET_CAP":
        result = fetch_crypto_total_market_cap(days_back, history_range, history_interval)
        if result is None:
            errors.append("CoinGecko crypto total market cap unavailable")
        return build_quote(asset, result, errors), warning

    if asset["assetClass"] == "VN_STOCK":
        result = fetch_with_vnstock(raw_symbol, days_back, history_interval)
        if result is None:
            errors.append("vnstock unavailable")
        else:
            warning = result.get("warning")

        if result is None and raw_symbol == "VNINDEX":
            result = fetch_vnindex_countryeconomy(history_interval)
            if result is None:
                errors.append("countryeconomy VNIndex fallback unavailable")

    if result is None:
        result = fetch_with_yfinance(yahoo_symbol, days_back, history_range, history_interval)
        if result is None:
            errors.append("yfinance unavailable")

    if result is None:
        result = fetch_with_yahoo_http(yahoo_symbol, days_back, history_range, history_interval)
        if result is None:
            errors.append("Yahoo HTTP fallback unavailable")

    quote = build_quote(asset, result, errors)
    return quote, warning


def build_quote(asset: dict, result, errors):
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
    history_range = payload.get("range") or f"{max(days_back, 7)}d"
    history_interval = normalize_interval(payload.get("interval"))
    quotes = {}
    errors = []

    for asset in assets:
        key = f'{asset["assetClass"]}:{asset["asset"].strip().upper()}'
        quote, warning = fetch_quote(asset, days_back, history_range, history_interval)
        quotes[key] = quote

        if quote["price"] is None:
            errors.append(f'{asset["asset"]}: {quote.get("error") or "market data unavailable"}')
        elif warning:
            errors.append(warning)

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

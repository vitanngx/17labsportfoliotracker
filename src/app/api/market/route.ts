import { spawn } from "node:child_process";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { MarketDataResponse, MarketRequestAsset } from "@/types/portfolio";

export const dynamic = "force-dynamic";

interface RoutePayload {
  assets: MarketRequestAsset[];
  daysBack?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as RoutePayload;
  const assets = Array.isArray(body.assets) ? body.assets : [];
  const daysBack = body.daysBack ?? 180;

  if (assets.length === 0) {
    return NextResponse.json({
      ok: true,
      quotes: {},
      errors: []
    } satisfies MarketDataResponse);
  }

  const scriptPath = path.join(process.cwd(), "python", "market_data.py");
  const payload = JSON.stringify({
    assets,
    daysBack
  });

  const attempts = ["python3", "python"];
  const errors: string[] = [];

  for (const command of attempts) {
    try {
      const result = await runPythonBridge(command, scriptPath, payload);
      return NextResponse.json(result);
    } catch (error) {
      errors.push(
        `${command}: ${
          error instanceof Error ? error.message : "Unable to execute market data bridge."
        }`
      );
    }
  }

  return NextResponse.json(
    {
      ok: false,
      quotes: {},
      errors
    } satisfies MarketDataResponse,
    { status: 503 }
  );
}

function runPythonBridge(
  command: string,
  scriptPath: string,
  payload: string
): Promise<MarketDataResponse> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [scriptPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Python market data process timed out."));
    }, 20000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Exited with code ${code}.`));
        return;
      }

      try {
        const parsed = parseMarketDataResponse(stdout);
        resolve(parsed);
      } catch (error) {
        reject(
          new Error(
            `Unable to parse Python market data response.${
              error instanceof Error ? ` ${error.message}` : ""
            }`
          )
        );
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
}

function parseMarketDataResponse(stdout: string): MarketDataResponse {
  const trimmed = stdout.trim();

  if (!trimmed) {
    throw new Error("The Python bridge returned an empty response.");
  }

  try {
    return JSON.parse(trimmed) as MarketDataResponse;
  } catch {
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(lines[index]) as MarketDataResponse;
      } catch {
        continue;
      }
    }
  }

  throw new Error("No valid JSON payload was found in the Python bridge output.");
}

import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models"
    "/gemini-2.5-flash-lite:generateContent"
)


# ── Request / Response models ─────────────────────────────

class Message(BaseModel):
    role: str       # 'user' | 'assistant'
    content: str


class HealthContext(BaseModel):
    deviceId: str | None = None
    heartrate: float | None = None
    spO2: float | None = None
    status: str | None = None
    alertHighHr: bool = False
    alertLowSpo2: bool = False
    avgHr: float | None = None
    avgSpO2: float | None = None
    sessionReadings: int = 0


class ChatRequest(BaseModel):
    messages: list[Message]
    context: HealthContext = HealthContext()


class ChatResponse(BaseModel):
    text: str


# ── Helpers ───────────────────────────────────────────────

def _system_prompt(ctx: HealthContext) -> str:
    alerts = []
    if ctx.alertHighHr and ctx.heartrate is not None:
        alerts.append(f"elevated heart rate ({ctx.heartrate:.0f} BPM, threshold 120 BPM)")
    if ctx.alertLowSpo2 and ctx.spO2 is not None:
        alerts.append(f"low blood oxygen ({ctx.spO2:.1f}%, threshold 92%)")

    if ctx.heartrate is not None:
        vitals = (
            f"Current patient vitals:\n"
            f"- Heart Rate: {ctx.heartrate:.0f} BPM (status: {ctx.status or 'normal'})\n"
            f"- Blood Oxygen (SpO2): {ctx.spO2:.1f}%\n"
            f"- Session averages: HR {f'{ctx.avgHr:.0f}' if ctx.avgHr else '—'} BPM, "
            f"SpO2 {f'{ctx.avgSpO2:.1f}' if ctx.avgSpO2 else '—'}%\n"
            f"- Readings this session: {ctx.sessionReadings}\n"
            + (f"- Active alerts: {', '.join(alerts)}" if alerts else "- No active alerts")
        )
    else:
        vitals = "No sensor data available yet — advise the user to connect their device."

    return (
        "You are a caring, intelligent health assistant embedded in a real-time biometric "
        "monitoring app (heart rate + SpO2 via ESP32 + MAX30102 sensor).\n\n"
        f"{vitals}\n\n"
        "Your role:\n"
        "- Explain what the user's current readings mean in plain language\n"
        "- Provide practical, evidence-based wellness suggestions\n"
        "- Acknowledge active alerts calmly and give actionable first steps\n"
        "- Answer general questions about heart rate, SpO2, and cardiovascular health\n"
        "- Be concise (2–4 sentences unless more detail is needed)\n"
        "- Always recommend consulting a healthcare professional for persistent symptoms\n"
        "- Never diagnose conditions or prescribe medication"
    )


def _build_history(messages: list[Message]) -> list[dict]:
    """Convert messages to Gemini content format, starting from first user turn."""
    prev = messages[:-1]
    first_user = next((i for i, m in enumerate(prev) if m.role == "user"), None)
    if first_user is None:
        return []
    return [
        {
            "role": "model" if m.role == "assistant" else "user",
            "parts": [{"text": m.content}],
        }
        for m in prev[first_user:]
    ]


# ── Endpoint ──────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY is not configured on the server.")
    if not req.messages:
        raise HTTPException(status_code=400, detail="No messages provided.")

    history = _build_history(req.messages)
    last = req.messages[-1]

    payload = {
        "system_instruction": {"parts": [{"text": _system_prompt(req.context)}]},
        "contents": history + [{"role": "user", "parts": [{"text": last.content}]}],
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 512},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                GEMINI_URL,
                params={"key": settings.gemini_api_key},
                json=payload,
            )

        if resp.status_code != 200:
            logger.error("Gemini API error %s: %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail=f"Gemini API error: {resp.status_code}")

        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return ChatResponse(text=text)

    except HTTPException:
        raise
    except Exception:
        logger.exception("Unexpected error calling Gemini")
        raise HTTPException(status_code=500, detail="Failed to get response from AI.")

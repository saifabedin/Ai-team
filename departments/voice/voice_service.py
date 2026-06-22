"""
ECM AI Team — Voice adapter (LIVE mode only).
Free/self-hosted bridge: Piper TTS + faster-whisper STT + a telephony API.
In mock mode the Node side never calls this — it synthesizes transcripts itself.

Run:  python3 voice_service.py   (listens on :4108, VOICE_ADAPTER_URL)
Deps: pip install fastapi uvicorn  (+ piper-tts, faster-whisper for real audio)

STATUS: Not yet implemented. Endpoints return 501 until a telephony provider
        (Twilio, Plivo, Exotel, etc.) is integrated.
"""
import os
from fastapi import FastAPI, Request, HTTPException
import uvicorn

app = FastAPI(title="ecm-voice-adapter")


@app.get("/health")
def health():
    return {"ok": True, "service": "voice-adapter", "status": "stub-not-implemented"}


@app.post("/call")
async def call(req: Request):
    """
    Expected body: { to, script: { opener, qualify, objections, close } }
    Steps needed:
      1. Synthesize script fields with Piper TTS -> wav
      2. Place call via telephony API (Twilio/Plivo/Exotel) and stream audio
      3. Transcribe lead responses with faster-whisper -> transcript
    """
    raise HTTPException(
        status_code=501,
        detail=(
            "Voice calling not implemented. "
            "Integrate a telephony provider (Twilio, Plivo, Exotel) and set VOICE_ADAPTER_URL. "
            "See departments/voice/voice_service.py for integration points."
        ),
    )


if __name__ == "__main__":
    port = int(os.environ.get("VOICE_PORT", "4108"))
    uvicorn.run(app, host="0.0.0.0", port=port)

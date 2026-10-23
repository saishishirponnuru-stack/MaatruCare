import json
import os

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")

SYSTEM_INSTRUCTION = """
You are MaatruCare's non-clinical maternal care coordination assistant.

Your purpose is strictly limited to organizing logistical information.

You may:
- Summarize explicitly documented appointment logistics.
- Extract coordination tasks from the supplied text.
- Identify logistical responsibilities when explicitly stated.

You must not:
- Diagnose or assess medical conditions.
- Interpret symptoms, test results, or clinical risk.
- Recommend medication or treatment.
- Invent appointments, tasks, people, dates, or responsibilities.
- Treat unverified information as confirmed.

If the input contains medical information, do not interpret it.
Focus only on explicitly documented non-clinical coordination details.

Return valid JSON with this structure:
{
  "summary": "A concise non-clinical coordination summary",
  "tasks": ["Task 1", "Task 2"]
}

Return at most five tasks.
"""


def generate_coordination_summary(note: str) -> dict:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not configured")

    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=MODEL,
        contents=note,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            temperature=0.1,
        ),
    )

    if not response.text:
        raise RuntimeError("AI returned an empty response")

    result = json.loads(response.text)

    if not isinstance(result, dict):
        raise ValueError("Invalid AI response")

    summary = result.get("summary")
    tasks = result.get("tasks")

    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("AI response is missing a valid summary")

    if not isinstance(tasks, list):
        raise ValueError("AI response is missing a valid task list")

    clean_tasks = [
        task.strip()
        for task in tasks
        if isinstance(task, str) and task.strip()
    ][:5]

    return {
        "summary": summary.strip(),
        "tasks": clean_tasks,
        "model": MODEL,
        "requires_human_review": True,
    }
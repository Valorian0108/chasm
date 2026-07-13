from google import genai
from dotenv import load_dotenv
import os

load_dotenv()

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

MODELS = [
    "models/gemini-2.0-flash-001",
    "models/gemini-2.0-flash",
    "models/gemini-flash-latest",
    "models/gemini-3.5-flash",
    "models/gemini-2.5-flash",
]

for model in MODELS:
    print(f"\nTrying {model}")

    try:
        response = client.models.generate_content(
            model=model,
            contents="Say hello."
        )

        print("SUCCESS!")
        print(response.text)
        break

    except Exception as e:
        print("FAILED")
        print(e)
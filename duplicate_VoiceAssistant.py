import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from stt_engine import listen_and_transcribe
from tts_engine import speak
from deep_translator import GoogleTranslator


# -----------------------------
# TRANSLATION FUNCTIONS
# -----------------------------
def te_to_en(text):
    return GoogleTranslator(source="te", target="en").translate(text)

def en_to_te(text):
    return GoogleTranslator(source="en", target="te").translate(text)


# -----------------------------
# LANGUAGE SELECTION
# -----------------------------
print("\nChoose Language:")
print("1. English")
print("2. Telugu")

choice = input("Enter choice (1 or 2): ").strip()

if choice == "2":
    selected_lang = "te"
    print("✅ Telugu selected")
else:
    selected_lang = "en"
    print("✅ English selected")


# -----------------------------
# LOAD DATASET
# -----------------------------
df = pd.read_csv("diabetes_qa_combined.csv")
questions = df["question"].astype(str).tolist()
answers = df["answer"].astype(str).tolist()

embedder = SentenceTransformer("all-MiniLM-L6-v2")
question_embeddings = embedder.encode(questions, normalize_embeddings=True)


# -----------------------------
# FIND BEST MATCH
# -----------------------------
def get_best_answer(query_en):
    query_embedding = embedder.encode([query_en], normalize_embeddings=True)
    similarities = cosine_similarity(query_embedding, question_embeddings)[0]

    best_index = similarities.argmax()
    best_score = similarities[best_index]

    print(f"[DEBUG] Similarity score: {best_score:.2f}")

    if best_score < 0.60:
        return (
            "I am not fully sure about this. "
            "Please maintain a healthy diet and consult a doctor."
        )

    return answers[best_index]


# -----------------------------
# MAIN LOOP
# -----------------------------
print("\n=== Diabetes Voice Assistant ===")
print("Say 'exit' to stop\n")

input("Press Enter to start...")

while True:
    try:
        input("\nPress Enter to speak...")

        user_text, lang = listen_and_transcribe(selected_lang)

        if not user_text:
            if selected_lang == "te":
                print("⚠️ Voice not clear")
                speak("దయచేసి మళ్లీ స్పష్టంగా మాట్లాడండి", "te")
            else:
                print("⚠️ Voice not clear")
                speak("Please speak clearly", "en")
            continue

        print("You said:", user_text)

        if user_text.lower().startswith(("exit", "quit", "stop")):
            speak("Take care and stay healthy", selected_lang)
            break

        # TELUGU FLOW
        if selected_lang == "te":
            search_text = te_to_en(user_text)
            response_en = get_best_answer(search_text)
            response_te = en_to_te(response_en)

            print("\nAssistant (Telugu):", response_te)
            speak(response_te, "te")

        # ENGLISH FLOW
        else:
            response_en = get_best_answer(user_text)
            print("\nAssistant:", response_en)
            speak(response_en, "en")

    except KeyboardInterrupt:
        break


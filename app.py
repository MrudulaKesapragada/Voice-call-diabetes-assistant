from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from pydub import AudioSegment
import os
import uuid
import imageio_ffmpeg
import speech_recognition as sr
from deep_translator import GoogleTranslator

# Configure ffmpeg for pydub
AudioSegment.converter = imageio_ffmpeg.get_ffmpeg_exe()
AudioSegment.ffprobe = imageio_ffmpeg.get_ffmpeg_exe()

app = Flask(__name__)
CORS(app)

# Root route for health check
@app.route("/")
def home():
    return jsonify({"status": "Backend is running successfully"})

# --- LOAD CSV DATA ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
csv_path = os.path.join(BASE_DIR, "diabetes_qa_combined.csv")

print("BASE_DIR:", BASE_DIR)
print("CSV PATH:", csv_path)
print("CSV EXISTS:", os.path.exists(csv_path))

if not os.path.exists(csv_path):
    raise FileNotFoundError(f"CSV not found at: {csv_path}")

df = pd.read_csv(csv_path, encoding="latin1")
questions = df["question"].astype(str).tolist()
answers = df["answer"].astype(str).tolist()

print("CSV loaded successfully. Rows:", len(df))

# --- LIGHTWEIGHT ANSWER MATCHING ---
def get_best_answer(query_en):
    query_en = query_en.lower().strip()

    best_match = None
    best_score = 0

    for q, a in zip(questions, answers):
        q_lower = q.lower()
        common_words = set(query_en.split()) & set(q_lower.split())
        score = len(common_words)

        if score > best_score:
            best_score = score
            best_match = a

    return best_match if best_match else "Please consult a doctor."

# --- PROCESS VOICE ---
@app.route('/process_voice', methods=['POST'])
def process_voice():
    lang = request.form.get('lang', 'en')
    audio = request.files.get('audio')

    if not audio:
        return jsonify({"error": "No audio uploaded"}), 400

    file_id = str(uuid.uuid4())
    webm_path = f"temp_{file_id}.webm"
    wav_path = f"temp_{file_id}.wav"

    try:
        audio.save(webm_path)
        print(f"Saved audio: {webm_path}")

        # Convert webm to wav
        sound = AudioSegment.from_file(webm_path, format="webm")
        sound.export(wav_path, format="wav")
        print(f"Converted to wav: {wav_path}")

        recognizer = sr.Recognizer()

        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

        # Speech recognition
        if lang == "te":
            user_text = recognizer.recognize_google(audio_data, language="te-IN")
            search_text = GoogleTranslator(source='auto', target='en').translate(user_text)
            ans_en = get_best_answer(search_text)
            final_ans = GoogleTranslator(source='auto', target='te').translate(ans_en)
        else:
            user_text = recognizer.recognize_google(audio_data, language="en-IN")
            final_ans = get_best_answer(user_text)

        return jsonify({
            "user_text": user_text,
            "assistant_response": final_ans
        })

    except sr.UnknownValueError:
        return jsonify({"error": "Speech not recognized clearly"}), 400

    except sr.RequestError as e:
        return jsonify({"error": f"Speech recognition service error: {str(e)}"}), 500

    except Exception as e:
        print("ERROR in /process_voice:", str(e))
        return jsonify({"error": f"Voice processing failed: {str(e)}"}), 500

    finally:
        if os.path.exists(webm_path):
            os.remove(webm_path)
        if os.path.exists(wav_path):
            os.remove(wav_path)

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
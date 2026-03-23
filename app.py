from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from deep_translator import GoogleTranslator
import sqlite3
import threading
import time
from datetime import datetime
import speech_recognition as sr
from pydub import AudioSegment
from gtts import gTTS
import os
import uuid

app = Flask(__name__)
CORS(app)

# --- AI DATA ---
df = pd.read_csv("diabetes_qa_combined.csv", encoding="latin1")
questions = df["question"].astype(str).tolist()
answers = df["answer"].astype(str).tolist()

embedder = SentenceTransformer("all-MiniLM-L6-v2")
question_embeddings = embedder.encode(questions, normalize_embeddings=True)

active_notifications = []

# --- DATABASE ---
def init_db():
    conn = sqlite3.connect('reminders.db')
    cursor = conn.cursor()
    cursor.execute('''CREATE TABLE IF NOT EXISTS reminders 
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT, remind_time TEXT, status TEXT DEFAULT 'pending')''')
    conn.commit()
    conn.close()

init_db()

# --- REMINDER THREAD ---


def check_reminders():
    while True:
        now = datetime.now().strftime("%H:%M")

        conn = sqlite3.connect('reminders.db')
        cursor = conn.cursor()

        cursor.execute(
            "SELECT id, task FROM reminders WHERE remind_time = ? AND status = 'pending'",
            (now,)
        )
        reminders = cursor.fetchall()

        for r_id, task in reminders:
            # ✅ Update DB
            cursor.execute(
                "UPDATE reminders SET status = 'completed' WHERE id = ?",
                (r_id,)
            )
            conn.commit()

            print(f"⏰ Reminder Triggered: {task}")

            # 🔊 Generate voice
            audio_file = f"reminder_{uuid.uuid4()}.mp3"
            tts = gTTS(text=f"Reminder: {task}", lang='en')
            tts.save(audio_file)

            # 📩 Send to frontend
            active_notifications.append({
                "id": r_id,
                "task": task,
                "audio_url": audio_file
            })

        conn.close()
        time.sleep(60)

threading.Thread(target=check_reminders, daemon=True).start()

@app.route('/get_notifications', methods=['GET'])
def get_notifications():
    global active_notifications
    data = list(active_notifications)
    active_notifications.clear()
    return jsonify(data)

# --- AUDIO SERVE ---
@app.route('/<filename>')
def serve_audio(filename):
    return send_from_directory('.', filename)

# --- PROCESS VOICE ---
@app.route('/process_voice', methods=['POST'])
def process_voice():
    lang = request.form.get('lang', 'en')
    audio = request.files.get('audio')

    if not audio:
        return jsonify({"error": "No audio"}), 400

    webm_path = "temp.webm"
    wav_path = "temp.wav"

    audio.save(webm_path)

    # Convert webm → wav
    sound = AudioSegment.from_file(webm_path)
    sound.export(wav_path, format="wav")

    recognizer = sr.Recognizer()

    with sr.AudioFile(wav_path) as source:
        audio_data = recognizer.record(source)

    try:
        if lang == "te":
            user_text = recognizer.recognize_google(audio_data, language="te-IN")
        else:
            user_text = recognizer.recognize_google(audio_data, language="en-IN")

        print("USER:", user_text)

    except:
        return jsonify({"error": "Speech not recognized"}), 400

    # --- AI RESPONSE ---
    if lang == "te":
        search_text = GoogleTranslator(source='auto', target='en').translate(user_text)
        ans_en = get_best_answer(search_text)
        final_ans = GoogleTranslator(source='auto', target='te').translate(ans_en)
    else:
        final_ans = get_best_answer(user_text)

    # --- GENERATE AUDIO ---
    audio_file = f"response_{uuid.uuid4()}.mp3"
    tts = gTTS(text=final_ans, lang='te' if lang == 'te' else 'en')
    tts.save(audio_file)

    # cleanup temp files
    if os.path.exists(webm_path): os.remove(webm_path)
    if os.path.exists(wav_path): os.remove(wav_path)

    return jsonify({
        "user_text": user_text,
        "assistant_response": final_ans,
        "audio_url": audio_file
    })

@app.route('/set_reminder', methods=['POST'])
def set_reminder():
    data = request.json
    conn = sqlite3.connect('reminders.db')
    cursor = conn.cursor()
    cursor.execute("INSERT INTO reminders (task, remind_time) VALUES (?, ?)", (data['task'], data['time']))
    conn.commit()
    conn.close()
    return jsonify({"status": "success"})

def get_best_answer(query_en):
    query_emb = embedder.encode([query_en], normalize_embeddings=True)
    sims = cosine_similarity(query_emb, question_embeddings)[0]
    idx = sims.argmax()
    return answers[idx] if sims[idx] > 0.6 else "Please consult a doctor."

if __name__ == '__main__':
    app.run(debug=True)
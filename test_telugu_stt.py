import whisper
import sounddevice as sd
import scipy.io.wavfile as wav
import numpy as np

model = whisper.load_model("medium")

fs = 16000
duration = 7

print("🎤 Speak Telugu clearly...")

audio = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype=np.float32)
sd.wait()

audio = audio / np.max(np.abs(audio))
wav.write("test.wav", fs, audio)

result = model.transcribe(
    "test.wav",
    task="transcribe",
    language="te",
    fp16=False
)

print("\n===== WHISPER OUTPUT =====")
print(result["text"])
print("==========================")

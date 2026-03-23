from gtts import gTTS
import os
import uuid
import time
import pygame

def speak(text, lang="en"):
    if not text: return
    filename = f"voice_{uuid.uuid4()}.mp3"
    try:
        tts = gTTS(text=text, lang=lang)
        tts.save(filename)
        pygame.mixer.init()
        pygame.mixer.music.load(filename)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            pygame.time.Clock().tick(10)
    except Exception as e:
        print(f"Audio Error: {e}")
    finally:
        time.sleep(0.5)
        pygame.mixer.music.stop()
        pygame.mixer.quit()
        if os.path.exists(filename):
            try:
                os.remove(filename)
            except:
                pass
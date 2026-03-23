import speech_recognition as sr

recognizer = sr.Recognizer()

def listen_and_transcribe(language_choice):
    with sr.Microphone() as source:
        print("🎤 Listening...")
        recognizer.adjust_for_ambient_noise(source, duration=0.5)
        audio = recognizer.listen(source)

    try:
        if language_choice == "te":
            text = recognizer.recognize_google(audio, language="te-IN")
            return text.strip(), "te"
        else:
            text = recognizer.recognize_google(audio, language="en-IN")
            return text.strip(), "en"

    except sr.UnknownValueError:
        return "", "unknown"

    except sr.RequestError as e:
        print("STT Error:", e)
        return "", "error"
 




import pandas as pd
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# -----------------------------
# LOAD DATASET
# -----------------------------
df = pd.read_csv("diabetes_qa_combined.csv")

questions = df["question"].astype(str).tolist()
answers = df["answer"].astype(str).tolist()

# -----------------------------
# LOAD EMBEDDING MODEL
# -----------------------------
embedder = SentenceTransformer("all-MiniLM-L6-v2")

question_embeddings = embedder.encode(
    questions,
    normalize_embeddings=True
)

# -----------------------------
# RETRIEVAL FUNCTION
# -----------------------------
def get_best_answer(user_query):
    query_embedding = embedder.encode(
        [user_query],
        normalize_embeddings=True
    )

    similarities = cosine_similarity(
        query_embedding, question_embeddings
    )[0]

    best_index = similarities.argmax()
    best_score = similarities[best_index]

    return best_index, best_score

# -----------------------------
# EVALUATION LOOP
# -----------------------------
correct = 0
total = len(df)

for i in range(total):
    query = df["question"][i]
    true_answer = df["answer"][i]

    pred_index, score = get_best_answer(query)
    predicted_answer = answers[pred_index]

    if true_answer.strip() == predicted_answer.strip():
        correct += 1

accuracy = correct / total

print("Total samples:", total)
print("Correct matches:", correct)
print("Retrieval Accuracy:", round(accuracy * 100, 2), "%")

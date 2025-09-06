import os, json
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


from engine.simulator import SimulationEngine

DATA_CSV = "data/genz_tone_mini.csv"
PERSONAS = "engine/personas.json"
LEXICONS = "engine/lexicons.json"
TOP_K = 3

USE_LLM = bool(os.getenv("OPENAI_API_KEY"))
if USE_LLM:
    from openai import OpenAI
    client = OpenAI()

with open(LEXICONS, "r") as f:
    _lex = json.load(f)
POLITICAL_TERMS = set(_lex.get("political", []))

app = FastAPI(title="GenZ Reaction API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SimulationEngine(PERSONAS, LEXICONS)

df = pd.read_csv(DATA_CSV)
corpus = df["text"].astype(str).tolist()
vectorizer = TfidfVectorizer(min_df=1, ngram_range=(1,2))
tfidf = vectorizer.fit_transform(corpus)

def retrieve(message: str, k=TOP_K):
    q = vectorizer.transform([message])
    sims = cosine_similarity(q, tfidf)[0]
    idx = sims.argsort()[::-1][:k]
    return df.iloc[idx][["text","tone","emotion_tag"]].to_dict(orient="records")

class SimRequest(BaseModel):
    message: str
    persona_ids: Optional[List[str]] = None

@app.get("/personas")
def personas():
    return engine.list_personas()

def is_political(text: str) -> bool:
    toks = [t.lower() for t in text.split()]
    return any(t in POLITICAL_TERMS for t in toks)

def polish_with_llm(persona_name: str, internal: str, public: str, message: str):
    prompt = f"""
You are polishing tone (not content). Keep each under 20 words.
Persona: {persona_name}.
Input message: "{message}"
Internal reaction (polish, keep same sentiment): {internal}
Public reaction (polish, short): {public}
Return JSON with keys: internal, public.
"""
    try:
        resp = client.responses.create(
            model="gpt-4o-mini",
            input=[{"role":"user","content":prompt}],
            temperature=0.4,
        )
        text = resp.output_text
        import re, json as pyjson
        m = re.search(r"\{.*\}", text, re.S)
        if m:
            return pyjson.loads(m.group(0))
    except Exception:
        pass
    return {"internal": internal, "public": public}

@app.post("/simulate")
def simulate(req: SimRequest):
    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Message required.")
    context = retrieve(req.message, k=TOP_K)
    results = engine.simulate(req.message, persona_ids=req.persona_ids)

    political = is_political(req.message)
    if USE_LLM and not political:
        for r in results:
            polished = polish_with_llm(r["persona_name"], r["internal_reaction"], r["public_reaction"], req.message)
            r["internal_reaction"] = polished.get("internal", r["internal_reaction"])
            r["public_reaction"] = polished.get("public", r["public_reaction"])

    for r in results:
        r["retrieved_context"] = context
    return results

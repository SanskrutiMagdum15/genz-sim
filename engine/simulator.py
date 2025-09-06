import json, re, random
from collections import Counter
from pathlib import Path

def _tokenize(text):
    text = text.lower()
    return re.findall(r"[a-z']+", text)

def _clamp(x, lo=-1.0, hi=1.0):
    return max(lo, min(hi, x))

class SimulationEngine:
    def __init__(self, personas_path, lexicons_path):
        self.personas = json.loads(Path(personas_path).read_text())
        self.lex = json.loads(Path(lexicons_path).read_text())
        for p in self.personas:
            for k, v in p["emotional_traits"].items():
                p["emotional_traits"][k] = max(0.0, min(1.0, float(v)))

    def list_personas(self):
        return [{"id": p["id"], "name": p["name"]} for p in self.personas]

    def simulate(self, message, persona_ids=None):
        feats = self._feature_counts(message)
        emo_raw, values_raw = self._scores_from_features(feats)
        political = feats.get("political", 0) > 0

        # Low-signal guard: when input has almost no lexicon hits, force neutral
        signal_hits = (
            feats["positive"] + feats["negative"] + feats.get("political", 0)
            + sum(feats["emotions"].values())
            + sum(feats["tones"].values())
        )
        low_signal = signal_hits < 2

        selected = [p for p in self.personas if (persona_ids is None or p["id"] in persona_ids)]
        results = []

        for p in selected:
            emo = self._blend(emo_raw, p["emotional_traits"], alpha=0.6)

            vals = {}
            for k, v in values_raw.items():
                pref = float(p["values_priorities"].get(k, 0.5))
                vals[k] = max(0.0, min(1.0, 0.5 * v + 0.5 * pref * v))

            top_emo = max(emo.items(), key=lambda kv: kv[1])[0]
            top_val = max(vals.items(), key=lambda kv: kv[1])[0] if len(vals) else None

            internal_s = self._sentiment_sign(emo)

            if political:
                internal = "Political content detected—internal reaction suppressed for safety."
                public = "Skipping public reaction due to political content."
                contradiction = False
                contradiction_why = ""
            elif low_signal:
                internal = "No strong reaction—message has low signal for me."
                public = "Neutral on this."
                contradiction = False
                contradiction_why = "Low-signal input; masking not applied."
            else:
                style = p["contradiction_style"]["mask_style"]
                strength = float(p["contradiction_style"]["mask_strength"])
                internal = self._compose_internal(p, top_emo, top_val, internal_s)
                public_s = self._public_sentiment(internal_s, style, strength)
                public = self._compose_public_from_score(public_s)

                diff = abs(internal_s - public_s)
                opposite = (internal_s * public_s) < -0.05
                strong_mask = strength >= 0.7
                neutralize = (internal_s <= -0.2 and -0.1 < public_s < 0.15) or (internal_s >= 0.2 and -0.15 < public_s < 0.1)
                contradiction = bool(opposite or diff > 0.35 or (strong_mask and neutralize))

                if contradiction:
                    if opposite:
                        contradiction_why = "Public tone opposes private feeling."
                    elif strong_mask and neutralize:
                        contradiction_why = "Public tone neutralizes private feeling under masking."
                    else:
                        contradiction_why = "Public tone downplays private feeling."
                else:
                    contradiction_why = "Internal and public reactions align."

            results.append({
                "persona_id": p["id"],
                "persona_name": p["name"],
                "emotion_scores": emo,
                "values": vals,
                "internal_reaction": internal,
                "public_reaction": public,
                "contradiction_flag": contradiction,
                "contradiction_why": contradiction_why,
                "political_input": political
            })

        return results

    def _feature_counts(self, text):
        toks = _tokenize(text)
        c = Counter(toks)

        def count_in(words):
            total = 0
            tl = text.lower()
            for w in words:
                if " " in w:
                    total += len(re.findall(r"\b" + re.escape(w) + r"\b", tl))
                else:
                    total += c[w]
            return total

        feats = {
            "len": len(toks),
            "positive": count_in(self.lex["positive"]),
            "negative": count_in(self.lex["negative"]),
            "political": count_in(self.lex.get("political", []))
        }
        emo_counts = {emo: count_in(words) for emo, words in self.lex["emotions"].items()}
        feats["emotions"] = emo_counts
        tone_counts = {tone: count_in(words) for tone, words in self.lex["tones"].items()}
        feats["tones"] = tone_counts
        return feats

    def _norm(self, x, denom):
        if denom <= 0:
            return 0.0
        return min(1.0, x / denom)

    def _scores_from_features(self, feats):
        L = max(8, feats["len"])
        emo_scores = {}
        for emo, cnt in feats["emotions"].items():
            emo_scores[emo] = self._norm(cnt, L / 3.0)
        pos = self._norm(feats["positive"], L / 4.0)
        neg = self._norm(feats["negative"], L / 4.0)
        emo_scores["joy"] = min(1.0, emo_scores.get("joy", 0) + 0.5 * pos)
        emo_scores["sadness"] = min(1.0, emo_scores.get("sadness", 0) + 0.4 * neg)
        emo_scores["anger"] = min(1.0, emo_scores.get("anger", 0) + 0.6 * neg)
        emo_scores["trust"] = min(1.0, emo_scores.get("trust", 0) + 0.3 * pos - 0.1 * neg)
        values = {k: self._norm(cnt, L / 3.0) for k, cnt in feats["tones"].items()}
        return emo_scores, values

    def _blend(self, data, prior, alpha=0.6):
        out = {}
        for k in set(list(data.keys()) + list(prior.keys())):
            out[k] = alpha * float(data.get(k, 0)) + (1 - alpha) * float(prior.get(k, 0))
            out[k] = max(0.0, min(1.0, out[k]))
        return out

    def _compose_internal(self, persona, top_emo, top_val, sentiment_sign):
        tone_hint = ", ".join(persona["tone_tags"][:2])
        starters_pos = ["Kinda into this,", "This actually works for me,", "Not bad,", "Sounds decent,"]
        starters_neg = ["Honestly not feeling it,", "Eh, that's rough,", "I don't love this,", "Not thrilled,"]
        starter = random.choice(starters_pos if sentiment_sign >= 0 else starters_neg)
        emo_phrase = {
            "joy": "makes me feel upbeat",
            "anger": "low-key ticks me off",
            "fear": "got me a bit anxious",
            "trust": "seems reliable",
            "surprise": "is unexpected but interesting",
            "disgust": "feels off",
            "sadness": "kinda bums me out"
        }.get(top_emo, "hits me in a mixed way")
        val_phrase = f"— mostly about {top_val} for me" if top_val else ""
        return f"{starter} {emo_phrase}{val_phrase}. ({tone_hint})"

    def _compose_public_from_score(self, s):
        if s >= 0.15:
            openers = ["Looks good to me!", "I'm down.", "This could work.", "Seems fine tbh."]
        elif s <= -0.15:
            openers = ["Not a fan.", "Gonna pass.", "This ain’t it.", "I disagree."]
        else:
            openers = ["Mixed feelings.", "I see both sides.", "Meh, depends.", "Neutral on this."]
        return random.choice(openers)

    def _public_sentiment(self, internal_s, mask_style, mask_strength):
        s = _clamp(internal_s)
        if mask_style == "reveal":
            return s
        if mask_style == "mask":
            atten = max(0.0, 1.0 - 1.2 * mask_strength)
            out = s * atten
            if s < -0.10 and mask_strength >= 0.7:
                out = min(0.20, -0.5 * s)
            return _clamp(out)
        if mask_style == "switch":
            out = -s * (0.5 + 0.5 * mask_strength)
            return _clamp(out)
        return s

    def _sentiment_sign(self, emo_scores):
        pos = emo_scores.get("joy", 0) + emo_scores.get("trust", 0)
        neg = emo_scores.get("anger", 0) + emo_scores.get("sadness", 0) + emo_scores.get("disgust", 0)
        s = (pos - neg)
        return _clamp(s, -1.0, 1.0)

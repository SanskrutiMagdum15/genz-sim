import { useEffect, useState } from "react";
import { fetchPersonas, simulate } from "./api";
import Heatmap from "./components/heatmap.jsx";

export default function App() {
  const [personas, setPersonas] = useState([]);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("Cafeteria introducing all-day breakfast menu next week.");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetchPersonas()
      .then((ps) => {
        setPersonas(ps);
        setSelected([]); 
      })
      .catch((e) => setErr(String(e)));
  }, []);

  function toggle(id) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (err) setErr("");
  }

  function selectAll() {
    setSelected(personas.map((p) => p.id));
    if (err) setErr("");
  }
  function selectNone() {
    setSelected([]);
  }
  function invertSelection() {
    const set = new Set(selected);
    setSelected(personas.map((p) => p.id).filter((id) => !set.has(id)));
    if (err) setErr("");
  }

  async function onRun() {
    setResults(null);

    if (selected.length === 0) {
      setErr("Please select at least one persona");
      return;
    }

    setErr("");
    setLoading(true);
    try {
      const out = await simulate(message, selected);
      setResults(out);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || selected.length === 0;
  const showShake = selected.length === 0 && err === "Please select at least one persona";

  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: 24,
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, textAlign: "center" }}>
        🎭 GenZ Persona Reaction Simulator
      </h1>
      <p style={{ color: "#555", textAlign: "center", marginBottom: 20 }}>
        Enter any message and see how different personas react! (internally, publicly, and emotionally)
      </p>

      <textarea
        style={{
          width: "100%",
          height: 120,
          padding: 14,
          border: "1px solid #ddd",
          borderRadius: 12,
          fontSize: 15,
          resize: "none",
          boxShadow: "inset 0 1px 4px rgba(0,0,0,0.06)",
        }}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {personas.map((p) => {
          const active = selected.includes(p.id);
          return (
            <button
              key={p.id}
              style={{
                padding: "8px 14px",
                borderRadius: 20,
                border: active ? "1px solid #222" : "1px solid #aaa",
                background: active ? "#111" : "#fff",
                color: active ? "#fff" : "#111",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: active ? "0 0 0 4px rgba(17,17,17,0.12)" : "none",
              }}
              onClick={() => toggle(p.id)}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
          flexWrap: "wrap",
          color: "#555",
          fontSize: 13,
        }}
      >
        <span style={{ opacity: 0.8 }}>{selected.length} selected</span>
        <button
          onClick={selectAll}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Select All
        </button>
        <button
          onClick={selectNone}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          None
        </button>
        <button
          onClick={invertSelection}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Invert
        </button>
      </div>

      <div style={{ textAlign: "center", position: "relative" }}>
        <button
          style={{
            marginTop: 20,
            padding: "12px 20px",
            borderRadius: 10,
            border: "none",
            background: isDisabled
              ? "linear-gradient(90deg, #999, #666)"
              : "linear-gradient(90deg, #111, #444)",
            color: "#fff",
            cursor: isDisabled ? "not-allowed" : "pointer",
            opacity: isDisabled ? 0.7 : 1,
            fontSize: 16,
            fontWeight: 600,
            transition: "all 0.3s ease",
            animation: showShake ? "shake 0.28s" : "none",
          }}
          disabled={isDisabled}
          onClick={() => {
            if (selected.length === 0) {
              setErr("Please select at least one persona");
              return;
            }
            onRun();
          }}
          aria-describedby={showShake ? "select-tooltip" : undefined}
        >
          {loading ? "Simulating..." : "Run Simulation"}
        </button>

        {showShake && (
          <div
            id="select-tooltip"
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              top: 64,
              left: "50%",
              transform: "translateX(-50%)",
              background: "#1f2937",
              color: "#fff",
              padding: "8px 10px",
              borderRadius: 8,
              fontSize: 13,
              boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
              whiteSpace: "nowrap",
            }}
          >
            Please select at least one persona
          </div>
        )}

        <style>
          {`
            @keyframes shake {
              0% { transform: translateX(0); }
              20% { transform: translateX(-6px); }
              40% { transform: translateX(6px); }
              60% { transform: translateX(-4px); }
              80% { transform: translateX(4px); }
              100% { transform: translateX(0); }
            }
          `}
        </style>
      </div>

      {err && err !== "Please select at least one persona" && (
        <div
          style={{
            marginTop: 16,
            padding: 10,
            borderRadius: 8,
            background: "#ffe5e5",
            color: "#b00020",
            textAlign: "center",
          }}
        >
          {err}
        </div>
      )}

      {results && results.length > 0 && (
        <>
          <div
            style={{
              marginTop: 30,
              padding: 16,
              border: "1px solid #eee",
              borderRadius: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              background: "#fafafa",
            }}
          >
            <h2 style={{ fontSize: 20, marginBottom: 12 }}>📊 Emotion Heatmap</h2>
            <Heatmap results={results} />
          </div>

          <div
            style={{
              marginTop: 30,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 16,
              alignItems: "stretch",
            }}
          >
            {results.map((r) => (
              <div
                key={r.persona_id}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 14,
                  padding: 16,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
                  background: "#fff",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
                  🧑 {r.persona_name}
                </div>

                {r.political_input ? (
                  <div style={{ marginTop: 6, color: "#8a6d3b" }}>
                    Political content detected. Reactions suppressed to avoid targeted persuasion.
                  </div>
                ) : (
                  <>
                    <div style={{ marginTop: 6 }}>
                      <b>Internal:</b> {r.internal_reaction}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <b>Public:</b> {r.public_reaction}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <b>Contradiction:</b> {r.contradiction_flag ? "Yes" : "No"}{" "}
                      <span style={{ color: "#666" }}>— {r.contradiction_why}</span>
                    </div>
                  </>
                )}

                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer" }}>Emotion & values</summary>
                  <pre
                    style={{
                      background: "#fafafa",
                      padding: 8,
                      borderRadius: 8,
                      overflow: "auto",
                      margin: 0,
                    }}
                  >
{JSON.stringify({ emotion_scores: r.emotion_scores, values: r.values }, null, 2)}
                  </pre>
                </details>

                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer" }}>
                    Retrieved context (top-k)
                  </summary>
                  <pre
                    style={{
                      background: "#fafafa",
                      padding: 8,
                      borderRadius: 8,
                      overflow: "auto",
                      margin: 0,
                    }}
                  >
{JSON.stringify(r.retrieved_context, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </>
      )}

      {selected.length === 0 && !results && !loading && (
        <div
          style={{
            marginTop: 18,
            padding: 12,
            border: "1px dashed #bbb",
            borderRadius: 10,
            background: "#fcfcfc",
            textAlign: "center",
            color: "#666",
            fontSize: 14,
          }}
        >
          Tip: select one or more personas above, then click <b>Run Simulation</b>.
        </div>
      )}
    </div>
  );
}

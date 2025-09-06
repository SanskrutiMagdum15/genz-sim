export default function Heatmap({ results }) {
    const emotions = ["joy", "anger", "fear", "trust", "surprise", "disgust", "sadness"];
    const rows = results.map((r) => ({
      name: r.persona_name,
      scores: emotions.map((e) => Number(r.emotion_scores?.[e] ?? 0)),
    }));
  
    function cellColor(v) {
      const light = 92 - Math.round(v * 50); 
      const sat = 20 + Math.round(v * 55);  
      return `hsl(190 ${sat}% ${light}%)`;
    }
  
    const cellStyle = {
      width: 42,
      height: 28,
      borderRadius: 6,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 11,
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    };
  
    return (
      <div style={{ marginTop: 20 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `180px repeat(${emotions.length}, 48px)`,
            gap: 6,
            alignItems: "center",
          }}
        >
          <div></div>
          {emotions.map((e) => (
            <div key={e} style={{ fontSize: 12, color: "#555", textAlign: "center" }}>
              {e}
            </div>
          ))}
  
          {rows.map((row, i) => (
            <div key={i} style={{ display: "contents" }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{row.name}</div>
              {row.scores.map((v, j) => (
                <div
                  key={j}
                  title={`${emotions[j]}: ${v.toFixed(2)}`}
                  style={{ ...cellStyle, background: cellColor(v) }}
                >
                  {v.toFixed(2)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          Emotion scores heatmap (0–1)
        </div>
      </div>
    );
  }
  
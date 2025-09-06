export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export async function fetchPersonas() {
  const res = await fetch(`${API_BASE}/personas`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function simulate(message, personaIds) {
  const res = await fetch(`${API_BASE}/simulate`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ message, persona_ids: personaIds?.length ? personaIds : null })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

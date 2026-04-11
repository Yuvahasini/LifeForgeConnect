import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `You are LifeForge AI Companion, an intelligent assistant integrated into LifeForge Connect, a unified donor-recipient platform for blood, platelets, bone marrow, organs, plasma, and human milk.

Your purpose is to:
- Help users understand donation types and eligibility.
- Explain compatibility concepts clearly (e.g., blood groups, HLA basics).
- Guide donors and recipients through safe, verified procedures.
- Provide emergency-aware responses when urgency is detected.
- Promote ethical, legal, and medically responsible information.

You must follow these rules strictly:
1. Do NOT provide medical diagnosis, treatment, or personalized clinical decisions. Always recommend consulting certified medical professionals for medical emergencies.
2. If a user message indicates urgency (e.g., "ICU", "critical", "urgent", "emergency"), respond calmly and clearly. Emphasize contacting emergency services or the nearest hospital immediately before using the platform.
3. Provide factual, evidence-based information in simple language. Avoid technical jargon unless explaining it clearly.
4. Never fabricate statistics, availability data, or specific hospital affiliations. If unsure, say: "I do not have access to real-time medical databases. Please verify with an authorized medical center."
5. Never collect or request sensitive personal data such as full medical records, Aadhaar numbers, detailed health history, or exact home addresses.
6. Maintain a compassionate and supportive tone. You are assisting in life-sensitive situations.
7. When explaining compatibility, clarify basic matching principles and emphasize that final compatibility must be confirmed through clinical testing.
8. Encourage voluntary, ethical, and legal donation practices only. Never suggest illegal organ trade or unsafe donation methods.

Your tone should be: Calm, trustworthy, structured, and supportive. You help users navigate life-saving systems responsibly and safely. Keep responses concise and clear — use bullet points where helpful. Never be overly verbose.`;

const URGENCY_KEYWORDS = ["emergency", "urgent", "critical", "icu", "bleeding heavily", "dying", "immediate"];

const QUICK_PROMPTS = [
  { label: "🩸 Blood Donation", text: "How do I donate blood and what are the eligibility criteria?" },
  { label: "🧬 Bone Marrow", text: "How does bone marrow donation work and how can I register?" },
  { label: "🫀 Organ Donation", text: "How do I register as an organ donor in India?" },
  { label: "🍼 Milk Donation", text: "How can I donate breast milk and what are the requirements?" },
  { label: "🔬 Compatibility", text: "Can you explain blood group compatibility in simple terms?" },
  { label: "⚡ Platelet Donation", text: "What is platelet donation and who needs it most?" },
];

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "12px 16px" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8, height: 8, borderRadius: "50%", background: "#e05c5c",
          animation: "bounce 1.2s infinite",
          animationDelay: `${i * 0.2}s`
        }} />
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  const isEmergency = msg.isEmergency;
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: "16px",
      animation: "fadeSlideIn 0.3s ease"
    }}>
      {!isUser && (
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg, #e05c5c, #c0392b)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "16px", flexShrink: 0, marginRight: 10, marginTop: 2,
          boxShadow: "0 0 12px rgba(224,92,92,0.4)"
        }}>❤️</div>
      )}
      <div style={{
        maxWidth: "75%",
        background: isUser
          ? "linear-gradient(135deg, #e05c5c, #c0392b)"
          : isEmergency
            ? "linear-gradient(135deg, #1a0a0a, #2d0f0f)"
            : "rgba(255,255,255,0.06)",
        border: isEmergency ? "1px solid #e05c5c" : isUser ? "none" : "1px solid rgba(255,255,255,0.1)",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        padding: "12px 16px",
        color: "#f0f0f0",
        fontSize: "14px",
        lineHeight: "1.6",
        whiteSpace: "pre-wrap",
        boxShadow: isEmergency ? "0 0 20px rgba(224,92,92,0.3)" : "none"
      }}>
        {isEmergency && (
          <div style={{
            color: "#ff6b6b", fontWeight: 700, fontSize: "12px",
            letterSpacing: "1px", marginBottom: "8px", display: "flex", alignItems: "center", gap: 6
          }}>
            🚨 HIGH URGENCY DETECTED
          </div>
        )}
        {msg.content}
      </div>
    </div>
  );
}

export default function LifeForgeAI() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello, I'm LifeForge AI — your guide through India's life-saving donor ecosystem.\n\nI can help you with:\n• Blood, platelet, plasma & organ donation\n• Bone marrow & HLA compatibility\n• Human milk bank information\n• Donor eligibility & procedures\n\nHow can I assist you today? If this is a medical emergency, please call 108 immediately.",
      isEmergency: false
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const isUrgent = (text) => URGENCY_KEYWORDS.some(k => text.toLowerCase().includes(k));

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;

    const urgent = isUrgent(userText);
    const processedText = urgent ? `High Urgency Context: The user may be in a medical emergency.\n\n${userText}` : userText;

    const newMessages = [...messages, { role: "user", content: userText, isEmergency: false }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const apiMessages = newMessages.map((m, i) => ({
      role: m.role,
      content: i === newMessages.length - 1 && urgent ? processedText : m.content
    }));

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: apiMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text || "I'm sorry, I couldn't process that. Please try again.";

      setMessages(prev => [...prev, {
        role: "assistant",
        content: reply,
        isEmergency: urgent
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "I'm having trouble connecting right now. If this is an emergency, please call 108 immediately.",
        isEmergency: urgent
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d0d0d",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      fontFamily: "'Georgia', serif",
      color: "#f0f0f0"
    }}>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        textarea:focus { outline: none; }
        textarea::placeholder { color: rgba(255,255,255,0.3); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(224,92,92,0.3); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        width: "100%", maxWidth: 780,
        padding: "20px 24px 0",
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "linear-gradient(135deg, #e05c5c, #8b0000)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, boxShadow: "0 0 20px rgba(224,92,92,0.5)"
          }}>❤️</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "0.5px", color: "#fff" }}>
              LifeForge AI
            </div>
            <div style={{ fontSize: 11, color: "#e05c5c", letterSpacing: "1.5px", textTransform: "uppercase" }}>
              Donor Intelligence Companion
            </div>
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(224,92,92,0.1)", border: "1px solid rgba(224,92,92,0.3)",
          borderRadius: 20, padding: "6px 14px", fontSize: 12, color: "#e05c5c"
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4caf50", animation: "pulse 2s infinite" }} />
          Online
        </div>
      </div>

      {/* Emergency Banner */}
      <div style={{
        width: "100%", maxWidth: 780,
        margin: "12px 24px 0",
        background: "rgba(224,92,92,0.08)",
        border: "1px solid rgba(224,92,92,0.2)",
        borderRadius: 10, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 10,
        fontSize: 12, color: "rgba(255,255,255,0.6)"
      }}>
        <span style={{ fontSize: 16 }}>🚨</span>
        <span>Medical Emergency? Call <strong style={{ color: "#e05c5c" }}>108</strong> immediately · Not a substitute for professional medical advice</span>
      </div>

      {/* Quick Prompts */}
      <div style={{
        width: "100%", maxWidth: 780,
        padding: "12px 24px 0",
        display: "flex", flexWrap: "wrap", gap: 8
      }}>
        {QUICK_PROMPTS.map((p, i) => (
          <button key={i} onClick={() => sendMessage(p.text)}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20, padding: "6px 14px",
              color: "rgba(255,255,255,0.7)", fontSize: 12,
              cursor: "pointer", transition: "all 0.2s",
              fontFamily: "Georgia, serif"
            }}
            onMouseEnter={e => {
              e.target.style.background = "rgba(224,92,92,0.15)";
              e.target.style.borderColor = "rgba(224,92,92,0.4)";
              e.target.style.color = "#fff";
            }}
            onMouseLeave={e => {
              e.target.style.background = "rgba(255,255,255,0.04)";
              e.target.style.borderColor = "rgba(255,255,255,0.1)";
              e.target.style.color = "rgba(255,255,255,0.7)";
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Chat Area */}
      <div style={{
        flex: 1, width: "100%", maxWidth: 780,
        margin: "12px 0 0",
        padding: "0 24px",
        overflowY: "auto",
        maxHeight: "calc(100vh - 320px)",
        minHeight: 300
      }}>
        {messages.map((msg, i) => <Message key={i} msg={msg} />)}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, #e05c5c, #c0392b)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16
            }}>❤️</div>
            <div style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "18px 18px 18px 4px"
            }}>
              <TypingIndicator />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div style={{
        width: "100%", maxWidth: 780,
        padding: "12px 24px 24px",
      }}>
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-end",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 16, padding: "12px 16px",
          transition: "border-color 0.2s"
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about donation eligibility, compatibility, procedures..."
            rows={1}
            style={{
              flex: 1, background: "transparent", border: "none",
              color: "#f0f0f0", fontSize: 14, lineHeight: "1.5",
              resize: "none", fontFamily: "Georgia, serif",
              maxHeight: 120, overflowY: "auto"
            }}
            onInput={e => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "none",
              background: input.trim() && !loading
                ? "linear-gradient(135deg, #e05c5c, #c0392b)"
                : "rgba(255,255,255,0.1)",
              color: "#fff", cursor: input.trim() && !loading ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, flexShrink: 0, transition: "all 0.2s",
              boxShadow: input.trim() && !loading ? "0 0 16px rgba(224,92,92,0.4)" : "none"
            }}>
            ➤
          </button>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 8 }}>
          LifeForge AI · For informational guidance only · Always consult a medical professional
        </div>
      </div>
    </div>
  );
}

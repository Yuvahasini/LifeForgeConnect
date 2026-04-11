import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Send, ArrowLeft, Heart, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { streamAIChat, AIChatMessage } from "@/lib/api";

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
    { label: "🩸 Blood Donation", text: "What are the eligibility criteria for blood donation? Include precautions and recovery tips." },
    { label: "🧬 Bone Marrow", text: "Explain how bone marrow donation works, HLA matching, and how to register as a donor in India." },
    { label: "🫀 Organ Donation", text: "How do I register as an organ donor in India? Explain the legal process, organ viability windows, and THOTA act." },
    { label: "🍼 Milk Donation", text: "How can a lactating mother donate breast milk? What is pasteurized donor human milk (PDHM) and how does milk banking work?" },
    { label: "🔬 Compatibility", text: "Explain blood group compatibility, the universal donor and recipient, and how cross-matching works." },
    { label: "⚡ Platelet Donation", text: "What is platelet apheresis donation? Who needs it most, what are the eligibility criteria, and how long does it take?" },
];

function TypingIndicator() {
    return (
        <div className="flex items-center gap-1.5 py-3 px-4">
            {[0, 1, 2].map(i => (
                <motion.div
                    key={i}
                    animate={{
                        y: [0, -6, 0],
                    }}
                    transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        delay: i * 0.2,
                    }}
                    className="w-2 h-2 rounded-full bg-primary"
                />
            ))}
        </div>
    );
}

interface MessageProps {
    msg: {
        role: "user" | "assistant";
        content: string;
        isEmergency?: boolean;
        isStreaming?: boolean;
    };
}

/** Simple Markdown-ish renderer for bold, bullets, and line breaks */
function formatContent(text: string) {
    return text.split("\n").map((line, i) => {
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*)/g).map((segment, j) => {
            if (segment.startsWith("**") && segment.endsWith("**")) {
                return <strong key={j} className="font-bold text-foreground">{segment.slice(2, -2)}</strong>;
            }
            return <span key={j}>{segment}</span>;
        });
        return (
            <span key={i}>
                {parts}
                {i < text.split("\n").length - 1 && <br />}
            </span>
        );
    });
}

function Message({ msg }: MessageProps) {
    const isUser = msg.role === "user";
    const isEmergency = msg.isEmergency;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex mb-6 ${isUser ? "justify-end" : "justify-start"}`}
        >
            {!isUser && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white mr-3 mt-1 shrink-0 shadow-lg shadow-primary/20">
                    <Heart size={18} fill="currentColor" />
                </div>
            )}
            <div
                className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isUser
                        ? "bg-gradient-to-br from-primary to-primary-dark text-white rounded-tr-none shadow-md shadow-primary/10"
                        : isEmergency
                            ? "bg-[#1a0a0a] border border-primary/40 text-rose-50 rounded-tl-none shadow-xl shadow-primary/20"
                            : "bg-white dark:bg-muted/30 border border-border text-foreground rounded-tl-none shadow-sm"
                    }`}
            >
                {isEmergency && (
                    <div className="text-primary font-bold text-[10px] tracking-widest uppercase mb-2 flex items-center gap-1.5 animate-pulse">
                        <span className="text-sm">🚨</span> HIGH URGENCY DETECTED
                    </div>
                )}
                {isUser ? msg.content : formatContent(msg.content)}
                {msg.isStreaming && (
                    <span className="inline-block w-1.5 h-4 bg-primary/70 ml-0.5 animate-pulse rounded-sm" />
                )}
            </div>
        </motion.div>
    );
}

export default function LifeForgeAI() {
    const [messages, setMessages] = useState<MessageProps["msg"][]>([
        {
            role: "assistant",
            content: "Hello! I'm **LifeForge AI** — your intelligent guide through India's life-saving donor ecosystem. 🏥\n\nI can help you with:\n• 🩸 Blood donation — eligibility, compatibility, precautions\n• ⚡ Platelet apheresis — who needs it, how it works\n• 🧬 Bone marrow matching — HLA types, registration\n• 🫀 Organ donation — pledging, legal process, viability\n• 🍼 Human milk banking — donors, storage, pasteurization\n• 🔴 Thalassemia care — transfusions, iron chelation\n• 💊 General health — first aid, nutrition, lab reports, myths vs facts\n\nHow can I assist you today? If this is a **medical emergency**, please call **108** immediately.",
            isEmergency: false,
        }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef(false);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, loading]);

    const isUrgent = (text: string) => URGENCY_KEYWORDS.some(k => text.toLowerCase().includes(k));

    const clearChat = useCallback(() => {
        setMessages([{
            role: "assistant",
            content: "Chat cleared! How can I help you? Ask me about blood donation, organ transplants, platelet needs, thalassemia, bone marrow, milk banking, or any health-related questions. 😊",
            isEmergency: false,
        }]);
    }, []);

    const sendMessage = async (text?: string) => {
        const userText = text || input.trim();
        if (!userText || loading) return;

        const urgent = isUrgent(userText);

        // Add user message
        const userMsg: MessageProps["msg"] = { role: "user", content: userText, isEmergency: false };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setLoading(true);
        abortRef.current = false;

        // Build conversation history for API (last 20 messages for context)
        const history: AIChatMessage[] = [...messages.slice(-20), userMsg].map(m => ({
            role: m.role as "user" | "assistant",
            content: m.role === "user" && urgent
                ? `⚠️ HIGH URGENCY CONTEXT — the user may be in an emergency.\n\n${m.content}`
                : m.content,
        }));

        // Add streaming placeholder
        const streamingMsg: MessageProps["msg"] = {
            role: "assistant",
            content: "",
            isEmergency: urgent,
            isStreaming: true,
        };
        setMessages(prev => [...prev, streamingMsg]);

        await streamAIChat(
            history,
            urgent,
            // onChunk — append text to the last message
            (chunk) => {
                if (abortRef.current) return;
                setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    updated[updated.length - 1] = {
                        ...last,
                        content: last.content + chunk,
                    };
                    return updated;
                });
            },
            // onDone — mark streaming complete
            () => {
                setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    updated[updated.length - 1] = { ...last, isStreaming: false };
                    return updated;
                });
                setLoading(false);
            },
            // onError — show error message
            (errMsg) => {
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = {
                        role: "assistant",
                        content: `⚠️ ${errMsg}\n\nIf this is an emergency, please call **108** immediately. You can also try asking again.`,
                        isEmergency: urgent,
                        isStreaming: false,
                    };
                    return updated;
                });
                setLoading(false);
            }
        );
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center font-body text-foreground pb-10">
            {/* Header Area */}
            <div className="w-full bg-background/80 backdrop-blur-md sticky top-0 z-10 border-b border-border">
                <div className="max-w-4xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="p-2 hover:bg-muted rounded-full transition-colors mr-2">
                            <ArrowLeft size={20} />
                        </Link>
                        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shadow-lg shadow-primary/20 shrink-0">
                            <Heart size={24} fill="currentColor" />
                        </div>
                        <div>
                            <h1 className="font-display font-bold text-xl leading-none">LifeForge AI</h1>
                            <p className="text-[10px] text-primary uppercase tracking-[0.2em] font-bold mt-1">
                                Donor Intelligence Companion
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={clearChat}
                            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full px-3 py-1.5 transition-all"
                            title="New conversation"
                        >
                            <RotateCcw size={12} />
                            New Chat
                        </button>
                        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <Sparkles size={12} className="inline mr-1" />AI Powered
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Warning Banner */}
            <div className="w-full max-w-4xl px-6 mt-6">
                <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3 flex items-start gap-3 text-[11px] sm:text-xs text-muted-foreground leading-relaxed">
                    <span className="text-base shrink-0">🚨</span>
                    <p>
                        <strong className="text-primary font-bold">Medical Emergency?</strong> Call <span className="text-primary font-bold">108</span> immediately. This AI provides informational guidance only and is not a substitute for professional medical advice, diagnosis, or treatment.
                    </p>
                </div>
            </div>

            {/* Main Chat Container */}
            <div className="w-full max-w-4xl flex-1 flex flex-col gap-8 px-6 mt-8 overflow-hidden">

                {/* Quick Help Section - Only visible when we have few messages */}
                {messages.length < 3 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {QUICK_PROMPTS.map((p, i) => (
                            <button
                                key={i}
                                onClick={() => sendMessage(p.text)}
                                className="bg-muted/30 hover:bg-muted/50 border border-border hover:border-primary/50 transition-all p-3 rounded-xl text-left flex flex-col gap-1 group"
                            >
                                <span className="text-base">{p.label.split(' ')[0]}</span>
                                <span className="text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors leading-tight">
                                    {p.label.split(' ').slice(1).join(' ')}
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Chat History */}
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
                    {messages.map((msg, i) => (
                        <Message key={i} msg={msg} />
                    ))}
                    {loading && messages[messages.length - 1]?.content === "" && (
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white shrink-0">
                                <Heart size={18} fill="currentColor" />
                            </div>
                            <div className="bg-muted/30 border border-border rounded-2xl rounded-tl-none overflow-hidden shadow-sm">
                                <TypingIndicator />
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} className="h-4" />
                </div>

                {/* Input Area Overlaying Chat */}
                <div className="pt-4 pb-6 sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent pt-10 px-1">
                    <div className="relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-primary-dark/20 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>
                        <div className="relative flex items-end gap-3 bg-white dark:bg-muted/20 border-2 border-border focus-within:border-primary/50 rounded-2xl p-3 shadow-xl shadow-black/5 transition-all">
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
                                className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium py-2.5 max-h-32 resize-none overflow-y-auto"
                                onInput={e => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = "auto";
                                    target.style.height = Math.min(target.scrollHeight, 128) + "px";
                                }}
                            />
                            <button
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || loading}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all transform active:scale-95 ${input.trim() && !loading
                                        ? "bg-gradient-to-br from-primary to-primary-dark shadow-lg shadow-primary/20"
                                        : "bg-muted text-muted-foreground cursor-not-allowed"
                                    }`}
                            >
                                {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} className="ml-0.5" />}
                            </button>
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between items-center px-2">
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-primary" /> Powered by Groq AI • India-wide donor intelligence
                        </span>
                        <span className="text-[10px] text-muted-foreground/60">
                            Shift + Enter for new line
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

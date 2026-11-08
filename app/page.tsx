"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  prompt?: string;
};

type Chat = {
  id: number;
  title: string;
  messages: Message[];
  updatedAt: number;
  pinned?: boolean;
};

const suggestions = [
  "Build me a Python project",
  "Explain AI in simple words",
  "Give me a cybersecurity idea",
  "Help me learn cloud computing",
];

const modes = ["General", "Code", "Cybersecurity", "Cloud"];

export default function Home() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState("New conversation");
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [mode, setMode] = useState("General");
  const [model, setModel] = useState("Shals-1");
  const [search, setSearch] = useState("");
  const [sidebar, setSidebar] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showModel, setShowModel] = useState(false);
  const [showMode, setShowMode] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [thinkMode, setThinkMode] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [menuChat, setMenuChat] = useState<number | null>(null);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("shals-ai-chats");

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const data = Array.isArray(parsed) ? (parsed as Chat[]) : [];
        setChats(data);

        if (data.length > 0) {
          const latest = [...data].sort(
            (a, b) => b.updatedAt - a.updatedAt
          )[0];

          setMessages(Array.isArray(latest.messages) ? latest.messages : []);
          setActiveChat(latest.title || "New conversation");
          setActiveChatId(latest.id);
        }
      } catch {
        localStorage.removeItem("shals-ai-chats");
        setChats([]);
      } finally {
        setHistoryLoaded(true);
      }
    } else {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!historyLoaded) return;

    try {
      localStorage.setItem("shals-ai-chats", JSON.stringify(chats));
    } catch (error) {
      console.error("Unable to save Shals AI chat history:", error);
    }
  }, [chats, historyLoaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const resizeInput = () => {
    if (!inputRef.current) return;

    inputRef.current.style.height = "auto";
    inputRef.current.style.height =
      Math.min(inputRef.current.scrollHeight, 180) + "px";
  };

  const saveChat = (items: Message[]) => {
    const firstUser = items.find((item) => item.role === "user");
    if (!firstUser) return;

    const title = firstUser.content.trim().slice(0, 35) || "New conversation";
    const chatId = activeChatId ?? Date.now();
    const updatedAt = Date.now();

    setActiveChat(title);
    setActiveChatId(chatId);
    setChats((oldChats) => {
      const exists = oldChats.some((chat) => chat.id === chatId);
      if (exists) {
        return oldChats.map((chat) =>
          chat.id === chatId
            ? { ...chat, title, messages: items, updatedAt }
            : chat
        );
      }

      return [
        { id: chatId, title, messages: items, updatedAt },
        ...oldChats,
      ];
    });
  };

  const newChat = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setMessages([]);
    setMessage("");
    setActiveChat("New conversation");
    setActiveChatId(null);
    setAttachedFiles([]);
    setThinking(false);
    setStreaming(false);
    setSidebar(false);

    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

 
const sendMessage = async () => {
  const text = message.trim();
  if ((!text && attachedFiles.length === 0) || streaming) return;

  const textExtensions = /\.(txt|md|csv|json|js|jsx|ts|tsx|py|html|css|xml|yaml|yml|log|sql|sh|java|c|cpp|h|ipynb)$/i;
  const attachmentParts = await Promise.all(
    attachedFiles.map(async (file) => {
      if (textExtensions.test(file.name) && file.size <= 200_000) {
        try {
          const content = await file.text();
          return `\n\n--- Attached text file: ${file.name} ---\n${content.slice(0, 30000)}\n--- End of ${file.name} ---`;
        } catch {
          return `\n[Could not read attached file: ${file.name}]`;
        }
      }
      if (file.type.startsWith("image/")) {
        return `\n[Image attached: ${file.name}. The current chat API does not send image pixels for AI analysis yet.]`;
      }
      return `\n[Attached file: ${file.name} (${Math.round(file.size / 1024)} KB). This file type is selected but its contents are not read by the current chat API.]`;
    })
  );

  const promptText = `${text}${attachmentParts.join("")}`.trim();
  const displayText = [
    text,
    ...attachedFiles.map((file) => `📎 ${file.name}`),
  ].filter(Boolean).join("\n");

  const userMessage: Message = {
    id: Date.now(),
    role: "user",
    content: displayText,
    prompt: promptText,
  };

  const updatedMessages = [...messages, userMessage];
  setMessages(updatedMessages);
  setMessage("");
  setAttachedFiles([]);
  setThinking(true);
  setStreaming(true);

  if (inputRef.current) {
    inputRef.current.style.height = "auto";
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: promptText,
        mode,
        model,
        webSearch,
        thinkMode,
        history: updatedMessages.slice(-20).map((item) => ({
          role: item.role,
          content: item.role === "user" ? item.prompt || item.content : item.content,
        })),
      }),
    });

   
if (!response.ok) {
  const data = await response.json();
  throw new Error(data.error || "Unable to get an AI response.");
}

if (!response.body) {
  throw new Error("Streaming is not supported.");
}

const assistantId = Date.now() + 1;

const initialMessages: Message[] = [
  ...updatedMessages,
  { id: assistantId, role: "assistant", content: "" },
];

setMessages(initialMessages);
setThinking(false);

const reader = response.body.getReader();
const decoder = new TextDecoder();
let fullReply = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  fullReply += decoder.decode(value, { stream: true });

  setMessages([
    ...updatedMessages,
    {
      id: assistantId,
      role: "assistant",
      content: fullReply,
    },
  ]);
}

fullReply += decoder.decode();

const finalMessages: Message[] = [
  ...updatedMessages,
  {
    id: assistantId,
    role: "assistant",
    content: fullReply,
  },
];

setMessages(finalMessages);
saveChat(finalMessages);

  } catch (error) {
    const errorMessage: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content:
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
    };

    const finalMessages = [...updatedMessages, errorMessage];
    setMessages(finalMessages);
    saveChat(finalMessages);
  } finally {
    setThinking(false);
    setStreaming(false);
  }
};


  const copyMessage = async (id: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch (error) {
      console.error("Unable to copy this response:", error);
    }
  };

 
const regenerate = async (id: number) => {
  if (streaming) return;

  const targetIndex = messages.findIndex((item) => item.id === id);
  if (targetIndex < 0) return;

  const previousUserMessage = [...messages.slice(0, targetIndex)]
    .reverse()
    .find((item) => item.role === "user");
  if (!previousUserMessage) return;

  const previousUserIndex = messages.findIndex(
    (item) => item.id === previousUserMessage.id
  );
  const promptText = previousUserMessage.prompt || previousUserMessage.content;
  const regenerationHistory = messages.slice(0, previousUserIndex + 1).map((item) => ({
    role: item.role,
    content: item.role === "user" ? item.prompt || item.content : item.content,
  }));
  const baseMessages = messages.map((item) =>
    item.id === id ? { ...item, content: "" } : item
  );

  setMessages(baseMessages);
  setStreaming(true);
  setThinking(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: promptText,
        mode,
        model,
        webSearch,
        thinkMode,
        history: regenerationHistory,
      }),
    });

    if (!response.ok) {
      let errorText = "Unable to regenerate the response.";
      try {
        const data = await response.json();
        errorText = data.error || errorText;
      } catch {}
      throw new Error(errorText);
    }

    if (!response.body) throw new Error("Streaming is not supported.");

    setThinking(false);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullReply += decoder.decode(value, { stream: true });
      setMessages(
        baseMessages.map((item) =>
          item.id === id ? { ...item, content: fullReply } : item
        )
      );
    }

    fullReply += decoder.decode();
    const finalMessages = baseMessages.map((item) =>
      item.id === id ? { ...item, content: fullReply } : item
    );
    setMessages(finalMessages);
    saveChat(finalMessages);
  } catch (error) {
    const errorText = error instanceof Error
      ? error.message
      : "Unable to regenerate the response.";
    const failedMessages = baseMessages.map((item) =>
      item.id === id ? { ...item, content: `Regeneration failed: ${errorText}` } : item
    );
    setMessages(failedMessages);
  } finally {
    setThinking(false);
    setStreaming(false);
  }
};

  const openChat = (chat: Chat) => {
    setMessages(chat.messages);
    setActiveChat(chat.title);
    setActiveChatId(chat.id);
    setSidebar(false);
    setMenuChat(null);
  };

  const deleteChat = (id: number) => {
    setChats((oldChats) => oldChats.filter((chat) => chat.id !== id));

    if (activeChatId === id) {
      setMessages([]);
      setActiveChat("New conversation");
      setActiveChatId(null);
    }

    setMenuChat(null);
  };

  const renameChat = (chat: Chat) => {
    const name = window.prompt(
      "Enter new chat name",
      chat.title
    );

    if (!name?.trim()) return;

    setChats((oldChats) =>
      oldChats.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              title: name.trim(),
            }
          : item
      )
    );

    if (activeChat === chat.title) {
      setActiveChat(name.trim());
    }

    setMenuChat(null);
  };

  const pinChat = (chat: Chat) => {
    setChats((oldChats) =>
      oldChats.map((item) =>
        item.id === chat.id
          ? {
              ...item,
              pinned: !item.pinned,
            }
          : item
      )
    );

    setMenuChat(null);
  };

  const exportChat = () => {
    if (!messages.length) return;

    const content = messages
      .map(
        (item) =>
          `${item.role === "user" ? "You" : "Shals AI"}:\n${
            item.content
          }`
      )
      .join("\n\n");

    const blob = new Blob([content], {
      type: "text/plain",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "shals-ai-chat.txt";
    link.click();

    URL.revokeObjectURL(url);
  };

  const filteredChats = [...chats]
    .filter((chat) => chat.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt - a.updatedAt);

  return (
    <main className="min-h-screen overflow-hidden bg-[#030407] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:48px_48px]" />

        <div className="absolute left-[20%] top-[-200px] h-[550px] w-[550px] rounded-full bg-cyan-500/[0.06] blur-[160px] animate-[float_14s_ease-in-out_infinite]" />

        <div className="absolute right-[-150px] top-[30%] h-[500px] w-[500px] rounded-full bg-violet-600/[0.05] blur-[160px] animate-[float_17s_ease-in-out_infinite_reverse]" />

        <div className="absolute left-[42%] top-[28%] h-[280px] w-[280px] rounded-full bg-cyan-400/[0.025] blur-[120px] animate-[ambientGlow_8s_ease-in-out_infinite]" />
      </div>

      <div className="relative flex h-screen overflow-hidden">
        {sidebar && (
          <button
            onClick={() => setSidebar(false)}
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/[0.07] bg-[#07080b]/95 backdrop-blur-2xl transition-all duration-300 lg:relative lg:translate-x-0 ${
            collapsed ? "lg:w-[76px]" : "w-[270px] lg:w-[260px]"
          } ${
            sidebar
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
        >
          <div className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center">
                <div className="absolute inset-[-10px] rounded-full bg-cyan-400/[0.12] blur-xl animate-[orbitGlow_4s_ease-in-out_infinite]" />
                <div className="absolute inset-[-4px] rounded-full bg-violet-500/[0.08] blur-lg animate-[orbitGlow_5s_ease-in-out_infinite_reverse]" />

                <div className="relative flex h-11 w-11 items-center justify-center">
                  <svg
                    viewBox="0 0 100 100"
                    className="h-11 w-11 overflow-visible"
                    aria-label="Shals AI orbit logo"
                  >
                    <defs>
                      <linearGradient id="blueS" x1="25" y1="18" x2="75" y2="82">
                        <stop offset="0%" stopColor="#b8f4ff" />
                        <stop offset="18%" stopColor="#69e8ff" />
                        <stop offset="55%" stopColor="#2388ff" />
                        <stop offset="100%" stopColor="#1760e8" />
                      </linearGradient>
                      <linearGradient id="blueOrbit" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#1557ff" stopOpacity="0.08" />
                        <stop offset="25%" stopColor="#2d8cff" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#65eaff" />
                        <stop offset="75%" stopColor="#277cff" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#1557ff" stopOpacity="0.08" />
                      </linearGradient>
                      <linearGradient id="cometBlue" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#42dfff" stopOpacity="0" />
                        <stop offset="72%" stopColor="#42dfff" stopOpacity="0.55" />
                        <stop offset="100%" stopColor="#d9fbff" />
                      </linearGradient>
                      <filter id="blueGlow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="2.2" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <filter id="orbitBlueGlow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="2.8" result="blur" />
                        <feMerge>
                          <feMergeNode in="blur" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    {/* The whole tilted orbit rotates around the S for a 3D-style effect. */}
                    <g>
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="-22 50 50"
                        to="338 50 50"
                        dur="4.8s"
                        repeatCount="indefinite"
                      />

                      <ellipse
                        cx="50"
                        cy="50"
                        rx="43"
                        ry="17"
                        fill="none"
                        stroke="#176dff"
                        strokeWidth="3"
                        opacity="0.22"
                        filter="url(#orbitBlueGlow)"
                      />
                      <ellipse
                        cx="50"
                        cy="50"
                        rx="43"
                        ry="17"
                        fill="none"
                        stroke="url(#blueOrbit)"
                        strokeWidth="1.35"
                        opacity="0.95"
                      />

                      {/* Glowing point rides the rotating orbit. */}
                      <path
                        d="M 37 0 C 41 -1.8 47 -1.2 50 0"
                        fill="none"
                        stroke="url(#cometBlue)"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        transform="translate(87 50) rotate(90)"
                        filter="url(#orbitBlueGlow)"
                      />
                      <circle cx="93" cy="50" r="4" fill="#32dfff" opacity="0.28" filter="url(#orbitBlueGlow)" />
                      <circle cx="93" cy="50" r="2" fill="#8ff3ff" filter="url(#blueGlow)" />
                      <circle cx="93" cy="50" r="0.8" fill="white" />
                    </g>

                    {/* Simple rounded S, matching the reference shape. */}
                    <text
                      x="50"
                      y="74"
                      textAnchor="middle"
                      fontFamily="Arial Rounded MT Bold, Trebuchet MS, Arial, sans-serif"
                      fontSize="72"
                      fontWeight="700"
                      fill="url(#blueS)"
                      stroke="#4bdcff"
                      strokeWidth="0.35"
                      paintOrder="stroke"
                      filter="url(#blueGlow)"
                    >
                      S
                    </text>

                    <circle cx="16" cy="50" r="0.55" fill="#43cfff" opacity="0.8" />
                    <circle cx="84" cy="30" r="0.65" fill="#55e4ff" opacity="0.85" />
                  </svg>
                </div>
              </div>

              {!collapsed && (
                <div>
                  <div className="text-sm font-bold tracking-wide">
                    SHALS AI
                  </div>

                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.25em] text-gray-600">
                    Intelligence
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden h-8 w-8 rounded-lg text-gray-600 transition hover:bg-white/[0.06] hover:text-white lg:block"
            >
              {collapsed ? "→" : "←"}
            </button>
          </div>

          <div className="p-4">
            <button
              onClick={newChat}
              title="Start a new conversation"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] px-4 py-3 text-sm text-gray-200 transition hover:border-cyan-400/40 hover:bg-cyan-400/[0.09] hover:shadow-[0_0_25px_rgba(34,211,238,0.07)]"
            >
              <span className="text-lg">+</span>
              {!collapsed && "New chat"}
            </button>
          </div>

          {!collapsed && (
            <div className="flex-1 overflow-y-auto px-4">
              <div className="mb-5">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search conversations"
                  title="Search your conversations"
                  className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 text-xs text-gray-300 outline-none placeholder:text-gray-700 focus:border-cyan-400/30"
                />
              </div>

              <div className="mb-2 px-2 text-[9px] uppercase tracking-[0.25em] text-gray-600">
                Conversations
              </div>

              <div className="space-y-1">
                {filteredChats.map((chat) => (
                  <div key={chat.id} className="group relative">
                    <button
                      onClick={() => openChat(chat)}
                      title={`Open: ${chat.title}`}
                      className={`w-full rounded-xl px-3 py-3 pr-9 text-left text-xs ${
                        activeChat === chat.title
                          ? "bg-white/[0.08] text-white"
                          : "text-gray-500 hover:bg-white/[0.04] hover:text-gray-200"
                      }`}
                    >
                      <span className="mr-2 text-gray-600">
                        {chat.pinned ? "◆" : "◌"}
                      </span>

                      {chat.title}
                    </button>

                    <button
                      onClick={() =>
                        setMenuChat(
                          menuChat === chat.id
                            ? null
                            : chat.id
                        )
                      }
                      title="Conversation options"
                      className="absolute right-2 top-2.5 hidden h-7 w-7 rounded-lg text-gray-600 hover:bg-white/[0.07] hover:text-white group-hover:block"
                    >
                      ⋯
                    </button>

                    {menuChat === chat.id && (
                      <div className="absolute right-0 top-11 z-50 w-32 rounded-xl border border-white/10 bg-[#111217] p-1 shadow-2xl">
                        <button
                          onClick={() => renameChat(chat)}
                          className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-400 hover:bg-white/[0.06] hover:text-white"
                        >
                          Rename
                        </button>

                        <button
                          onClick={() => pinChat(chat)}
                          className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-400 hover:bg-white/[0.06] hover:text-white"
                        >
                          {chat.pinned ? "Unpin" : "Pin"}
                        </button>

                        <button
                          onClick={() => deleteChat(chat.id)}
                          className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-400 hover:bg-red-400/10"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {filteredChats.length === 0 && (
                  <div className="px-3 py-10 text-center text-xs text-gray-700">
                    No conversations yet
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.07] p-3">
            <button
              onClick={() => setShowProfile(!showProfile)}
              title="Open workspace menu"
              className="flex w-full items-center gap-3 rounded-xl p-2 hover:bg-white/[0.05]"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 text-xs font-black text-black">
                U
              </div>

              {!collapsed && (
                <div className="text-left">
                  <div className="text-xs text-gray-300">
                    Your workspace
                  </div>

                  <div className="mt-0.5 text-[10px] text-gray-600">
                    ● Operational
                  </div>
                </div>
              )}
            </button>

            {showProfile && !collapsed && (
              <div className="mt-2 rounded-xl border border-white/10 bg-[#101116] p-1">
                <button
                  title="Open settings"
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-400 hover:bg-white/[0.06] hover:text-white"
                >
                  ⚙ Settings
                </button>

                <button
                  title="Change appearance"
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-400 hover:bg-white/[0.06] hover:text-white"
                >
                  ◐ Appearance
                </button>

                <button
                  title="Get help"
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-400 hover:bg-white/[0.06] hover:text-white"
                >
                  ? Help
                </button>
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#050609]/70 px-4 backdrop-blur-2xl md:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebar(true)}
                title="Open sidebar"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-gray-400 lg:hidden"
              >
                ☰
              </button>

              <div>
                <div className="text-sm text-gray-200">
                  {activeChat}
                </div>

                <div className="mt-0.5 text-[10px] text-gray-600">
                  ● {model} · {mode}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                title="Sign in to your Shals AI account"
                className="hidden rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-gray-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.04] hover:text-white sm:block"
              >
                Sign In
              </button>

              <div className="relative hidden sm:block">
                <button
                  onClick={() => setShowMode(!showMode)}
                  title="Choose assistant mode"
                  className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-gray-400 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.04] hover:text-white"
                >
                  {mode}⌄
                </button>

                {showMode && (
                  <div className="absolute right-0 top-11 z-50 w-44 rounded-2xl border border-white/10 bg-[#101116] p-1.5 shadow-2xl">
                    {modes.map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          setMode(item);
                          setShowMode(false);
                        }}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-xs ${
                          mode === item
                            ? "bg-cyan-400/10 text-cyan-300"
                            : "text-gray-500 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowModel(!showModel)}
                  title="Choose AI model"
                  className="rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-gray-300 transition hover:border-violet-400/30 hover:bg-violet-400/[0.04]"
                >
                  {model}⌄
                </button>

                {showModel && (
                  <div className="absolute right-0 top-11 z-50 w-36 rounded-2xl border border-white/10 bg-[#101116] p-1.5 shadow-2xl">
                    {["Shals-1", "Shals-Pro"].map((item) => (
                      <button
                        key={item}
                        onClick={() => {
                          setModel(item);
                          setShowModel(false);
                        }}
                        className={`w-full rounded-xl px-3 py-2.5 text-left text-xs ${
                          model === item
                            ? "bg-violet-400/10 text-violet-300"
                            : "text-gray-500 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={exportChat}
                disabled={!messages.length}
                title="Export this conversation as a text file"
                className="hidden rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-xs text-gray-400 transition hover:border-cyan-400/20 hover:text-white disabled:opacity-30 md:block"
              >
                ↓ Export
              </button>
            </div>
          </header>

          
<div className="min-h-0 flex-1 overflow-y-auto">

            <div className="mx-auto flex w-full max-w-5xl flex-col px-5 pb-48 pt-8 md:px-10">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col justify-center">
                  <div className="text-center animate-[fadeUp_0.7s_ease-out]">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/[0.04] px-4 py-2 text-[9px] uppercase tracking-[0.25em] text-gray-500">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      Shals AI is ready
                    </div>

                    <div className="relative mx-auto w-fit">
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-52 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/[0.16] blur-[90px] animate-[centerGlow_4s_ease-in-out_infinite]" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.13] blur-[65px] animate-[centerGlow_5s_ease-in-out_infinite_reverse]" />
                  <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/[0.11] blur-[45px] animate-[centerGlow_3s_ease-in-out_infinite]" />
                  <div className="pointer-events-none absolute -inset-x-20 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-cyan-300/20 to-transparent blur-sm animate-pulse" />
                  <h1 className="relative text-6xl font-semibold tracking-[-0.06em] md:text-8xl">
                    <span className="text-white drop-shadow-[0_0_22px_rgba(255,255,255,0.10)]">Shals</span>{" "}
                    <span className="bg-gradient-to-r from-cyan-200 via-blue-400 to-violet-500 bg-clip-text text-transparent drop-shadow-[0_0_28px_rgba(56,189,248,0.35)]">
                      AI
                    </span>
                  </h1>
                </div>
                <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-gray-400 md:text-base">
                  Think smarter. Build faster. Explore beyond the ordinary.
                </p>
                  </div>

                  <div className="mx-auto mt-10 grid w-full max-w-3xl gap-3 sm:grid-cols-3">
                    {[
                      [
                        "✦",
                        "Think",
                        "Understand complex ideas with clear explanations.",
                      ],
                      [
                        "</>",
                        "Build",
                        "Create projects, write code and solve problems.",
                      ],
                      [
                        "◈",
                        "Explore",
                        "Discover new ideas and turn them into reality.",
                      ],
                    ].map(([icon, title, desc]) => (
                      <div
                        key={title}
                        title={desc}
                        className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 transition hover:-translate-y-1 hover:border-cyan-400/25 hover:bg-white/[0.05] hover:shadow-[0_12px_35px_rgba(34,211,238,0.06)]"
                      >
                        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/15 bg-cyan-400/[0.08] text-xs text-cyan-300">
                          {icon}
                        </div>

                        <h3 className="text-xs font-semibold text-gray-200">
                          {title}
                        </h3>

                        <p className="mt-1 text-[11px] leading-4 text-gray-500">
                          {desc}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-2">
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        title={`Use suggestion: ${item}`}
                        onClick={() => {
                          setMessage(item);
                          setTimeout(resizeInput, 0);
                        }}
                        className="rounded-full border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-xs text-gray-500 transition hover:-translate-y-1 hover:border-cyan-400/25 hover:bg-cyan-400/[0.04] hover:text-gray-200"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-9 pt-6">
                  {messages.map((item) => (
                    <div
                      key={item.id}
                      className={`flex gap-4 ${
                        item.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {item.role === "assistant" && (
                        <div
                          title="Shals AI"
                          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-white to-gray-300 text-xs font-black text-black shadow-[0_0_20px_rgba(34,211,238,0.08)]"
                        >
                          S
                          <span className="absolute -right-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                        </div>
                      )}

                      <div
                        className={`max-w-[80%] ${
                          item.role === "user"
                            ? "rounded-2xl rounded-br-md border border-cyan-400/20 bg-cyan-400/[0.09] px-5 py-3.5 text-sm text-gray-100"
                            : "pt-1 text-sm leading-7 text-gray-300"
                        }`}
                      >
                      {item.role === "assistant" ? (
  <div className="prose prose-invert prose-sm max-w-none break-words [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-black/40 [&_pre]:p-4 [&_code]:font-mono [&_li]:my-1 [&_p]:my-3 [&_h1]:mb-3 [&_h2]:mb-3 [&_h3]:mb-2">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {item.content}
    </ReactMarkdown>
  </div>
) : (
  item.content
)}

                        {streaming &&
                          item.id ===
                            messages[messages.length - 1]?.id && (
                            <span className="ml-1 inline-block h-4 w-[2px] animate-pulse bg-cyan-400 align-middle" />
                          )}

                        {item.role === "assistant" &&
                          item.content &&
                          !streaming && (
                            <div className="mt-4 flex gap-4 text-[11px] text-gray-600">
                              <button
                                title="Copy response"
                                onClick={() =>
                                  copyMessage(
                                    item.id,
                                    item.content
                                  )
                                }
                                className="hover:text-white"
                              >
                                {copied === item.id
                                  ? "✓ Copied"
                                  : "Copy"}
                              </button>

                              <button
                                title="Generate another response"
                                onClick={() =>
                                  regenerate(item.id)
                                }
                                className="hover:text-white"
                              >
                                ↻ Regenerate
                              </button>

                              <button
                                title="Good response"
                                className="hover:text-emerald-300"
                              >
                                👍
                              </button>

                              <button
                                title="Poor response"
                                className="hover:text-red-300"
                              >
                                👎
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  ))}

                  {thinking && (
                    <div className="flex items-center gap-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-xs font-black text-black">
                        S
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        Thinking

                        <span className="flex gap-1">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cyan-400" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-blue-400 [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#030407] via-[#030407]/95 to-transparent px-5 pb-5 pt-12 lg:left-[260px]">
            <div className="mx-auto max-w-4xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
                className="group overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0a0b0f]/95 shadow-2xl backdrop-blur-2xl focus-within:border-cyan-400/45 focus-within:shadow-[0_0_35px_rgba(34,211,238,0.06)]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setAttachedFiles((current) => {
                      const additions = files.filter(
                        (file) =>
                          !current.some(
                            (existing) =>
                              existing.name === file.name &&
                              existing.size === file.size &&
                              existing.lastModified === file.lastModified
                          )
                      );
                      return [...current, ...additions];
                    });
                    e.target.value = "";
                  }}
                />
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setAttachedFiles((current) => [
                      ...current,
                      ...files.filter(
                        (file) =>
                          !current.some(
                            (existing) =>
                              existing.name === file.name &&
                              existing.size === file.size &&
                              existing.lastModified === file.lastModified
                          )
                      ),
                    ]);
                    e.target.value = "";
                  }}
                />

                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2 px-4 pt-4">
                    {attachedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                        className="flex max-w-full items-center gap-2 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] px-3 py-2 text-xs text-gray-300"
                      >
                        <span className="text-cyan-300">
                          {file.type.startsWith("image/") ? "▧" : "📎"}
                        </span>
                        <span className="max-w-[180px] truncate" title={file.name}>
                          {file.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-600">
                          {file.size < 1024 * 1024
                            ? `${Math.max(1, Math.round(file.size / 1024))} KB`
                            : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachedFiles((current) =>
                              current.filter((_, fileIndex) => fileIndex !== index)
                            )
                          }
                          title={`Remove ${file.name}`}
                          aria-label={`Remove ${file.name}`}
                          className="ml-1 text-gray-500 transition hover:text-red-300"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    resizeInput();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  rows={1}
                  placeholder="Message Shals AI..."
                  title="Type your message"
                  className="max-h-[180px] w-full resize-none bg-transparent px-5 py-5 text-sm text-white outline-none placeholder:text-gray-600"
                />

                <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.accept = "";
                          fileInputRef.current.click();
                        }
                      }}
                      title="Attach a file"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] text-sm text-gray-500 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.07] hover:text-cyan-200"
                    >
                      +
                    </button>

                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      title="Attach an image"
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/10 bg-cyan-400/[0.025] text-sm text-gray-500 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.07] hover:text-cyan-200"
                    >
                      ⌕
                    </button>

                    <button
                      type="button"
                      onClick={() => setWebSearch(!webSearch)}
                      title={
                        webSearch
                          ? "Web search is ON"
                          : "Search the web for current information"
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm transition ${
                        webSearch
                          ? "border border-cyan-300/30 bg-cyan-400/15 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.12)]"
                          : "border border-cyan-400/10 bg-cyan-400/[0.025] text-gray-500 hover:border-cyan-400/30 hover:bg-cyan-400/[0.07] hover:text-cyan-200"
                      }`}
                    >
                      ◉
                    </button>

                    <button
                      type="button"
                      onClick={() => setThinkMode(!thinkMode)}
                      title={
                        thinkMode
                          ? "Deep thinking is ON"
                          : "Use deeper reasoning for complex questions"
                      }
                      className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm transition ${
                        thinkMode
                          ? "border border-violet-300/30 bg-violet-400/15 text-violet-300 shadow-[0_0_18px_rgba(139,92,246,0.12)]"
                          : "border border-violet-400/10 bg-violet-400/[0.025] text-gray-500 hover:border-violet-400/30 hover:bg-violet-400/[0.07] hover:text-violet-200"
                      }`}
                    >
                      ✦
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="hidden text-[10px] text-gray-600 sm:block">
                      Enter ↵
                    </span>

                    <button
                      type="submit"
                      disabled={(!message.trim() && attachedFiles.length === 0) || streaming}
                      title={
                        streaming
                          ? "Shals AI is generating a response"
                          : "Send message"
                      }
                      className={`flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition ${
                        streaming
                          ? "bg-red-400 text-black hover:bg-red-300"
                          : message.trim() || attachedFiles.length > 0
                            ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.08)] hover:bg-cyan-100"
                            : "bg-white/[0.07] text-gray-600"
                      }`}
                    >
                      {streaming ? "Generating..." : "Send"}
                      <span>{streaming ? "⋯" : "↑"}</span>
                    </button>
                  </div>
                </div>
              </form>

              <div className="mt-3 flex items-center justify-center gap-2 text-[10px] text-gray-600">
                <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
                Shals AI can make mistakes. Check important information.
              </div>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(30px, 25px) scale(1.08);
          }
        }

        @keyframes ambientGlow {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(0.9);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.15);
          }
        }

        @keyframes logoAura {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(0.85);
          }
          50% {
            opacity: 0.85;
            transform: scale(1.25);
          }
        }

        @keyframes logoPulse {
          0%,
          100% {
            opacity: 0.45;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.05);
          }
        }

        @keyframes orbitGlow {
          0%, 100% {
            opacity: 0.45;
            transform: scale(0.92);
          }
          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @keyframes orbitSpin {
          from {
            transform: rotate(-28deg);
          }
          to {
            transform: rotate(332deg);
          }
        }

        @keyframes orbitDot {
          0%, 100% {
            opacity: 0.65;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.25);
          }
        }

        @keyframes centerGlow {
          0%, 100% {
            opacity: 0.35;
            transform: translate(-50%, -50%) scale(0.88);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.16);
          }
        }

        @keyframes starTrail {
          0%,
          100% {
            opacity: 0;
            transform: translate(-8px, -8px) rotate(25deg);
          }
          35% {
            opacity: 0.8;
          }
          60% {
            opacity: 0;
            transform: translate(17px, 17px) rotate(25deg);
          }
        }

        @keyframes starMove {
          0%,
          100% {
            opacity: 0;
            transform: translate(-8px, -7px);
          }
          35% {
            opacity: 1;
          }
          65% {
            opacity: 0;
            transform: translate(18px, 18px);
          }
        }

        * {
          scrollbar-width: thin;
          scrollbar-color: #242832 transparent;
        }

        *::-webkit-scrollbar {
          width: 5px;
        }

        *::-webkit-scrollbar-track {
          background: transparent;
        }

        *::-webkit-scrollbar-thumb {
          background: #242832;
          border-radius: 999px;
        }
      `}</style>
    </main>
  );
}
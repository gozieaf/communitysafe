"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    watsonAssistantChatOptions?: {
      integrationID: string;
      region: string;
      serviceInstanceID: string;
      onLoad: (instance: { render: () => void; openWindow?: () => void }) => void;
    };
  }
}

export function ChatWidget() {
  const chatInstance = useRef<{ render: () => void; openWindow?: () => void } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const integrationID = process.env.NEXT_PUBLIC_WATSONX_INTEGRATION_ID;
    const region = process.env.NEXT_PUBLIC_WATSONX_REGION;
    const serviceInstanceID = process.env.NEXT_PUBLIC_WATSONX_SERVICE_INSTANCE_ID;
    if (!integrationID || !region || !serviceInstanceID || document.getElementById("watsonx-web-chat")) return;
    window.watsonAssistantChatOptions = {
      integrationID,
      region,
      serviceInstanceID,
      onLoad: (instance) => {
        chatInstance.current = instance;
        instance.render();
      },
    };
    const script = document.createElement("script");
    script.id = "watsonx-web-chat";
    script.src = "https://web-chat.global.assistant.watson.appdomain.cloud/versions/latest/WatsonAssistantChatEntry.js";
    document.head.appendChild(script);
    return () => { chatInstance.current = null; script.remove(); delete window.watsonAssistantChatOptions; };
  }, []);

  function openChat(): void {
    if (chatInstance.current?.openWindow) {
      chatInstance.current.openWindow();
      return;
    }
    setMessage("Chat is not configured yet.");
  }

  return <>
    <button
      type="button"
      aria-label="Open chat"
      title="Open chat"
      onClick={openChat}
      style={{ position: "fixed", right: 24, bottom: 24, zIndex: 20, width: 56, height: 56, borderRadius: "50%", border: "1px solid #1f2937", background: "#111827", color: "white", fontSize: 24, cursor: "pointer", boxShadow: "0 8px 20px rgba(0, 0, 0, 0.2)" }}
    >
      📍
    </button>
    {message && <p role="status" style={{ position: "fixed", right: 24, bottom: 88, zIndex: 20, maxWidth: 240, margin: 0, padding: "0.65rem 0.8rem", background: "white", border: "1px solid #d1d5db", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)" }}>{message}</p>}
  </>;
}

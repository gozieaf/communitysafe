"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    watsonAssistantChatOptions?: {
      integrationID: string;
      region: string;
      serviceInstanceID: string;
      onLoad: (instance: { render: () => void }) => void;
    };
  }
}

export function ChatWidget() {
  useEffect(() => {
    const integrationID = process.env.NEXT_PUBLIC_WATSONX_INTEGRATION_ID;
    const region = process.env.NEXT_PUBLIC_WATSONX_REGION;
    const serviceInstanceID = process.env.NEXT_PUBLIC_WATSONX_SERVICE_INSTANCE_ID;
    if (!integrationID || !region || !serviceInstanceID || document.getElementById("watsonx-web-chat")) return;
    window.watsonAssistantChatOptions = { integrationID, region, serviceInstanceID, onLoad: (instance) => instance.render() };
    const script = document.createElement("script");
    script.id = "watsonx-web-chat";
    script.src = "https://web-chat.global.assistant.watson.appdomain.cloud/versions/latest/WatsonAssistantChatEntry.js";
    document.head.appendChild(script);
    return () => { script.remove(); delete window.watsonAssistantChatOptions; };
  }, []);
  return null;
}

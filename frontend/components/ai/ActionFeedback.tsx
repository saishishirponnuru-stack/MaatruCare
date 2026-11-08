"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/components/ui/ProductUI";

export default function ActionFeedback({ feedback }: { feedback?: { text: string; error: boolean } }) {
  const target = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (feedback?.error && feedback.text) target.current?.scrollIntoView({block: "nearest", behavior: "instant"});
  }, [feedback?.error, feedback?.text]);
  return <div ref={target}><Message error={feedback?.error}>{feedback?.text}</Message></div>;
}

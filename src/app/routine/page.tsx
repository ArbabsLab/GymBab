"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUser } from "@clerk/nextjs";
import { Input } from "@/components/ui/input";

const Routine = () => {
  const { user } = useUser();
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<any[]>([{role: "assistant", content: "Hello, before I create your personalized fitness plan, I want to know a few things about you! Ready?"}]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const fieldsToCollect = [
    { key: "age", question: "First, how old are you?" },
    { key: "height", question: "Thank you! Next, how tall are you? (in ft/in)" },
    { key: "weight", question: "What's your weight? (in lbs)" },
    { key: "injuries", question: "Do you have any injuries or physical limitations?" },
    { key: "workout_days", question: "How many days per week can you work out?" },
    { key: "fitness_goal", question: "What's your fitness goal? (e.g. build muscle, lose fat, build endurance)" },
    { key: "fitness_level", question: "What's your current fitness level? (beginner, intermediate, advanced)" },
    { key: "dietary_restrictions", question: "Any dietary restrictions? (e.g. vegan, lactose intolerant, none)" }
  ];

  const [userData, setUserData] = useState({age: "21", weight: "150", injuries: "none", workout_days: "3", fitness_goal: "build muscle", fitness_level: "beginner"});
  const [currentFieldIndex, setCurrentFieldIndex] = useState(0);

  const addMessage = (msg: any) => {
    setMessages((prev) => [...prev, msg]);
  };

  const generatePlan = async (data: any) => {
  try {
    const res = await fetch("/generate-routine", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: user?.id,
        age: data.age,
        height: data.height,
        weight: data.weight,
        injuries: data.injuries,
        workout_days: data.workout_days.split(",").map((day: string) => day.trim()),
        fitness_goal: data.fitness_goal,
        fitness_level: data.fitness_level,
        dietary_restrictions: data.dietary_restrictions,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Failed to generate plan");
    }

    const result = await res.json();
    return result.data; 
  } catch (err) {
    console.error("generatePlan error:", err);
    throw err;
  }
};

  const sendMessage = async () => {
    if (!input.trim()) return;

    const currentField = fieldsToCollect[currentFieldIndex];
    const userReply = input.trim();

    
    addMessage({ role: "user", content: userReply });
    setInput("");
    setIsTyping(true);

    
    const updatedData = {
      ...userData,
      [currentField.key]: userReply,
    };
    setUserData(updatedData);

    
    if (currentFieldIndex + 1 < fieldsToCollect.length) {
      const Field = fieldsToCollect[currentFieldIndex];
      setTimeout(() => {
        addMessage({
          role: "assistant",
          content: Field.question,
        });
        setCurrentFieldIndex((i) => i + 1);
        setIsTyping(false);
      }, 1000);
    } else {
      
      setTimeout(() => {
        addMessage({
          role: "assistant",
          content: "Thanks! I'm generating your personalized fitness & diet plan now...",
        });
        setIsTyping(false);

      // send stuff to backend and generate plans
      console.log(userData);
      generatePlan(userData);
    }, 1000);
  }
  };


  useEffect(() => {
    messageContainerRef.current?.scrollTo({
      top: messageContainerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <div className="flex flex-col min-h-screen text-foreground pt-24 pb-6">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-mono">
            <span>Generate Your </span>
            <span className="text-primary uppercase">Fitness Program</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Chat with Gymbab AI to create your personalized plan
          </p>
        </div>

        {/* Chat Container */}
        
        <Card className="bg-card/90 backdrop-blur-sm border border-border p-4 h-[500px] flex flex-col">
          <div
            ref={messageContainerRef}
            className="flex-1 overflow-y-auto pr-1 space-y-4"
          >
            {messages.map((msg, i) => (
              <div key={i} className="text-sm">
                <span
                  className={`font-semibold ${
                    msg.role === "assistant" ? "text-primary" : "text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? "Gymbab AI" : "You"}:
                </span>{" "}
                {msg.content}
              </div>
            ))}
            {isTyping && (
              <div className="text-sm text-muted-foreground">Gymbab AI is typing...</div>
            )}
          </div>

          {/* Input Area */}
          <div className="flex gap-2 mt-4">
            <Input
              placeholder="Ask something like 'Make me a gym plan for 3 days'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!input.trim()}>
              Send
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Routine;

import { createDeepAgent } from "deepagents";

const agent = createDeepAgent({
  model: "anthropic:claude-sonnet-4-6",
  systemPrompt: "Research the question, check your reasoning, and answer clearly.",
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "What makes a long-running agent reliable?",
    },
  ],
});

console.log(result.messages.at(-1)?.content);

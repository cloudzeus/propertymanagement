import { describe, it, expect } from "vitest";
import { buildRequestBody } from "./agent";

describe("buildRequestBody", () => {
  it("prepends the system message and maps tools to OpenAI function format", () => {
    const body = buildRequestBody({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
      tools: [{ name: "t", description: "d", parameters: { type: "object", properties: {} } }],
      model: "deepseek-chat",
    });
    expect(body.model).toBe("deepseek-chat");
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(body.tools![0]).toEqual({ type: "function", function: { name: "t", description: "d", parameters: { type: "object", properties: {} } } });
  });

  it("omits tools when none provided", () => {
    const body = buildRequestBody({ system: "s", messages: [], model: "deepseek-chat" });
    expect(body.tools).toBeUndefined();
  });
});

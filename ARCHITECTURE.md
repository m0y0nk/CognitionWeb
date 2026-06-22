# CognitionWeb — Architecture Document

## Overview

CognitionWeb is an AI-driven browser automation agent that combines LLM reasoning with Playwright browser control to autonomously interact with web pages. This document details the architectural decisions, component design, and data flow.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                         Entry Point                            │
│                        (src/index.ts)                          │
│  • Load config  • Create agent  • Handle shutdown              │
└──────────────────────────┬─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│                       Agent Core                               │
│                      (src/agent.ts)                            │
│                                                                │
│   ┌────────────────── ReAct Loop ───────────────────┐          │
│   │                                                 │          │
│   │  1. OBSERVE   ─── screenshot + page info        │          │
│   │       │                                         │          │
│   │       ▼                                         │          │
│   │  2. REASON    ─── send to LLM with tools        │          │
│   │       │                                         │          │
│   │       ▼                                         │          │
│   │  3. ACT       ─── execute tool call             │          │
│   │       │                                         │          │
│   │       ▼                                         │          │
│   │  4. CHECK     ─── task complete? If not, → 1    │          │
│   │                                                 │          │
│   └─────────────────────────────────────────────────┘          │
│                                                                │
│   Conversation History: Message[] (system/user/assistant/tool) │
│   Step Log: AgentStep[] (iteration, tool, args, result)        │
└────────────┬──────────────────────┬────────────────────────────┘
             │                      │
             ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────────────┐
│   LLM Provider       │  │         Tool System                  │
│ (src/providers/)     │  │       (src/tools/)                   │
│                      │  │                                      │
│ ┌──────────────────┐ │  │  ┌──────────┐  ┌──────────────────┐  │
│ │   LLMProvider    │ │  │  │ Registry │  │   Tool Interface │  │
│ │   (interface)    │ │  │  │ (index)  │  │   (each tool)    │  │
│ │                  │ │  │  └──────────┘  └──────────────────┘  │
│ │ • chat()         │ │  │                                      │
│ │ • supportsVision │ │  │  Tools:                              │
│ └──────────────────┘ │  │  • take_screenshot                   │
│                      │  │  • open_browser                      │
│ Implementations:     │  │  • navigate_to_url                   │
│ • GeminiProvider     │  │  • click_on_screen                   │
│ • GroqProvider       │  │  • send_keys                         │
│ • OpenAIProvider     │  │  • scroll                            │
│                      │  │  • double_click                      │
│ Factory:             │  │  • get_page_info                     │
│ • createProvider()   │  │                                      │
└──────────────────────┘  └──────────────────────┬───────────────┘
                                                 │
                                                 ▼
                          ┌──────────────────────────────────────┐
                          │        Browser Manager               │
                          │       (src/browser.ts)               │
                          │                                      │
                          │  • launch() → Page                   │
                          │  • getPage() → Page                  │
                          │  • close()                           │
                          │                                      │
                          │  Playwright: chromium/firefox/webkit │
                          └──────────────────────────────────────┘
```

---

## Component Design

### 1. Configuration (`src/config.ts`)

Loads environment variables with validation:
- Validates `LLM_PROVIDER` is one of: `gemini`, `groq`, `openai`
- Validates the corresponding API key is present and not a placeholder
- Provides clear error messages with setup instructions
- Defaults: `gemini` provider, `chromium` browser, headful mode, 25 max iterations

### 2. Logger (`src/logger.ts`)

Dual-transport Winston logger:
- **Console**: Colorized, human-readable with contextual metadata (tool name, iteration count)
- **File** (`logs/agent.log`): JSON-formatted with timestamps for post-run analysis
- **Error file** (`logs/error.log`): Error-only log for quick debugging
- Auto-creates the `logs/` directory on startup

### 3. Browser Manager (`src/browser.ts`)

Singleton pattern managing the Playwright browser lifecycle:
- Supports `chromium`, `firefox`, and `webkit` browser engines
- Sets consistent viewport (1280×800) for reproducible screenshots
- Custom user agent to avoid bot detection
- Safe cleanup — `close()` is idempotent and catches internal errors

### 4. Tool System (`src/tools/`)

Each tool is a self-contained module implementing the `Tool` interface:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: {...}; required: string[] };
  execute(args, page): Promise<ToolResult>;
}
```

**Design principles:**
- **Self-describing**: Each tool carries its own name, description, and parameter schema
- **Independent**: Tools don't depend on each other
- **Error-safe**: Each tool wraps its logic in try/catch and returns structured results
- **Logged**: Every tool execution is logged with context

**Tool Registry** (`src/tools/index.ts`):
- Aggregates all tools into a single array
- Generates tool definitions for LLM function calling
- Provides `executeTool(name, args, page)` dispatcher with unknown-tool handling

### 5. LLM Provider Abstraction (`src/providers/`)

**Strategy Pattern** — swap providers via configuration:

```typescript
interface LLMProvider {
  name: string;
  supportsVision: boolean;
  chat(messages, tools): Promise<LLMResponse>;
}
```

Each provider:
1. Converts our unified `ChatMessage[]` to the provider's native format
2. Converts our `ToolDefinition[]` to the provider's function-calling format
3. Sends the request and normalizes the response back to `LLMResponse`

**Provider-specific handling:**
- **Gemini**: Uses `Content[]` with `Part[]`, system instructions as separate param, `functionResponse` for tool results
- **Groq**: OpenAI-compatible format, no vision — ignores image data
- **OpenAI**: Native format with `ChatCompletionContentPart[]` for multimodal messages

### 6. Agent Core (`src/agent.ts`)

The brain — implements the ReAct loop:

1. **Initialize**: Launch browser, navigate to target URL, set up conversation
2. **Loop** (up to `MAX_ITERATIONS`):
   - Send conversation history + tool definitions to LLM
   - If LLM returns tool calls → execute each one, add results to history
   - If LLM returns final answer (no tool calls) → return result
   - If LLM returns text + no done signal → prompt to continue
   - If error occurs → add error context for LLM recovery
3. **Cleanup**: Close browser regardless of outcome

**Vision handling**: The agent checks `provider.supportsVision`. If true, screenshot base64 data is sent as an image part. If false (Groq), the agent relies on `get_page_info` text data only.

---

## Data Flow

### Typical Form-Filling Flow

```
1. Agent starts → launches browser → navigates to target URL

2. Agent calls get_page_info
   → Extracts form fields: [{label: "Username", selector: "#username", ...}]
   → Sends to LLM: "Page has 1 form field: Username, 1 button: Submit"

3. LLM reasons: "I need to fill the Username field"
   → Returns tool call: send_keys({text: "Mayank Soni", selector: "#username"})

4. Agent executes send_keys → fills the field
   → Reports back: "Typed 'Mayank Soni' into #username"

5. LLM reasons: "Username filled. Now I should submit."
   → Returns tool call: click_on_screen({x: 640, y: 500})

6. Agent clicks submit button
   → Reports back: "Clicked on <button> 'Submit'"

7. LLM reasons: "Form submitted. Task complete."
   → Returns final answer: "Successfully filled and submitted the form."

8. Agent closes browser → prints summary
```

---

## Error Handling Strategy

### Layer 1: Tool-Level
Each tool catches its own exceptions and returns structured `ToolResult`:
```typescript
{ success: false, message: "Element not found", error: "TimeoutError" }
```

### Layer 2: Agent-Level
The agent catches tool errors and feeds them back to the LLM:
```
"An error occurred: Element not found. Please try a different approach."
```
This allows the LLM to self-recover (e.g., scroll to find the element, use a different selector).

### Layer 3: Provider-Level
API errors (rate limits, network issues) are caught and re-thrown with context.

### Layer 4: Process-Level
`SIGINT`/`SIGTERM` handlers ensure the browser is always closed cleanly.

---

## Future Improvements

1. **Multi-step planning**: Use a planning phase before execution for complex tasks
2. **Session persistence**: Save/restore browser sessions across runs
3. **Parallel tool execution**: Execute independent tool calls concurrently
4. **Accessibility tree**: Use a11y tree for more reliable element identification
5. **Recording**: Record browser sessions as video for debugging
6. **Retry logic**: Automatic retry with exponential backoff for flaky operations
7. **Human-in-the-loop**: Pause for confirmation on high-stakes actions
8. **More providers**: Add support for Anthropic Claude, local Ollama models

---

## Technology Choices Rationale

| Technology | Alternatives Considered | Why This Choice |
|:---|:---|:---|
| TypeScript | Python | Better Playwright DX, type safety, all SDKs available |
| Playwright | Puppeteer, Selenium | Auto-waiting, multi-browser, modern API |
| ReAct loop | Plan-and-execute | Simpler, proven for tool-using agents |
| Winston | Pino, console.log | Structured logging, multiple transports |
| Strategy pattern | Adapter, factory-only | Clean swapping, type-safe interface |
| dotenv | Config files, CLI args | Standard, simple, works with .gitignore |

# CognitionWeb — Intelligent Browser Automation Agent

An AI-powered browser automation agent that autonomously navigates web pages, identifies form elements, and performs interactions using LLM-driven decision making with Playwright.

![Node.js](https://img.shields.io/badge/Node.js-22+-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Playwright](https://img.shields.io/badge/Playwright-1.49-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

## 🎯 What It Does

CognitionWeb is a mini browser automation agent (inspired by [Browser Use](https://github.com/browser-use/browser-use)) that:

1. **Opens a browser** and navigates to a target URL
2. **Analyzes the page** using vision (screenshots) and DOM parsing
3. **Makes intelligent decisions** about what actions to take using an LLM
4. **Interacts with elements** — clicks buttons, fills forms, scrolls pages
5. **Iterates autonomously** until the task is complete

### Target Task

The agent navigates to [shadcn/ui React Hook Form demo](https://ui.shadcn.com/docs/forms/react-hook-form) and:
- Identifies the form fields (Username/Name, Bio/Description)
- Fills in the fields with specified values
- Submits the form

---

## 🏗️ Architecture

The agent uses a **ReAct (Reasoning + Action)** loop:

```
┌─────────────────────────────────────────────────┐
│                  Agent Loop                      │
│                                                  │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   │
│   │ Observe  │──▶│  Reason  │──▶│   Act    │   │
│   │(screenshot│   │  (LLM)   │   │ (tools)  │   │
│   │+ page    │   │          │   │          │   │
│   │  info)   │   └──────────┘   └──────────┘   │
│   └──────────┘         │              │         │
│        ▲               │              │         │
│        └───────────────┴──────────────┘         │
│                    Repeat                        │
└─────────────────────────────────────────────────┘
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation.

---

## 🔌 Supported LLM Providers

The agent supports **3 LLM providers** via a pluggable abstraction layer. Switch providers by changing one environment variable — no code changes needed.

| Provider | Model | Vision | Function Calling | Cost (Input) | Default |
|:---|:---|:---:|:---:|:---|:---:|
| **Google Gemini** | `gemini-2.0-flash` | ✅ | ✅ | ~$0.10/1M tokens | ✅ |
| **Groq** | `llama-3.3-70b-versatile` | ❌ | ✅ | ~$0.59/1M tokens | |
| **OpenAI** | `gpt-4o-mini` | ✅ | ✅ | ~$0.15/1M tokens | |

---

## 🛠️ Available Tools

The agent has access to these modular tools:

| Tool | Description |
|:---|:---|
| `take_screenshot` | Capture viewport or full-page screenshot (used for LLM vision) |
| `open_browser` | Initialize and verify browser instance |
| `navigate_to_url` | Navigate to a URL and wait for page load |
| `click_on_screen(x, y)` | Click at specific coordinates with element identification |
| `send_keys` | Type text into focused element or CSS selector target |
| `scroll` | Scroll page in any direction by pixel amount |
| `double_click` | Double-click at coordinates |
| `get_page_info` | Extract form fields, buttons, and text from the DOM |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18
- An API key for at least one LLM provider (Gemini recommended — has free tier)

### Installation

```bash
# Clone the repository
git clone https://github.com/m0y0nk/CognitionWeb.git
cd CognitionWeb

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Set up configuration
cp .env.example .env
```

### Configuration

Edit `.env` with your API key:

```bash
# Choose your provider (gemini is cheapest)
LLM_PROVIDER=gemini

# Set the API key for your chosen provider
GEMINI_API_KEY=your_key_here

# Browser settings
HEADLESS=false          # Set to true for headless mode
BROWSER_TYPE=chromium   # chromium, firefox, or webkit

# Agent settings
TARGET_URL=https://ui.shadcn.com/docs/forms/react-hook-form
MAX_ITERATIONS=25
```

### Run the Agent

```bash
# Development mode (with tsx — faster, no build step)
npm run dev

# Or build and run
npm run build
npm start

# Custom task via CLI argument
npm start "Navigate to google.com and search for 'AI automation'"
```

---

## 📁 Project Structure

```
CognitionWeb/
├── .env.example          # Configuration template
├── .gitignore            # Git ignore rules
├── ARCHITECTURE.md       # Detailed architecture documentation
├── README.md             # This file
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── src/
    ├── index.ts           # Entry point — CLI, config display, graceful shutdown
    ├── agent.ts           # Core agent — ReAct loop with LLM orchestration
    ├── browser.ts         # Playwright BrowserManager (launch/page/close)
    ├── config.ts          # Environment config loader with validation
    ├── logger.ts          # Winston logger (console + JSON file)
    ├── types.ts           # TypeScript type definitions
    ├── providers/         # Swappable LLM provider backends
    │   ├── index.ts       # Provider factory (createProvider)
    │   ├── base.ts        # LLMProvider interface
    │   ├── gemini.ts      # Google Gemini (default)
    │   ├── groq.ts        # Groq / Llama 3.3
    │   └── openai.ts      # OpenAI GPT-4o-mini
    └── tools/             # Modular browser automation tools
        ├── index.ts       # Tool registry and dispatcher
        ├── take_screenshot.ts
        ├── open_browser.ts
        ├── navigate_to_url.ts
        ├── click_on_screen.ts
        ├── send_keys.ts
        ├── scroll.ts
        ├── double_click.ts
        └── get_page_info.ts
```

---

## 📊 Output

The agent produces:

- **`screenshots/`** — Step-by-step screenshots captured during execution
- **`logs/agent.log`** — Structured JSON log of all actions and decisions
- **`logs/error.log`** — Error-only log for debugging
- **Console output** — Colorized real-time progress

---

## ⚙️ Design Decisions

| Decision | Choice | Why |
|:---|:---|:---|
| Language | TypeScript | Type safety + SDK support for all providers |
| Browser | Playwright | Auto-waiting, multi-browser, industry standard |
| Default LLM | Gemini Flash | Cheapest with vision + function calling |
| Architecture | ReAct loop | Proven pattern for autonomous tool-using agents |
| Provider pattern | Strategy | Swap LLM with zero code changes |
| Logging | Winston | Structured, multi-transport, production-ready |

---

## 🧪 Error Handling

The agent handles errors at multiple levels:

1. **Tool level** — Each tool catches and reports its own errors
2. **Agent level** — Failed tool calls are fed back to the LLM for recovery
3. **Provider level** — API errors are caught with descriptive messages
4. **Config level** — Missing API keys produce clear setup instructions
5. **Process level** — SIGINT/SIGTERM trigger graceful browser cleanup

---

## 📝 License

MIT

---

## 👤 Author

**Mayank Soni** — [GitHub](https://github.com/m0y0nk)

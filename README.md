# Memory Test Chat App

A one-page React chat application that uses OpenAI's API with function calling (agent-like behavior) to test:
- Reading a sample business profile
- Accessing long-term memory
- Creating HTML documents
- Editing HTML documents

## Features

- 🤖 AI-powered chat interface using OpenAI GPT-4
- 💾 Long-term memory storage (persists across sessions)
- 📄 HTML document creation and editing
- 🏢 Business profile integration
- 🎨 Modern, responsive UI

## Prerequisites

- Node.js 18+ and npm
- OpenAI API key

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Start the development server:**
   In one terminal, start the backend server:
   ```bash
   npm run server
   ```

   In another terminal, start the frontend:
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5173` (or the port shown in your terminal)

## Project Structure

```
memorytest/
├── server/
│   ├── index.ts          # Express server with API endpoints
│   ├── agent.ts          # OpenAI agent with tools
│   └── storage.ts        # Memory and HTML document storage
├── src/
│   ├── components/
│   │   ├── ChatInterface.tsx  # Main chat UI component
│   │   └── ChatInterface.css
│   ├── App.tsx           # Main app component
│   ├── App.css
│   ├── main.tsx          # React entry point
│   └── types/            # TypeScript type definitions
├── data/
│   ├── business-profile.json  # Sample business profile
│   └── storage/          # Generated storage files
└── package.json
```

## Available Tools

The agent has access to the following tools:

1. **read_business_profile** - Reads the sample business profile
2. **read_long_term_memory** - Retrieves data from memory by key
3. **write_long_term_memory** - Stores data in memory
4. **create_html_document** - Creates a new HTML document
5. **edit_html_document** - Edits an existing HTML document by ID
6. **list_html_documents** - Lists all HTML documents

## Usage Examples

- "What is the business profile?"
- "Remember that my favorite color is blue"
- "What did I tell you about my favorite color?"
- "Create an HTML document with a simple webpage"
- "Edit the HTML document with ID doc-1234567890"
- "List all HTML documents"

## Storage

- Memory data is stored in `data/storage/memory.json`
- HTML documents are stored in `data/storage/html-docs.json`

Both are created automatically on first use.

## Development

- Frontend runs on `http://localhost:5173` (Vite default)
- Backend API runs on `http://localhost:3001`

The frontend is configured to proxy `/api` requests to the backend server.

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.


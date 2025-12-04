import OpenAI from 'openai';
import { readFileSync } from 'fs';
import { join } from 'path';
// @ts-ignore - diff-match-patch doesn't have types
import DiffMatchPatch from 'diff-match-patch';
import { parse } from 'node-html-parser';
import { memoryStorage, htmlDocumentStorage } from './storage';
import type { BusinessProfile } from '../src/types';

// Load business profile
const businessProfilePath = join(process.cwd(), 'data', 'business-profile.json');
const businessProfile: BusinessProfile = JSON.parse(
  readFileSync(businessProfilePath, 'utf-8')
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Pricing (prices per 1M tokens)
const PRICING = {
  'gpt-4o-mini': {
    input: 0.15,   // $0.15 per 1M tokens (very cheap!)
    output: 0.60,  // $0.60 per 1M tokens
  },
  'gpt-3.5-turbo': {
    input: 0.50,   // $0.50 per 1M tokens
    output: 1.50,  // $1.50 per 1M tokens
  },
  'gpt-4-turbo-preview': {
    input: 10.00,  // $10 per 1M tokens
    output: 30.00, // $30 per 1M tokens
  },
  'gpt-4-turbo': {
    input: 10.00,
    output: 30.00,
  },
  'gpt-4': {
    input: 30.00,
    output: 60.00,
  },
};

// Using GPT-4o-mini: much cheaper, faster, and excellent at tool calling
const MODEL_NAME = 'gpt-4o-mini';

// HTML Editor utilities using diff-match-patch
function generatePatch(original: string, modified: string): string {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(original, modified);
  dmp.diff_cleanupSemantic(diffs);
  const patches = dmp.patch_make(original, diffs);
  return dmp.patch_toText(patches);
}

function applyPatch(original: string, patchText: string): string {
  const dmp = new DiffMatchPatch();
  const patches = dmp.patch_fromText(patchText);
  const [result, success] = dmp.patch_apply(patches, original);
  // Check if all patches applied successfully
  const allSuccess = success.every((s: boolean) => s);
  if (!allSuccess) {
    console.warn('Some patches failed to apply');
  }
  return result;
}

function validateHtml(htmlString: string): { valid: boolean; error?: Error } {
  try {
    parse(htmlString);
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err as Error };
  }
}

async function editHtmlWithLLM(
  originalHtml: string,
  instruction: string
): Promise<{ updatedHtml: string; patch?: string }> {
  // Call LLM to get updated HTML
  const editResponse = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages: [
      {
        role: 'system',
        content: `You are an HTML editor. Make ONLY the specific change requested in the instruction. Preserve all formatting, structure, and style. Return ONLY the complete HTML code, no markdown, no explanations.`,
      },
      {
        role: 'user',
        content: `HTML:\n${originalHtml}\n\n\nInstruction: ${instruction}\n\nMake ONLY the requested change. Return the complete HTML.`,
      },
    ],
    temperature: 0.0,
    max_tokens: 4096, // Maximum completion tokens for GPT-4 Turbo
  });

  let edited = editResponse.choices[0].message.content || '';
  // Clean up markdown if present
  edited = edited.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '').trim();

  // Generate patch
  const patch = generatePatch(originalHtml, edited);

  // Apply patch to original to get final HTML (this preserves formatting better)
  const finalHtml = applyPatch(originalHtml, patch);

  // Validate HTML
  const validation = validateHtml(finalHtml);
  if (!validation.valid) {
    // If validation fails, try using the edited HTML directly
    console.warn('HTML validation failed, using edited HTML directly:', validation.error?.message);
    const directValidation = validateHtml(edited);
    if (directValidation.valid) {
      return { updatedHtml: edited, patch };
    }
    throw new Error(
      `HTML validation failed: ${validation.error?.message}`
    );
  }

  return { updatedHtml: finalHtml, patch };
}

// Define tools using OpenAI function calling format
export const tools = [
  {
    type: 'function' as const,
    function: {
      name: 'read_business_profile',
      description: 'Reads the sample business profile that should always be loaded.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_long_term_memory',
      description: 'Reads data from long-term memory storage using a key.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'The key to retrieve data from long-term memory.',
          },
        },
        required: ['key'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_long_term_memory',
      description: 'Writes data to long-term memory storage.',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'The key to store data in long-term memory.',
          },
          value: {
            type: 'string',
            description: 'The value to store.',
          },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_html_document',
      description: 'Creates a new HTML document.',
      parameters: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The HTML content of the document.',
          },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'edit_html_document',
      description: 'Edits an existing HTML document by ID. You provide the document ID and a description of what change to make. The tool will fetch the current document, use an LLM to make only the requested change, and return the complete updated HTML document.',
      parameters: {
        type: 'object',
        properties: {
          documentId: {
            type: 'string',
            description: 'The ID of the HTML document to edit.',
          },
          editDescription: {
            type: 'string',
            description: 'A clear description of what change to make to the document (e.g., "change the temperature to 75°F" or "add a humidity field showing 60%"). Only make this specific change, keep everything else the same.',
          },
        },
        required: ['documentId', 'editDescription'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_html_documents',
      description: 'Lists all HTML documents with their IDs.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_html_with_llm',
      description: 'Uses an LLM to generate HTML content from a description. This is useful when you need to create well-formatted HTML documents. The tool will create the document automatically after generation.',
      parameters: {
        type: 'object',
        properties: {
          description: {
            type: 'string',
            description: 'A detailed description of what HTML content to generate (e.g., "a weather report card for San Francisco showing temperature, condition, and location")',
          },
        },
        required: ['description'],
      },
    },
  },
];

// Tool execution functions
export async function executeTool(
  toolName: string,
  args: any
): Promise<string> {
  switch (toolName) {
    case 'read_business_profile':
      return JSON.stringify(businessProfile, null, 2);

    case 'read_long_term_memory':
      const memoryValue = memoryStorage.read(args.key);
      if (memoryValue) {
        return JSON.stringify({ key: args.key, value: memoryValue });
      }
      
      // Return a fake long-term memory story when no specific memory is found
      const fakeMemoryStory = `This is long-term memory for TechCorp Solutions. 

TechCorp Solutions was founded in 2020 with a vision to revolutionize technology consulting. Over the years, the company has grown from a small startup in San Francisco to a thriving organization with 150 employees. 

Key milestones in the company's history:
- 2020: Company founded by a team of former Silicon Valley engineers
- 2021: Secured first major client, Fortune 500 Financial Services
- 2022: Expanded services to include AI and Machine Learning integration
- 2023: Opened new headquarters in San Francisco and reached 100 employees
- 2024: Launched innovative cloud infrastructure solutions and reached 150 employees

The company culture is built on four core values: Innovation, Customer-Centricity, Integrity, and Excellence. These values guide every project and client interaction.

TechCorp Solutions has successfully completed over 500 projects, helping mid-market companies transform their technology infrastructure. The company is known for its expertise in cloud migration, AI integration, and digital transformation.

This long-term memory contains the foundational knowledge about TechCorp Solutions that persists across all conversations. When you need to reference company history, values, or key information, this memory provides the context.`;
      
      return JSON.stringify({ 
        key: args.key, 
        value: fakeMemoryStory,
        message: 'Long-term memory accessed successfully. This contains foundational information about TechCorp Solutions.'
      });

    case 'write_long_term_memory':
      memoryStorage.write(args.key, args.value);
      return JSON.stringify({
        success: true,
        message: `Stored value for key: ${args.key}`,
      });

    case 'create_html_document':
      const newDoc = htmlDocumentStorage.create(args.content);
      return JSON.stringify({
        success: true,
        document: newDoc,
        message: `Created HTML document with ID: ${newDoc.id}`,
      });

    case 'edit_html_document':
      // First, get the existing document
      const existingDoc = htmlDocumentStorage.get(args.documentId);
      if (!existingDoc) {
        return JSON.stringify({
          success: false,
          message: `Document with ID ${args.documentId} not found`,
        });
      }

      try {
        // Use diff-match-patch approach for better formatting preservation
        const { updatedHtml } = await editHtmlWithLLM(
          existingDoc.content,
          args.editDescription
        );

        // Update the document with the edited HTML
        const updatedDoc = htmlDocumentStorage.update(args.documentId, updatedHtml);
        if (!updatedDoc) {
          return JSON.stringify({
            success: false,
            message: `Failed to update document with ID ${args.documentId}`,
          });
        }

        return JSON.stringify({
          success: true,
          document: updatedDoc,
          message: `Updated HTML document with ID: ${args.documentId}. Made the requested change: ${args.editDescription}`,
        });
      } catch (error: any) {
        return JSON.stringify({
          success: false,
          message: `Error editing document: ${error.message}`,
        });
      }

    case 'list_html_documents':
      const docs = htmlDocumentStorage.getAll();
      return JSON.stringify({
        documents: docs.map(doc => ({
          id: doc.id,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        })),
      });

    case 'generate_html_with_llm':
      // Use LLM to generate HTML from description
      // Note: This makes an additional API call, which will be tracked separately
      // The cost for this call is not included in the main conversation cost tracking
      // but the generated HTML will be properly formatted
      const htmlGenerationResponse = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          {
            role: 'system',
            content: 'You are an expert HTML developer. Generate clean, modern, and well-structured HTML5 documents. Always include proper DOCTYPE, head, and body tags. Use modern CSS for styling. Make the HTML visually appealing and responsive. Return ONLY the HTML code, no markdown formatting, no code blocks, no explanations - just the raw HTML.',
          },
          {
            role: 'user',
            content: `Generate a complete, standalone HTML document for: ${args.description}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 4096, // Maximum completion tokens for GPT-4 Turbo
      });

      let generatedHtml = htmlGenerationResponse.choices[0].message.content || '';
      
      // Clean up the HTML - remove markdown code blocks if present
      generatedHtml = generatedHtml.replace(/^```html\n?/i, '').replace(/^```\n?/i, '').replace(/\n?```$/i, '').trim();
      
      // Create the document with the generated HTML
      const generatedDoc = htmlDocumentStorage.create(generatedHtml);
      
      return JSON.stringify({
        success: true,
        document: generatedDoc,
        message: `Generated and created HTML document with ID: ${generatedDoc.id}`,
      });

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// Agent system instruction
const systemInstruction = `You are a helpful business assistant that works with TechCorp Solutions.

You should:
1. Always read the business profile when starting a conversation
2. Use long-term memory to remember important information across conversations
3. Help create and edit HTML documents as needed
4. Be conversational and helpful

The business profile contains information about TechCorp Solutions. Use it to answer questions about the company.`;

// Individual call cost
export interface CallCost {
  callNumber: number;
  promptTokens: number;
  completionTokens: number;
  cost: number;
}

// Cost tracking interface
export interface CostInfo {
  totalCost: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  calls: number;
  callCosts: CallCost[];
}

// Run agent with message history
export async function runAgent(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ message: string; cost: CostInfo; documentId?: string }> {
  // Check if this is the first message in a new conversation
  const isNewConversation = messages.length === 1 && messages[0].role === 'user';
  
  // Prepend system instruction
  const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemInstruction },
  ];

  // Automatically read business profile using the tool on first user message
  if (isNewConversation) {
    // Automatically inject tool call to read business profile
    const profileResult = await executeTool('read_business_profile', {});
    
    conversationMessages.push({
      role: 'assistant',
      content: null,
      tool_calls: [{
        id: 'call_init_business_profile',
        type: 'function',
        function: {
          name: 'read_business_profile',
          arguments: '{}',
        },
      }],
    } as any);
    
    conversationMessages.push({
      role: 'tool',
      tool_call_id: 'call_init_business_profile',
      content: profileResult,
    });
  }

  // Add user messages
  conversationMessages.push(...messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  })));

  // Initialize cost tracking
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let apiCalls = 0;
  const callCosts: CallCost[] = [];
  const modelPricing = PRICING[MODEL_NAME as keyof typeof PRICING] || PRICING['gpt-4o-mini'];

  // Helper function to calculate and track individual call costs
  const trackCallCost = (usage: OpenAI.Completions.CompletionUsage | null | undefined, callNumber: number) => {
    if (usage) {
      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const inputCost = (promptTokens / 1_000_000) * modelPricing.input;
      const outputCost = (completionTokens / 1_000_000) * modelPricing.output;
      const callCost = inputCost + outputCost;

      totalPromptTokens += promptTokens;
      totalCompletionTokens += completionTokens;

      callCosts.push({
        callNumber,
        promptTokens,
        completionTokens,
        cost: parseFloat(callCost.toFixed(6)),
      });
    }
  };

  let response = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages: conversationMessages,
    tools: tools as any,
    tool_choice: 'auto',
    max_tokens: 4096, // Maximum completion tokens for GPT-4 Turbo
  });

  apiCalls++;
  trackCallCost(response.usage, apiCalls);

  let assistantMessage = response.choices[0].message;
  const messagesToSend: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...conversationMessages,
    assistantMessage,
  ];

  // Track document IDs from tool calls
  let documentId: string | undefined;

  // Handle tool calls
  while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const toolCallResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments);
      const result = await executeTool(toolName, args);
      
      // Extract document ID from create/edit/generate operations
      if (toolName === 'create_html_document' || toolName === 'edit_html_document' || toolName === 'generate_html_with_llm') {
        try {
          const resultObj = JSON.parse(result);
          if (resultObj.document && resultObj.document.id) {
            documentId = resultObj.document.id;
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      toolCallResults.push({
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    messagesToSend.push(...toolCallResults);

    // Get next response
    response = await openai.chat.completions.create({
      model: MODEL_NAME,
      messages: messagesToSend,
      tools: tools as any,
      tool_choice: 'auto',
      max_tokens: 4096, // Maximum completion tokens for GPT-4 Turbo
    });

    apiCalls++;
    trackCallCost(response.usage, apiCalls);

    assistantMessage = response.choices[0].message;
    messagesToSend.push(assistantMessage);
  }

  // Calculate total cost (sum of all call costs)
  const totalCost = callCosts.reduce((sum, call) => sum + call.cost, 0);

  const costInfo: CostInfo = {
    totalCost: parseFloat(totalCost.toFixed(6)),
    totalTokens: totalPromptTokens + totalCompletionTokens,
    promptTokens: totalPromptTokens,
    completionTokens: totalCompletionTokens,
    calls: apiCalls,
    callCosts: callCosts,
  };

  return {
    message: assistantMessage.content || 'No response generated',
    cost: costInfo,
    documentId: documentId,
  };
}


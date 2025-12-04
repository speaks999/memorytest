import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { runAgent } from './agent';
import { htmlDocumentStorage } from './storage';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get HTML document by ID
app.get('/api/document/:id', (req, res) => {
  try {
    const { id } = req.params;
    const document = htmlDocumentStorage.get(id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({ document });
  } catch (error: any) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      error: error.message || 'An error occurred fetching the document',
    });
  }
});

// List all HTML documents
app.get('/api/documents', (req, res) => {
  try {
    const documents = htmlDocumentStorage.getAll();
    res.json({ documents });
  } catch (error: any) {
    console.error('Error listing documents:', error);
    res.status(500).json({
      error: error.message || 'An error occurred listing documents',
    });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be an array' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY is not set in environment variables',
      });
    }

    const result = await runAgent(messages);
    
    res.json({
      message: result.message,
      cost: result.cost,
      documentId: result.documentId,
    });
  } catch (error: any) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({
      error: error.message || 'An error occurred processing the chat message',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


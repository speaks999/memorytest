import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { HtmlDocument, MemoryData } from '../src/types';

// In-memory storage (can be replaced with a database)
const storageDir = join(process.cwd(), 'data', 'storage');

// Ensure storage directory exists
if (!existsSync(storageDir)) {
  mkdirSync(storageDir, { recursive: true });
}

const memoryFile = join(storageDir, 'memory.json');
const htmlDocsFile = join(storageDir, 'html-docs.json');

// Initialize memory storage
let memoryData: MemoryData = {};
if (existsSync(memoryFile)) {
  try {
    const data = readFileSync(memoryFile, 'utf-8');
    memoryData = JSON.parse(data);
  } catch (error) {
    console.error('Error loading memory:', error);
    memoryData = {};
  }
}

// Initialize HTML documents storage
let htmlDocuments: HtmlDocument[] = [];
if (existsSync(htmlDocsFile)) {
  try {
    const data = readFileSync(htmlDocsFile, 'utf-8');
    htmlDocuments = JSON.parse(data);
  } catch (error) {
    console.error('Error loading HTML documents:', error);
    htmlDocuments = [];
  }
}

export const memoryStorage = {
  read: (key: string): any => {
    return memoryData[key] || null;
  },
  write: (key: string, value: any): void => {
    memoryData[key] = value;
    writeFileSync(memoryFile, JSON.stringify(memoryData, null, 2));
  },
  getAll: (): MemoryData => {
    return { ...memoryData };
  },
};

export const htmlDocumentStorage = {
  create: (content: string): HtmlDocument => {
    const doc: HtmlDocument = {
      id: `doc-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    htmlDocuments.push(doc);
    writeFileSync(htmlDocsFile, JSON.stringify(htmlDocuments, null, 2));
    return doc;
  },
  get: (id: string): HtmlDocument | null => {
    return htmlDocuments.find(doc => doc.id === id) || null;
  },
  update: (id: string, content: string): HtmlDocument | null => {
    const doc = htmlDocuments.find(d => d.id === id);
    if (!doc) return null;
    doc.content = content;
    doc.updatedAt = new Date().toISOString();
    writeFileSync(htmlDocsFile, JSON.stringify(htmlDocuments, null, 2));
    return doc;
  },
  getAll: (): HtmlDocument[] => {
    return [...htmlDocuments];
  },
};


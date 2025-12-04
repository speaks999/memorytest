import { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import './App.css';

function App() {
  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>Memory Test Chat App</h1>
          <p>Powered by OpenAI Agents SDK</p>
        </header>
        <ChatInterface />
      </div>
    </div>
  );
}

export default App;


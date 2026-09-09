import fetch from 'node-fetch';

class AIService {
  constructor() {
    this.baseURL = 'https://tokenin.my.id/v1';
    this.apiKey = process.env.AI_API_KEY || 'sk-f507f08a0...........................................';
    this.model = 'myt/gemini-3.5-flash-free';
  }

  /**
   * Chat completion with the AI model
   * @param {Array} messages - Array of message objects { role, content }
   * @param {Object} options - Additional options like temperature, max_tokens, etc.
   * @returns {Promise<Object>} - AI response
   */
  async chatCompletion(messages, options = {}) {
    try {
      const { temperature = 0.7, max_tokens = 1024, stream = false } = options;

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature,
          max_tokens,
          stream,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }

  /**
   * Streaming chat completion
   * @param {Array} messages - Array of message objects
   * @param {Function} onChunk - Callback for each chunk
   * @param {Object} options - Additional options
   */
  async streamChatCompletion(messages, onChunk, options = {}) {
    try {
      const { temperature = 0.7, max_tokens = 1024 } = options;

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature,
          max_tokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              onChunk(null, true);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                onChunk(content, false);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming Error:', error);
      throw error;
    }
  }

  /**
   * Get list of available models
   * @returns {Promise<Array>} - List of models
   */
  async getModels() {
    try {
      const response = await fetch(`${this.baseURL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Get Models Error:', error);
      throw error;
    }
  }
}

export default new AIService();
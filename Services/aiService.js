import fetch from 'node-fetch';

class AIService {
  constructor() {
    this.baseURL = process.env.AI_BASE_URL || 'https://tokenin.my.id/v1';
    this.apiKey = process.env.AI_API_KEY;
    this.model = process.env.AI_MODEL || 'myt/gemini-3.5-flash-free';
    
    console.log('🤖 AI Service initialized');
    console.log('📡 Base URL:', this.baseURL);
    console.log('📦 Model:', this.model);
    console.log('🔑 API Key exists:', !!this.apiKey);
  }

  /**
   * Chat completion with the AI model
   */
  async chatCompletion(messages, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('AI_API_KEY is not configured in environment variables');
      }

      const { temperature = 0.7, max_tokens = 1024, stream = false } = options;

      console.log('📤 Sending request to AI API...');
      console.log('📦 Model:', this.model);
      console.log('📦 Messages count:', messages.length);

      const requestBody = {
        model: this.model,
        messages: messages,
        temperature,
        max_tokens,
        stream,
      };

      console.log('📦 Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📥 AI API Response Status:', response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: { message: 'Unknown error' } };
        }
        
        console.error('❌ AI API Error Response:', errorData);
        
        // Handle specific error codes
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your AI_API_KEY.');
        } else if (response.status === 402) {
          throw new Error('Insufficient balance. Please top up your account.');
        } else if (response.status === 404) {
          throw new Error(`Model "${this.model}" not found. Please check available models.`);
        } else if (response.status === 429) {
          throw new Error('Too many requests. Please try again later.');
        }
        
        throw new Error(errorData.error?.message || `API Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ AI API Response received successfully');
      
      return data;
    } catch (error) {
      console.error('❌ AI Service Error:', error);
      throw error;
    }
  }

  /**
   * Streaming chat completion
   */
  async streamChatCompletion(messages, onChunk, options = {}) {
    try {
      if (!this.apiKey) {
        throw new Error('AI_API_KEY is not configured in environment variables');
      }

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
      console.error('❌ Streaming Error:', error);
      throw error;
    }
  }

  /**
   * Get list of available models
   */
  async getModels() {
    try {
      if (!this.apiKey) {
        throw new Error('AI_API_KEY is not configured in environment variables');
      }

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
      console.error('❌ Get Models Error:', error);
      throw error;
    }
  }
}

// Export a singleton instance
const aiService = new AIService();
export default aiService;
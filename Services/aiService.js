// Services/aiService.js
import fetch from 'node-fetch';

class AIService {
  constructor() {
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.apiKey = process.env.GROQ_API_KEY;
    this.model = process.env.AI_MODEL || 'gemma2-9b-it';
    this.timeout = 30000;
    
    console.log('🤖 AI Service initialized (Groq)');
    console.log('📡 Base URL:', this.baseURL);
    console.log('📦 Model:', this.model);
    console.log('🔑 API Key exists:', !!this.apiKey);
  }

  async fetchWithTimeout(url, options, timeout = this.timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async chatCompletion(messages, options = {}) {
    try {
      if (!this.apiKey || this.apiKey.length < 10) {
        console.error('❌ Invalid API Key');
        return this.getFallbackResponse(messages);
      }

      const { temperature = 0.5, max_tokens = 200 } = options;

      const formattedMessages = messages.map(msg => ({
        role: msg.role || 'user',
        content: msg.content || ''
      }));

      const requestBody = {
        model: this.model,
        messages: formattedMessages,
        temperature: temperature,
        max_tokens: Math.min(max_tokens, 2048),
        stream: false,
      };

      console.log('📤 Sending request to Groq API...');
      console.log('📦 Model:', this.model);

      const response = await this.fetchWithTimeout(
        `${this.baseURL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        },
        30000
      );

      console.log('📥 Response Status:', response.status);

      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Failed to parse JSON:', e);
        return this.getFallbackResponse(messages);
      }

      if (!response.ok) {
        console.error('❌ Groq API Error:', data);
        return this.getFallbackResponse(messages);
      }

      console.log('✅ AI Response received successfully');
      return data;
    } catch (error) {
      console.error('❌ AI Service Error:', error);
      return this.getFallbackResponse(messages);
    }
  }

  async streamChatCompletion(messages, onChunk, options = {}) {
    try {
      if (!this.apiKey || this.apiKey.length < 10) {
        console.error('❌ Invalid API Key');
        // Send fallback as stream
        const fallback = this.getFallbackResponse(messages);
        const text = fallback.choices[0].message.content;
        const words = text.split(' ');
        let index = 0;
        
        const interval = setInterval(() => {
          if (index < words.length) {
            onChunk(words[index] + ' ', false);
            index++;
          } else {
            clearInterval(interval);
            onChunk(null, true);
          }
        }, 30);
        return;
      }

      const { temperature = 0.5, max_tokens = 200 } = options;

      const formattedMessages = messages.map(msg => ({
        role: msg.role || 'user',
        content: msg.content || ''
      }));

      const requestBody = {
        model: this.model,
        messages: formattedMessages,
        temperature: temperature,
        max_tokens: Math.min(max_tokens, 2048),
        stream: true,
      };

      console.log('📤 Sending streaming request to Groq API...');

      const response = await this.fetchWithTimeout(
        `${this.baseURL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        },
        60000 // Longer timeout for streaming
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Groq API Error:', errorText);
        // Send fallback as stream
        const fallback = this.getFallbackResponse(messages);
        const text = fallback.choices[0].message.content;
        const words = text.split(' ');
        let index = 0;
        
        const interval = setInterval(() => {
          if (index < words.length) {
            onChunk(words[index] + ' ', false);
            index++;
          } else {
            clearInterval(interval);
            onChunk(null, true);
          }
        }, 30);
        return;
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
      
      onChunk(null, true);
    } catch (error) {
      console.error('❌ Streaming Error:', error);
      // Send fallback as stream on error
      const fallback = this.getFallbackResponse(messages);
      const text = fallback.choices[0].message.content;
      const words = text.split(' ');
      let index = 0;
      
      const interval = setInterval(() => {
        if (index < words.length) {
          onChunk(words[index] + ' ', false);
          index++;
        } else {
          clearInterval(interval);
          onChunk(null, true);
        }
      }, 30);
    }
  }

  async getModels() {
    try {
      if (!this.apiKey || this.apiKey.length < 10) {
        console.error('❌ Invalid API Key');
        return [];
      }

      const response = await this.fetchWithTimeout(
        `${this.baseURL}/models`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        },
        10000
      );

      if (!response.ok) {
        console.error('❌ Failed to fetch models');
        return [];
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('❌ Get Models Error:', error);
      return [];
    }
  }

  getFallbackResponse(messages) {
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    let responseText = "I'm currently experiencing technical difficulties. Here are some helpful resources instead:\n\n";
    
    if (userMessage.toLowerCase().includes('study') || userMessage.toLowerCase().includes('exam')) {
      responseText += "📚 **Study Tips:**\n- Review your course materials regularly\n- Create a study schedule\n- Practice with past exam questions\n- Join study groups with classmates\n\n";
    } else if (userMessage.toLowerCase().includes('gpa')) {
      responseText += "📊 **GPA Tips:**\n- Focus on understanding core concepts\n- Attend all lectures and tutorials\n- Submit assignments on time\n- Use the GPA Calculator tool in this app\n\n";
    } else if (userMessage.toLowerCase().includes('course')) {
      responseText += "📖 **Course Tips:**\n- Check the Courses tab for materials\n- Track your enrollment status\n- Access resources from enrolled courses\n\n";
    } else {
      responseText += "💡 **Quick Tips:**\n- Check your course materials in the Courses tab\n- Use the GPA Calculator to track your progress\n- Contact your instructors for specific questions\n\n";
    }
    
    responseText += "Please try again later or contact support if the issue persists. 🎓";
    
    return {
      choices: [{
        message: {
          content: responseText
        }
      }],
      model: 'fallback',
      usage: { total_tokens: 0 }
    };
  }
}

// Export a singleton instance
const aiService = new AIService();
export default aiService;
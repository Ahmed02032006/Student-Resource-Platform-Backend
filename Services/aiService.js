// Services/aiService.js
import fetch from 'node-fetch';

class AIService {
  constructor() {
    this.baseURL = process.env.AI_BASE_URL || 'https://tokenin.my.id/v1';
    this.apiKey = process.env.AI_API_KEY;
    this.model = process.env.AI_MODEL || 'gpt-3.5-turbo'; // Changed to a more reliable model
    this.timeout = 15000; // 15 seconds timeout
    
    console.log('🤖 AI Service initialized');
    console.log('📡 Base URL:', this.baseURL);
    console.log('📦 Model:', this.model);
    console.log('🔑 API Key exists:', !!this.apiKey);
  }

  /**
   * Fetch with timeout
   */
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
        throw new Error('Request timeout: The AI service is taking too long to respond.');
      }
      throw error;
    }
  }

  /**
   * Chat completion with the AI model
   */
  async chatCompletion(messages, options = {}) {
    try {
      // Check if API key exists
      if (!this.apiKey || this.apiKey === 'sk-f507f08a0...........................................') {
        console.warn('⚠️ AI_API_KEY not properly configured. Using fallback response.');
        return this.getFallbackResponse(messages);
      }

      const { temperature = 0.5, max_tokens = 200, stream = false } = options;

      // Limit message length to prevent timeout
      const truncatedMessages = messages.map(msg => ({
        ...msg,
        content: msg.content?.length > 300 ? msg.content.substring(0, 300) + '...' : msg.content
      }));

      const requestBody = {
        model: this.model,
        messages: truncatedMessages,
        temperature: Math.min(temperature, 0.5),
        max_tokens: Math.min(max_tokens, 200),
        stream,
      };

      console.log('📤 Sending request to AI API...');

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
        10000 // 10 second timeout
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: { message: 'Unknown error' } };
        }
        
        console.error('❌ AI API Error Response:', errorData);
        
        // Return fallback instead of throwing
        return this.getFallbackResponse(messages);
      }

      const data = await response.json();
      console.log('✅ AI API Response received successfully');
      
      return data;
    } catch (error) {
      console.error('❌ AI Service Error:', error);
      // Return fallback response instead of throwing
      return this.getFallbackResponse(messages);
    }
  }

  /**
   * Fallback response when AI is unavailable
   */
  getFallbackResponse(messages) {
    const userMessage = messages.find(m => m.role === 'user')?.content || '';
    
    let responseText = "I'm sorry, but the AI service is currently unavailable. Here are some helpful resources instead:\n\n";
    
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

  /**
   * Streaming chat completion with fallback
   */
  async streamChatCompletion(messages, onChunk, options = {}) {
    try {
      if (!this.apiKey || this.apiKey === 'sk-f507f08a0...........................................') {
        // Simulate streaming with fallback
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
        }, 50);
        return;
      }

      const { temperature = 0.5, max_tokens = 200 } = options;

      const response = await this.fetchWithTimeout(
        `${this.baseURL}/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: messages,
            temperature: Math.min(temperature, 0.5),
            max_tokens: Math.min(max_tokens, 200),
            stream: true,
          }),
        },
        15000
      );

      if (!response.ok) {
        // Simulate streaming with fallback
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
        }, 50);
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
    } catch (error) {
      console.error('❌ Streaming Error:', error);
      // Simulate streaming with fallback
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
      }, 50);
    }
  }

  /**
   * Get list of available models
   */
  async getModels() {
    try {
      if (!this.apiKey || this.apiKey === 'sk-f507f08a0...........................................') {
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
        5000
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('❌ Get Models Error:', error);
      return [];
    }
  }
}

// Export a singleton instance
const aiService = new AIService();
export default aiService;
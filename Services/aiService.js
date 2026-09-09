// Services/aiService.js
import fetch from 'node-fetch';

class AIService {
  constructor() {
    this.baseURL = process.env.AI_BASE_URL || 'https://tokenin.my.id/v1';
    this.apiKey = process.env.AI_API_KEY;
    this.model = 'myt/gemini-3.5-flash-free'; // Updated default
    this.timeout = 20000; // 20 seconds timeout for Gemini
    
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
      if (!this.apiKey || this.apiKey.length < 10) {
        console.warn('⚠️ AI_API_KEY not properly configured.');
        return this.getFallbackResponse(messages);
      }

      const { temperature = 0.5, max_tokens = 200, stream = false } = options;

      // For Gemini models, use lower values for faster response
      const isGemini = this.model.includes('gemini');
      const adjustedTemperature = isGemini ? Math.min(temperature, 0.3) : temperature;
      const adjustedMaxTokens = isGemini ? Math.min(max_tokens, 150) : max_tokens;

      // Truncate messages if too long
      const truncatedMessages = messages.map(msg => ({
        ...msg,
        content: msg.content?.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content
      }));

      const requestBody = {
        model: this.model,
        messages: truncatedMessages,
        temperature: adjustedTemperature,
        max_tokens: adjustedMaxTokens,
        stream,
      };

      console.log('📤 Sending request to AI API...');
      console.log('📦 Model:', this.model);
      console.log('📦 Messages:', truncatedMessages.length);

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
        isGemini ? 15000 : 20000 // Shorter timeout for Gemini
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: { message: 'Unknown error' } };
        }
        
        console.error('❌ AI API Error:', errorData);
        
        // Try fallback model if Gemini fails
        if (this.model.includes('gemini')) {
          console.log('🔄 Trying fallback model: myt/grok-4.6-free');
          return this.chatCompletionWithFallback(messages, options);
        }
        
        return this.getFallbackResponse(messages);
      }

      const data = await response.json();
      console.log('✅ AI Response received successfully');
      return data;
    } catch (error) {
      console.error('❌ AI Service Error:', error);
      
      // Try fallback model on error
      if (this.model.includes('gemini')) {
        console.log('🔄 Trying fallback model on error: myt/grok-4.6-free');
        return this.chatCompletionWithFallback(messages, options);
      }
      
      return this.getFallbackResponse(messages);
    }
  }

  /**
   * Try with fallback model
   */
  async chatCompletionWithFallback(messages, options = {}) {
    try {
      const fallbackModel = 'myt/grok-4.6-free';
      console.log('📦 Using fallback model:', fallbackModel);
      
      const { temperature = 0.5, max_tokens = 200 } = options;
      
      const requestBody = {
        model: fallbackModel,
        messages: messages,
        temperature: Math.min(temperature, 0.5),
        max_tokens: Math.min(max_tokens, 200),
      };

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
        15000
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Fallback model response received');
        return data;
      }
      
      return this.getFallbackResponse(messages);
    } catch (error) {
      console.error('❌ Fallback model error:', error);
      return this.getFallbackResponse(messages);
    }
  }

  /**
   * Fallback response when AI is unavailable
   */
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
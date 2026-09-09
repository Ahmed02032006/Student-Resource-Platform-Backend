// Services/aiService.js
import fetch from 'node-fetch';

class AIService {
  constructor() {
    // Use Groq API
    this.baseURL = 'https://api.groq.com/openai/v1';
    this.apiKey = process.env.AI_API_KEY; // Make sure this is your Groq API key
    this.model = 'gemma2-9b-it'; // or 'mixtral-8x7b-32768', 'llama3-70b-8192'
    this.timeout = 30000;
    
    console.log('🤖 AI Service initialized (Groq)');
    console.log('📡 Base URL:', this.baseURL);
    console.log('📦 Model:', this.model);
    console.log('🔑 API Key exists:', !!this.apiKey);
    console.log('🔑 API Key length:', this.apiKey?.length || 0);
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
      // Check API key
      if (!this.apiKey || this.apiKey.length < 10) {
        console.error('❌ Invalid API Key');
        return this.getFallbackResponse(messages);
      }

      const { temperature = 0.7, max_tokens = 1024 } = options;

      // Ensure messages are in the correct format
      const formattedMessages = messages.map(msg => ({
        role: msg.role || 'user',
        content: msg.content || ''
      }));

      const requestBody = {
        model: this.model,
        messages: formattedMessages,
        temperature: temperature,
        max_tokens: Math.min(max_tokens, 2048), // Groq max
        stream: false,
      };

      console.log('📤 Sending request to Groq API...');
      console.log('📦 Model:', this.model);
      console.log('📦 Messages count:', formattedMessages.length);

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

      // Log the response status
      console.log('📥 Response Status:', response.status);

      // Get response as text first for debugging
      const responseText = await response.text();
      console.log('📄 Raw Response:', responseText.substring(0, 500));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ Failed to parse JSON:', e);
        return this.getFallbackResponse(messages);
      }

      if (!response.ok) {
        console.error('❌ Groq API Error:', data);
        
        // Try with a different model
        const fallbackModels = ['mixtral-8x7b-32768', 'llama3-70b-8192'];
        for (const fallbackModel of fallbackModels) {
          console.log(`🔄 Trying fallback model: ${fallbackModel}`);
          try {
            const fallbackBody = { ...requestBody, model: fallbackModel };
            const fallbackResponse = await this.fetchWithTimeout(
              `${this.baseURL}/chat/completions`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(fallbackBody),
              },
              30000
            );
            
            if (fallbackResponse.ok) {
              const fallbackText = await fallbackResponse.text();
              const fallbackData = JSON.parse(fallbackText);
              console.log('✅ Fallback model worked!');
              return fallbackData;
            }
          } catch (fallbackError) {
            console.log(`❌ Fallback ${fallbackModel} failed:`, fallbackError.message);
          }
        }
        
        return this.getFallbackResponse(messages);
      }

      console.log('✅ AI Response received successfully');
      return data;
    } catch (error) {
      console.error('❌ AI Service Error:', error);
      return this.getFallbackResponse(messages);
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
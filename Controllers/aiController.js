// Controllers/aiController.js
import aiService from '../Services/aiService.js';

export const chatWithAI = async (req, res, next) => {
  try {
    const { messages, temperature, max_tokens } = req.body;

    console.log('📨 AI Chat Request received');
    console.log('📦 Messages:', messages);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'messages array is required and must not be empty.',
      });
    }

    // For Gemini models, use shorter messages and lower max_tokens
    const isGemini = process.env.AI_MODEL?.includes('gemini');
    const adjustedMessages = messages.map(msg => ({
      ...msg,
      content: msg.content?.length > 500 ? msg.content.substring(0, 500) + '...' : msg.content
    }));

    const response = await aiService.chatCompletion(adjustedMessages, {
      temperature: isGemini ? 0.5 : (temperature || 0.7),
      max_tokens: isGemini ? 256 : (max_tokens || 512),
    });

    console.log('✅ AI Response received');

    return res.status(200).json({
      status: 'success',
      data: {
        message: response.choices?.[0]?.message?.content || '',
        usage: response.usage || null,
        model: response.model || process.env.AI_MODEL || 'myt/gemini-3.5-flash-free',
      },
    });
  } catch (err) {
    console.error('❌ AI Chat Error:', err);
    
    // Handle specific error types
    let errorMessage = 'Failed to get AI response. Please try again.';
    let errorCode = 'AI_SERVICE_ERROR';
    
    if (err.message.includes('timeout') || err.message.includes('taking too long')) {
      errorMessage = 'The AI model is currently slow or unresponsive. Please try a shorter question or try again later.';
      errorCode = 'AI_TIMEOUT';
    } else if (err.message.includes('overloaded') || err.message.includes('busy')) {
      errorMessage = 'The AI service is currently busy. Please try again in a few moments.';
      errorCode = 'AI_OVERLOADED';
    } else if (err.message.includes('API key')) {
      errorMessage = 'AI service configuration error. Please contact support.';
      errorCode = 'AI_CONFIG_ERROR';
    }
    
    return res.status(500).json({
      status: 'error',
      code: errorCode,
      message: errorMessage,
    });
  }
};

export const testAIConnection = async (req, res, next) => {
  try {
    // Use a very short test message
    const testMessage = [
      { role: 'user', content: 'Hi' }
    ];

    const response = await aiService.chatCompletion(testMessage, {
      temperature: 0.3,
      max_tokens: 20, // Very short response
    });

    return res.status(200).json({
      status: 'success',
      message: 'AI API is working!',
      response: response.choices?.[0]?.message?.content || 'No response',
      model: response.model || process.env.AI_MODEL || 'myt/gemini-3.5-flash-free',
    });
  } catch (err) {
    console.error('❌ AI Test Error:', err);
    return res.status(500).json({
      status: 'error',
      code: 'AI_TEST_FAILED',
      message: err.message || 'Failed to connect to AI API. The model might be slow or unavailable.',
    });
  }
};
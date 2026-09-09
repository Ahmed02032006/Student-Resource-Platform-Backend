// Controllers/aiController.js
import aiService from '../Services/aiService.js';

export const chatWithAI = async (req, res, next) => {
  try {
    const { messages, temperature, max_tokens } = req.body;

    console.log('📨 AI Chat Request received');

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'messages array is required and must not be empty.',
      });
    }

    // Always try to get AI response, fallback will handle errors
    const response = await aiService.chatCompletion(messages, {
      temperature: temperature || 0.5,
      max_tokens: max_tokens || 200,
    });

    // Ensure we always return a message
    const message = response.choices?.[0]?.message?.content || 
                   "I'm here to help! Please try asking your question again.";

    return res.status(200).json({
      status: 'success',
      data: {
        message: message,
        usage: response.usage || null,
        model: response.model || process.env.AI_MODEL || 'fallback',
      },
    });
  } catch (err) {
    console.error('❌ AI Chat Error:', err);
    
    // Always return a response, never let the server crash
    return res.status(200).json({
      status: 'success',
      data: {
        message: "I'm currently experiencing some technical difficulties. Please try again later or check your course materials in the Courses tab.",
        model: 'fallback',
        usage: null,
      },
    });
  }
};

export const testAIConnection = async (req, res, next) => {
  try {
    const testMessage = [
      { role: 'user', content: 'Hi' }
    ];

    const response = await aiService.chatCompletion(testMessage, {
      temperature: 0.3,
      max_tokens: 20,
    });

    return res.status(200).json({
      status: 'success',
      message: 'AI API is working!',
      response: response.choices?.[0]?.message?.content || 'No response',
      model: response.model || process.env.AI_MODEL || 'fallback',
    });
  } catch (err) {
    console.error('❌ AI Test Error:', err);
    // Always return a 200 with a friendly message
    return res.status(200).json({
      status: 'success',
      message: 'AI service is temporarily unavailable, but the app is working',
      response: 'AI is currently unavailable. Please try again later.',
      model: 'fallback',
    });
  }
};
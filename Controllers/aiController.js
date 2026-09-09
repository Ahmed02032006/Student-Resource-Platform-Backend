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

export const streamChatWithAI = async (req, res, next) => {
  try {
    const { messages, temperature, max_tokens } = req.body;

    console.log('📨 AI Stream Request received');

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'messages array is required and must not be empty.',
      });
    }

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Stream connected' })}\n\n`);

    await aiService.streamChatCompletion(
      messages,
      (chunk, done) => {
        if (done) {
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
        }
      },
      {
        temperature: temperature || 0.5,
        max_tokens: max_tokens || 200,
      }
    );
  } catch (err) {
    console.error('❌ AI Stream Error:', err);
    
    // Send error through SSE
    try {
      res.write(`data: ${JSON.stringify({ 
        error: err.message || 'Streaming error occurred',
        type: 'error' 
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (writeErr) {
      console.error('❌ Failed to write error response:', writeErr);
      // If we can't write, just end the response
      res.end();
    }
  }
};

export const getAvailableModels = async (req, res, next) => {
  try {
    console.log('📨 Getting available models...');
    
    const models = await aiService.getModels();
    
    return res.status(200).json({
      status: 'success',
      data: models,
      count: models.length,
    });
  } catch (err) {
    console.error('❌ Get Models Error:', err);
    
    return res.status(200).json({
      status: 'success',
      data: [],
      count: 0,
      message: 'Failed to fetch models, but returning empty array',
    });
  }
};

export const testAIConnection = async (req, res, next) => {
  try {
    console.log('🧪 Testing AI Connection...');
    console.log('🔑 API Key from env:', process.env.GROQ_API_KEY ? 'Exists (length: ' + process.env.GROQ_API_KEY.length + ')' : 'MISSING');
    console.log('📦 Model from env:', process.env.AI_MODEL || 'gemma2-9b-it');

    // Test Groq API directly
    const testMessage = [
      { role: 'user', content: 'Say "Hello, I am working!" in one short sentence.' }
    ];

    const requestBody = {
      model: process.env.AI_MODEL || 'gemma2-9b-it',
      messages: testMessage,
      max_tokens: 50,
      temperature: 0.3
    };

    console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📥 Response Status:', response.status);

    const responseText = await response.text();
    console.log('📄 Raw Response:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = { error: 'Invalid JSON', raw: responseText };
    }

    return res.status(200).json({
      status: response.ok ? 'success' : 'error',
      statusCode: response.status,
      response: data,
      model: requestBody.model,
      apiKeyLength: process.env.GROQ_API_KEY?.length || 0,
      apiKeyPrefix: process.env.GROQ_API_KEY?.substring(0, 10) + '...',
    });
  } catch (err) {
    console.error('❌ Test Error:', err);
    return res.status(200).json({
      status: 'error',
      message: err.message,
      stack: err.stack,
    });
  }
};
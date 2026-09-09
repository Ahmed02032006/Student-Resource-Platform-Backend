import aiService from '../Services/aiService.js';

/**
 * POST /api/ai/chat
 * Chat with the AI model
 */
export const chatWithAI = async (req, res, next) => {
  try {
    const { messages, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'messages array is required and must not be empty.',
      });
    }

    const response = await aiService.chatCompletion(messages, {
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 1024,
    });

    return res.status(200).json({
      status: 'success',
      data: {
        message: response.choices?.[0]?.message?.content || '',
        usage: response.usage || null,
        model: response.model || 'myt/gemini-3.5-flash-free',
      },
    });
  } catch (err) {
    console.error('AI Chat Error:', err);
    next(err);
  }
};

/**
 * POST /api/ai/chat/stream
 * Stream chat with the AI model
 */
export const streamChatWithAI = async (req, res, next) => {
  try {
    const { messages, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'messages array is required and must not be empty.',
      });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 1024,
      }
    );
  } catch (err) {
    console.error('AI Stream Error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
};

/**
 * GET /api/ai/models
 * Get available models
 */
export const getAvailableModels = async (req, res, next) => {
  try {
    const models = await aiService.getModels();
    return res.status(200).json({
      status: 'success',
      data: models,
    });
  } catch (err) {
    console.error('Get Models Error:', err);
    next(err);
  }
};
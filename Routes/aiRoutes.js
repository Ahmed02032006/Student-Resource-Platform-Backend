import express from 'express';
import { authenticate } from '../Middleware/authenticate.js';
import { chatWithAI, streamChatWithAI, getAvailableModels } from '../Controllers/aiController.js';

const router = express.Router();

// All AI routes require authentication
router.use(authenticate);

// Chat endpoints
router.post('/chat', chatWithAI);
router.post('/chat/stream', streamChatWithAI);

// Get available models
router.get('/models', getAvailableModels);

export default router;
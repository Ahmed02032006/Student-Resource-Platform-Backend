import express from 'express';
import { authenticate } from '../Middleware/authenticate.js';
import { 
  chatWithAI, 
  testAIConnection 
} from '../Controllers/aiController.js';

const router = express.Router();

// Public test endpoint (no auth required)
router.get('/test', testAIConnection);

// All other AI routes require authentication
router.use(authenticate);

// Chat endpoints
router.post('/chat', chatWithAI);
router.post('/chat/stream', streamChatWithAI);

// Get available models
router.get('/models', getAvailableModels);

export default router;
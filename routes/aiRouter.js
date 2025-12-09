// /routes/aiRouter.js

const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

router.post('/ask', aiController.askAssistant);

module.exports = router;
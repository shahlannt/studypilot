const aiService = require('../services/ai');
const { extractAttachmentsText } = require('../services/attachmentText');
const Note = require('../models/Note');
const Subject = require('../models/Subject');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { buildStatsForRecommendation } = require('../services/statsService');

// @desc    Chat with AI assistant
// @route   POST /api/ai/chat
// @access  Private
const chat = async (req, res, next) => {
  try {
    const { message, conversationId, context } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Load relevant context (only the minimum needed)
    let contextContent = '';
    if (context && context.noteId) {
      const note = await Note.findOne({ _id: context.noteId, user: req.user._id });
      if (note) {
        contextContent = `[Study note: ${note.title}]\n${note.content}`;
      }
    } else if (context && context.subjectId) {
      const subject = await Subject.findOne({ _id: context.subjectId, user: req.user._id });
      if (subject) {
        contextContent = `[Subject: ${subject.name}]\n${subject.description || ''}`;
      }
    }

    // Find or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ _id: conversationId, user: req.user._id });
    }
    if (!conversation) {
      conversation = await Conversation.create({
        user: req.user._id,
        title: message.slice(0, 60),
        context: context || {}
      });
    }

    // Save user message
    await Message.create({
      conversation: conversation._id,
      role: 'user',
      content: message
    });

    // Load recent history for context
    const history = await Message.find({ conversation: conversation._id })
      .sort({ createdAt: -1 })
      .limit(10);
    const historyMessages = history
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }));

    const system = `You are StudyPilot, a helpful AI study assistant. You help students understand concepts, summarize material, generate practice questions, and plan their studying.
Use markdown formatting in your responses. Be clear, accurate, and encouraging. Use code blocks for code.
If study context is provided, base your answers on it where relevant.`;

    const response = await aiService.generate({
      system,
      messages: [
        ...(contextContent ? [{ role: 'user', content: contextContent }] : []),
        ...historyMessages,
        { role: 'user', content: message }
      ],
      maxTokens: 1500
    });

    // Save assistant message
    const assistantMessage = await Message.create({
      conversation: conversation._id,
      role: 'assistant',
      content: response
    });

    res.json({
      success: true,
      conversationId: conversation._id,
      response,
      message: assistantMessage
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Summarize a note
// @route   POST /api/ai/summarize
// @access  Private
const summarize = async (req, res, next) => {
  try {
    const { noteId, length } = req.body;
    const note = await Note.findOne({ _id: noteId, user: req.user._id });
    if (!note) {
      return res.status(404).json({ success: false, error: 'Note not found' });
    }

    // A note's substance can live in attachments (PDFs/images) rather than the
    // markdown body, so the "effective content" is the body plus whatever text
    // can be extracted from attached files. Extraction never throws — unreadable
    // files simply contribute nothing (see services/attachmentText.js).
    const bodyText = (note.content || '').trim();
    let attachmentText = '';
    try {
      attachmentText = await extractAttachmentsText(note);
    } catch (extractError) {
      console.error('[aiController] Error extracting text from attachments:', extractError);
      // Continue with just the body text if extraction fails
      attachmentText = '';
    }
    const effective = [bodyText, attachmentText].filter(Boolean).join('\n\n');

    if (effective.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'This note has no text to summarize. Add text, a PDF, or an image with readable text.'
      });
    }

    let summary;
    try {
      summary = await aiService.summarize(effective, length || req.user.settings?.ai?.summaryLength);
    } catch (summarizeError) {
      console.error('[aiController] Error generating summary:', summarizeError);
      throw summarizeError; // Re-throw to be caught by the outer try/catch
    }

    // Cache the summary on the note
    note.summary = { ...summary, length: length || 'medium', generatedAt: new Date() };
    await note.save();

    res.json({ success: true, summary });
  } catch (error) {
    console.error('[aiController] Summarize error:', error);
    next(error);
  }
};

// @desc    Generate quiz from note or subject
// @route   POST /api/ai/generate-quiz
// @access  Private
const generateQuiz = async (req, res, next) => {
  try {
    const { sourceType, sourceId, numQuestions = 5, difficulty = 'medium', questionType = 'mixed' } = req.body;

    let content = '';
    let title = 'Quiz';
    let subjectId = null;

    if (sourceType === 'note') {
      const note = await Note.findOne({ _id: sourceId, user: req.user._id });
      if (!note) return res.status(404).json({ success: false, error: 'Note not found' });
      content = note.content;
      title = `Quiz: ${note.title}`;
      subjectId = note.subject;
    } else if (sourceType === 'subject') {
      const subject = await Subject.findOne({ _id: sourceId, user: req.user._id });
      if (!subject) return res.status(404).json({ success: false, error: 'Subject not found' });
      const notes = await Note.find({ user: req.user._id, subject: subject._id }).select('content');
      content = notes.map((n) => n.content).join('\n\n');
      title = `Quiz: ${subject.name}`;
      subjectId = subject._id;
    } else {
      return res.status(400).json({ success: false, error: 'Invalid source type' });
    }

    if (!content || content.trim().length < 30) {
      return res.status(400).json({
        success: false,
        error: 'Not enough content to generate a quiz. Add more notes first.'
      });
    }

    const count = Math.min(Math.max(parseInt(numQuestions) || 5, 1), 15);
    const quizData = await aiService.generateQuiz({
      content,
      numQuestions: count,
      difficulty,
      questionType
    });

    res.json({
      success: true,
      quiz: {
        title: quizData.title || title,
        questions: quizData.questions || [],
        source: { type: sourceType, noteId: sourceType === 'note' ? sourceId : null, subjectId },
        difficulty,
        questionType
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Explain a concept
// @route   POST /api/ai/explain
// @access  Private
const explain = async (req, res, next) => {
  try {
    const { question, context } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, error: 'Question is required' });
    }

    let contextContent = '';
    if (context && context.noteId) {
      const note = await Note.findOne({ _id: context.noteId, user: req.user._id });
      if (note) contextContent = note.content;
    }

    const response = await aiService.explain({ question, context: contextContent });
    res.json({ success: true, response });
  } catch (error) {
    next(error);
  }
};

// @desc    Personalized study recommendations
// @route   POST /api/ai/recommend
// @access  Private
const recommend = async (req, res, next) => {
  try {
    const stats = await buildStatsForRecommendation(req.user._id);
    const recommendations = await aiService.recommend({ stats });
    res.json({ success: true, recommendations });
  } catch (error) {
    next(error);
  }
};

// @desc    Get conversations
// @route   GET /api/ai/conversations
// @access  Private
const getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(30);
    res.json({ success: true, conversations });
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/ai/conversations/:id
// @access  Private
const getConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    const messages = await Message.find({ conversation: conversation._id }).sort({ createdAt: 1 });
    res.json({ success: true, conversation, messages });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a conversation
// @route   DELETE /api/ai/conversations/:id
// @access  Private
const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({ _id: req.params.id, user: req.user._id });
    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }
    await Message.deleteMany({ conversation: conversation._id });
    await conversation.deleteOne();
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  chat,
  summarize,
  generateQuiz,
  explain,
  recommend,
  getConversations,
  getConversation,
  deleteConversation
};

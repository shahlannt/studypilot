const Task = require('../models/Task');

// @desc    Get all tasks with filters
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res, next) => {
  try {
    const { status, priority, subject, search, sort, dueBefore, dueAfter } = req.query;
    const query = { user: req.user._id };

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (subject) query.subject = subject;

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    if (dueBefore) query.dueDate = { ...(query.dueDate || {}), $lte: new Date(dueBefore) };
    if (dueAfter) query.dueDate = { ...(query.dueDate || {}), $gte: new Date(dueAfter) };

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      dueDate: { dueDate: 1 },
      priority: { priority: -1 },
      title: { title: 1 }
    };
    const sortBy = sortOptions[sort] || sortOptions.newest;

    const tasks = await Task.find(query)
      .populate('subject', 'name color')
      .sort(sortBy);

    res.json({ success: true, tasks });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
const getTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user._id })
      .populate('subject', 'name color');
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// @desc    Create task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res, next) => {
  try {
    const task = await Task.create({
      user: req.user._id,
      title: req.body.title,
      description: req.body.description || '',
      subject: req.body.subject || null,
      priority: req.body.priority || 'medium',
      status: req.body.status || 'todo',
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      estimatedMinutes: req.body.estimatedMinutes || 0,
      tags: req.body.tags || []
    });

    res.status(201).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res, next) => {
  try {
    let task = await Task.findOne({ _id: req.params.id, user: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const allowed = ['title', 'description', 'subject', 'priority', 'status', 'dueDate', 'estimatedMinutes', 'tags'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    // Track completion time
    if (req.body.status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
    }
    if (req.body.status !== 'completed') {
      task.completedAt = null;
    }

    await task.save();
    res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle task completion
// @route   PATCH /api/tasks/:id/toggle
// @access  Private
const toggleTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    task.status = task.status === 'completed' ? 'todo' : 'completed';
    task.completedAt = task.status === 'completed' ? new Date() : null;
    await task.save();

    res.json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }
    await task.deleteOne();
    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTasks, getTask, createTask, updateTask, toggleTask, deleteTask };

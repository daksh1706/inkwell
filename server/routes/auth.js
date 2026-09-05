import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'inkwell_secret', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, initialWorkspace } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, and password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists',
      });
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
    });

    // Initialize or migrate workspace
    let workspace = null;
    if (initialWorkspace && initialWorkspace.notebooks && initialWorkspace.notebooks.length > 0) {
      workspace = await Workspace.create({
        userId: user._id,
        activePageId: initialWorkspace.activePageId || null,
        notebooks: initialWorkspace.notebooks,
      });
    } else {
      workspace = await Workspace.create({
        userId: user._id,
        activePageId: null,
        notebooks: [],
      });
    }

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      workspace: {
        activePageId: workspace.activePageId,
        notebooks: workspace.notebooks,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during signup',
    });
  }
});

// @desc    Authenticate user & get token (Login)
// @route   POST /api/auth/signin
// @access  Public
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Fetch user workspace
    let workspace = await Workspace.findOne({ userId: user._id });
    if (!workspace) {
      workspace = await Workspace.create({
        userId: user._id,
        activePageId: null,
        notebooks: [],
      });
    }

    const token = generateToken(user._id);

    return res.json({
      success: true,
      message: 'Signed in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      workspace: {
        activePageId: workspace.activePageId,
        notebooks: workspace.notebooks,
      },
    });
  } catch (error) {
    console.error('Signin error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during sign in',
    });
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    return res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching user',
    });
  }
});

export default router;

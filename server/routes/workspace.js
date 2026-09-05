import express from 'express';
import Workspace from '../models/Workspace.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get current user's workspace
// @route   GET /api/workspace
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let workspace = await Workspace.findOne({ userId: req.user._id });
    if (!workspace) {
      workspace = await Workspace.create({
        userId: req.user._id,
        activePageId: null,
        notebooks: [],
      });
    }

    return res.json({
      success: true,
      data: {
        activePageId: workspace.activePageId,
        notebooks: workspace.notebooks,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    console.error('Fetch workspace error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error fetching workspace',
    });
  }
});

// @desc    Update current user's workspace
// @route   PUT /api/workspace
// @access  Private
router.put('/', protect, async (req, res) => {
  try {
    const { activePageId, notebooks } = req.body;

    const workspace = await Workspace.findOneAndUpdate(
      { userId: req.user._id },
      {
        $set: {
          activePageId: activePageId !== undefined ? activePageId : null,
          notebooks: Array.isArray(notebooks) ? notebooks : [],
          updatedAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      message: 'Workspace saved successfully',
      data: {
        activePageId: workspace.activePageId,
        notebooks: workspace.notebooks,
        updatedAt: workspace.updatedAt,
      },
    });
  } catch (error) {
    console.error('Update workspace error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error saving workspace',
    });
  }
});

export default router;

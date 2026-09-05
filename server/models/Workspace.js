import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    activePageId: {
      type: String,
      default: null,
    },
    notebooks: {
      type: Array,
      default: [],
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    minimize: false, // Ensure empty objects in canvas/notes are preserved
  }
);

const Workspace = mongoose.model('Workspace', workspaceSchema);
export default Workspace;

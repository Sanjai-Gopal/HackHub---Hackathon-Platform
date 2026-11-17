const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");
const { Readable } = require("stream");
const { protect } = require("../middleware/authMiddleware.js");
const Team = require("../models/Team.js");
const User = require("../models/User.js");

const router = express.Router();

// Multer memory storage with 10MB file size limit & fileFilter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/json",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith("text/")) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Unsupported file format. Please upload standard documents, presentations, images, or archives."
        )
      );
    }
  },
});

// Middleware wrapper for multer error handling
const handleSingleUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "File exceeds the 10MB maximum size limit." });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Helper: Resiliently resolve user's teamId and auto-reconcile with MongoDB Team collection
const getTeamId = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }

  // 1. Direct teamId on user document
  if (req.user.teamId) {
    return new mongoose.Types.ObjectId(req.user.teamId);
  }

  // 2. Fallback: Search if user is a member of any Team document and auto-repair user.teamId
  try {
    const team = await Team.findOne({ "members.user": req.user._id });
    if (team) {
      req.user.teamId = team._id;
      await User.findByIdAndUpdate(req.user._id, { $set: { teamId: team._id } });
      return team._id;
    }
  } catch (err) {
    console.error("Team reconciliation lookup error:", err);
  }

  res.status(403).json({
    message: "Please create or join a team first.",
  });
  return null;
};

// Upload file - authenticated team members only
router.post(
  "/upload",
  protect,
  handleSingleUpload,
  async (req, res) => {
    try {
      const teamId = await getTeamId(req, res);
      if (!teamId) return;

      if (!req.file) {
        return res.status(400).json({ message: "No file selected for upload!" });
      }

      const bucket = new GridFSBucket(mongoose.connection.db, {
        bucketName: "uploads",
      });

      const sanitizedOriginalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filename = `${Date.now()}-${sanitizedOriginalName}`;

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: req.file.mimetype,
        metadata: {
          teamId,
          uploadedBy: req.user._id,
          originalName: req.file.originalname,
          size: req.file.size,
          uploadedAt: new Date(),
        },
      });

      Readable.from(req.file.buffer)
        .pipe(uploadStream)
        .on("error", (err) => {
          console.error("Upload stream error:", err);
          if (!res.headersSent) {
            res.status(500).json({ message: "Upload failed during streaming." });
          }
        })
        .on("finish", (savedFile) => {
          res.status(201).json({
            message: "File uploaded successfully!",
            file: {
              _id: savedFile._id,
              filename,
              originalName: req.file.originalname,
              contentType: req.file.mimetype,
              size: req.file.size,
            },
          });
        });
    } catch (err) {
      console.error("Upload error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Internal server error during upload" });
      }
    }
  }
);

// Fetch only current team's files
router.get("/files", protect, async (req, res) => {
  try {
    const teamId = await getTeamId(req, res);
    if (!teamId) return;

    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const files = await bucket
      .find({ "metadata.teamId": teamId })
      .sort({ uploadDate: -1 })
      .toArray();

    return res.status(200).json(files);
  } catch (err) {
    console.error("Fetch files error:", err);
    res.status(500).json({ message: "Error fetching files" });
  }
});

// Download only files belonging to current team
router.get("/file/:filename", protect, async (req, res) => {
  try {
    const teamId = await getTeamId(req, res);
    if (!teamId) return;

    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const file = await bucket
      .find({
        filename: req.params.filename,
        "metadata.teamId": teamId,
      })
      .next();

    if (!file) {
      return res.status(404).json({ message: "File not found in your team repository." });
    }

    res.set("Content-Type", file.contentType || "application/octet-stream");
    res.set("Content-Disposition", `attachment; filename="${file.metadata?.originalName || file.filename}"`);

    bucket.openDownloadStream(file._id).pipe(res);
  } catch (err) {
    console.error("Download error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error retrieving file" });
    }
  }
});

// Delete only files belonging to current team
router.delete("/file/:identifier", protect, async (req, res) => {
  try {
    const teamId = await getTeamId(req, res);
    if (!teamId) return;

    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const file = await bucket
      .find({
        filename: req.params.identifier,
        "metadata.teamId": teamId,
      })
      .next();

    if (!file) {
      return res.status(404).json({
        message: "File not found in your team repository.",
      });
    }

    await bucket.delete(file._id);

    res.status(200).json({
      message: "File deleted successfully!",
      filename: req.params.identifier,
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: "Error deleting file" });
  }
});

module.exports = router;

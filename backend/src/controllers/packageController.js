const { Package, Repository, User, Upload } = require("../models");
const tcpClient = require("../services/tcpClient");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const {
  ensureUploadDir,
  generateUniqueFilename,
} = require("../utils/fileUtils");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = ensureUploadDir();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = generateUniqueFilename(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 }, // 100MB default
});

/**
 * Get all packages for a repository
 * GET /api/repos/:repo_name/packages
 */
const getPackagesByRepo = async (req, res) => {
  try {
    const { repo_name } = req.params;
    const { role } = req.user;

    // Check if repository exists
    const repository = await Repository.findOne({
      where: { repo_name },
    });

    if (!repository) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    // Check if user has access
    const accessRoles = repository.hasAccess;
    if (!accessRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this repository",
      });
    }

    // Get packages
    const packages = await Package.findAll({
      where: { repo_for_pkg: repo_name },
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["username", "role"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    res.json({
      success: true,
      data: packages,
    });
  } catch (error) {
    console.error("Get packages error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Get package by name
 * GET /api/packages/:pkg_name
 */
const getPackageByName = async (req, res) => {
  try {
    const { pkg_name } = req.params;

    const package = await Package.findOne({
      where: { pkg_name },
      include: [
        {
          model: Repository,
          as: "repository",
          attributes: ["repo_name", "description", "hasAccess"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["username", "role"],
        },
        {
          model: Upload,
          as: "uploads",
          include: [
            {
              model: User,
              as: "uploader",
              attributes: ["username", "role"],
            },
          ],
          order: [["uploaded_at", "DESC"]],
        },
      ],
    });

    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    res.json({
      success: true,
      data: package,
    });
  } catch (error) {
    console.error("Get package error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Create new package
 * POST /api/repos/:repo_name/packages
 */
const createPackage = async (req, res) => {
  try {
    const { repo_name } = req.params;
    const { pkg_name, version, description } = req.body;
    const { username, role } = req.user;

    // Validate input
    if (!pkg_name || !version) {
      return res.status(400).json({
        success: false,
        message: "Package name and version are required",
      });
    }

    // Check if repository exists
    const repository = await Repository.findOne({
      where: { repo_name },
    });

    if (!repository) {
      return res.status(404).json({
        success: false,
        message: "Repository not found",
      });
    }

    // Check if user has access
    const accessRoles = repository.hasAccess;
    if (!accessRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this repository",
      });
    }

    // Check if package already exists
    const existingPkg = await Package.findOne({ where: { pkg_name } });

    if (existingPkg) {
      return res.status(409).json({
        success: false,
        message: "Package name already exists",
      });
    }

    // Create package
    const newPackage = await Package.create({
      pkg_name,
      repo_for_pkg: repo_name,
      created_by_username: username,
      version,
      description,
      status: "pending",
    });
    console.log("HII :- ", newPackage);
    res.status(201).json({
      success: true,
      message: "Package created successfully",
      data: newPackage,
    });
  } catch (error) {
    console.error("Create package error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Update package status
 * PATCH /api/packages/:pkg_name/status
 */
const updatePackageStatus = async (req, res) => {
  try {
    const { pkg_name } = req.params;
    const { status } = req.body;
    const { role } = req.user;

    // Only Testers can update status
    if (role !== "Tester") {
      return res.status(403).json({
        success: false,
        message: "Only Testers can update package status",
      });
    }

    // Validate status
    if (!["accepted", "rejected", "pending"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be accepted, rejected, or pending",
      });
    }

    // Find package
    const package = await Package.findOne({ where: { pkg_name } });

    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    // Update status
    package.status = status;
    await package.save();

    res.json({
      success: true,
      message: "Package status updated successfully",
      data: package,
    });
  } catch (error) {
    console.error("Update package status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Delete package
 * DELETE /api/packages/:pkg_name
 */
const deletePackage = async (req, res) => {
  try {
    const { pkg_name } = req.params;
    const { username } = req.user;

    // Find package with uploads
    const package = await Package.findOne({
      where: { pkg_name },
      include: [
        {
          model: Upload,
          as: "uploads",
        },
      ],
    });

    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    // Check if user is the creator
    if (package.created_by_username !== username) {
      return res.status(403).json({
        success: false,
        message: "Only the package creator can delete it",
      });
    }

    // Delete all files from FTP server
    const deletionErrors = [];
    if (package.uploads && package.uploads.length > 0) {
      for (const upload of package.uploads) {
        try {
          await tcpClient.del(upload.file_path);
          console.log(`Deleted file from FTP: ${upload.file_path}`);
        } catch (ftpError) {
          console.error(
            `Failed to delete file from FTP: ${upload.file_path}`,
            ftpError
          );
          deletionErrors.push(upload.file_path);
        }
      }
    }

    // Delete package (cascade will handle uploads in DB)
    await package.destroy();

    const responseMessage =
      deletionErrors.length > 0
        ? `Package deleted successfully, but ${deletionErrors.length} file(s) could not be deleted from FTP server`
        : "Package deleted successfully";

    res.json({
      success: true,
      message: responseMessage,
      ftpDeletionErrors: deletionErrors.length > 0 ? deletionErrors : undefined,
    });
  } catch (error) {
    console.error("Delete package error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

/**
 * Upload file to package (via TCP server)
 * POST /api/packages/:pkg_name/upload
 */
const uploadFile = async (req, res) => {
  try {
    const { pkg_name } = req.params;
    const { username } = req.user;

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Find package
    const package = await Package.findOne({
      where: { pkg_name },
      include: [{ model: Repository, as: "repository" }],
    });

    if (!package) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    const localFilePath = req.file.path;
    const remoteFilename = req.file.filename;

    // Upload to TCP server
    const result = await tcpClient.put(localFilePath, remoteFilename);

    // Log upload in database
    const upload = await Upload.create({
      pkg_name: pkg_name,
      repo_name: package.repo_for_pkg,
      uploaded_by: username,
      file_path: remoteFilename,
    });
    // Clean up local file after successful upload
    fs.unlinkSync(localFilePath);

    res.json({
      success: true,
      message: "File uploaded successfully",
      data: {
        upload_id: upload.upload_id,
        file_path: remoteFilename,
        bytes: result.bytes,
      },
    });
  } catch (error) {
    console.error("Upload file error:", error);

    // Clean up local file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    });
  }
};

/**
 * Download file from package (via TCP server)
 * GET /api/packages/:pkg_name/download/:filename
 */
const downloadFile = async (req, res) => {
  try {
    const { pkg_name, filename } = req.params;

    // Find package
    const package = await Package.findOne({ where: { pkg_name } });

    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    // Verify file exists in uploads
    const upload = await Upload.findOne({
      where: {
        pkg_name,
        file_path: filename,
      },
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Set headers for file download
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    // Download from TCP server and pipe to response
    await tcpClient.get(filename, res);
  } catch (error) {
    console.error("Download file error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "File download failed",
        error: error.message,
      });
    }
  }
};

/**
 * Delete file from package (via TCP server)
 * DELETE /api/packages/:pkg_name/file/:filename
 */
const deleteFile = async (req, res) => {
  try {
    const { pkg_name, filename } = req.params;
    const { username } = req.user;

    // Find package
    const package = await Package.findOne({ where: { pkg_name } });

    if (!package) {
      return res.status(404).json({
        success: false,
        message: "Package not found",
      });
    }

    // Verify file exists in uploads
    const upload = await Upload.findOne({
      where: {
        pkg_name,
        file_path: filename,
      },
    });

    if (!upload) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Check if user is the uploader
    if (upload.uploaded_by !== username) {
      return res.status(403).json({
        success: false,
        message: "Only the file uploader can delete it",
      });
    }

    // Delete from TCP server
    await tcpClient.del(filename);

    // Delete from database
    await upload.destroy();

    res.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      success: false,
      message: "File deletion failed",
      error: error.message,
    });
  }
};

module.exports = {
  upload,
  getPackagesByRepo,
  getPackageByName,
  createPackage,
  updatePackageStatus,
  deletePackage,
  uploadFile,
  downloadFile,
  deleteFile,
};

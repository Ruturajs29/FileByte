const { Repository, Package, User, Upload } = require('../models');
const { Op } = require('sequelize');
const tcpClient = require('../services/tcpClient');

/**
 * Get all repositories (filtered by role)
 * GET /api/repos
 */
const getAllRepositories = async (req, res) => {
  try {
    const { role } = req.user;

    // Get all repositories
    const allRepositories = await Repository.findAll({
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['username', 'role']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Filter repositories where user's role has access
    const repositories = allRepositories.filter(repo => {
      const accessRoles = repo.hasAccess; // This is already an array due to getter
      return accessRoles.includes(role);
    });

    res.json({
      success: true,
      data: repositories
    });

  } catch (error) {
    console.error('Get repositories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Get repository by name
 * GET /api/repos/:repo_name
 */
const getRepositoryByName = async (req, res) => {
  try {
    const { repo_name } = req.params;
    const { role } = req.user;

    const repository = await Repository.findOne({
      where: { repo_name },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['username', 'role']
        },
        {
          model: Package,
          as: 'packages',
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['username', 'role']
            }
          ]
        }
      ]
    });

    if (!repository) {
      return res.status(404).json({
        success: false,
        message: 'Repository not found'
      });
    }

    // Check if user's role has access
    const accessRoles = repository.hasAccess; // Array due to getter
    if (!accessRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this repository'
      });
    }

    res.json({
      success: true,
      data: repository
    });

  } catch (error) {
    console.error('Get repository error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Create new repository
 * POST /api/repos
 */
const createRepository = async (req, res) => {
  try {
    const { repo_name, description, hasAccess } = req.body;
    const { username } = req.user;

    // Validate input
    if (!repo_name || !hasAccess) {
      return res.status(400).json({
        success: false,
        message: 'Repository name and access roles are required'
      });
    }

    // Ensure hasAccess is an array
    const accessRoles = Array.isArray(hasAccess) ? hasAccess : [hasAccess];

    // Validate roles
    const validRoles = ['Developer', 'Tester', 'HR'];
    const invalidRoles = accessRoles.filter(role => !validRoles.includes(role));
    
    if (invalidRoles.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid roles: ${invalidRoles.join(', ')}`
      });
    }

    // Check if repository already exists
    const existingRepo = await Repository.findOne({ where: { repo_name } });

    if (existingRepo) {
      return res.status(409).json({
        success: false,
        message: 'Repository name already exists'
      });
    }

    // Create repository
    const newRepo = await Repository.create({
      repo_name,
      description,
      created_by_username: username,
      hasAccess: accessRoles // Will be converted to comma-separated by setter
    });

    res.status(201).json({
      success: true,
      message: 'Repository created successfully',
      data: newRepo
    });

  } catch (error) {
    console.error('Create repository error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Update repository
 * PUT /api/repos/:repo_name
 */
const updateRepository = async (req, res) => {
  try {
    const { repo_name } = req.params;
    const { description, hasAccess } = req.body;
    const { role } = req.user;

    // Find repository
    const repository = await Repository.findOne({
      where: { repo_name }
    });

    if (!repository) {
      return res.status(404).json({
        success: false,
        message: 'Repository not found'
      });
    }

    // Check if user's role has access
    const accessRoles = repository.hasAccess;
    if (!accessRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this repository'
      });
    }

    // Update fields
    if (description !== undefined) repository.description = description;
    
    if (hasAccess !== undefined) {
      const newAccessRoles = Array.isArray(hasAccess) ? hasAccess : [hasAccess];
      
      // Validate roles
      const validRoles = ['Developer', 'Tester', 'HR'];
      const invalidRoles = newAccessRoles.filter(r => !validRoles.includes(r));
      
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid roles: ${invalidRoles.join(', ')}`
        });
      }
      
      repository.hasAccess = newAccessRoles;
    }

    await repository.save();

    res.json({
      success: true,
      message: 'Repository updated successfully',
      data: repository
    });

  } catch (error) {
    console.error('Update repository error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Delete repository
 * DELETE /api/repos/:repo_name
 */
const deleteRepository = async (req, res) => {
  try {
    const { repo_name } = req.params;
    const { username, role } = req.user;

    // Find repository
    const repository = await Repository.findOne({
      where: { repo_name }
    });

    if (!repository) {
      return res.status(404).json({
        success: false,
        message: 'Repository not found'
      });
    }

    // Check if user's role has access
    const accessRoles = repository.hasAccess;
    if (!accessRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this repository'
      });
    }

    // Check if user is the creator
    if (repository.created_by_username !== username) {
      return res.status(403).json({
        success: false,
        message: 'Only the repository creator can delete it'
      });
    }

    // Get all uploads for this repository to delete from FTP server
    const uploads = await Upload.findAll({
      where: { repo_name }
    });

    // Delete all files from FTP server
    const deletionErrors = [];
    for (const upload of uploads) {
      try {
        await tcpClient.del(upload.file_path);
        console.log(`Deleted file from FTP: ${upload.file_path}`);
      } catch (ftpError) {
        console.error(`Failed to delete file from FTP: ${upload.file_path}`, ftpError);
        deletionErrors.push(upload.file_path);
      }
    }

    // Delete repository (cascade will handle packages and uploads in DB)
    await repository.destroy();

    const responseMessage = deletionErrors.length > 0
      ? `Repository deleted successfully, but ${deletionErrors.length} file(s) could not be deleted from FTP server`
      : 'Repository deleted successfully';

    res.json({
      success: true,
      message: responseMessage,
      ftpDeletionErrors: deletionErrors.length > 0 ? deletionErrors : undefined
    });

  } catch (error) {
    console.error('Delete repository error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getAllRepositories,
  getRepositoryByName,
  createRepository,
  updateRepository,
  deleteRepository
};

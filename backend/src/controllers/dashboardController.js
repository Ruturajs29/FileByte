const { Repository, Package, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Get dashboard statistics
 * GET /api/dashboard
 */
const getDashboard = async (req, res) => {
  try {
    const { username, role } = req.user;

    // Get all repositories and filter by role access
    const allRepos = await Repository.findAll();
    const accessibleRepos = allRepos.filter(repo => {
      const accessRoles = repo.hasAccess; // Already an array due to getter
      return accessRoles.includes(role);
    });
    const totalRepos = accessibleRepos.length;

    // Get repo names that user has access to
    const accessibleRepoNames = accessibleRepos.map(repo => repo.repo_name);

    // Get packages count only from accessible repositories
    const totalPackages = await Package.count({
      where: {
        repo_for_pkg: {
          [Op.in]: accessibleRepoNames.length > 0 ? accessibleRepoNames : [''] // Empty array fallback
        }
      }
    });

    // Get package status counts only from accessible repositories
    const acceptedCount = await Package.count({
      where: {
        status: 'accepted',
        repo_for_pkg: {
          [Op.in]: accessibleRepoNames.length > 0 ? accessibleRepoNames : ['']
        }
      }
    });

    const rejectedCount = await Package.count({
      where: {
        status: 'rejected',
        repo_for_pkg: {
          [Op.in]: accessibleRepoNames.length > 0 ? accessibleRepoNames : ['']
        }
      }
    });

    const pendingCount = await Package.count({
      where: {
        status: 'pending',
        repo_for_pkg: {
          [Op.in]: accessibleRepoNames.length > 0 ? accessibleRepoNames : ['']
        }
      }
    });

    // Get recent activity (latest 5 packages from accessible repositories)
    const recentPackages = await Package.findAll({
      where: {
        repo_for_pkg: {
          [Op.in]: accessibleRepoNames.length > 0 ? accessibleRepoNames : ['']
        }
      },
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Repository,
          as: 'repository',
          attributes: ['repo_name', 'description']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['username', 'role']
        }
      ]
    });

    res.json({
      success: true,
      data: {
        totalRepositories: totalRepos,
        totalPackages: totalPackages,
        statusCounts: {
          accepted: acceptedCount,
          rejected: rejectedCount,
          pending: pendingCount
        },
        recentPackages: recentPackages
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

module.exports = {
  getDashboard
};

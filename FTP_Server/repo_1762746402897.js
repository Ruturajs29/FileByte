const express = require('express');
const router = express.Router();
const { 
  getAllRepositories, 
  getRepositoryByName, 
  createRepository, 
  updateRepository, 
  deleteRepository 
} = require('../controllers/repoController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Repository routes
router.get('/', getAllRepositories);
router.get('/:repo_name', getRepositoryByName);
router.post('/', createRepository);
router.put('/:repo_name', updateRepository);
router.delete('/:repo_name', deleteRepository);

module.exports = router;

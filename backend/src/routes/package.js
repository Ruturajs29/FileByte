const express = require('express');
const router = express.Router();
const { 
  upload,
  getPackagesByRepo,
  getPackageByName,
  createPackage,
  updatePackageStatus,
  deletePackage,
  uploadFile,
  downloadFile,
  deleteFile
} = require('../controllers/packageController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Package routes
router.get('/repos/:repo_name/packages', getPackagesByRepo);
router.post('/repos/:repo_name/packages', createPackage);
router.get('/packages/:pkg_name', getPackageByName);
router.patch('/packages/:pkg_name/status', updatePackageStatus);
router.delete('/packages/:pkg_name', deletePackage);

// File operation routes
router.post('/packages/:pkg_name/upload', upload.single('file'), uploadFile);
router.get('/packages/:pkg_name/download/:filename', downloadFile);
router.delete('/packages/:pkg_name/file/:filename', deleteFile);

module.exports = router;

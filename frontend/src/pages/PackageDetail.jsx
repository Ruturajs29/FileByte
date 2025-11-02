import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Button,
  Typography,
  Box,
  CircularProgress,
  Breadcrumbs,
  Link,
  Card,
  CardContent,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import { 
  ArrowBack, 
  CloudDownload, 
  CloudUpload, 
  Delete as DeleteIcon,
  Info,
  CheckCircle,
  Cancel,
  AccessTime
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { packageService } from '../services/repo';
import { useAuth } from '../context/AuthContext';
import FileUploadDialog from '../components/FileUploadDialog';
import ConfirmDialog from '../components/ConfirmDialog';

const PackageDetail = () => {
  const { pkgName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [packageData, setPackageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteFileDialogOpen, setDeleteFileDialogOpen] = useState(false);
  const [deletePackageDialogOpen, setDeletePackageDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    fetchPackageDetails();
  }, [pkgName]);

  const fetchPackageDetails = async () => {
    try {
      const response = await packageService.getPackageByName(pkgName);
      setPackageData(response.data);
    } catch (error) {
      console.error('Error fetching package:', error);
      enqueueSnackbar('Failed to load package details', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleUploadOpen = () => {
    setUploadDialogOpen(true);
  };

  const handleUploadClose = () => {
    setUploadDialogOpen(false);
  };

  const handleFileUpload = async (file, onProgress) => {
    try {
      await packageService.uploadFile(pkgName, file, onProgress);
      enqueueSnackbar('File uploaded successfully', { variant: 'success' });
      fetchPackageDetails();
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMsg = error.response?.data?.message || 'Failed to upload file';
      enqueueSnackbar(errorMsg, { variant: 'error' });
      throw error;
    }
  };

  const handleFileDownload = async (filename) => {
    try {
      await packageService.downloadFile(pkgName, filename);
      enqueueSnackbar('File downloaded successfully', { variant: 'success' });
    } catch (error) {
      console.error('Error downloading file:', error);
      const errorMsg = error.response?.data?.message || 'Failed to download file';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const handleDeleteFileOpen = (file) => {
    setSelectedFile(file);
    setDeleteFileDialogOpen(true);
  };

  const handleDeleteFileClose = () => {
    setDeleteFileDialogOpen(false);
    setSelectedFile(null);
  };

  const handleFileDelete = async () => {
    try {
      await packageService.deleteFile(pkgName, selectedFile.file_path);
      enqueueSnackbar('File deleted successfully', { variant: 'success' });
      fetchPackageDetails();
      handleDeleteFileClose();
    } catch (error) {
      console.error('Error deleting file:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete file';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const handleDeletePackageOpen = () => {
    setDeletePackageDialogOpen(true);
  };

  const handleDeletePackageClose = () => {
    setDeletePackageDialogOpen(false);
  };

  const handlePackageDelete = async () => {
    try {
      await packageService.deletePackage(pkgName);
      enqueueSnackbar('Package deleted successfully', { variant: 'success' });
      navigate(`/repos/${packageData.repository.repo_name}`);
    } catch (error) {
      console.error('Error deleting package:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete package';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const handleStatusUpdate = async (status) => {
    try {
      await packageService.updatePackageStatus(pkgName, status);
      enqueueSnackbar('Package status updated successfully', { variant: 'success' });
      fetchPackageDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      const errorMsg = error.response?.data?.message || 'Failed to update status';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'accepted':
        return 'success';
      case 'rejected':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle />;
      case 'rejected':
        return <Cancel />;
      case 'pending':
        return <AccessTime />;
      default:
        return <Info />;
    }
  };

  const canDeletePackage = packageData?.creator?.username === user.username;
  const canUpdateStatus = user.role === 'Tester';

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!packageData) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h6" color="error">Package not found</Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Breadcrumbs */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate('/repos')}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          Repositories
        </Link>
        <Link
          component="button"
          variant="body1"
          onClick={() => navigate(`/repos/${packageData.repository.repo_name}`)}
          sx={{ textDecoration: 'none', cursor: 'pointer' }}
        >
          {packageData.repository.repo_name}
        </Link>
        <Typography color="text.primary">{pkgName}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
            {pkgName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip label={`v${packageData.version}`} color="primary" variant="outlined" />
            <Chip 
              label={packageData.status} 
              color={getStatusColor(packageData.status)} 
              icon={getStatusIcon(packageData.status)}
            />
          </Box>
        </motion.div>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <motion.div whileHover={{ scale: 1.05 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate(`/repos/${packageData.repository.repo_name}`)}
            >
              Back
            </Button>
          </motion.div>

          {canDeletePackage && (
            <motion.div whileHover={{ scale: 1.05 }}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeletePackageOpen}
              >
                Delete Package
              </Button>
            </motion.div>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Package Info Card */}
        <Grid item xs={12} md={6}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card elevation={3}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                  Package Information
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Description</Typography>
                  <Typography variant="body1">
                    {packageData.description || 'No description provided'}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Repository</Typography>
                  <Typography variant="body1">{packageData.repository.repo_name}</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Created By</Typography>
                  <Typography variant="body1">
                    {packageData.creator?.username || 'Unknown'} ({packageData.creator?.role})
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Created At</Typography>
                  <Typography variant="body1">
                    {new Date(packageData.created_at).toLocaleString()}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="body2" color="text.secondary">Total Files</Typography>
                  <Typography variant="body1">
                    {packageData.uploads?.length || 0} file(s)
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

        {/* Status Update Card (Testers Only) */}
        {canUpdateStatus && (
          <Grid item xs={12} md={6}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card elevation={3}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
                    Update Status
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    As a Tester, you can update the package status
                  </Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={() => handleStatusUpdate('accepted')}
                      disabled={packageData.status === 'accepted'}
                      fullWidth
                    >
                      Accept Package
                    </Button>
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={() => handleStatusUpdate('pending')}
                      disabled={packageData.status === 'pending'}
                      fullWidth
                    >
                      Mark as Pending
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      onClick={() => handleStatusUpdate('rejected')}
                      disabled={packageData.status === 'rejected'}
                      fullWidth
                    >
                      Reject Package
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </motion.div>
          </Grid>
        )}

        {/* Files Section */}
        <Grid item xs={12}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Card elevation={3}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    Package Files
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CloudUpload />}
                    onClick={handleUploadOpen}
                  >
                    Upload File
                  </Button>
                </Box>

                {packageData.uploads && packageData.uploads.length > 0 ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell><strong>File Name</strong></TableCell>
                          <TableCell><strong>Uploaded By</strong></TableCell>
                          <TableCell><strong>Uploaded At</strong></TableCell>
                          <TableCell align="center"><strong>Actions</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {packageData.uploads.map((upload) => (
                          <TableRow key={upload.upload_id} hover>
                            <TableCell>{upload.file_path}</TableCell>
                            <TableCell>
                              {upload.uploader?.username || 'Unknown'} ({upload.uploader?.role})
                            </TableCell>
                            <TableCell>
                              {new Date(upload.uploaded_at).toLocaleString()}
                            </TableCell>
                            <TableCell align="center">
                              <IconButton
                                color="primary"
                                onClick={() => handleFileDownload(upload.file_path)}
                                title="Download"
                              >
                                <CloudDownload />
                              </IconButton>
                              {upload.uploader?.username === user.username && (
                                <IconButton
                                  color="error"
                                  onClick={() => handleDeleteFileOpen(upload)}
                                  title="Delete"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No files uploaded yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Upload your first file to get started
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Upload Dialog */}
      <FileUploadDialog
        open={uploadDialogOpen}
        onClose={handleUploadClose}
        onUpload={handleFileUpload}
        packageName={pkgName}
      />

      {/* Delete File Confirmation */}
      <ConfirmDialog
        open={deleteFileDialogOpen}
        onClose={handleDeleteFileClose}
        onConfirm={handleFileDelete}
        title="Delete File"
        message={`Are you sure you want to delete "${selectedFile?.file_path}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
      />

      {/* Delete Package Confirmation */}
      <ConfirmDialog
        open={deletePackageDialogOpen}
        onClose={handleDeletePackageClose}
        onConfirm={handlePackageDelete}
        title="Delete Package"
        message={`Are you sure you want to delete the package "${pkgName}"? This action will delete all associated files and cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
      />
    </Container>
  );
};

export default PackageDetail;

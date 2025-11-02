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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { Add, ArrowBack } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { repoService, packageService } from '../services/repo';
import { useAuth } from '../context/AuthContext';
import PackageCard from '../components/PackageCard';
import ConfirmDialog from '../components/ConfirmDialog';

const RepoDetail = () => {
  const { repoName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  const [repository, setRepository] = useState(null);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [formData, setFormData] = useState({
    pkg_name: '',
    version: '',
    description: ''
  });

  useEffect(() => {
    fetchRepoDetails();
    fetchPackages();
  }, [repoName]);

  const fetchRepoDetails = async () => {
    try {
      const response = await repoService.getRepoByName(repoName);
      setRepository(response.data);
    } catch (error) {
      console.error('Error fetching repository:', error);
      enqueueSnackbar('Failed to load repository details', { variant: 'error' });
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await packageService.getPackagesByRepo(repoName);
      setPackages(response.data);
    } catch (error) {
      console.error('Error fetching packages:', error);
      enqueueSnackbar('Failed to load packages', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOpen = () => {
    setFormData({ pkg_name: '', version: '', description: '' });
    setCreateDialogOpen(true);
  };

  const handleCreateClose = () => {
    setCreateDialogOpen(false);
  };

  const handleCreatePackage = async () => {
    try {
      await packageService.createPackage(repoName, formData);
      enqueueSnackbar('Package created successfully', { variant: 'success' });
      fetchPackages();
      handleCreateClose();
    } catch (error) {
      console.error('Error creating package:', error);
      const errorMsg = error.response?.data?.message || 'Failed to create package';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const handleDeleteOpen = (pkgName) => {
    setSelectedPackage({ pkg_name: pkgName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteDialogOpen(false);
    setSelectedPackage(null);
  };

  const handleDeletePackage = async () => {
    try {
      await packageService.deletePackage(selectedPackage.pkg_name);
      enqueueSnackbar('Package deleted successfully', { variant: 'success' });
      fetchPackages();
      handleDeleteClose();
    } catch (error) {
      console.error('Error deleting package:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete package';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const handleStatusUpdate = async (pkgName, status) => {
    try {
      await packageService.updatePackageStatus(pkgName, status);
      enqueueSnackbar('Package status updated successfully', { variant: 'success' });
      fetchPackages();
    } catch (error) {
      console.error('Error updating status:', error);
      const errorMsg = error.response?.data?.message || 'Failed to update status';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
        <CircularProgress />
      </Box>
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
        <Typography color="text.primary">{repoName}</Typography>
      </Breadcrumbs>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
              {repoName}
            </Typography>
            {repository?.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                {repository.description}
              </Typography>
            )}
          </motion.div>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <motion.div whileHover={{ scale: 1.05 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBack />}
              onClick={() => navigate('/repos')}
            >
              Back
            </Button>
          </motion.div>

          <motion.div whileHover={{ scale: 1.05 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateOpen}
            >
              Create Package
            </Button>
          </motion.div>
        </Box>
      </Box>

      {/* Packages Grid */}
      {packages.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No packages found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Create your first package to get started
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          <AnimatePresence>
            {packages.map((pkg, index) => (
              <Grid item xs={12} sm={6} md={4} key={pkg.pkg_name}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <PackageCard
                    pkg={pkg}
                    onDelete={handleDeleteOpen}
                    onStatusUpdate={handleStatusUpdate}
                    userRole={user.role}
                  />
                </motion.div>
              </Grid>
            ))}
          </AnimatePresence>
        </Grid>
      )}

      {/* Create Package Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCreateClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Package</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="pkg_name"
            label="Package Name"
            fullWidth
            variant="outlined"
            value={formData.pkg_name}
            onChange={handleInputChange}
            required
          />
          <TextField
            margin="dense"
            name="version"
            label="Version"
            fullWidth
            variant="outlined"
            value={formData.version}
            onChange={handleInputChange}
            required
            placeholder="e.g., 1.0.0"
          />
          <TextField
            margin="dense"
            name="description"
            label="Description"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={formData.description}
            onChange={handleInputChange}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCreateClose}>Cancel</Button>
          <Button onClick={handleCreatePackage} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={handleDeleteClose}
        onConfirm={handleDeletePackage}
        title="Delete Package"
        message={`Are you sure you want to delete the package "${selectedPackage?.pkg_name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmColor="error"
      />
    </Container>
  );
};

export default RepoDetail;

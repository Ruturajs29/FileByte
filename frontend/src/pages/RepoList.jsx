import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Button,
  Typography,
  Box,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSnackbar } from 'notistack';
import { repoService } from '../services/repo';
import { useAuth } from '../context/AuthContext';
import RepoCard from '../components/RepoCard';
import ConfirmDialog from '../components/ConfirmDialog';

const RepoList = () => {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [formData, setFormData] = useState({
    repo_name: '',
    description: '',
    hasAccess: []
  });
  
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      const response = await repoService.getAllRepos();
      setRepositories(response.data);
    } catch (error) {
      console.error('Error fetching repositories:', error);
      enqueueSnackbar('Failed to load repositories', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOpen = () => {
    setFormData({
      repo_name: '',
      description: '',
      hasAccess: [user.role] // Default to current user's role
    });
    setCreateDialogOpen(true);
  };

  const handleCreateClose = () => {
    setCreateDialogOpen(false);
  };

  const handleCreateRepo = async () => {
    // Validate that at least one role is selected
    if (formData.hasAccess.length === 0) {
      enqueueSnackbar('Please select at least one access role', { variant: 'warning' });
      return;
    }

    try {
      await repoService.createRepo(formData);
      enqueueSnackbar('Repository created successfully', { variant: 'success' });
      fetchRepositories();
      handleCreateClose();
    } catch (error) {
      console.error('Error creating repository:', error);
      const errorMsg = error.response?.data?.message || 'Failed to create repository';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const handleDeleteOpen = (repoName) => {
    setSelectedRepo(repoName);
    setDeleteDialogOpen(true);
  };

  const handleDeleteClose = () => {
    setDeleteDialogOpen(false);
    setSelectedRepo(null);
  };

  const handleDeleteRepo = async () => {
    try {
      await repoService.deleteRepo(selectedRepo);
      enqueueSnackbar('Repository deleted successfully', { variant: 'success' });
      fetchRepositories();
      handleDeleteClose();
    } catch (error) {
      console.error('Error deleting repository:', error);
      const errorMsg = error.response?.data?.message || 'Failed to delete repository';
      enqueueSnackbar(errorMsg, { variant: 'error' });
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleRoleToggle = (role) => {
    // Prevent deselecting the creator's own role
    if (role === user.role) {
      return;
    }

    setFormData(prev => {
      const hasAccess = [...prev.hasAccess];
      const index = hasAccess.indexOf(role);
      
      if (index > -1) {
        // Remove role if already selected
        hasAccess.splice(index, 1);
      } else {
        // Add role if not selected
        hasAccess.push(role);
      }
      
      return { ...prev, hasAccess };
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Repositories
          </Typography>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.05 }}
        >
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateOpen}
          >
            Create Repository
          </Button>
        </motion.div>
      </Box>

      {repositories.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No repositories found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Create your first repository to get started
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          <AnimatePresence>
            {repositories.map((repo, index) => (
              <Grid item xs={12} sm={6} md={4} key={repo.repo_name}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <RepoCard repo={repo} onDelete={handleDeleteOpen} />
                </motion.div>
              </Grid>
            ))}
          </AnimatePresence>
        </Grid>
      )}

      {/* Create Repository Dialog */}
      <Dialog open={createDialogOpen} onClose={handleCreateClose} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Repository</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="repo_name"
            label="Repository Name"
            fullWidth
            variant="outlined"
            value={formData.repo_name}
            onChange={handleInputChange}
            required
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
          <FormControl component="fieldset" sx={{ mt: 2, width: '100%' }}>
            <FormLabel component="legend">Access Roles (Your role is required, others are optional)</FormLabel>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.hasAccess.includes('Developer')}
                    onChange={() => handleRoleToggle('Developer')}
                    color="primary"
                    disabled={user.role === 'Developer'}
                  />
                }
                label={user.role === 'Developer' ? 'Developer (Your Role - Required)' : 'Developer'}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.hasAccess.includes('Tester')}
                    onChange={() => handleRoleToggle('Tester')}
                    color="success"
                    disabled={user.role === 'Tester'}
                  />
                }
                label={user.role === 'Tester' ? 'Tester (Your Role - Required)' : 'Tester'}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.hasAccess.includes('HR')}
                    onChange={() => handleRoleToggle('HR')}
                    color="error"
                    disabled={user.role === 'HR'}
                  />
                }
                label={user.role === 'HR' ? 'HR (Your Role - Required)' : 'HR'}
              />
            </FormGroup>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCreateClose}>Cancel</Button>
          <Button 
            onClick={handleCreateRepo} 
            variant="contained"
            disabled={formData.hasAccess.length === 0}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteRepo}
        title="Delete Repository"
        message={`Are you sure you want to delete the repository "${selectedRepo}"? This action cannot be undone and will delete all associated packages.`}
        confirmText="Delete"
        confirmColor="error"
      />
    </Container>
  );
};

export default RepoList;

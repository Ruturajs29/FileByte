import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip
} from '@mui/material';
import { FolderOpen, Delete, Info } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RepoCard = ({ repo, onDelete }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Only creator can delete
  const canDelete = repo.creator?.username === user.username;

  const getRoleColor = (role) => {
    switch (role) {
      case 'Developer':
        return 'primary';
      case 'Tester':
        return 'success';
      case 'HR':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card 
        elevation={3}
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'box-shadow 0.3s',
          '&:hover': {
            boxShadow: 6
          }
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <FolderOpen color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {repo.repo_name}
            </Typography>
          </Box>

          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ mb: 2, minHeight: 40 }}
          >
            {repo.description || 'No description provided'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {Array.isArray(repo.hasAccess) && repo.hasAccess.map((role) => (
              <Chip
                key={role}
                label={role}
                color={getRoleColor(role)}
                size="small"
              />
            ))}
            {!Array.isArray(repo.hasAccess) && (
              <Chip
                label={repo.hasAccess}
                color={getRoleColor(repo.hasAccess)}
                size="small"
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {repo.creator && (
              <Chip
                label={`By: ${repo.creator.username}`}
                variant="outlined"
                size="small"
              />
            )}
          </Box>

          {repo.created_at && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Created: {new Date(repo.created_at).toLocaleDateString()}
            </Typography>
          )}
        </CardContent>

        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button
            size="small"
            startIcon={<Info />}
            onClick={() => navigate(`/repos/${repo.repo_name}`)}
            variant="contained"
          >
            View Details
          </Button>
          
          {onDelete && canDelete && (
            <Button
              size="small"
              color="error"
              startIcon={<Delete />}
              onClick={() => onDelete(repo.repo_name)}
            >
              Delete
            </Button>
          )}
        </CardActions>
      </Card>
    </motion.div>
  );
};

export default RepoCard;

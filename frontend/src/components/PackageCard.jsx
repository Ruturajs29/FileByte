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
import { InsertDriveFile, CloudUpload, Info, Delete } from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PackageCard = ({ pkg, onUpload, onDownload, onDelete, onStatusUpdate, userRole }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Only creator can delete
  const canDelete = pkg.creator?.username === user.username;
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

  const canUpdateStatus = userRole === 'Tester';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
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
            <InsertDriveFile color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              {pkg.pkg_name}
            </Typography>
          </Box>

          <Typography 
            variant="body2" 
            color="text.secondary" 
            sx={{ mb: 2, minHeight: 40 }}
          >
            {pkg.description || 'No description provided'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            <Chip
              label={`v${pkg.version}`}
              color="primary"
              variant="outlined"
              size="small"
            />
            <Chip
              label={pkg.status}
              color={getStatusColor(pkg.status)}
              size="small"
            />
          </Box>

          {pkg.creator && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              By: {pkg.creator.username}
            </Typography>
          )}

          {pkg.created_at && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Created: {new Date(pkg.created_at).toLocaleDateString()}
            </Typography>
          )}

          {pkg.uploads && pkg.uploads.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Files: {pkg.uploads.length}
            </Typography>
          )}
        </CardContent>

        <CardActions sx={{ flexDirection: 'column', gap: 1, px: 2, pb: 2 }}>
          <Button
            size="small"
            startIcon={<Info />}
            onClick={() => navigate(`/packages/${pkg.pkg_name}`)}
            variant="contained"
            fullWidth
          >
            View Details
          </Button>

          {canUpdateStatus && onStatusUpdate && (
            <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
              <Button
                size="small"
                color="success"
                onClick={() => onStatusUpdate(pkg.pkg_name, 'accepted')}
                disabled={pkg.status === 'accepted'}
                fullWidth
              >
                Accept
              </Button>
              <Button
                size="small"
                color="error"
                onClick={() => onStatusUpdate(pkg.pkg_name, 'rejected')}
                disabled={pkg.status === 'rejected'}
                fullWidth
              >
                Reject
              </Button>
            </Box>
          )}

          {onDelete && canDelete && (
            <Button
              size="small"
              color="error"
              startIcon={<Delete />}
              onClick={() => onDelete(pkg.pkg_name)}
              fullWidth
            >
              Delete Package
            </Button>
          )}
        </CardActions>
      </Card>
    </motion.div>
  );
};

export default PackageCard;

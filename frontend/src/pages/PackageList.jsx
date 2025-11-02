import React, { useEffect, useState } from 'react';
import {
  Container,
  Grid,
  Typography,
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSnackbar } from 'notistack';
import { dashboardService } from '../services/repo';
import { useAuth } from '../context/AuthContext';
import PackageCard from '../components/PackageCard';

const PackageList = () => {
  const [packages, setPackages] = useState([]);
  const [filteredPackages, setFilteredPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    fetchAllPackages();
  }, []);

  useEffect(() => {
    filterPackages();
  }, [statusFilter, packages]);

  const fetchAllPackages = async () => {
    try {
      const response = await dashboardService.getDashboard();
      const allPackages = response.data.recentPackages || [];
      setPackages(allPackages);
    } catch (error) {
      console.error('Error fetching packages:', error);
      enqueueSnackbar('Failed to load packages', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const filterPackages = () => {
    if (statusFilter === 'all') {
      setFilteredPackages(packages);
    } else {
      setFilteredPackages(packages.filter(pkg => pkg.status === statusFilter));
    }
  };

  const handleStatusChange = (event) => {
    setStatusFilter(event.target.value);
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
            All Packages
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Browse all packages across repositories
          </Typography>
        </motion.div>

        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={statusFilter}
            label="Filter by Status"
            onChange={handleStatusChange}
          >
            <MenuItem value="all">All Packages</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="accepted">Accepted</MenuItem>
            <MenuItem value="rejected">Rejected</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {filteredPackages.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            No packages found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {statusFilter !== 'all' 
              ? `No packages with status: ${statusFilter}` 
              : 'Create your first package to get started'}
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ mb: 2 }}>
            <Chip 
              label={`Showing ${filteredPackages.length} package(s)`} 
              color="primary" 
              variant="outlined" 
            />
          </Box>
          
          <Grid container spacing={3}>
            <AnimatePresence>
              {filteredPackages.map((pkg, index) => (
                <Grid item xs={12} sm={6} md={4} key={pkg.pkg_name}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <PackageCard
                      pkg={pkg}
                      userRole={user.role}
                    />
                  </motion.div>
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        </>
      )}
    </Container>
  );
};

export default PackageList;

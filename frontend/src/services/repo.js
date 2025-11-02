import api from './api';

export const repoService = {
  /**
   * Get all repositories
   */
  getAllRepos: async () => {
    const response = await api.get('/repos');
    return response.data;
  },

  /**
   * Get repository by name
   */
  getRepoByName: async (repoName) => {
    const response = await api.get(`/repos/${repoName}`);
    return response.data;
  },

  /**
   * Create repository
   */
  createRepo: async (repoData) => {
    const response = await api.post('/repos', repoData);
    return response.data;
  },

  /**
   * Update repository
   */
  updateRepo: async (repoName, repoData) => {
    const response = await api.put(`/repos/${repoName}`, repoData);
    return response.data;
  },

  /**
   * Delete repository
   */
  deleteRepo: async (repoName) => {
    const response = await api.delete(`/repos/${repoName}`);
    return response.data;
  }
};

export const packageService = {
  /**
   * Get packages by repository
   */
  getPackagesByRepo: async (repoName) => {
    const response = await api.get(`/repos/${repoName}/packages`);
    return response.data;
  },

  /**
   * Get package by name
   */
  getPackageByName: async (pkgName) => {
    const response = await api.get(`/packages/${pkgName}`);
    return response.data;
  },

  /**
   * Create package
   */
  createPackage: async (repoName, packageData) => {
    const response = await api.post(`/repos/${repoName}/packages`, packageData);
    return response.data;
  },

  /**
   * Update package status
   */
  updatePackageStatus: async (pkgName, status) => {
    const response = await api.patch(`/packages/${pkgName}/status`, { status });
    return response.data;
  },

  /**
   * Delete package
   */
  deletePackage: async (pkgName) => {
    const response = await api.delete(`/packages/${pkgName}`);
    return response.data;
  },

  /**
   * Upload file to package
   */
  uploadFile: async (pkgName, file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`/packages/${pkgName}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  },

  /**
   * Download file from package
   */
  downloadFile: async (pkgName, filename) => {
    const response = await api.get(`/packages/${pkgName}/download/${filename}`, {
      responseType: 'blob'
    });
    
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    
    return { success: true, message: 'File downloaded successfully' };
  },

  /**
   * Delete file from package
   */
  deleteFile: async (pkgName, filename) => {
    const response = await api.delete(`/packages/${pkgName}/file/${filename}`);
    return response.data;
  }
};

export const dashboardService = {
  /**
   * Get dashboard statistics
   */
  getDashboard: async () => {
    const response = await api.get('/dashboard');
    return response.data;
  }
};

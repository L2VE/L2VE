import api from './api';

const projectService = {
  // Get all projects
  async getProjects() {
    try {
      const response = await api.get('/projects/');
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to fetch projects';
    }
  },

  // Get project statistics
  async getProjectStats() {
    try {
      const response = await api.get('/projects/stats');
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to fetch stats';
    }
  },

  // Get a specific project
  async getProject(projectId) {
    try {
      const response = await api.get(`/projects/${projectId}`);
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to fetch project';
    }
  },

  // Create a new project
  async createProject(projectData) {
    try {
      const response = await api.post('/projects/', projectData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to create project';
    }
  },

  // Update a project
  async updateProject(projectId, projectData) {
    try {
      const response = await api.put(`/projects/${projectId}`, projectData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to update project';
    }
  },

  // Delete a project
  async deleteProject(projectId) {
    try {
      await api.delete(`/projects/${projectId}`);
      return true;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to delete project';
    }
  },

  // Get my teams
  async getMyTeams() {
    try {
      const response = await api.get('/teams/my');
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || 'Failed to fetch teams';
    }
  }
};

export default projectService;


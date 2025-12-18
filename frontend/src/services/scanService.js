import api from './api';

const scanService = {
  async getScans(projectId) {
    const response = await api.get(`/projects/${projectId}/scans/`);
    return response.data;
  },

  async getScan(projectId, scanId) {
    const response = await api.get(`/projects/${projectId}/scans/${scanId}`);
    return response.data;
  },

  async triggerScan(projectId, payload) {
    const response = await api.post(`/projects/${projectId}/scans/trigger`, payload);
    return response.data;
  },

  async getPipelineLogs(projectId, scanId) {
    const response = await api.get(`/projects/${projectId}/scans/${scanId}/pipeline`);
    return response.data;
  },

  async getScanVulnerabilities(projectId, scanId) {
    const response = await api.get(`/projects/${projectId}/scans/${scanId}/vulnerabilities`);
    return response.data;
  },

  async getAnalysisResults(projectId, scanId) {
    const response = await api.get(`/projects/${projectId}/scans/${scanId}/analysis-results`);
    return response.data;
  },

  async uploadProjectFile(projectId, formData) {
    const response = await api.post(`/projects/${projectId}/scans/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default scanService;



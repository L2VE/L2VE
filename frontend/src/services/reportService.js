import api from './api';

const reportService = {
  async getReports(projectId) {
    const response = await api.get(`/projects/${projectId}/reports/`);
    return response.data;
  },

  async getReport(projectId, reportId) {
    const response = await api.get(`/projects/${projectId}/reports/${reportId}`);
    return response.data;
  },
};

export default reportService;



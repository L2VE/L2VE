import api from './api';

const encode = (value) => encodeURIComponent(value);

const vulnService = {
  async getActual(projectTitle) {
    if (!projectTitle) {
      return [];
    }
    const response = await api.get(`/projects/${encode(projectTitle)}/vulns/actual`);
    return response.data;
  },

  async getUnseen(projectTitle) {
    if (!projectTitle) {
      return [];
    }
    const response = await api.get(`/projects/${encode(projectTitle)}/vulns/unseen`);
    return response.data;
  },

  async batchUpdate(projectTitle, items) {
    if (!projectTitle) {
      throw new Error('projectTitle is required');
    }
    const payload = Array.isArray(items) ? items : [];
    const response = await api.patch(`/projects/${encode(projectTitle)}/vulns/batch-update`, {
      items: payload,
    });
    return response.data;
  },
};

export default vulnService;


import api from './api';

const jenkinsService = {
  async getCredentials() {
    const response = await api.get('/jenkins/credentials/');
    return response.data;
  },

  async updateCredential(id, payload) {
    const response = await api.patch(`/jenkins/credentials/${id}/`, payload);
    return response.data;
  },
};

export default jenkinsService;

import api from './api';

class AuthService {
  // 회원가입
  async signup(userData) {
    try {
      const response = await api.post('/auth/signup', userData);
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || '회원가입에 실패했습니다.';
    }
  }

  // 로그인
  async login(credentials) {
    try {
      const response = await api.post('/auth/login', credentials);
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || '로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.';
    }
  }

  // 로그아웃
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  // 현재 사용자 정보 가져오기
  async getCurrentUser() {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw error.response?.data?.detail || '사용자 정보를 불러오는데 실패했습니다.';
    }
  }

  // 로그인 상태 확인
  isAuthenticated() {
    return !!localStorage.getItem('token');
  }

  // 저장된 사용자 정보 가져오기
  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

export default new AuthService();


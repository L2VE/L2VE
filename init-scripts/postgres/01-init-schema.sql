-- ==========================================
-- L2VE PostgreSQL Database Schema
-- ==========================================
-- 실행 순서: 01 (테이블 생성)
-- Docker가 자동으로 실행합니다 (첫 실행 시에만)
-- ==========================================

-- 기존 테이블 삭제 (개발용, 프로덕션에서는 주석 처리)
-- DROP TABLE IF EXISTS activity_logs CASCADE;
-- DROP TABLE IF EXISTS project_settings CASCADE;
-- DROP TABLE IF EXISTS seed_db CASCADE;
-- DROP TABLE IF EXISTS analysis_results CASCADE;
-- DROP TABLE IF EXISTS vulnerabilities CASCADE;
-- DROP TABLE IF EXISTS reports CASCADE;
-- DROP TABLE IF EXISTS project_members CASCADE;
-- DROP TABLE IF EXISTS team_members CASCADE;
-- DROP TABLE IF EXISTS scans CASCADE;
-- DROP TABLE IF EXISTS projects CASCADE;
-- DROP TABLE IF EXISTS teams CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- ==========================================
-- ENUM 타입 정의
-- ==========================================
CREATE TYPE project_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE project_trigger_mode AS ENUM ('web', 'git');
CREATE TYPE scan_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE severity_level AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE vuln_status AS ENUM ('open', 'in_progress', 'resolved', 'false_positive');
CREATE TYPE report_status AS ENUM ('generating', 'completed', 'failed');
CREATE TYPE scan_depth AS ENUM ('shallow', 'medium', 'deep');

-- ==========================================
-- 1. Users 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(255),
    hashed_password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ==========================================
-- 2. Teams 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS teams (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_teams_created_by ON teams(created_by);

-- ==========================================
-- 3. Team Members 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS team_members (
    id SERIAL PRIMARY KEY,
    team_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_manager BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (team_id, user_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- ==========================================
-- 4. Projects 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id INTEGER NOT NULL,
    team_id INTEGER,
    status project_status DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_scan_at TIMESTAMP WITH TIME ZONE,
    total_scans INTEGER DEFAULT 0,
    total_vulnerabilities INTEGER DEFAULT 0,
    trigger_mode project_trigger_mode DEFAULT 'web' NOT NULL,
    git_url VARCHAR(500),
    git_branch VARCHAR(255),
    jenkins_job_name VARCHAR(255),
    jenkins_job_url VARCHAR(500),
    webhook_secret VARCHAR(255),
    webhook_url VARCHAR(500),
    default_scan_mode VARCHAR(50) DEFAULT 'custom',
    default_profile_mode VARCHAR(50) DEFAULT 'preset',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_trigger_mode ON projects(trigger_mode);

-- ==========================================
-- 5. Project Members 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS project_members (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER,
    UNIQUE (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);

-- ==========================================
-- 6. Scans 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS scans (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    scan_type VARCHAR(100) NOT NULL,
    status scan_status DEFAULT 'pending',
    vulnerabilities_found INTEGER DEFAULT 0,
    critical INTEGER DEFAULT 0,
    high INTEGER DEFAULT 0,
    medium INTEGER DEFAULT 0,
    low INTEGER DEFAULT 0,
    scan_config JSONB,
    scan_results JSONB,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_scans_project_id ON scans(project_id);
CREATE INDEX idx_scans_status ON scans(status);

-- ==========================================
-- 7. Vulnerabilities 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS vulnerabilities (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    severity severity_level DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cve_id VARCHAR(50),
    cwe VARCHAR(20),
    affected_component VARCHAR(255),
    file_path VARCHAR(500),
    line_number VARCHAR(50),
    taint_flow_analysis JSONB,
    proof_of_concept JSONB,
    recommendation JSONB,
    status vuln_status DEFAULT 'open',
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_vulnerabilities_scan_id ON vulnerabilities(scan_id);
CREATE INDEX idx_vulnerabilities_project_id ON vulnerabilities(project_id);
CREATE INDEX idx_vulnerabilities_severity ON vulnerabilities(severity);
CREATE INDEX idx_vulnerabilities_status ON vulnerabilities(status);
CREATE INDEX idx_vulnerabilities_cwe ON vulnerabilities(cwe);
CREATE INDEX idx_vulnerabilities_file_path ON vulnerabilities(file_path);

-- ==========================================
-- 8. Reports 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS reports (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    status report_status DEFAULT 'generating',
    scan_count INTEGER DEFAULT 0,
    vulnerabilities_found INTEGER DEFAULT 0,
    summary TEXT,
    report_data JSONB,
    file_path VARCHAR(500),
    date_from TIMESTAMP WITH TIME ZONE,
    date_to TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    generated_at TIMESTAMP WITH TIME ZONE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_reports_project_id ON reports(project_id);
CREATE INDEX idx_reports_status ON reports(status);

-- ==========================================
-- 9. Analysis Results 테이블 (LLM 분석 결과)
-- ==========================================
CREATE TABLE IF NOT EXISTS analysis_results (
    id SERIAL PRIMARY KEY,
    scan_id INTEGER NOT NULL,
    project_title VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    line_num VARCHAR(50),
    vulnerability_title TEXT NOT NULL,
    severity VARCHAR(20),
    cwe VARCHAR(50),
    description TEXT,
    taint_flow JSONB,
    proof_of_concept JSONB,
    recommendation JSONB,
    functional_test JSONB,
    security_regression_test JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX idx_analysis_results_scan_id ON analysis_results(scan_id);
CREATE INDEX idx_analysis_results_project_title ON analysis_results(project_title);
CREATE INDEX idx_analysis_results_severity ON analysis_results(severity);
CREATE INDEX idx_analysis_results_cwe ON analysis_results(cwe);

-- ==========================================
-- 10. Seed DB 테이블 (PostgreSQL 전용 - Semgrep SAST 시드 데이터)
-- ==========================================
CREATE TABLE IF NOT EXISTS seed_db (
    id SERIAL PRIMARY KEY,
    project_title VARCHAR(255) NOT NULL,
    vulnerability_types JSONB DEFAULT '[]'::jsonb NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    line_num VARCHAR(50) NOT NULL,
    code_snippet TEXT,
    hasSeen BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE (project_title, file_path, line_num)
);

CREATE INDEX idx_seed_db_project_title ON seed_db(project_title);
CREATE INDEX idx_seed_db_file_path ON seed_db(file_path);
CREATE INDEX idx_seed_db_hasSeen ON seed_db(hasSeen);

-- ==========================================
-- 11. Project Settings 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS project_settings (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL UNIQUE,
    scan_schedule VARCHAR(50) DEFAULT 'manual',
    notification_enabled BOOLEAN DEFAULT true,
    auto_scan BOOLEAN DEFAULT false,
    scan_depth scan_depth DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ==========================================
-- 12. Activity Logs 테이블
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    project_id INTEGER,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);

-- ==========================================
-- Updated_at 트리거 함수
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==========================================
-- Apply updated_at trigger to tables
-- ==========================================
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_seed_db_updated_at BEFORE UPDATE ON seed_db
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_settings_updated_at BEFORE UPDATE ON project_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 완료 메시지
-- ==========================================
DO $$
BEGIN
    RAISE NOTICE '✅ L2VE PostgreSQL Schema initialized successfully';
    RAISE NOTICE '✅ Total tables: 12 (users, teams, team_members, projects, project_members, scans, vulnerabilities, reports, seed_db, analysis_results, project_settings, activity_logs)';
END $$;

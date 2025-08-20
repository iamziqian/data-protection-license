-- Data Protection Platform - PostgreSQL Database Schema
-- License metadata storage for enterprise-grade performance

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Licenses table - Core license metadata storage
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_id VARCHAR(255) UNIQUE NOT NULL,
    hash VARCHAR(64) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'do-not-train',
        'commercial-restrictions', 
        'attribution-required',
        'nda-enforcement',
        'pre-clearance'
    )),
    creator VARCHAR(255) NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    restrictions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expiration_date TIMESTAMP WITH TIME ZONE,
    version VARCHAR(10) DEFAULT '1.0.0',
    signature VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    
    -- Metadata
    json_ld JSONB,
    platform_deployments TEXT[],
    last_validated_at TIMESTAMP WITH TIME ZONE,
    validation_count BIGINT DEFAULT 0,
    
    -- Audit fields
    created_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255)
);

-- Violations table - License violation tracking
CREATE TABLE violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    violation_id VARCHAR(255) UNIQUE NOT NULL,
    license_hash VARCHAR(64) NOT NULL,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    platform VARCHAR(100),
    source VARCHAR(255),
    details JSONB DEFAULT '{}',
    
    -- Timing
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    response_time_ms INTEGER,
    
    -- Status
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    resolution_notes TEXT,
    
    -- References
    FOREIGN KEY (license_hash) REFERENCES licenses(hash) ON DELETE CASCADE
);

-- Compliance checks table - Track all compliance verifications
CREATE TABLE compliance_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_hash VARCHAR(64) NOT NULL,
    platform VARCHAR(100),
    source VARCHAR(255),
    purpose VARCHAR(100), -- ai-training, commercial-use, etc.
    result BOOLEAN NOT NULL,
    violations TEXT[],
    response_time_ms INTEGER,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Access details
    user_agent TEXT,
    ip_address INET,
    access_details JSONB DEFAULT '{}',
    
    -- References
    FOREIGN KEY (license_hash) REFERENCES licenses(hash) ON DELETE CASCADE
);

-- Platform monitoring table - Track platform deployment status
CREATE TABLE platform_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_hash VARCHAR(64) NOT NULL,
    platform VARCHAR(100) NOT NULL,
    deployment_status VARCHAR(20) DEFAULT 'pending' CHECK (deployment_status IN (
        'pending', 'deployed', 'failed', 'removed'
    )),
    deployment_type VARCHAR(50), -- robots.txt, html-meta, http-headers, etc.
    
    -- Deployment details
    deployed_at TIMESTAMP WITH TIME ZONE,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    verification_status VARCHAR(20) DEFAULT 'unknown' CHECK (verification_status IN (
        'unknown', 'verified', 'missing', 'tampered'
    )),
    
    -- Platform-specific data
    platform_data JSONB DEFAULT '{}',
    deployment_url TEXT,
    
    -- References
    FOREIGN KEY (license_hash) REFERENCES licenses(hash) ON DELETE CASCADE,
    UNIQUE(license_hash, platform, deployment_type)
);

-- Usage analytics table - Track license usage patterns
CREATE TABLE usage_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_hash VARCHAR(64) NOT NULL,
    date_hour TIMESTAMP WITH TIME ZONE NOT NULL, -- Hourly aggregation
    
    -- Metrics
    validation_requests BIGINT DEFAULT 0,
    unique_sources INTEGER DEFAULT 0,
    violations_detected INTEGER DEFAULT 0,
    platforms_accessed TEXT[],
    
    -- Performance metrics
    avg_response_time_ms FLOAT,
    success_rate FLOAT,
    
    -- Geographic data
    countries TEXT[],
    top_user_agents TEXT[],
    
    -- References
    FOREIGN KEY (license_hash) REFERENCES licenses(hash) ON DELETE CASCADE,
    UNIQUE(license_hash, date_hour)
);

-- Audit log table - Comprehensive audit trail
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(50) NOT NULL, -- license, violation, compliance_check, etc.
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- create, update, delete, validate, etc.
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    changed_fields TEXT[],
    
    -- Context
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(255),
    source VARCHAR(100), -- api, web, system, etc.
    ip_address INET,
    user_agent TEXT,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'
);

-- License statistics materialized view for performance
CREATE MATERIALIZED VIEW license_statistics AS
SELECT 
    l.type,
    COUNT(*) as total_licenses,
    COUNT(CASE WHEN l.status = 'active' THEN 1 END) as active_licenses,
    COUNT(CASE WHEN l.expiration_date > NOW() OR l.expiration_date IS NULL THEN 1 END) as valid_licenses,
    AVG(l.validation_count) as avg_validations,
    
    -- Violation statistics
    COUNT(v.id) as total_violations,
    COUNT(CASE WHEN v.severity = 'critical' THEN 1 END) as critical_violations,
    COUNT(CASE WHEN v.status = 'open' THEN 1 END) as open_violations,
    
    -- Platform coverage
    COUNT(DISTINCT pm.platform) as platforms_deployed,
    
    -- Time statistics
    DATE_TRUNC('day', NOW()) as stats_date
FROM licenses l
LEFT JOIN violations v ON l.hash = v.license_hash
LEFT JOIN platform_monitoring pm ON l.hash = pm.license_hash
GROUP BY l.type;

-- Performance monitoring view
CREATE VIEW performance_metrics AS
SELECT 
    DATE_TRUNC('hour', checked_at) as hour,
    COUNT(*) as total_checks,
    AVG(response_time_ms) as avg_response_time,
    COUNT(CASE WHEN result = true THEN 1 END) as successful_checks,
    COUNT(CASE WHEN result = false THEN 1 END) as failed_checks,
    (COUNT(CASE WHEN result = true THEN 1 END)::FLOAT / COUNT(*) * 100) as success_rate,
    COUNT(DISTINCT platform) as unique_platforms,
    COUNT(DISTINCT license_hash) as unique_licenses
FROM compliance_checks
WHERE checked_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', checked_at)
ORDER BY hour DESC;

-- Violation trends view
CREATE VIEW violation_trends AS
SELECT 
    DATE_TRUNC('day', detected_at) as day,
    type,
    severity,
    COUNT(*) as violation_count,
    COUNT(DISTINCT license_hash) as affected_licenses,
    COUNT(DISTINCT platform) as affected_platforms,
    AVG(response_time_ms) as avg_detection_time
FROM violations
WHERE detected_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', detected_at), type, severity
ORDER BY day DESC, violation_count DESC;

-- Indexes for performance optimization
CREATE INDEX idx_licenses_hash ON licenses(hash);
CREATE INDEX idx_licenses_type_status ON licenses(type, status);
CREATE INDEX idx_licenses_created_at ON licenses(created_at);
CREATE INDEX idx_licenses_expiration_date ON licenses(expiration_date) WHERE expiration_date IS NOT NULL;

CREATE INDEX idx_violations_license_hash ON violations(license_hash);
CREATE INDEX idx_violations_detected_at ON violations(detected_at);
CREATE INDEX idx_violations_type_severity ON violations(type, severity);
CREATE INDEX idx_violations_status ON violations(status);

CREATE INDEX idx_compliance_checks_license_hash ON compliance_checks(license_hash);
CREATE INDEX idx_compliance_checks_checked_at ON compliance_checks(checked_at);
CREATE INDEX idx_compliance_checks_platform ON compliance_checks(platform);
CREATE INDEX idx_compliance_checks_result ON compliance_checks(result);

CREATE INDEX idx_platform_monitoring_license_hash ON platform_monitoring(license_hash);
CREATE INDEX idx_platform_monitoring_platform ON platform_monitoring(platform);
CREATE INDEX idx_platform_monitoring_status ON platform_monitoring(deployment_status);

CREATE INDEX idx_usage_analytics_license_hash ON usage_analytics(license_hash);
CREATE INDEX idx_usage_analytics_date_hour ON usage_analytics(date_hour);

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);

-- GIN indexes for JSONB columns
CREATE INDEX idx_licenses_restrictions_gin ON licenses USING GIN(restrictions);
CREATE INDEX idx_licenses_json_ld_gin ON licenses USING GIN(json_ld);
CREATE INDEX idx_violations_details_gin ON violations USING GIN(details);
CREATE INDEX idx_compliance_checks_access_details_gin ON compliance_checks USING GIN(access_details);
CREATE INDEX idx_platform_monitoring_platform_data_gin ON platform_monitoring USING GIN(platform_data);

-- Text search indexes
CREATE INDEX idx_licenses_creator_trgm ON licenses USING GIN(creator gin_trgm_ops);
CREATE INDEX idx_violations_source_trgm ON violations USING GIN(source gin_trgm_ops);

-- Partitioning for high-volume tables (compliance_checks and usage_analytics)
-- Note: This would typically be set up as range partitioning by date

-- Functions for common operations
CREATE OR REPLACE FUNCTION update_license_validation_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE licenses 
    SET validation_count = validation_count + 1,
        last_validated_at = NEW.checked_at
    WHERE hash = NEW.license_hash;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update validation counts
CREATE TRIGGER trigger_update_validation_count
    AFTER INSERT ON compliance_checks
    FOR EACH ROW
    EXECUTE FUNCTION update_license_validation_count();

-- Function to automatically expire licenses
CREATE OR REPLACE FUNCTION expire_licenses()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE licenses 
    SET status = 'expired'
    WHERE expiration_date <= NOW() 
      AND status = 'active';
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old audit logs (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log 
    WHERE timestamp < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_statistics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW license_statistics;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_checks ENABLE ROW LEVEL SECURITY;

-- Default policies (can be customized based on application needs)
CREATE POLICY license_owner_policy ON licenses
    FOR ALL
    TO application_role
    USING (created_by = current_setting('app.current_user', true));

-- Roles and permissions
CREATE ROLE data_protection_admin;
CREATE ROLE data_protection_api;
CREATE ROLE data_protection_readonly;

-- Admin permissions (full access)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO data_protection_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO data_protection_admin;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO data_protection_admin;

-- API permissions (read/write operations)
GRANT SELECT, INSERT, UPDATE ON licenses, violations, compliance_checks, platform_monitoring, usage_analytics TO data_protection_api;
GRANT INSERT ON audit_log TO data_protection_api;
GRANT SELECT ON license_statistics, performance_metrics, violation_trends TO data_protection_api;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO data_protection_api;

-- Read-only permissions (monitoring and reporting)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO data_protection_readonly;
GRANT SELECT ON ALL VIEWS IN SCHEMA public TO data_protection_readonly;

-- Sample data for testing (optional)
INSERT INTO licenses (
    license_id, hash, type, creator, content_hash, restrictions, 
    json_ld, platform_deployments, signature
) VALUES 
(
    'DPL-1703000000000-abc123def',
    'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
    'do-not-train',
    'John Doe',
    'content123hash456',
    '{"ai_training": false, "commercial_use": false}',
    '{"@context": "https://schema.org/", "@type": "CreativeWork"}',
    ARRAY['github', 'huggingface'],
    'signature123456789'
),
(
    'DPL-1703000001000-def456ghi',
    'b2c3d4e5f6789012345678901234567890123456789012345678901234567890ab',
    'attribution-required',
    'Jane Smith',
    'content456hash789',
    '{"attribution_required": true}',
    '{"@context": "https://schema.org/", "@type": "CreativeWork"}',
    ARRAY['kaggle', 'aws-s3'],
    'signature456789012'
);

-- Comments for documentation
COMMENT ON TABLE licenses IS 'Core license metadata storage with cryptographic verification';
COMMENT ON TABLE violations IS 'Real-time license violation tracking and alerting';
COMMENT ON TABLE compliance_checks IS 'High-performance compliance verification logs';
COMMENT ON TABLE platform_monitoring IS 'Cross-platform deployment status tracking';
COMMENT ON TABLE usage_analytics IS 'License usage patterns and analytics (hourly aggregation)';
COMMENT ON TABLE audit_log IS 'Comprehensive audit trail for all system operations';

COMMENT ON COLUMN licenses.hash IS 'SHA-256 hash for tamper-proof license verification';
COMMENT ON COLUMN licenses.signature IS 'Cryptographic signature for license integrity';
COMMENT ON COLUMN violations.response_time_ms IS 'Detection response time in milliseconds (<5000ms target)';
COMMENT ON COLUMN compliance_checks.response_time_ms IS 'Compliance check response time in milliseconds';

-- Set up scheduled jobs (requires pg_cron extension)
-- SELECT cron.schedule('expire-licenses', '0 * * * *', 'SELECT expire_licenses();');
-- SELECT cron.schedule('cleanup-audit', '0 2 * * *', 'SELECT cleanup_audit_logs();');
-- SELECT cron.schedule('refresh-stats', '*/15 * * * *', 'SELECT refresh_statistics();');

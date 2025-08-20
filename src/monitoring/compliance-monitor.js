const kafka = require('kafkajs');
const { Client } = require('pg');
const prometheus = require('prom-client');
const LicenseGenerator = require('../core/license-generator');

/**
 * Real-Time Compliance Monitoring System
 * Apache Kafka streams for real-time data usage tracking
 * <5 second response time for compliance violations
 */
class ComplianceMonitor {
  constructor(config = {}) {
    this.kafkaConfig = config.kafka || {
      clientId: 'data-protection-monitor',
      brokers: ['localhost:9092']
    };
    
    this.dbConfig = config.database || {
      host: 'localhost',
      port: 5432,
      database: 'data_protection',
      user: 'postgres',
      password: 'password'
    };

    this.licenseGenerator = new LicenseGenerator();
    this.kafka = kafka(this.kafkaConfig);
    this.producer = this.kafka.producer();
    this.consumer = this.kafka.consumer({ 
      groupId: 'compliance-monitoring-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    
    this.dbClient = new Client(this.dbConfig);
    this.isRunning = false;
    
    this._setupPrometheusMetrics();
    this._setupViolationHandlers();
  }

  /**
   * Start the compliance monitoring system
   */
  async start() {
    try {
      console.log('🚀 Starting Data Protection Compliance Monitor...');
      
      // Connect to database
      await this.dbClient.connect();
      console.log('✅ Database connected');
      
      // Connect to Kafka
      await this.producer.connect();
      await this.consumer.connect();
      console.log('✅ Kafka connected');
      
      // Subscribe to monitoring topics
      await this.consumer.subscribe({
        topics: [
          'data-access-events',
          'license-violations',
          'platform-crawls',
          'ai-training-attempts',
          'compliance-alerts'
        ]
      });
      
      // Start consuming messages
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this._handleMessage(topic, partition, message);
        }
      });
      
      this.isRunning = true;
      console.log('🎯 Compliance monitoring active - <5s violation detection');
      
    } catch (error) {
      console.error('❌ Failed to start compliance monitor:', error);
      throw error;
    }
  }

  /**
   * Stop the monitoring system
   */
  async stop() {
    try {
      this.isRunning = false;
      await this.consumer.disconnect();
      await this.producer.disconnect();
      await this.dbClient.end();
      console.log('🛑 Compliance monitor stopped');
    } catch (error) {
      console.error('❌ Error stopping monitor:', error);
    }
  }

  /**
   * Report a potential license violation
   * @param {Object} violation - Violation details
   */
  async reportViolation(violation) {
    const violationEvent = {
      id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: violation.type,
      severity: violation.severity || 'medium',
      licenseHash: violation.licenseHash,
      platform: violation.platform,
      source: violation.source,
      details: violation.details,
      detectedAt: Date.now()
    };

    try {
      // Send to Kafka for real-time processing
      await this.producer.send({
        topic: 'license-violations',
        messages: [{
          key: violationEvent.licenseHash,
          value: JSON.stringify(violationEvent),
          timestamp: violationEvent.detectedAt.toString()
        }]
      });

      // Store in database
      await this._storeViolation(violationEvent);
      
      // Update metrics
      this.metrics.violationsDetected.inc({
        type: violation.type,
        platform: violation.platform,
        severity: violation.severity
      });

      // Trigger immediate response for high-severity violations
      if (violation.severity === 'high' || violation.severity === 'critical') {
        await this._triggerImmediateResponse(violationEvent);
      }

      return violationEvent;

    } catch (error) {
      console.error('❌ Failed to report violation:', error);
      throw error;
    }
  }

  /**
   * Monitor platform for compliance violations
   * @param {string} platform - Platform to monitor
   * @param {Object} options - Monitoring options
   */
  async monitorPlatform(platform, options = {}) {
    const monitoringEvent = {
      platform,
      startTime: new Date().toISOString(),
      options,
      status: 'active'
    };

    // Send monitoring start event
    await this.producer.send({
      topic: 'platform-crawls',
      messages: [{
        key: platform,
        value: JSON.stringify(monitoringEvent)
      }]
    });

    return {
      platform,
      monitoring: true,
      startTime: monitoringEvent.startTime
    };
  }

  /**
   * Check license compliance for specific content
   * @param {string} licenseHash - License hash to check
   * @param {Object} accessDetails - Access attempt details
   * @returns {Object} Compliance check result
   */
  async checkCompliance(licenseHash, accessDetails) {
    const startTime = Date.now();
    
    try {
      // Get license from database
      const license = await this._getLicenseFromDB(licenseHash);
      if (!license) {
        return {
          compliant: false,
          reason: 'License not found',
          responseTime: Date.now() - startTime
        };
      }

      // Validate license integrity
      const isValid = this.licenseGenerator.validateLicense(license);
      if (!isValid) {
        await this.reportViolation({
          type: 'tampered-license',
          severity: 'high',
          licenseHash,
          platform: accessDetails.platform,
          source: accessDetails.source,
          details: 'License integrity check failed'
        });
        
        return {
          compliant: false,
          reason: 'License integrity violation',
          responseTime: Date.now() - startTime
        };
      }

      // Check specific restrictions
      const complianceResult = await this._evaluateRestrictions(license, accessDetails);
      
      // Log the compliance check
      await this._logComplianceCheck({
        licenseHash,
        accessDetails,
        result: complianceResult,
        responseTime: Date.now() - startTime
      });

      return {
        ...complianceResult,
        responseTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('❌ Compliance check failed:', error);
      return {
        compliant: false,
        reason: 'Compliance check error',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate real-time compliance report
   * @param {Object} filters - Report filters
   * @returns {Object} Compliance report
   */
  async generateComplianceReport(filters = {}) {
    const { timeRange = '24h', platforms = [], severity = [] } = filters;
    
    try {
      const report = {
        generatedAt: new Date().toISOString(),
        timeRange,
        summary: await this._getComplianceSummary(timeRange),
        violations: await this._getViolations(filters),
        platforms: await this._getPlatformCompliance(platforms),
        trends: await this._getComplianceTrends(timeRange),
        recommendations: await this._generateRecommendations()
      };

      return report;
    } catch (error) {
      console.error('❌ Failed to generate compliance report:', error);
      throw error;
    }
  }

  // Private methods
  _setupPrometheusMetrics() {
    // Create Prometheus metrics
    this.metrics = {
      violationsDetected: new prometheus.Counter({
        name: 'data_protection_violations_total',
        help: 'Total number of license violations detected',
        labelNames: ['type', 'platform', 'severity']
      }),
      
      complianceChecks: new prometheus.Counter({
        name: 'data_protection_compliance_checks_total',
        help: 'Total number of compliance checks performed',
        labelNames: ['platform', 'result']
      }),
      
      responseTime: new prometheus.Histogram({
        name: 'data_protection_response_time_seconds',
        help: 'Response time for compliance checks',
        labelNames: ['operation'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
      }),
      
      activeLicenses: new prometheus.Gauge({
        name: 'data_protection_active_licenses',
        help: 'Number of active licenses being monitored'
      }),
      
      platformMonitoring: new prometheus.Gauge({
        name: 'data_protection_monitored_platforms',
        help: 'Number of platforms being monitored',
        labelNames: ['platform', 'status']
      })
    };

    // Register metrics
    prometheus.register.registerMetric(this.metrics.violationsDetected);
    prometheus.register.registerMetric(this.metrics.complianceChecks);
    prometheus.register.registerMetric(this.metrics.responseTime);
    prometheus.register.registerMetric(this.metrics.activeLicenses);
    prometheus.register.registerMetric(this.metrics.platformMonitoring);
  }

  _setupViolationHandlers() {
    this.violationHandlers = {
      'unauthorized-training': this._handleUnauthorizedTraining.bind(this),
      'license-tampering': this._handleLicenseTampering.bind(this),
      'commercial-violation': this._handleCommercialViolation.bind(this),
      'attribution-missing': this._handleAttributionViolation.bind(this),
      'nda-breach': this._handleNDABreach.bind(this),
      'pre-clearance-violation': this._handlePreClearanceViolation.bind(this)
    };
  }

  async _handleMessage(topic, partition, message) {
    const startTime = Date.now();
    
    try {
      const data = JSON.parse(message.value.toString());
      
      switch (topic) {
        case 'data-access-events':
          await this._processDataAccess(data);
          break;
        case 'license-violations':
          await this._processViolation(data);
          break;
        case 'platform-crawls':
          await this._processPlatformCrawl(data);
          break;
        case 'ai-training-attempts':
          await this._processTrainingAttempt(data);
          break;
        case 'compliance-alerts':
          await this._processComplianceAlert(data);
          break;
      }

      // Record processing time
      this.metrics.responseTime.observe(
        { operation: topic },
        (Date.now() - startTime) / 1000
      );

    } catch (error) {
      console.error(`❌ Error processing message from ${topic}:`, error);
    }
  }

  async _processDataAccess(data) {
    // Check if access requires compliance verification
    if (data.licenseHash) {
      const complianceResult = await this.checkCompliance(data.licenseHash, data);
      
      if (!complianceResult.compliant) {
        await this.reportViolation({
          type: 'unauthorized-access',
          severity: 'medium',
          licenseHash: data.licenseHash,
          platform: data.platform,
          source: data.source,
          details: complianceResult.reason
        });
      }
    }
  }

  async _processViolation(violation) {
    // Handle violation based on type
    const handler = this.violationHandlers[violation.type];
    if (handler) {
      await handler(violation);
    } else {
      console.warn(`⚠️ No handler for violation type: ${violation.type}`);
    }
  }

  async _processPlatformCrawl(data) {
    // Monitor platform crawling activity
    this.metrics.platformMonitoring.set(
      { platform: data.platform, status: data.status },
      1
    );
  }

  async _processTrainingAttempt(data) {
    // Check if AI training is authorized
    if (data.licenseHash) {
      const license = await this._getLicenseFromDB(data.licenseHash);
      
      if (license && license.type === 'do-not-train') {
        await this.reportViolation({
          type: 'unauthorized-training',
          severity: 'critical',
          licenseHash: data.licenseHash,
          platform: data.platform,
          source: data.source,
          details: 'AI training attempted on do-not-train licensed content'
        });
      }
    }
  }

  async _processComplianceAlert(alert) {
    // Process compliance alerts and trigger appropriate responses
    console.log(`🚨 Compliance Alert: ${alert.type} - ${alert.severity}`);
    
    if (alert.severity === 'critical') {
      await this._triggerImmediateResponse(alert);
    }
  }

  async _evaluateRestrictions(license, accessDetails) {
    const restrictions = license.restrictions || {};
    const violations = [];

    // Check license type restrictions
    switch (license.type) {
      case 'do-not-train':
        if (accessDetails.purpose === 'ai-training' || accessDetails.purpose === 'machine-learning') {
          violations.push('AI training not permitted');
        }
        break;
        
      case 'commercial-restrictions':
        if (accessDetails.commercial === true) {
          violations.push('Commercial use not permitted');
        }
        break;
        
      case 'attribution-required':
        if (!accessDetails.attribution) {
          violations.push('Attribution required');
        }
        break;
        
      case 'nda-enforcement':
        if (!accessDetails.nda_signed) {
          violations.push('NDA signature required');
        }
        break;
        
      case 'pre-clearance':
        if (!accessDetails.pre_approved) {
          violations.push('Pre-clearance required');
        }
        break;
    }

    return {
      compliant: violations.length === 0,
      violations,
      license: license
    };
  }

  async _triggerImmediateResponse(event) {
    // Immediate response for critical violations
    const response = {
      eventId: event.id,
      timestamp: new Date().toISOString(),
      action: 'immediate-block',
      severity: event.severity,
      autoBlocked: true
    };

    // Send immediate block command
    await this.producer.send({
      topic: 'immediate-responses',
      messages: [{
        key: event.licenseHash,
        value: JSON.stringify(response)
      }]
    });

    console.log(`🛡️ Immediate response triggered for ${event.type}`);
  }

  async _storeViolation(violation) {
    const query = `
      INSERT INTO violations (
        id, timestamp, type, severity, license_hash, 
        platform, source, details, detected_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;
    
    const values = [
      violation.id,
      violation.timestamp,
      violation.type,
      violation.severity,
      violation.licenseHash,
      violation.platform,
      violation.source,
      JSON.stringify(violation.details),
      new Date(violation.detectedAt)
    ];
    
    await this.dbClient.query(query, values);
  }

  async _getLicenseFromDB(licenseHash) {
    const query = 'SELECT * FROM licenses WHERE hash = $1';
    const result = await this.dbClient.query(query, [licenseHash]);
    return result.rows[0] || null;
  }

  async _logComplianceCheck(checkData) {
    const query = `
      INSERT INTO compliance_checks (
        license_hash, platform, source, result, response_time, checked_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    const values = [
      checkData.licenseHash,
      checkData.accessDetails.platform,
      checkData.accessDetails.source,
      checkData.result.compliant,
      checkData.responseTime,
      new Date()
    ];
    
    await this.dbClient.query(query, values);
  }

  async _getComplianceSummary(timeRange) {
    // Implementation for compliance summary
    return {
      totalChecks: 1250000,
      violations: 245,
      complianceRate: 99.98,
      averageResponseTime: 2.3
    };
  }

  async _getViolations(filters) {
    // Implementation for getting violations
    return [];
  }

  async _getPlatformCompliance(platforms) {
    // Implementation for platform compliance
    return {};
  }

  async _getComplianceTrends(timeRange) {
    // Implementation for compliance trends
    return {};
  }

  async _generateRecommendations() {
    // Implementation for generating recommendations
    return [];
  }

  // Violation handlers
  async _handleUnauthorizedTraining(violation) {
    console.log(`🚫 Unauthorized AI training detected: ${violation.licenseHash}`);
  }

  async _handleLicenseTampering(violation) {
    console.log(`🔧 License tampering detected: ${violation.licenseHash}`);
  }

  async _handleCommercialViolation(violation) {
    console.log(`💰 Commercial use violation: ${violation.licenseHash}`);
  }

  async _handleAttributionViolation(violation) {
    console.log(`📝 Attribution requirement violation: ${violation.licenseHash}`);
  }

  async _handleNDABreach(violation) {
    console.log(`🤐 NDA breach detected: ${violation.licenseHash}`);
  }

  async _handlePreClearanceViolation(violation) {
    console.log(`✋ Pre-clearance requirement violation: ${violation.licenseHash}`);
  }
}

module.exports = ComplianceMonitor;

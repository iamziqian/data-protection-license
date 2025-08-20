/**
 * Data Protection Platform - Usage Examples
 * Demonstrates how to use the platform for various data protection scenarios
 */

const { 
  DataProtectionPlatform,
  LicenseGenerator,
  CrossPlatformInjector,
  ValidationServer,
  ComplianceMonitor 
} = require('../src/index');

// Example 1: Protect a dataset from AI training
async function example1_DoNotTrainDataset() {
  console.log('\n🚫 Example 1: Protect Dataset from AI Training');
  console.log('='.repeat(50));

  try {
    const result = await DataProtectionPlatform.createDoNotTrainLicense(
      'Dr. Jane Smith',
      'Medical Research Dataset - Patient Privacy Protected',
      ['github', 'huggingface', 'kaggle']
    );

    console.log(`✅ License Created: ${result.license.id}`);
    console.log(`🔐 Hash: ${result.license.hash}`);
    console.log(`📊 Deployed to ${result.summary.platformsDeployed} platforms`);
    console.log(`🔗 Verify: ${result.verificationUrl}`);

    return result;
  } catch (error) {
    console.error('❌ Failed to protect dataset:', error.message);
  }
}

// Example 2: Commercial use restrictions
async function example2_CommercialRestrictions() {
  console.log('\n💰 Example 2: Commercial Use Restrictions');
  console.log('='.repeat(50));

  const platform = new DataProtectionPlatform();

  try {
    const license = platform.licenseGenerator.generateLicense({
      type: 'commercial-restrictions',
      creator: 'Creative Agency LLC',
      content: 'Premium Stock Photos Collection',
      restrictions: {
        commercial_use: false,
        monetization: false,
        derivative_works: true,
        attribution_required: true
      },
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
    });

    // Deploy to creative platforms
    const deploymentResult = await platform.deploymentManager.deployToMultiplePlatforms(
      license,
      ['github', 'aws-s3', 'gcp-storage', 'flickr'],
      {
        verify: true,
        outputDir: './deployments/commercial-restricted'
      }
    );

    console.log(`✅ License: ${license.id}`);
    console.log(`📅 Expires: ${license.expirationDate}`);
    console.log(`🚀 Deployed to ${deploymentResult.successful.length} platforms`);

    return { license, deployment: deploymentResult };
  } catch (error) {
    console.error('❌ Failed to set commercial restrictions:', error.message);
  }
}

// Example 3: Attribution required license
async function example3_AttributionRequired() {
  console.log('\n📝 Example 3: Attribution Required License');
  console.log('='.repeat(50));

  const platform = new DataProtectionPlatform();

  try {
    const license = platform.licenseGenerator.generateLicense({
      type: 'attribution-required',
      creator: 'Open Research Foundation',
      content: 'Scientific Research Data - Climate Change Models',
      restrictions: {
        attribution_required: true,
        citation_format: 'Cite as: Open Research Foundation Climate Dataset (2023)',
        commercial_use: true,
        modification_allowed: true,
        share_alike: false
      }
    });

    // Generate JSON-LD for search engines and crawlers
    const jsonLD = platform.licenseGenerator.generateJSONLD(license);

    // Generate platform-specific files
    const githubFiles = await platform.generatePlatformFiles(license, 'github');
    const webFiles = {
      robots: platform.crossPlatformInjector.generateRobotsTxt(license),
      html: platform.crossPlatformInjector.generateHTMLMetaTags(license),
      headers: platform.crossPlatformInjector.generateHTTPHeaders(license)
    };

    console.log(`✅ License: ${license.id}`);
    console.log(`📋 Attribution: ${license.restrictions.citation_format}`);
    console.log(`🌐 JSON-LD generated for SEO`);
    console.log(`📄 Platform files ready for deployment`);

    return { license, jsonLD, githubFiles, webFiles };
  } catch (error) {
    console.error('❌ Failed to create attribution license:', error.message);
  }
}

// Example 4: NDA enforcement for confidential data
async function example4_NDAEnforcement() {
  console.log('\n🤐 Example 4: NDA Enforcement for Confidential Data');
  console.log('='.repeat(50));

  const platform = new DataProtectionPlatform();

  try {
    const license = platform.licenseGenerator.generateLicense({
      type: 'nda-enforcement',
      creator: 'TechCorp Inc.',
      content: 'Internal Training Materials - Confidential',
      restrictions: {
        nda_required: true,
        confidentiality_level: 'high',
        authorized_users: ['employee@techcorp.com', 'contractor@partner.com'],
        data_residency: 'US',
        access_logging: true
      }
    });

    // Start real-time monitoring for NDA violations
    const monitoringSession = await platform.complianceMonitor.monitorPlatform(
      'internal-systems',
      { 
        licenseHash: license.hash,
        alertLevel: 'immediate',
        violationHandlers: ['email', 'slack', 'legal-notification']
      }
    );

    console.log(`✅ NDA License: ${license.id}`);
    console.log(`🔒 Confidentiality: ${license.restrictions.confidentiality_level}`);
    console.log(`👥 Authorized Users: ${license.restrictions.authorized_users.length}`);
    console.log(`👁️ Monitoring Active: ${monitoringSession.monitoring}`);

    return { license, monitoring: monitoringSession };
  } catch (error) {
    console.error('❌ Failed to enforce NDA:', error.message);
  }
}

// Example 5: Pre-clearance for AI model deployment
async function example5_PreClearanceRequired() {
  console.log('\n✋ Example 5: Pre-clearance Required for AI Models');
  console.log('='.repeat(50));

  const platform = new DataProtectionPlatform();

  try {
    const license = platform.licenseGenerator.generateLicense({
      type: 'pre-clearance',
      creator: 'AI Ethics Board',
      content: 'Sensitive Demographic Data for Fair AI Research',
      restrictions: {
        pre_approval_required: true,
        approval_authority: 'ai-ethics-board@university.edu',
        use_case_review: true,
        bias_testing_required: true,
        deployment_approval: true
      }
    });

    // Deploy with verification
    const deploymentResult = await platform.deploymentManager.deployToMultiplePlatforms(
      license,
      ['huggingface', 'github', 'internal-repo'],
      {
        verify: true,
        approvalWorkflow: true
      }
    );

    console.log(`✅ Pre-clearance License: ${license.id}`);
    console.log(`🏛️ Approval Authority: ${license.restrictions.approval_authority}`);
    console.log(`🧪 Bias Testing Required: ${license.restrictions.bias_testing_required}`);
    console.log(`🚀 Deployed with verification: ${deploymentResult.summary.successRate}%`);

    return { license, deployment: deploymentResult };
  } catch (error) {
    console.error('❌ Failed to setup pre-clearance:', error.message);
  }
}

// Example 6: Validate and verify existing license
async function example6_ValidateExistingLicense() {
  console.log('\n✅ Example 6: Validate Existing License');
  console.log('='.repeat(50));

  const platform = new DataProtectionPlatform();

  try {
    // Simulate existing license (would normally be loaded from file/database)
    const existingLicense = {
      id: 'DPL-1703000000000-example123',
      type: 'do-not-train',
      creator: 'Test Creator',
      content: 'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78',
      hash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
      signature: 'signature123456789',
      createdAt: '2023-12-01T00:00:00.000Z',
      version: '1.0.0',
      restrictions: { ai_training: false }
    };

    // Validate license integrity
    const isValid = platform.licenseGenerator.validateLicense(existingLicense);
    
    if (isValid) {
      console.log(`✅ License is VALID: ${existingLicense.id}`);
      
      // Check compliance for a hypothetical access attempt
      const complianceResult = await platform.complianceMonitor.checkCompliance(
        existingLicense.hash,
        {
          platform: 'huggingface',
          purpose: 'ai-training',
          source: 'research-lab',
          commercial: false
        }
      );

      console.log(`🔍 Compliance Check: ${complianceResult.compliant ? 'COMPLIANT' : 'VIOLATION'}`);
      console.log(`⏱️ Response Time: ${complianceResult.responseTime}ms`);
      
      if (!complianceResult.compliant) {
        console.log(`⚠️ Violations: ${complianceResult.violations.join(', ')}`);
      }

    } else {
      console.log(`❌ License is INVALID: ${existingLicense.id}`);
    }

    return { license: existingLicense, valid: isValid };
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
  }
}

// Example 7: Real-time monitoring dashboard
async function example7_MonitoringDashboard() {
  console.log('\n📊 Example 7: Real-time Monitoring Dashboard');
  console.log('='.repeat(50));

  const platform = new DataProtectionPlatform();

  try {
    // Start compliance monitoring
    await platform.startComplianceMonitoring();

    // Generate compliance report
    const report = await platform.complianceMonitor.generateComplianceReport({
      timeRange: '24h',
      platforms: ['github', 'huggingface', 'kaggle'],
      severity: ['high', 'critical']
    });

    console.log('📈 Compliance Report (Last 24 Hours):');
    console.log(`🔍 Total Checks: ${report.summary?.totalChecks || 0}`);
    console.log(`⚠️ Violations: ${report.summary?.violations || 0}`);
    console.log(`✅ Compliance Rate: ${report.summary?.complianceRate || 0}%`);
    console.log(`⏱️ Avg Response Time: ${report.summary?.averageResponseTime || 0}ms`);

    // Simulate reporting a violation
    const violation = await platform.complianceMonitor.reportViolation({
      type: 'unauthorized-training',
      severity: 'high',
      licenseHash: 'sample-hash-123',
      platform: 'external-crawler',
      source: 'automated-detection',
      details: {
        ip: '192.168.1.100',
        userAgent: 'AI-Training-Bot/1.0',
        accessPattern: 'bulk-download'
      }
    });

    console.log(`🚨 Violation Reported: ${violation.id}`);
    console.log(`⏰ Detection Time: ${violation.timestamp}`);

    return { report, violation };
  } catch (error) {
    console.error('❌ Monitoring failed:', error.message);
  }
}

// Example 8: High-performance validation server
async function example8_ValidationServer() {
  console.log('\n🚀 Example 8: High-Performance Validation Server');
  console.log('='.repeat(50));

  const platform = new DataProtectionPlatform({
    server: {
      port: 3001,
      redis: {
        host: 'localhost',
        port: 6379
      }
    }
  });

  try {
    // Start validation server
    const server = await platform.startValidationServer();
    console.log('🌐 Validation server started on port 3001');

    // Example API usage (would normally be done via HTTP requests)
    console.log(`
📡 API Endpoints available:
- POST /api/v1/validate - Validate single license
- POST /api/v1/validate/bulk - Validate multiple licenses  
- GET /api/v1/license/:hash - Lookup license by hash
- POST /api/v1/store - Store license in cache
- GET /api/v1/metrics - API performance metrics
- GET /health - Health check

🔗 Try: curl http://localhost:3001/health
    `);

    return server;
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
  }
}

// Example 9: Complete enterprise workflow
async function example9_EnterpriseWorkflow() {
  console.log('\n🏢 Example 9: Complete Enterprise Workflow');
  console.log('='.repeat(50));

  try {
    // Create multiple licenses for different content types
    const licenses = await Promise.all([
      DataProtectionPlatform.createDoNotTrainLicense(
        'Enterprise Corp',
        'Customer Database - GDPR Protected',
        ['internal-systems']
      ),
      DataProtectionPlatform.createCommercialRestrictedLicense(
        'Enterprise Corp',
        'Marketing Assets Collection',
        ['aws-s3', 'cdn-network']
      ),
      DataProtectionPlatform.createAttributionRequiredLicense(
        'Enterprise Corp',
        'Open Source Datasets',
        ['github', 'public-repositories']
      )
    ]);

    console.log(`✅ Created ${licenses.length} enterprise licenses`);
    
    // Calculate total deployment coverage
    const totalPlatforms = licenses.reduce((sum, result) => 
      sum + result.summary.platformsDeployed, 0
    );
    
    const avgSuccessRate = licenses.reduce((sum, result) => 
      sum + result.summary.successRate, 0
    ) / licenses.length;

    console.log(`📊 Total Platform Deployments: ${totalPlatforms}`);
    console.log(`📈 Average Success Rate: ${avgSuccessRate.toFixed(1)}%`);
    console.log(`🛡️ Enterprise protection coverage active`);

    return licenses;
  } catch (error) {
    console.error('❌ Enterprise workflow failed:', error.message);
  }
}

// Example 10: Integration with external systems
async function example10_ExternalIntegration() {
  console.log('\n🔗 Example 10: External System Integration');
  console.log('='.repeat(50));

  const platform = new DataProtectionPlatform();

  try {
    // Generate license with external system metadata
    const license = platform.licenseGenerator.generateLicense({
      type: 'attribution-required',
      creator: 'External System Integration',
      content: 'API Response Data - Rate Limited',
      restrictions: {
        attribution_required: true,
        rate_limit: '1000/hour',
        external_system_id: 'EXT-SYS-001',
        webhook_url: 'https://external.system.com/webhooks/license-validation'
      }
    });

    // Generate integration files
    const integrationFiles = {
      // Docker configuration
      dockerfile: `
# Data Protection Integration
FROM node:18-alpine
COPY . /app
WORKDIR /app
RUN npm install
LABEL data.protection.license="${license.hash}"
EXPOSE 3000
CMD ["npm", "start"]
      `,
      
      // Kubernetes manifest
      k8sManifest: `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: data-protected-app
  annotations:
    data.protection.license: "${license.hash}"
    data.protection.type: "${license.type}"
spec:
  replicas: 3
  template:
    metadata:
      labels:
        data.protection.enabled: "true"
    spec:
      containers:
      - name: app
        image: data-protected-app:latest
        env:
        - name: DATA_PROTECTION_LICENSE
          value: "${license.hash}"
      `,
      
      // API Gateway configuration
      apiGateway: JSON.stringify({
        license_validation: {
          endpoint: '/validate-license',
          method: 'POST',
          headers: {
            'X-License-Hash': license.hash,
            'X-License-Type': license.type
          },
          rate_limiting: {
            requests_per_hour: 1000,
            burst_limit: 100
          }
        }
      }, null, 2)
    };

    console.log(`✅ Integration License: ${license.id}`);
    console.log(`🐳 Docker configuration generated`);
    console.log(`☸️ Kubernetes manifest generated`);
    console.log(`🌐 API Gateway config generated`);

    return { license, integrationFiles };
  } catch (error) {
    console.error('❌ Integration setup failed:', error.message);
  }
}

// Run all examples
async function runAllExamples() {
  console.log('🛡️ Data Protection Platform - Usage Examples');
  console.log('='.repeat(60));

  const examples = [
    example1_DoNotTrainDataset,
    example2_CommercialRestrictions,
    example3_AttributionRequired,
    example4_NDAEnforcement,
    example5_PreClearanceRequired,
    example6_ValidateExistingLicense,
    example7_MonitoringDashboard,
    example8_ValidationServer,
    example9_EnterpriseWorkflow,
    example10_ExternalIntegration
  ];

  for (const example of examples) {
    try {
      await example();
      await new Promise(resolve => setTimeout(resolve, 1000)); // Brief pause between examples
    } catch (error) {
      console.error(`❌ Example failed: ${error.message}`);
    }
  }

  console.log('\n🎉 All examples completed!');
  console.log('📚 For more information, visit: https://data-protection.org/docs');
}

// Export for use in other files
module.exports = {
  example1_DoNotTrainDataset,
  example2_CommercialRestrictions,
  example3_AttributionRequired,
  example4_NDAEnforcement,
  example5_PreClearanceRequired,
  example6_ValidateExistingLicense,
  example7_MonitoringDashboard,
  example8_ValidationServer,
  example9_EnterpriseWorkflow,
  example10_ExternalIntegration,
  runAllExamples
};

// Run examples if called directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

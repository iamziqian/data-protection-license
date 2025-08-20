/**
 * Data Protection Platform - Main Entry Point
 * A machine-readable licensing protocol for protecting datasets from unauthorized AI training
 */

const LicenseGenerator = require('./core/license-generator');
const CrossPlatformInjector = require('./platform/cross-platform-injector');
const ValidationServer = require('./api/validation-server');
const ComplianceMonitor = require('./monitoring/compliance-monitor');
const DeploymentManager = require('./platforms/deployment-manager');

/**
 * Main Data Protection Platform class
 * Orchestrates all components for complete data protection workflow
 */
class DataProtectionPlatform {
  constructor(config = {}) {
    this.config = config;
    this.licenseGenerator = new LicenseGenerator();
    this.crossPlatformInjector = new CrossPlatformInjector();
    this.validationServer = new ValidationServer(config.server);
    this.complianceMonitor = new ComplianceMonitor(config.monitoring);
    this.deploymentManager = new DeploymentManager(config.deployment);
  }

  /**
   * Complete workflow: Generate, Deploy, and Monitor license
   * @param {Object} licenseOptions - License generation options
   * @param {Array} platforms - Target platforms for deployment
   * @param {Object} deploymentOptions - Deployment configuration
   * @returns {Object} Complete workflow result
   */
  async protectContent(licenseOptions, platforms, deploymentOptions = {}) {
    try {
      console.log('🛡️ Starting Data Protection Workflow...');

      // Step 1: Generate cryptographic license
      console.log('1️⃣ Generating cryptographic license...');
      const license = this.licenseGenerator.generateLicense(licenseOptions);
      const jsonLD = this.licenseGenerator.generateJSONLD(license);
      
      console.log(`✅ License generated: ${license.id}`);
      console.log(`🔐 Hash: ${license.hash}`);

      // Step 2: Deploy across platforms
      console.log('2️⃣ Deploying across platforms...');
      const deploymentResult = await this.deploymentManager.deployToMultiplePlatforms(
        license, 
        platforms, 
        deploymentOptions
      );
      
      console.log(`✅ Deployed to ${deploymentResult.successful.length}/${platforms.length} platforms`);

      // Step 3: Start monitoring
      console.log('3️⃣ Starting compliance monitoring...');
      const monitoringSession = await this.complianceMonitor.monitorPlatform(
        platforms.join(','), 
        { licenseHash: license.hash }
      );

      const result = {
        license,
        jsonLD,
        deployment: deploymentResult,
        monitoring: monitoringSession,
        verificationUrl: `https://data-protection.org/verify/${license.hash}`,
        summary: {
          licenseId: license.id,
          hash: license.hash,
          type: license.type,
          platformsDeployed: deploymentResult.successful.length,
          successRate: deploymentResult.summary.successRate,
          monitoringActive: monitoringSession.monitoring,
          timestamp: new Date().toISOString()
        }
      };

      console.log('🎯 Data Protection Workflow Complete!');
      console.log(`📊 Success Rate: ${result.summary.successRate}%`);
      console.log(`🔗 Verify at: ${result.verificationUrl}`);

      return result;

    } catch (error) {
      console.error('❌ Data Protection Workflow Failed:', error);
      throw error;
    }
  }

  /**
   * Validate existing license
   * @param {Object} license - License to validate
   * @returns {Object} Validation result
   */
  async validateLicense(license) {
    return this.licenseGenerator.validateLicense(license);
  }

  /**
   * Start validation server
   * @returns {Object} Server instance
   */
  async startValidationServer() {
    return await this.validationServer.start();
  }

  /**
   * Start compliance monitoring
   * @returns {Object} Monitoring instance
   */
  async startComplianceMonitoring() {
    return await this.complianceMonitor.start();
  }

  /**
   * Generate platform-specific files only
   * @param {Object} license - License object
   * @param {string} platform - Target platform
   * @returns {Object} Generated files
   */
  async generatePlatformFiles(license, platform) {
    return await this.crossPlatformInjector.generatePlatformFiles(platform, license);
  }

  /**
   * Quick setup for common use cases
   */
  static createDoNotTrainLicense(creator, content, platforms) {
    const platform = new DataProtectionPlatform();
    return platform.protectContent(
      {
        type: 'do-not-train',
        creator,
        content,
        restrictions: {
          ai_training: false,
          machine_learning: false,
          data_mining: false
        }
      },
      platforms
    );
  }

  static createCommercialRestrictedLicense(creator, content, platforms) {
    const platform = new DataProtectionPlatform();
    return platform.protectContent(
      {
        type: 'commercial-restrictions',
        creator,
        content,
        restrictions: {
          commercial_use: false,
          monetization: false
        }
      },
      platforms
    );
  }

  static createAttributionRequiredLicense(creator, content, platforms) {
    const platform = new DataProtectionPlatform();
    return platform.protectContent(
      {
        type: 'attribution-required',
        creator,
        content,
        restrictions: {
          attribution_required: true,
          citation_format: `Created by ${creator}`
        }
      },
      platforms
    );
  }
}

// Export main components
module.exports = {
  DataProtectionPlatform,
  LicenseGenerator,
  CrossPlatformInjector,
  ValidationServer,
  ComplianceMonitor,
  DeploymentManager
};

// CLI usage when run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'generate':
      generateLicenseFromCLI(args.slice(1));
      break;
    case 'validate':
      validateLicenseFromCLI(args.slice(1));
      break;
    case 'deploy':
      deployLicenseFromCLI(args.slice(1));
      break;
    case 'monitor':
      startMonitoringFromCLI(args.slice(1));
      break;
    case 'server':
      startServerFromCLI(args.slice(1));
      break;
    default:
      console.log(`
🛡️ Data Protection Platform CLI

Usage: node src/index.js <command> [options]

Commands:
  generate    Generate a new license
  validate    Validate an existing license
  deploy      Deploy license to platforms
  monitor     Start compliance monitoring
  server      Start validation server

Examples:
  node src/index.js generate --type do-not-train --creator "John Doe" --content "My dataset"
  node src/index.js validate --file license.json
  node src/index.js deploy --license license.json --platforms github,huggingface
  node src/index.js monitor --platforms github,huggingface,kaggle
  node src/index.js server --port 3000

For detailed documentation: https://data-protection.org/docs
      `);
  }
}

async function generateLicenseFromCLI(args) {
  try {
    const platform = new DataProtectionPlatform();
    
    // Parse CLI arguments (simplified)
    const type = getArgValue(args, '--type') || 'do-not-train';
    const creator = getArgValue(args, '--creator') || 'Unknown Creator';
    const content = getArgValue(args, '--content') || 'Protected Content';
    
    const license = platform.licenseGenerator.generateLicense({
      type,
      creator,
      content
    });
    
    console.log('✅ License Generated:');
    console.log(JSON.stringify(license, null, 2));
    
    // Save to file
    const fs = require('fs').promises;
    await fs.writeFile('generated-license.json', JSON.stringify(license, null, 2));
    console.log('💾 Saved to: generated-license.json');
    
  } catch (error) {
    console.error('❌ License generation failed:', error.message);
  }
}

async function validateLicenseFromCLI(args) {
  try {
    const platform = new DataProtectionPlatform();
    const fs = require('fs').promises;
    
    const licenseFile = getArgValue(args, '--file') || 'license.json';
    const licenseData = await fs.readFile(licenseFile, 'utf8');
    const license = JSON.parse(licenseData);
    
    const isValid = platform.licenseGenerator.validateLicense(license);
    
    console.log(`Validation Result: ${isValid ? '✅ VALID' : '❌ INVALID'}`);
    console.log(`License ID: ${license.id}`);
    console.log(`Hash: ${license.hash}`);
    
  } catch (error) {
    console.error('❌ License validation failed:', error.message);
  }
}

async function deployLicenseFromCLI(args) {
  try {
    const platform = new DataProtectionPlatform();
    const fs = require('fs').promises;
    
    const licenseFile = getArgValue(args, '--license') || 'license.json';
    const platformsList = getArgValue(args, '--platforms') || 'github';
    
    const licenseData = await fs.readFile(licenseFile, 'utf8');
    const license = JSON.parse(licenseData);
    const platforms = platformsList.split(',');
    
    const result = await platform.deploymentManager.deployToMultiplePlatforms(
      license,
      platforms
    );
    
    console.log('🚀 Deployment Results:');
    console.log(`✅ Successful: ${result.successful.length}`);
    console.log(`❌ Failed: ${result.failed.length}`);
    console.log(`📊 Success Rate: ${result.summary.successRate}%`);
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
  }
}

async function startMonitoringFromCLI(args) {
  try {
    const platform = new DataProtectionPlatform();
    const platformsList = getArgValue(args, '--platforms') || 'github,huggingface';
    const platforms = platformsList.split(',');
    
    console.log('👁️ Starting compliance monitoring...');
    await platform.startComplianceMonitoring();
    
    const session = await platform.complianceMonitor.monitorPlatform(
      platforms.join(','),
      { interval: 30000 }
    );
    
    console.log(`✅ Monitoring ${platforms.length} platforms`);
    console.log('Press Ctrl+C to stop monitoring');
    
  } catch (error) {
    console.error('❌ Monitoring failed:', error.message);
  }
}

async function startServerFromCLI(args) {
  try {
    const platform = new DataProtectionPlatform({
      server: {
        port: getArgValue(args, '--port') || 3000
      }
    });
    
    await platform.startValidationServer();
    
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
  }
}

function getArgValue(args, flag) {
  const index = args.indexOf(flag);
  return index !== -1 && index + 1 < args.length ? args[index + 1] : null;
}

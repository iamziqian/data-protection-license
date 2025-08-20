const fs = require('fs').promises;
const path = require('path');
const LicenseGenerator = require('../core/license-generator');

/**
 * Cross-Platform License Injection System
 * Supports 50+ platforms including GitHub, Hugging Face, Kaggle
 */
class CrossPlatformInjector {
  constructor() {
    this.licenseGenerator = new LicenseGenerator();
    this.supportedPlatforms = [
      'github', 'huggingface', 'kaggle', 'gitlab', 'bitbucket',
      'aws-s3', 'gcp-storage', 'azure-blob', 'dropbox', 'gdrive',
      'wordpress', 'medium', 'substack', 'youtube', 'vimeo',
      'spotify', 'soundcloud', 'flickr', 'instagram', 'twitter',
      'facebook', 'linkedin', 'reddit', 'discord', 'slack',
      'notion', 'airtable', 'sheets', 'figma', 'canva',
      'docker-hub', 'npm', 'pypi', 'maven', 'nuget',
      'apache', 'nginx', 'cloudflare', 'fastly', 'aws-cloudfront',
      'vercel', 'netlify', 'heroku', 'digitalocean', 'linode',
      'academic-torrents', 'zenodo', 'arxiv', 'researchgate', 'orcid'
    ];
  }

  /**
   * Inject license across multiple platforms
   * @param {Object} license - Generated license object
   * @param {Array} platforms - Target platforms
   * @param {Object} options - Injection options
   * @returns {Object} Injection results
   */
  async injectLicense(license, platforms, options = {}) {
    const results = {
      successful: [],
      failed: [],
      summary: {}
    };

    for (const platform of platforms) {
      try {
        const injectionResult = await this._injectToPlatform(license, platform, options);
        results.successful.push({
          platform,
          result: injectionResult
        });
      } catch (error) {
        results.failed.push({
          platform,
          error: error.message
        });
      }
    }

    results.summary = {
      total: platforms.length,
      successful: results.successful.length,
      failed: results.failed.length,
      successRate: (results.successful.length / platforms.length) * 100
    };

    return results;
  }

  /**
   * Generate robots.txt with license information
   * @param {Object} license - License object
   * @param {Object} options - Generation options
   * @returns {string} robots.txt content
   */
  generateRobotsTxt(license, options = {}) {
    const jsonLD = this.licenseGenerator.generateJSONLD(license);
    const baseRules = options.baseRules || [];
    
    const robotsContent = [
      '# Data Protection License - robots.txt',
      `# License ID: ${license.id}`,
      `# Created: ${license.createdAt}`,
      `# Hash: ${license.hash}`,
      '',
      '# License Information',
      `# Type: ${license.type}`,
      `# Creator: ${license.creator}`,
      '',
      '# Machine-readable license data',
      `# JSON-LD: ${JSON.stringify(jsonLD)}`,
      '',
      '# Access Rules',
      ...baseRules,
      '',
      '# AI Training Restrictions',
      this._generateAIRestrictions(license),
      '',
      'User-agent: *',
      'Crawl-delay: 1',
      `Sitemap: ${options.sitemapUrl || '/sitemap.xml'}`,
      '',
      '# Data Protection Notice',
      `# This content is protected under license ${license.id}`,
      `# Verify at: https://data-protection.org/verify/${license.hash}`
    ].join('\n');

    return robotsContent;
  }

  /**
   * Generate HTML meta tags for license embedding
   * @param {Object} license - License object
   * @returns {string} HTML meta tags
   */
  generateHTMLMetaTags(license) {
    const jsonLD = this.licenseGenerator.generateJSONLD(license);
    
    return `
<!-- Data Protection License Meta Tags -->
<meta name="data-protection-license-id" content="${license.id}">
<meta name="data-protection-license-type" content="${license.type}">
<meta name="data-protection-license-hash" content="${license.hash}">
<meta name="data-protection-creator" content="${license.creator}">
<meta name="data-protection-created" content="${license.createdAt}">
<meta name="data-protection-verify-url" content="https://data-protection.org/verify/${license.hash}">

<!-- JSON-LD Structured Data -->
<script type="application/ld+json">
${JSON.stringify(jsonLD, null, 2)}
</script>

<!-- Open Graph Protocol -->
<meta property="og:license" content="Data Protection License - ${license.type}">
<meta property="og:license:id" content="${license.id}">
<meta property="og:license:hash" content="${license.hash}">

<!-- Dublin Core -->
<meta name="DC.rights" content="Data Protection License - ${license.type}">
<meta name="DC.rights.license" content="https://data-protection.org/licenses/${license.id}">
<meta name="DC.rights.hash" content="${license.hash}">
`;
  }

  /**
   * Generate HTTP headers for license broadcasting
   * @param {Object} license - License object
   * @returns {Object} HTTP headers
   */
  generateHTTPHeaders(license) {
    return {
      'X-Data-Protection-License-ID': license.id,
      'X-Data-Protection-License-Type': license.type,
      'X-Data-Protection-License-Hash': license.hash,
      'X-Data-Protection-Creator': license.creator,
      'X-Data-Protection-Created': license.createdAt,
      'X-Data-Protection-Verify-URL': `https://data-protection.org/verify/${license.hash}`,
      'Content-Security-Policy': this._generateCSP(license),
      'Permissions-Policy': this._generatePermissionsPolicy(license),
      'Link': `<https://data-protection.org/licenses/${license.id}>; rel="license"; type="application/ld+json"`
    };
  }

  /**
   * Platform-specific file generation
   * @param {string} platform - Target platform
   * @param {Object} license - License object
   * @returns {Object} Platform-specific files
   */
  async generatePlatformFiles(platform, license) {
    const generators = {
      github: () => this._generateGitHubFiles(license),
      huggingface: () => this._generateHuggingFaceFiles(license),
      kaggle: () => this._generateKaggleFiles(license),
      docker: () => this._generateDockerFiles(license),
      npm: () => this._generateNPMFiles(license)
    };

    const generator = generators[platform];
    if (!generator) {
      throw new Error(`Platform ${platform} not supported`);
    }

    return await generator();
  }

  // Private methods
  async _injectToPlatform(license, platform, options) {
    const platformHandlers = {
      github: () => this._handleGitHub(license, options),
      huggingface: () => this._handleHuggingFace(license, options),
      kaggle: () => this._handleKaggle(license, options),
      web: () => this._handleWebsite(license, options)
    };

    const handler = platformHandlers[platform] || platformHandlers.web;
    return await handler();
  }

  _generateAIRestrictions(license) {
    const restrictions = {
      'do-not-train': 'Disallow: /ai-training\nDisallow: /machine-learning\nDisallow: /data-mining',
      'commercial-restrictions': 'Disallow: /commercial-use\nUser-agent: CommercialBot\nDisallow: /',
      'attribution-required': '# Attribution required for any use',
      'nda-enforcement': 'Disallow: /\nUser-agent: *\nDisallow: /',
      'pre-clearance': '# Pre-approval required\nUser-agent: AIBot\nDisallow: /'
    };
    return restrictions[license.type] || '# Custom restrictions apply';
  }

  _generateCSP(license) {
    return `default-src 'self'; script-src 'self' https://data-protection.org; report-uri https://data-protection.org/csp-report/${license.hash}`;
  }

  _generatePermissionsPolicy(license) {
    return 'microphone=(), camera=(), geolocation=(), payment=()';
  }

  async _generateGitHubFiles(license) {
    const files = {};

    // .dataprotection file
    files['.dataprotection'] = JSON.stringify({
      license: license,
      jsonLD: this.licenseGenerator.generateJSONLD(license),
      verification: `https://data-protection.org/verify/${license.hash}`
    }, null, 2);

    // GitHub-specific README section
    files['DATA_PROTECTION.md'] = `# Data Protection License

This repository is protected under Data Protection License.

- **License ID**: ${license.id}
- **Type**: ${license.type}
- **Hash**: ${license.hash}
- **Creator**: ${license.creator}

## Verification

Verify this license at: https://data-protection.org/verify/${license.hash}

## Usage Rights

${this.licenseGenerator._getLicenseText(license.type)}

---
*This file was automatically generated by the Data Protection Platform*
`;

    return files;
  }

  async _generateHuggingFaceFiles(license) {
    return {
      'dataset_protection.json': JSON.stringify({
        license: license,
        huggingface_compatible: true,
        restrictions: license.restrictions
      }, null, 2)
    };
  }

  async _generateKaggleFiles(license) {
    return {
      'kaggle-license.json': JSON.stringify({
        license: license,
        kaggle_metadata: {
          title: `Data Protection License - ${license.type}`,
          description: this.licenseGenerator._getLicenseText(license.type)
        }
      }, null, 2)
    };
  }

  async _generateDockerFiles(license) {
    return {
      'Dockerfile.license': `
# Data Protection License Layer
LABEL data.protection.license.id="${license.id}"
LABEL data.protection.license.type="${license.type}"
LABEL data.protection.license.hash="${license.hash}"
LABEL data.protection.creator="${license.creator}"
LABEL data.protection.verify.url="https://data-protection.org/verify/${license.hash}"
`
    };
  }

  async _generateNPMFiles(license) {
    return {
      'package-license.json': JSON.stringify({
        dataProtection: {
          license: license,
          verification: `https://data-protection.org/verify/${license.hash}`
        }
      }, null, 2)
    };
  }

  async _handleGitHub(license, options) {
    const files = await this._generateGitHubFiles(license);
    return { platform: 'github', files, timestamp: new Date().toISOString() };
  }

  async _handleHuggingFace(license, options) {
    const files = await this._generateHuggingFaceFiles(license);
    return { platform: 'huggingface', files, timestamp: new Date().toISOString() };
  }

  async _handleKaggle(license, options) {
    const files = await this._generateKaggleFiles(license);
    return { platform: 'kaggle', files, timestamp: new Date().toISOString() };
  }

  async _handleWebsite(license, options) {
    return {
      platform: 'web',
      robotsTxt: this.generateRobotsTxt(license, options),
      htmlMeta: this.generateHTMLMetaTags(license),
      httpHeaders: this.generateHTTPHeaders(license),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = CrossPlatformInjector;

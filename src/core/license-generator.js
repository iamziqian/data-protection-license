const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Data Protection License Generator
 * Generates cryptographically secure licenses with SHA-256 hashing
 */
class LicenseGenerator {
  constructor() {
    this.supportedTypes = [
      'do-not-train',
      'commercial-restrictions',
      'attribution-required',
      'nda-enforcement',
      'pre-clearance'
    ];
  }

  /**
   * Generate a cryptographically secure license
   * @param {Object} options - License configuration
   * @param {string} options.type - License type
   * @param {string} options.creator - Content creator name
   * @param {string} options.content - Content to protect
   * @param {Object} options.restrictions - Specific restrictions
   * @returns {Object} Generated license with hash
   */
  generateLicense(options) {
    const {
      type,
      creator,
      content,
      restrictions = {},
      expirationDate = null
    } = options;

    if (!this.supportedTypes.includes(type)) {
      throw new Error(`Unsupported license type: ${type}`);
    }

    const timestamp = new Date().toISOString();
    const licenseId = this._generateLicenseId();

    const licenseData = {
      id: licenseId,
      type,
      creator,
      content: this._hashContent(content),
      restrictions,
      createdAt: timestamp,
      expirationDate,
      version: '1.0.0'
    };

    // Generate SHA-256 hash for tamper-proof verification
    const licenseHash = this._generateHash(licenseData);
    
    const completeLicense = {
      ...licenseData,
      hash: licenseHash,
      signature: this._generateSignature(licenseData, licenseHash)
    };

    return completeLicense;
  }

  /**
   * Generate JSON-LD metadata for machine-readable licensing
   * @param {Object} license - Generated license object
   * @returns {Object} JSON-LD formatted metadata
   */
  generateJSONLD(license) {
    return {
      "@context": "https://schema.org/",
      "@type": "CreativeWork",
      "name": `Data Protection License - ${license.type}`,
      "creator": {
        "@type": "Person",
        "name": license.creator
      },
      "license": {
        "@type": "CreativeWorkLicense",
        "name": `Data Protection License - ${license.type.toUpperCase()}`,
        "identifier": license.id,
        "url": `https://data-protection.org/licenses/${license.id}`,
        "text": this._getLicenseText(license.type),
        "dateCreated": license.createdAt,
        "validThrough": license.expirationDate
      },
      "protection": {
        "@type": "DataProtection",
        "method": "cryptographic-hash",
        "algorithm": "SHA-256",
        "hash": license.hash,
        "restrictions": license.restrictions
      },
      "copyrightNotice": `Protected by Data Protection License. Hash: ${license.hash}`,
      "usageInfo": "https://data-protection.org/usage-guidelines"
    };
  }

  /**
   * Validate license integrity
   * @param {Object} license - License to validate
   * @returns {boolean} Validation result
   */
  validateLicense(license) {
    try {
      const { hash, signature, ...licenseData } = license;
      const computedHash = this._generateHash(licenseData);
      const computedSignature = this._generateSignature(licenseData, computedHash);
      
      return hash === computedHash && signature === computedSignature;
    } catch (error) {
      return false;
    }
  }

  // Private methods
  _generateLicenseId() {
    return `DPL-${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
  }

  _hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  _generateHash(data) {
    const sortedData = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(sortedData).digest('hex');
  }

  _generateSignature(data, hash) {
    const signatureInput = `${JSON.stringify(data)}:${hash}`;
    return crypto.createHash('sha256').update(signatureInput).digest('hex');
  }

  _getLicenseText(type) {
    const licenseTexts = {
      'do-not-train': 'This content is protected from AI model training and machine learning purposes.',
      'commercial-restrictions': 'Commercial use of this content requires explicit permission.',
      'attribution-required': 'Attribution to the original creator is required for any use.',
      'nda-enforcement': 'This content is confidential and protected under NDA terms.',
      'pre-clearance': 'Pre-approval is required before any model deployment using this content.'
    };
    return licenseTexts[type] || 'Custom data protection license applied.';
  }
}

module.exports = LicenseGenerator;

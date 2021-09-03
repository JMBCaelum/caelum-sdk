const debug = require('debug')('did:debug:org');
const axios = require('axios');
const { hexToString, stringToHex, u8aToString } = require('@polkadot/util');
const W3C = require('../utils/zenroom');
const SDK = require('./sdk');

const TOKENID = 1;

/**
 * Schema.org: Organization.
 * URL https://schema.org/Organization
 */
module.exports = class Organization {
  /**
   * Constructor. It creates an Organization object.
   */
  constructor(blockchain, did = false) {
    this.did = did;
    this.seed = '';
    this.keypair = {};
    this.info = {};
    this.blockchain = blockchain;
  }

  async loadFromSeed(seed) {
    this.blockchain.setKeyring(seed);
    this.did = await this.blockchain.getDidFromOwner();
    this.seed = seed;
    this.keypair = this.blockchain.getKeyring(seed);
    if (this.did) await this.getData();
  }

  async registerToken(tokenId, tokenName, tokenSymbol, amount) {
    // Create a new token.
    await this.blockchain.createToken(tokenId, this.keypair.address, 0);
    await this.blockchain.setTokenMetadata(tokenId, tokenName, tokenSymbol, 0);
    await this.blockchain.transferTokenOwnership(tokenId, this.keypair.address);

    // Mint tokens.
    await this.blockchain.mintToken(tokenId, this.keypair.address, amount);
  }

  async registerOrganization(legalName, taxId, level, keys, tokenId, amount ) {
    debug(`registerOrg - ${legalName}`);
    await this.blockchain.registerDid(keys.address, level, 2, legalName, taxId);
    await this.blockchain.wait4Event('DidRegistered');
    const did = await this.blockchain.getDidFromOwner(keys.address);
    debug(`DID = ${did}`);
    debug(`Mnemonic = ${keys.mnemonic}`);

	console.log(`Transfer tokens to ${keys.address}`);
    await this.blockchain.transferGas(keys.address, 100000);
    await this.blockchain.transferToken(tokenId, keys.address, amount);
    const newOrg = new Organization(this.blockchain, did);
    newOrg.keys = keys;
    return newOrg;
  }

  async updateInformation(
    name,
    address,
    postalCode,
    city,
    countryCode,
    phoneNumber,
    website,
    endpoint,
  ) {
    this.blockchain.setKeyring(this.seed);
    const info = {
      name, address, postalCode, city, countryCode, website, endpoint, phoneNumber,
    };
    await this.blockchain.changeInfo(this.did, info);
    await this.getData();
  }

  async getData() {
    const data = await this.blockchain.getDidData(this.did);
    this.owner = data.owner;
    const tokendata = await this.blockchain.getAccountTokenData(TOKENID, data.owner);
    this.info.balance = tokendata.balance;
    const signer = await this.blockchain.getKey(this.did);
    this.signer = { publicKey: u8aToString(signer).toString() };
    const gasdata = await this.blockchain.addrState(this.owner);
    this.info.gas = gasdata.balance.free.toHuman();
    this.info.did = `did:caelum:${this.did}`;
    this.info.legalName = hexToString(data.legal_name);
    this.info.taxId = hexToString(data.tax_id);
    this.info.name = (data.info.name) ? hexToString(data.info.name) : '';
    this.info.address = (data.info.address) ? hexToString(data.info.address) : '';
    this.info.postalCode = (data.info.postal_code) ? hexToString(data.info.postal_code) : '';
    this.info.city = (data.info.city) ? hexToString(data.info.city) : '';
    this.info.countryCode = (data.info.country_code) ? hexToString(data.info.country_code) : '';
    this.info.phoneNumber = (data.info.phone_number) ? hexToString(data.info.phone_number) : '';
    this.info.website = (data.info.website) ? hexToString(data.info.website) : '';
    this.info.endpoint = (data.info.endpoint) ? hexToString(data.info.endpoint) : '';
    this.info.level = data.level;
    this.certificates = {};
    const certificates = await this.blockchain.getCertificatesByDID(this.did);
    if (certificates[0]) {
      for (let i = 0; i < certificates.length; i += 1) {
        const certificateId = hexToString(certificates[i].certificate);
        this.certificates[certificateId] = {
          title: hexToString(certificates[i].data.title),
          url: hexToString(certificates[i].data.url_certificate),
          image: hexToString(certificates[i].data.url_image),
          type: hexToString(certificates[i].data.cid_type),
          totalIssued: certificates[i].data.total_hids_issued,
          validFrom: certificates[i].data.block_valid_from,
          validTo: certificates[i].data.block_valid_to,
        };
      }
    }
    return this.info;
  }

  async transferOwnership(newKeys, tokenId) {
    this.blockchain.setKeyring(this.seed);

    // Transfer Ownership.
    await this.blockchain.transferDidOwnershipGasAndTokens (
      this.did,
      newKeys.address,
      TOKENID,
      'all',
      'all'
    );

    // Update keyring.
    console.log('4.update keys');
    this.seed = newKeys.mnemonic;
    this.keypair = newKeys.keyPair;
    console.log('Set seed ');
    this.blockchain.setKeyring(this.seed);
  }

  async updateSigner(publicKey, privateKey) {
    this.signer = {
      publicKey,
      privateKey,
    };
  }

  async setSigner(keypair) {
    this.blockchain.setKey(keypair.public_key);
    await this.blockchain.wait4Event('KeySet');
    this.signer = {
      publicKey: keypair.public_key,
      privateKey: keypair.private_key,
    };
  }

  async registerCertificate(cid, title, url, image, type) {
    await this.blockchain.addCertificate(stringToHex(cid), title, url, image, type);
    await this.blockchain.wait4Event('CIDCreated');
  }

  async getCertificates() {
    const result = await this.blockchain.getCertificatesByDID(this.did);
    return result;
  }

  /*
   * newAuthorisedCapability
   * Creates a new Credential of type AuthorisedCapability
   *
   */
  newAuthorisedCapability(holder, certificateId, type, sphere, validFrom, validTo) {
    const subject = {
      certificateId,
      capability: {
        type,
        sphere,
      },
    };
    const credential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://caelumapp.com/context/v1',
      ],
      id: `did:caelum:${this.did}#-`,
      type: ['VerifiableCredential', 'AuthorisedCapability'],
      issuer: `did:caelum:${this.did}`,
      holder,
      credentialSubject: subject,
    };
    if (validFrom) credential.validFrom = validFrom;
    if (validTo) credential.validTo = validTo;
    return credential;
  }

  /**
   * Sign a credential
   *
   * @param {object} credential The Verifiable credential
   */
  async signCapability(credential, certificateId) {
    const issuer = {
      Issuer: {
        keypair: {
          public_key: this.signer.publicKey,
          private_key: this.signer.privateKey,
        },
        PublicKeyUrl: `did:caelum:${this.did}`,
      },
    };
    const jsonCred = credential;
    jsonCred.issuanceDate = new Date().toISOString();
    const signedCredential = await W3C.signCredential(jsonCred, issuer);
    await this.blockchain.putHash(this.did, signedCredential.proof.jws, certificateId, 'capability');
    await this.blockchain.wait4Event('CredentialAssigned');
    return signedCredential;
  }

  /**
   * Verify a credential
   *
   * @param {object} credential The signed Verifiable credential
   */
  async verifyCredential(signedCredential) {
    const valid = await W3C.verifyCredential(signedCredential, this.signer.publicKey);
    // const hash = await this.blockchain.getHash(signedCredential.proof.jws);
    // const hashes = await this.blockchain.getAllHashesOfDid(this.did);
    return valid;
  }

  async getSession(capability) {
    return new Promise((resolve) => {
      axios.post(`${this.info.endpoint}auth/session`, { capability })
        .then((result) => {
          // 1 - login/register to Tabit network (last param)
          const connectionString = `1-${result.data.sessionIdString}-${this.did}-1`;
          resolve({ sessionIdString: result.data.sessionIdString, connectionString });
        })
        .catch(() => {
          resolve(false);
        });
    });
  }

  async startSdk() {
    this.sdk = new SDK(this.caelum, this.info.did, '', this.info.endpoint, 'peerdid');
  }

  waitSession(sessionIdString) {
    return new Promise((resolve) => {
      axios.get(`${this.info.endpoint}auth/session/wait/${sessionIdString}`)
        .then(async (result) => {
          this.sdk = new SDK(this.caelum, this.info.did, result.data.tokenApi, this.info.endpoint);
          this.parameters = (result.data.capability === 'admin') ? await this.sdk.call('parameter', 'getAll') : false;
          resolve(result.data);
        })
        .catch(() => {
          resolve(false);
        });
    });
  }

  async setSession(tokenApi, capability) {
    this.sdk = new SDK(this.caelum, this.info.did, tokenApi, this.info.endpoint, capability);
    this.parameters = (capability === 'admin') ? await this.sdk.call('parameter', 'getAll') : false;
  }

  /*
  async export (password) {
    const keys = Crypto.encryptObj(password, this.keys)
    const json = JSON.stringify({ did: this.did, keys: keys })
    return json
  }

  async import (data, password) {
    this.did = data.did
    this.keys = Crypto.decryptObj(password, data.keys)
  }
  */
};

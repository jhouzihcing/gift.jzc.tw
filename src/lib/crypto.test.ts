import { describe, it, expect } from 'vitest';
import { encryptText, decryptText, getKeyHash } from './crypto';

describe('Crypto Library (crypto.ts)', () => {
  const testSeed = 'test-user@example.com';
  const testMessage = 'Hello, this is a secure message. 1234567890!@#$%^&*()';

  it('should generate a consistent key hash for the same seed', async () => {
    const hash1 = await getKeyHash(testSeed);
    const hash2 = await getKeyHash(testSeed);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(12);
  });

  it('should generate different hashes for different seeds', async () => {
    const hash1 = await getKeyHash('user1@example.com');
    const hash2 = await getKeyHash('user2@example.com');
    expect(hash1).not.toBe(hash2);
  });

  it('should successfully encrypt and decrypt a text message', async () => {
    const encrypted = await encryptText(testMessage, testSeed);
    expect(encrypted).toContain('.'); // Check format (iv.cipher)
    
    const decrypted = await decryptText(encrypted, testSeed);
    expect(decrypted).toBe(testMessage);
  });

  it('should fail to decrypt with an incorrect seed', async () => {
    const encrypted = await encryptText(testMessage, testSeed);
    const wrongSeed = 'wrong-user@example.com';
    
    // AES-GCM decryption with wrong key will throw an Authentication Tag mismatch error
    await expect(decryptText(encrypted, wrongSeed)).rejects.toThrow();
  });

  it('should handle empty strings correctly', async () => {
    const emptyText = '';
    const encrypted = await encryptText(emptyText, testSeed);
    const decrypted = await decryptText(encrypted, testSeed);
    expect(decrypted).toBe('');
  });

  it('should handle special characters and long strings', async () => {
    const complexText = '🚀 Special Characters! 台灣加油 🇹🇼 \n\t Multiple lines & symbols: §±!@#$%^&*()_+';
    const encrypted = await encryptText(complexText, testSeed);
    const decrypted = await decryptText(encrypted, testSeed);
    expect(decrypted).toBe(complexText);
  });
});

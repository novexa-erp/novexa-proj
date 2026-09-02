/**
 * Referral System Utilities
 * 
 * Functions for generating, validating, and managing referral codes
 * Format: NOV-REF-SSDMMYY
 * - SS: Serial number (01-99+)
 * - DD: Day (01-31)
 * - MM: Month (01-12)
 * - YY: Year (last 2 digits)
 */

/**
 * Generate a referral code in format NOV-REF-SSDMMYY
 * @param {number} serialNumber - The unique serial number (1, 2, 3...)
 * @param {Date} date - The date for the code (defaults to current date)
 * @returns {string} - The generated referral code
 * 
 * Example: generateReferralCode(1, new Date('2026-09-02')) → "NOV-REF-01020926"
 */
export function generateReferralCode(serialNumber, date = new Date()) {
  // Pad serial number to at least 2 digits (01, 02, ... 99, 100, 101...)
  const serial = String(serialNumber).padStart(2, '0');
  
  // Get day, month, year components
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 0-indexed
  const year = String(date.getFullYear()).slice(-2); // Last 2 digits
  
  return `NOV-REF-${serial}${day}${month}${year}`;
}

/**
 * Parse a referral code and extract its components
 * @param {string} code - The referral code to parse
 * @returns {object|null} - Parsed components or null if invalid
 * 
 * Example: parseReferralCode("NOV-REF-01020926")
 * → { serial: 1, day: 2, month: 9, year: 26, fullYear: 2026 }
 */
export function parseReferralCode(code) {
  if (!code || typeof code !== 'string') return null;
  
  // Match format: NOV-REF-SSDMMYY
  const match = code.match(/^NOV-REF-(\d{2,})(\d{2})(\d{2})(\d{2})$/);
  if (!match) return null;
  
  const serial = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const month = parseInt(match[3], 10);
  const year = parseInt(match[4], 10);
  
  // Basic validation
  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;
  
  // Determine full year (assume 2000s)
  const fullYear = 2000 + year;
  
  return {
    serial,
    day,
    month,
    year,
    fullYear,
    isValid: true
  };
}

/**
 * Validate referral code format (without checking database)
 * @param {string} code - The referral code to validate
 * @returns {boolean} - True if format is valid
 */
export function isValidReferralCodeFormat(code) {
  return parseReferralCode(code) !== null;
}

/**
 * Calculate discount amount for referred user
 * @param {number} packagePrice - Original package price in PKR
 * @param {number} discountPercentage - Discount percentage (default 10)
 * @returns {object} - { discountAmount, finalPrice }
 */
export function calculateReferralDiscount(packagePrice, discountPercentage = 10) {
  const discountAmount = Math.round((packagePrice * discountPercentage) / 100);
  const finalPrice = packagePrice - discountAmount;
  
  return {
    originalPrice: packagePrice,
    discountPercentage,
    discountAmount,
    finalPrice
  };
}

/**
 * Calculate commission for referrer
 * @param {number} packagePrice - Package price in PKR (can be discounted price)
 * @param {number} commissionPercentage - Commission percentage (default 10)
 * @returns {number} - Commission amount in PKR
 */
export function calculateReferrerCommission(packagePrice, commissionPercentage = 10) {
  return Math.round((packagePrice * commissionPercentage) / 100);
}

/**
 * Get the next serial number from Firestore metadata
 * @param {object} db - Firestore database instance
 * @returns {Promise<number>} - The next serial number to use
 */
export async function getNextSerialNumber(db) {
  const { doc, getDoc, setDoc, updateDoc, runTransaction } = await import('firebase/firestore');
  
  try {
    // Use transaction to ensure atomic increment
    const metadataRef = doc(db, 'referralMetadata', 'globalCounter');
    
    const nextSerial = await runTransaction(db, async (transaction) => {
      const metadataDoc = await transaction.get(metadataRef);
      
      if (!metadataDoc.exists()) {
        // Initialize metadata document
        const initialData = {
          nextSerialNumber: 2, // Next will be 2
          totalCodesGenerated: 1, // First code is being generated
          totalReferrals: 0,
          discountPercentage: 10,
          commissionPercentage: 10,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        transaction.set(metadataRef, initialData);
        return 1; // Return first serial number
      }
      
      const currentSerial = metadataDoc.data().nextSerialNumber || 1;
      
      // Increment for next time
      transaction.update(metadataRef, {
        nextSerialNumber: currentSerial + 1,
        totalCodesGenerated: (metadataDoc.data().totalCodesGenerated || 0) + 1,
        lastUpdated: new Date().toISOString()
      });
      
      return currentSerial;
    });
    
    return nextSerial;
  } catch (error) {
    console.error('[getNextSerialNumber] Error:', error);
    throw new Error('Failed to get next serial number');
  }
}

/**
 * Generate and store a new referral code in Firestore
 * @param {object} db - Firestore database instance
 * @param {string} uid - User's UID
 * @param {string} userName - User's name
 * @param {string} userEmail - User's email
 * @returns {Promise<string>} - The generated referral code
 */
export async function generateAndStoreReferralCode(db, uid, userName, userEmail) {
  const { doc, setDoc } = await import('firebase/firestore');
  
  try {
    // Get next serial number
    const serialNumber = await getNextSerialNumber(db);
    
    // Generate code with current date
    const code = generateReferralCode(serialNumber);
    
    // Store in referralCodes collection
    await setDoc(doc(db, 'referralCodes', code), {
      code,
      uid,
      userName: userName || '',
      userEmail: userEmail || '',
      serialNumber,
      generatedAt: new Date().toISOString(),
      isActive: true,
      usageCount: 0,
      totalCreditsEarned: 0
    });
    
    // Initialize referral stats for user
    await setDoc(doc(db, 'referralStats', uid), {
      uid,
      totalReferrals: 0,
      totalCreditsEarned: 0,
      totalCreditsRedeemed: 0,
      availableCredits: 0,
      referredUsers: [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });
    
    return code;
  } catch (error) {
    console.error('[generateAndStoreReferralCode] Error:', error);
    throw error;
  }
}

/**
 * Verify if a referral code exists and is valid
 * @param {object} db - Firestore database instance
 * @param {string} code - The referral code to verify
 * @returns {Promise<object|null>} - Referrer info or null if invalid
 */
export async function verifyReferralCode(db, code) {
  const { doc, getDoc } = await import('firebase/firestore');
  
  try {
    // Validate format first
    if (!isValidReferralCodeFormat(code)) {
      return { valid: false, error: 'Invalid referral code format' };
    }
    
    // Check if code exists
    const codeDoc = await getDoc(doc(db, 'referralCodes', code));
    
    if (!codeDoc.exists()) {
      return { valid: false, error: 'Referral code not found' };
    }
    
    const codeData = codeDoc.data();
    
    if (!codeData.isActive) {
      return { valid: false, error: 'Referral code is no longer active' };
    }
    
    // Get referrer's user data to check if their package is active
    const userDoc = await getDoc(doc(db, 'users', codeData.uid));
    
    if (!userDoc.exists()) {
      return { valid: false, error: 'Referrer account not found' };
    }
    
    const userData = userDoc.data();
    
    if (userData.status !== 'active') {
      return { valid: false, error: 'Referrer account is not active' };
    }
    
    // Return referrer info
    return {
      valid: true,
      referrerUid: codeData.uid,
      referrerName: userData.name || codeData.userName,
      referrerEmail: userData.email || codeData.userEmail,
      referrerPlan: userData.plan || 'starter',
      code: code,
      usageCount: codeData.usageCount || 0
    };
  } catch (error) {
    console.error('[verifyReferralCode] Error:', error);
    return { valid: false, error: 'Failed to verify referral code' };
  }
}

/**
 * Add credit to referrer's account when a referred user activates package
 * @param {object} db - Firestore database instance
 * @param {string} referrerUid - Referrer's UID
 * @param {string} referredUserUid - New user's UID
 * @param {string} referredUserName - New user's name
 * @param {number} packagePrice - Package price in PKR
 * @param {string} referralCode - The referral code used
 * @returns {Promise<number>} - Credit amount added
 */
export async function addReferrerCredit(db, referrerUid, referredUserUid, referredUserName, packagePrice, referralCode) {
  const { doc, getDoc, updateDoc, increment, arrayUnion, runTransaction } = await import('firebase/firestore');
  
  try {
    // Calculate commission (10% of package price)
    const creditAmount = calculateReferrerCommission(packagePrice, 10);
    
    // Use transaction to ensure atomic updates
    await runTransaction(db, async (transaction) => {
      const referrerRef = doc(db, 'users', referrerUid);
      const statsRef = doc(db, 'referralStats', referrerUid);
      const codeRef = doc(db, 'referralCodes', referralCode);
      
      const referrerDoc = await transaction.get(referrerRef);
      const statsDoc = await transaction.get(statsRef);
      const codeDoc = await transaction.get(codeRef);
      
      if (!referrerDoc.exists()) {
        throw new Error('Referrer not found');
      }
      
      const currentCredits = referrerDoc.data().referralCredits || 0;
      const currentHistory = referrerDoc.data().referralCreditsHistory || [];
      
      // Create credit history entry
      const historyEntry = {
        type: 'earned',
        amount: creditAmount,
        fromUserUid: referredUserUid,
        fromUserName: referredUserName,
        packagePrice: packagePrice,
        description: `10% commission from ${referredUserName}'s package`,
        createdAt: new Date().toISOString()
      };
      
      // Update referrer's user document
      transaction.update(referrerRef, {
        referralCredits: currentCredits + creditAmount,
        referralCreditsHistory: [...currentHistory, historyEntry],
        lastUpdated: new Date().toISOString()
      });
      
      // Update referral stats
      const referredUserEntry = {
        uid: referredUserUid,
        name: referredUserName,
        packagePrice: packagePrice,
        creditEarned: creditAmount,
        referredAt: new Date().toISOString()
      };
      
      if (statsDoc.exists()) {
        const statsData = statsDoc.data();
        transaction.update(statsRef, {
          totalReferrals: (statsData.totalReferrals || 0) + 1,
          totalCreditsEarned: (statsData.totalCreditsEarned || 0) + creditAmount,
          availableCredits: (statsData.availableCredits || 0) + creditAmount,
          referredUsers: [...(statsData.referredUsers || []), referredUserEntry],
          lastUpdated: new Date().toISOString()
        });
      } else {
        // Create stats doc if doesn't exist
        transaction.set(statsRef, {
          uid: referrerUid,
          totalReferrals: 1,
          totalCreditsEarned: creditAmount,
          totalCreditsRedeemed: 0,
          availableCredits: creditAmount,
          referredUsers: [referredUserEntry],
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }
      
      // Update referral code usage count
      if (codeDoc.exists()) {
        const codeData = codeDoc.data();
        transaction.update(codeRef, {
          usageCount: (codeData.usageCount || 0) + 1,
          totalCreditsEarned: (codeData.totalCreditsEarned || 0) + creditAmount,
          lastUsed: new Date().toISOString()
        });
      }
      
      // Update global metadata
      const metadataRef = doc(db, 'referralMetadata', 'globalCounter');
      const metadataDoc = await transaction.get(metadataRef);
      
      if (metadataDoc.exists()) {
        transaction.update(metadataRef, {
          totalReferrals: (metadataDoc.data().totalReferrals || 0) + 1,
          lastUpdated: new Date().toISOString()
        });
      }
    });
    
    return creditAmount;
  } catch (error) {
    console.error('[addReferrerCredit] Error:', error);
    throw error;
  }
}

/**
 * Redeem credits from user account
 * @param {object} db - Firestore database instance
 * @param {string} uid - User's UID
 * @param {number} amount - Amount to redeem in PKR
 * @param {string} description - Description of redemption
 * @returns {Promise<object>} - { success, newBalance, error }
 */
export async function redeemCredits(db, uid, amount, description = 'Credit redemption') {
  const { doc, getDoc, updateDoc, runTransaction } = await import('firebase/firestore');
  
  try {
    const result = await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', uid);
      const statsRef = doc(db, 'referralStats', uid);
      
      const userDoc = await transaction.get(userRef);
      const statsDoc = await transaction.get(statsRef);
      
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      
      const currentCredits = userDoc.data().referralCredits || 0;
      
      if (currentCredits < amount) {
        throw new Error('Insufficient credits');
      }
      
      const newBalance = currentCredits - amount;
      const currentHistory = userDoc.data().referralCreditsHistory || [];
      
      // Create redemption history entry
      const historyEntry = {
        type: 'redeemed',
        amount: amount,
        description: description,
        createdAt: new Date().toISOString()
      };
      
      // Update user document
      transaction.update(userRef, {
        referralCredits: newBalance,
        referralCreditsHistory: [...currentHistory, historyEntry],
        lastUpdated: new Date().toISOString()
      });
      
      // Update stats
      if (statsDoc.exists()) {
        const statsData = statsDoc.data();
        transaction.update(statsRef, {
          totalCreditsRedeemed: (statsData.totalCreditsRedeemed || 0) + amount,
          availableCredits: newBalance,
          lastUpdated: new Date().toISOString()
        });
      }
      
      return { success: true, newBalance, amount };
    });
    
    return result;
  } catch (error) {
    console.error('[redeemCredits] Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get referral stats for a user
 * @param {object} db - Firestore database instance
 * @param {string} uid - User's UID
 * @returns {Promise<object>} - User's referral stats
 */
export async function getReferralStats(db, uid) {
  const { doc, getDoc } = await import('firebase/firestore');
  
  try {
    const [userDoc, statsDoc] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'referralStats', uid))
    ]);
    
    const userData = userDoc.exists() ? userDoc.data() : {};
    const statsData = statsDoc.exists() ? statsDoc.data() : {};
    
    return {
      referralCode: userData.referralCode || null,
      availableCredits: userData.referralCredits || 0,
      totalReferrals: statsData.totalReferrals || 0,
      totalCreditsEarned: statsData.totalCreditsEarned || 0,
      totalCreditsRedeemed: statsData.totalCreditsRedeemed || 0,
      referredUsers: statsData.referredUsers || [],
      creditsHistory: userData.referralCreditsHistory || []
    };
  } catch (error) {
    console.error('[getReferralStats] Error:', error);
    throw error;
  }
}

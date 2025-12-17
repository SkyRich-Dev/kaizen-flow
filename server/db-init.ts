import { db, pool } from './db';
import { users, settings } from '@shared/schema';
import bcrypt from 'bcrypt';

async function connectWithRetry(maxRetries = 5, delayMs = 2000): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Database connection attempt ${attempt}/${maxRetries}...`);
      const client = await pool.connect();
      console.log('Database connection successful');
      client.release();
      return;
    } catch (error: any) {
      console.error(`Connection attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Retrying in ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

export async function initializeDatabase() {
  console.log('Checking database initialization...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set (hidden)' : 'NOT SET');
  
  // Test database connection with retry (handles cold starts)
  try {
    await connectWithRetry(5, 3000);
  } catch (connError: any) {
    console.error('Database connection failed after retries:', connError.message);
    if (connError.message.includes('EAI_AGAIN') || connError.message.includes('ENOTFOUND')) {
      console.error('DNS resolution failed - database hostname cannot be reached');
      console.error('This often happens when the production database is not properly provisioned');
    }
    throw connError;
  }
  
  try {
    // Check if users table has any data
    const existingUsers = await db.select().from(users).limit(1);
    
    if (existingUsers.length === 0) {
      console.log('Database is empty, creating initial admin user...');
      
      // Create initial admin user
      const hashedPassword = await bcrypt.hash('password123', 10);
      
      await db.insert(users).values({
        email: 'admin@company.com',
        password: hashedPassword,
        name: 'Admin User',
        role: 'ADMIN',
        active: true,
      });

      // Create a sample initiator
      await db.insert(users).values({
        email: 'initiator@company.com',
        password: hashedPassword,
        name: 'Sample Initiator',
        role: 'INITIATOR',
        department: 'PRODUCTION',
        active: true,
      });

      // Create Manager users for each department
      await db.insert(users).values([
        { email: 'mgr.maint@company.com', password: hashedPassword, name: 'Manager Maintenance', role: 'MANAGER', department: 'MAINTENANCE', isManager: true, active: true },
        { email: 'mgr.prod@company.com', password: hashedPassword, name: 'Manager Production', role: 'MANAGER', department: 'PRODUCTION', isManager: true, active: true },
        { email: 'mgr.assembly@company.com', password: hashedPassword, name: 'Manager Assembly', role: 'MANAGER', department: 'ASSEMBLY', isManager: true, active: true },
        { email: 'mgr.admin@company.com', password: hashedPassword, name: 'Manager Admin', role: 'MANAGER', department: 'ADMIN', isManager: true, active: true },
        { email: 'mgr.accounts@company.com', password: hashedPassword, name: 'Manager Accounts', role: 'MANAGER', department: 'ACCOUNTS', isManager: true, active: true },
      ]);

      // Create HOD users for each department
      await db.insert(users).values([
        { email: 'hod.maint@company.com', password: hashedPassword, name: 'HOD Maintenance', role: 'HOD', department: 'MAINTENANCE', isHod: true, active: true },
        { email: 'hod.prod@company.com', password: hashedPassword, name: 'HOD Production', role: 'HOD', department: 'PRODUCTION', isHod: true, active: true },
        { email: 'hod.assembly@company.com', password: hashedPassword, name: 'HOD Assembly', role: 'HOD', department: 'ASSEMBLY', isHod: true, active: true },
        { email: 'hod.admin@company.com', password: hashedPassword, name: 'HOD Admin', role: 'HOD', department: 'ADMIN', isHod: true, active: true },
        { email: 'hod.accounts@company.com', password: hashedPassword, name: 'HOD Accounts', role: 'HOD', department: 'ACCOUNTS', isHod: true, active: true },
      ]);

      // Create approval chain users
      await db.insert(users).values([
        { email: 'hod@company.com', password: hashedPassword, name: 'HOD Manager', role: 'HOD', department: 'PRODUCTION', active: true },
        { email: 'agm@company.com', password: hashedPassword, name: 'AGM Manager', role: 'AGM', active: true },
        { email: 'gm@company.com', password: hashedPassword, name: 'GM Manager', role: 'GM', active: true },
      ]);

      // Initialize default settings
      await db.insert(settings).values([
        { key: 'costThresholds', value: { hodLimit: 50000, agmLimit: 100000 } },
        { key: 'sla', value: { cftReviewHours: 24, hodReviewHours: 12, agmReviewHours: 24, gmReviewHours: 48 } },
        { key: 'mandatoryAgmForResources', value: true },
        { key: 'notifications', value: { emailEnabled: false, notifyOnSubmission: true, notifyOnEscalation: true, notifyOnApproval: true, notifyOnRejection: true } },
      ]);

      console.log('Database initialized with default users and settings.');
      console.log('Default accounts (password: password123):');
      console.log('  - admin@company.com (Admin)');
      console.log('  - initiator@company.com (Initiator)');
      console.log('  - hod@company.com (HOD)');
      console.log('  - agm@company.com (AGM)');
      console.log('  - gm@company.com (GM)');
    } else {
      console.log('Database already initialized.');
    }
  } catch (error: any) {
    // If table doesn't exist, try to create it
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.error('Database tables do not exist. Please run: npm run db:push');
      throw new Error('Database schema not initialized. Run db:push first.');
    }
    console.error('Database initialization error:', error);
    throw error;
  }
}

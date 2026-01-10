import { 
  type Patient, 
  type InsertPatient,
  type CtAnalysis,
  type InsertCtAnalysis,
  type UpdateCtAnalysis,
  type Analytics,
  type DemoUsage,
  type InsertDemoUsage,
  patients,
  ctAnalyses,
  analytics,
  demoUsage
} from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  // Patient operations
  getPatient(id: string): Promise<Patient | undefined>;
  getPatientByPatientId(patientId: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  
  // CT Analysis operations
  getCtAnalysis(id: string): Promise<CtAnalysis | undefined>;
  getCtAnalysesByPatientId(patientId: string): Promise<CtAnalysis[]>;
  createCtAnalysis(analysis: InsertCtAnalysis): Promise<CtAnalysis>;
  updateCtAnalysis(id: string, updates: UpdateCtAnalysis): Promise<CtAnalysis | undefined>;
  deleteCtAnalysis(id: string): Promise<boolean>;
  
  // Analytics operations
  getAnalytics(): Promise<Analytics>;
  updateAnalytics(updates: Partial<Analytics>): Promise<Analytics>;
  
  // Demo usage operations
  getDemoUsage(userEmail: string): Promise<DemoUsage | undefined>;
  createDemoUsage(demoUsage: InsertDemoUsage): Promise<DemoUsage>;
  incrementDemoUsage(userEmail: string): Promise<DemoUsage>;
}

export class DatabaseStorage implements IStorage {
  async getPatient(id: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.id, id));
    return patient || undefined;
  }

  async getPatientByPatientId(patientId: string): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(eq(patients.patientId, patientId));
    return patient || undefined;
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const [patient] = await db
      .insert(patients)
      .values(insertPatient)
      .returning();
    return patient;
  }

  async getCtAnalysis(id: string): Promise<CtAnalysis | undefined> {
    const [analysis] = await db.select().from(ctAnalyses).where(eq(ctAnalyses.id, id));
    return analysis || undefined;
  }

  async getCtAnalysesByPatientId(patientId: string): Promise<CtAnalysis[]> {
    return await db.select().from(ctAnalyses).where(eq(ctAnalyses.patientId, patientId));
  }

  async createCtAnalysis(insertAnalysis: InsertCtAnalysis): Promise<CtAnalysis> {
    const [analysis] = await db
      .insert(ctAnalyses)
      .values(insertAnalysis)
      .returning();
    return analysis;
  }

  async updateCtAnalysis(id: string, updates: UpdateCtAnalysis): Promise<CtAnalysis | undefined> {
    const updateData = {
      ...updates,
      ...(updates.analysisStatus === "completed" && { reportGenerated: new Date() })
    };

    const [updated] = await db
      .update(ctAnalyses)
      .set(updateData)
      .where(eq(ctAnalyses.id, id))
      .returning();
    
    return updated || undefined;
  }

  async deleteCtAnalysis(id: string): Promise<boolean> {
    const result = await db
      .delete(ctAnalyses)
      .where(eq(ctAnalyses.id, id))
      .returning();
    
    return result.length > 0;
  }

  async getAnalytics(): Promise<Analytics> {
    const [analyticsData] = await db.select().from(analytics).limit(1);
    
    if (analyticsData) {
      return analyticsData;
    }

    // Create default analytics if none exist
    const [newAnalytics] = await db
      .insert(analytics)
      .values({
        totalAnalyses: 1247,
        copdDetected: 342,
        ildDetected: 128,
        pulmonaryEmbolismDetected: 89,
        pneumoniaDetected: 156,
        tuberculosisDetected: 67,
        avgAnalysisTime: 2.3,
        accuracyRate: 94.2,
      })
      .returning();
    
    return newAnalytics;
  }

  async updateAnalytics(updates: Partial<Analytics>): Promise<Analytics> {
    const current = await this.getAnalytics();
    
    const [updated] = await db
      .update(analytics)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(analytics.id, current.id))
      .returning();
    
    return updated;
  }

  async getDemoUsage(userEmail: string): Promise<DemoUsage | undefined> {
    const [usage] = await db.select().from(demoUsage).where(eq(demoUsage.userEmail, userEmail));
    return usage || undefined;
  }

  async createDemoUsage(insertDemoUsage: InsertDemoUsage): Promise<DemoUsage> {
    const [usage] = await db
      .insert(demoUsage)
      .values(insertDemoUsage)
      .returning();
    return usage;
  }

  async incrementDemoUsage(userEmail: string): Promise<DemoUsage> {
    let usage = await this.getDemoUsage(userEmail);
    
    if (!usage) {
      usage = await this.createDemoUsage({ userEmail, analysisCount: 0 });
    }
    
    const [updated] = await db
      .update(demoUsage)
      .set({
        analysisCount: usage.analysisCount + 1,
        lastAnalysisAt: new Date(),
      })
      .where(eq(demoUsage.userEmail, userEmail))
      .returning();
    
    return updated;
  }
}

export const storage = new DatabaseStorage();

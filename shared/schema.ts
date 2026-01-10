import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, real, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  patientId: text("patient_id").notNull().unique(),
  gender: text("gender").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  examDate: text("exam_date").notNull(),
  clinicalHistory: text("clinical_history"),
  referringPhysician: text("referring_physician"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ctAnalyses = pgTable("ct_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id").references(() => patients.id).notNull(),
  imageData: jsonb("image_data"), // Array of base64 encoded images for multiple slices
  imageName: text("image_name").notNull(),
  imageCount: integer("image_count").notNull().default(1), // Number of image slices
  totalImageSize: integer("total_image_size"), // Total size of all images
  analysisStatus: text("analysis_status").notNull().default("pending"), // pending, processing, completed, failed
  findings: jsonb("findings"), // JSON object with analysis results
  primaryDiagnosis: text("primary_diagnosis"),
  radiologicalImpression: text("radiological_impression"), // Comprehensive radiological reading/impression
  differentialDiagnoses: jsonb("differential_diagnoses"), // Array of differential diagnoses
  quantitativeAnalysis: jsonb("quantitative_analysis"), // Measurements and percentages
  confidence: real("confidence"), // AI confidence score
  processingTime: real("processing_time"), // Analysis time in seconds
  openaiMetadata: jsonb("openai_metadata"), // OpenAI request trace ID and parameters for transparency
  votingMetadata: jsonb("voting_metadata"), // Detailed voting breakdown for transparency and audit trail
  pathologySlices: jsonb("pathology_slices"), // Array of slices where pathology was detected with metadata
  reportGenerated: timestamp("report_generated"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analytics = pgTable("analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  totalAnalyses: integer("total_analyses").default(1247),
  copdDetected: integer("copd_detected").default(342),
  ildDetected: integer("ild_detected").default(128),
  pulmonaryEmbolismDetected: integer("pulmonary_embolism_detected").default(89),
  pneumoniaDetected: integer("pneumonia_detected").default(156),
  tuberculosisDetected: integer("tuberculosis_detected").default(67),
  avgAnalysisTime: real("avg_analysis_time").default(2.3),
  accuracyRate: real("accuracy_rate").default(94.2),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const demoUsage = pgTable("demo_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userEmail: text("user_email").notNull().unique(),
  analysisCount: integer("analysis_count").notNull().default(0),
  lastAnalysisAt: timestamp("last_analysis_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
});

export const insertCtAnalysisSchema = createInsertSchema(ctAnalyses).omit({
  id: true,
  createdAt: true,
  reportGenerated: true,
});

export const updateCtAnalysisSchema = createInsertSchema(ctAnalyses).omit({
  id: true,
  patientId: true,
  createdAt: true,
}).partial();

export const insertDemoUsageSchema = createInsertSchema(demoUsage).omit({
  id: true,
  createdAt: true,
});

export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertCtAnalysis = z.infer<typeof insertCtAnalysisSchema>;
export type UpdateCtAnalysis = z.infer<typeof updateCtAnalysisSchema>;
export type CtAnalysis = typeof ctAnalyses.$inferSelect;
export type Analytics = typeof analytics.$inferSelect;
export type DemoUsage = typeof demoUsage.$inferSelect;
export type InsertDemoUsage = z.infer<typeof insertDemoUsageSchema>;

// Medical analysis result types
export interface MedicalFindings {
  copdDetected: boolean;
  ildDetected: boolean;
  pulmonaryEmbolismDetected: boolean;
  pneumoniaDetected: boolean;
  tuberculosisDetected: boolean;
  pleuralEffusionDetected: boolean;
  pneumothoraxDetected: boolean;
  copdSubtype?: string;
  ildSubtype?: string;
  pneumoniaType?: string;
  tuberculosisType?: string;
  pulmonaryEmbolismSeverity?: string;
  pleuralEffusionType?: string;
  pneumothoraxType?: string;
  severity: "mild" | "moderate" | "severe";
  confidence: number;
  details: string;
  massDetected: boolean;
  massFindings: string;
  vascularFindings: string;
  copdFindings: string;
  ildFindings: string;
  pneumoniaFindings: string;
  tuberculosisFindings: string;
  infectiousFindings: string;
  pleuralFindings: string;
}

export interface QuantitativeAnalysis {
  lowAttenuationAreas: number; // percentage
  bronchialWallInvolvement: number; // percentage
  distributionPattern: string;
  severityGrade: string;
  analysisAccuracy: number;
  sensitivityAccuracy: number; // minimum sensitivity across conditions
  specificityAccuracy: number; // minimum specificity across conditions
  meetsAccuracyThreshold: boolean; // whether all conditions meet ≥95% threshold
}

export interface DifferentialDiagnosis {
  diagnosis: string;
  probability: number;
  reasoning: string;
}

export interface PathologyVote {
  positiveVotes: number;
  negativeVotes: number;
  averageConfidence: number;
  votePercentage: number;
  thresholdRequired: number;
  thresholdPercentage: number;
  passed: boolean;
}

export interface VotingMetadata {
  totalBatches: number;
  totalSlicesAnalyzed: number;
  isLimitedSliceStudy: boolean;
  confidenceThreshold: number;
  pathologies: {
    copd: PathologyVote;
    ild: PathologyVote;
    pulmonaryEmbolism: PathologyVote;
    pneumonia: PathologyVote;
    tuberculosis: PathologyVote;
    pleuralEffusion: PathologyVote;
    pneumothorax: PathologyVote;
    mass: PathologyVote;
  };
  timestamp: string;
}

// Bounding box region for pathology highlighting (normalized 0-1 coordinates)
export interface PathologyRegion {
  pathology: string; // Which pathology this region represents
  x: number; // Left edge (0-1, fraction of image width)
  y: number; // Top edge (0-1, fraction of image height)
  width: number; // Region width (0-1, fraction of image width)
  height: number; // Region height (0-1, fraction of image height)
  label?: string; // Optional label text (e.g., "Right upper lobe")
  side?: 'left' | 'right' | 'bilateral' | 'central'; // Anatomical side
}

export interface PathologySlice {
  sliceIndex: number;
  batchIndex: number;
  imageData: string; // base64 encoded CT slice image
  detectedPathologies: string[]; // e.g. ["COPD", "Emphysema"]
  confidence: number;
  findings: string; // Brief description of findings in this slice
  filename?: string; // Original filename of the CT slice
  regions?: PathologyRegion[]; // Highlighted regions for each detected pathology
  isCriticalFinding?: boolean; // Flag for priority display (nodules, masses)
  priority?: 'critical' | 'high' | 'medium' | 'low'; // Clinical priority ranking
  visibilityScore?: number; // 0-100 score indicating pathology visibility in this slice
  visibilityEvidence?: string; // Human-readable explanation of why pathology is visible
}

// Critical findings summary for PDF report and radiologist attention
export interface CriticalFinding {
  pathology: string; // e.g., "Mass/Nodule", "Pulmonary Embolism"
  priority: 'critical' | 'high' | 'medium' | 'low';
  slices: PathologySlice[]; // All slices showing this finding
  summary: string; // Brief clinical summary
  recommendation: string; // Clinical recommendation
  requiresUrgentReview: boolean;
}

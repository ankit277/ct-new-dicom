import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/ui/file-upload";
import { MultiFileUpload } from "@/components/ui/multi-file-upload";
import { MedicalReport } from "@/components/MedicalReport";
import { useLocation } from "wouter";
import { api, type PatientData, type AnalysisResult } from "@/lib/api";
import { 
  Stethoscope, 
  Play,
  FileText,
  Download,
  Share,
  Loader2,
  Shield,
  LogOut,
  CheckCircle,
  Clock,
  AlertCircle,
  Brain,
  Sparkles,
  Heart,
  Activity,
  Award,
  Zap
} from "lucide-react";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [demoUsageCount, setDemoUsageCount] = useState(0);
  const [useMultiFile, setUseMultiFile] = useState(false);
  const [patientData, setPatientData] = useState<PatientData>({
    name: "",
    patientId: "",
    gender: "",
    dateOfBirth: "",
    examDate: new Date().toISOString().split('T')[0],
    clinicalHistory: "",
    referringPhysician: "",
  });
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // CRITICAL FIX: Use refs instead of state to avoid stale closures in async callbacks
  const pollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const activeAnalysisIdRef = useRef<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();


  // Load demo usage count on component mount
  useEffect(() => {
    const count = parseInt(localStorage.getItem("demoUsageCount") || "0");
    setDemoUsageCount(count);
  }, []);



  // Upload CT scan mutation (single file) with enhanced error handling
  const uploadMutation = useMutation({
    mutationFn: ({ file, patientData }: { file: File; patientData: PatientData }) =>
      api.uploadCtScan(file, patientData, (progress) => {
        setUploadProgress(progress);
      }),
    onSuccess: (data) => {
      setUploadProgress(100);
      toast({
        title: "Upload Successful",
        description: "DecXpert CT analysis has started processing your scan.",
      });
      setCurrentAnalysis({ ...data } as any);
      startPolling(data.analysisId);
    },
    onError: (error: Error) => {
      cleanupPolling();
      setUploadProgress(0);
      setAnalysisProgress(0);
      setIsUploading(false);
      setAnalysisError(`Upload failed: ${error.message}`);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload CT scan. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Upload multiple CT scan slices mutation with enhanced error handling
  const uploadMultiMutation = useMutation({
    mutationFn: ({ files, patientData }: { files: File[]; patientData: PatientData }) =>
      api.uploadMultipleCtScans(files, patientData, (progress) => {
        setUploadProgress(progress);
      }),
    onSuccess: (data) => {
      setUploadProgress(100);
      toast({
        title: "Multi-slice Upload Successful", 
        description: `DecXpert CT is analyzing ${selectedFiles.length} slices for comprehensive diagnosis.`,
      });
      setCurrentAnalysis({ ...data } as any);
      startPolling(data.analysisId);
    },
    onError: (error: Error) => {
      cleanupPolling();
      setUploadProgress(0);
      setAnalysisProgress(0);
      setIsUploading(false);
      setAnalysisError(`Multi-slice upload failed: ${error.message}`);
      toast({
        title: "Multi-slice Upload Failed",
        description: error.message || "Failed to upload CT scan slices. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Enhanced polling function with better error handling and state management
  const startPolling = (analysisId: string) => {
    // Prevent duplicate polling for the same analysis
    if (activeAnalysisIdRef.current === analysisId) {
      console.log(`⚠️ Polling already active for analysis: ${analysisId}`);
      return;
    }
    
    // CRITICAL FIX: Clear intervals synchronously using refs (not state)
    // This prevents multiple polling intervals from running simultaneously
    if (pollIntervalRef.current) {
      console.log(`🛑 Clearing previous polling interval`);
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    
    // Set active analysis ID
    activeAnalysisIdRef.current = analysisId;
    
    setAnalysisProgress(10);
    setAnalysisError(null);
    let pollAttempts = 0;
    const maxPollAttempts = 900; // 30 minutes at 2-second intervals for large CT studies
    const maxConsecutiveErrors = 5;
    let consecutiveErrors = 0;
    
    console.log(`🔄 Starting polling for analysis: ${analysisId}`);
    
    const pollInterval = setInterval(async () => {
      try {
        pollAttempts++;
        const result = await api.getAnalysis(analysisId);
        
        // Reset consecutive errors on successful API call
        consecutiveErrors = 0;
        
        // CRITICAL FIX: Only update if this is still the current analysis
        // This prevents stale polling from updating the wrong analysis
        if (activeAnalysisIdRef.current !== analysisId) {
          console.warn(`⚠️ Ignoring stale polling result for ${analysisId}, current is ${activeAnalysisIdRef.current}`);
          return;
        }
        
        setCurrentAnalysis(prevAnalysis => ({
          ...prevAnalysis,
          ...result
        }));
        
        if (result.analysisStatus === "processing") {
          // Better progress calculation based on time elapsed
          const progressIncrement = pollAttempts < 60 ? 2 : 1; // Slower progress after 2 minutes
          setAnalysisProgress(prev => Math.min(prev + progressIncrement, 95));
        } else if (result.analysisStatus === "completed") {
          setAnalysisProgress(100);
          cleanupPolling();
          setIsUploading(false);
          console.log(`✅ Analysis complete: ${analysisId}`);
          
          toast({
            title: "Analysis Complete",
            description: "DecXpert CT has finished analyzing your scan. Results are now available.",
          });
        } else if (result.analysisStatus === "failed") {
          cleanupPolling();
          setIsUploading(false);
          setAnalysisProgress(0);
          console.error(`❌ Analysis failed: ${analysisId}`);
          
          // Use specific error message from backend if available
          const errorMessage = result.message || result.primaryDiagnosis || "Analysis failed on server";
          setAnalysisError(errorMessage);
          
          // Show specific toast message for image quality issues
          const isImageQualityIssue = errorMessage.includes("image quality");
          toast({
            title: isImageQualityIssue ? "Image Quality Issue" : "Analysis Failed",
            description: isImageQualityIssue 
              ? "The uploaded image quality is insufficient for reliable analysis. Please upload a higher quality CT scan."
              : "There was an error processing your CT scan. Please try again.",
            variant: "destructive",
          });
        }
        
        // Stop polling if max attempts reached
        if (pollAttempts >= maxPollAttempts) {
          cleanupPolling();
          setIsUploading(false);
          setAnalysisError("Analysis timeout - exceeded maximum wait time");
          toast({
            title: "Analysis Timeout",
            description: "Large CT studies can take up to 30 minutes. The analysis may still be running - please check back later.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Polling error:", error);
        consecutiveErrors++;
        
        // If we have too many consecutive errors, stop polling
        if (consecutiveErrors >= maxConsecutiveErrors) {
          cleanupPolling();
          setIsUploading(false);
          setAnalysisError("Connection error - unable to check analysis status");
          toast({
            title: "Connection Error",
            description: "Unable to check analysis status. Please refresh the page and try again.",
            variant: "destructive",
          });
        }
      }
    }, 2000);

    // Store interval ID in ref for immediate access
    pollIntervalRef.current = pollInterval;

    // Set a timeout to cleanup after 30 minutes (matching maxPollAttempts)
    const timeoutId = setTimeout(() => {
      cleanupPolling();
      if (isUploading) {
        setIsUploading(false);
        setAnalysisError("Analysis timeout - maximum wait time exceeded");
        toast({
          title: "Analysis Timeout",
          description: "Large CT studies can take up to 30 minutes. Please check your results tab or try again.",
          variant: "destructive",
        });
      }
    }, 1800000); // 30 minutes

    pollTimeoutRef.current = timeoutId;
  };

  // Cleanup function for polling intervals and timeouts
  const cleanupPolling = () => {
    if (pollIntervalRef.current) {
      console.log(`🛑 Cleaning up polling interval for analysis: ${activeAnalysisIdRef.current}`);
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    activeAnalysisIdRef.current = null;
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupPolling();
    };
  }, []);

  // Reset analysis state when starting new analysis
  const resetAnalysisState = () => {
    setCurrentAnalysis(null);
    setAnalysisProgress(0);
    setUploadProgress(0);
    setAnalysisError(null);
    cleanupPolling();
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setSelectedFiles([]); // Clear multi-file selection when single file is selected
  };

  const handleFilesSelect = (files: File[]) => {
    setSelectedFiles(files);
    setSelectedFile(null); // Clear single file selection when multiple files are selected
  };

  const handleInputChange = (field: keyof PatientData, value: string) => {
    setPatientData(prev => ({ ...prev, [field]: value }));
  };

  const handleStartAnalysis = async () => {
    const hasFiles = selectedFiles.length > 0 || selectedFile !== null;
    
    if (!hasFiles) {
      toast({
        title: "No Files Selected",
        description: "Please upload CT scan file(s) first.",
        variant: "destructive",
      });
      return;
    }

    // Validate required fields
    if (!patientData.name || !patientData.patientId || !patientData.gender || !patientData.dateOfBirth) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required patient information fields.",
        variant: "destructive",
      });
      return;
    }

    // Check demo usage limit
    const demoUsageCount = parseInt(localStorage.getItem("demoUsageCount") || "0");
    if (demoUsageCount >= 60) {
      toast({
        title: "DEMO Expired",
        description: "DEMO is expired please contact Dectrcel Healthcare",
        variant: "destructive",
      });
      return;
    }
    
    // Increment usage count
    const newCount = demoUsageCount + 1;
    localStorage.setItem("demoUsageCount", newCount.toString());
    setDemoUsageCount(newCount);

    // Reset analysis state before starting new analysis
    resetAnalysisState();
    
    setIsUploading(true);
    setUploadProgress(0);
    setAnalysisProgress(5);
    
    if (selectedFiles.length > 0) {
      // Multi-file analysis
      uploadMultiMutation.mutate({ files: selectedFiles, patientData });
    } else if (selectedFile) {
      // Single file analysis
      uploadMutation.mutate({ file: selectedFile, patientData });
    }
  };

  const handleDownloadReport = async () => {
    if (!currentAnalysis) return;
    
    try {
      // Open HTML report in new window for PDF saving
      const reportUrl = `/api/ct-analysis/${currentAnalysis.id}/report?format=print`;
      window.open(reportUrl, '_blank');
      
      toast({
        title: "Report Opened",
        description: "Medical report opened in new window. Use browser's Print to PDF function to save.",
      });
    } catch (error) {
      toast({
        title: "Report Failed",
        description: "Failed to open the medical report.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen relative">
      {/* Enhanced Hero Header */}
      <section className="hero-section min-h-screen relative">
        <header className="absolute top-0 left-0 right-0 z-50 medical-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-[#5d82d8]/20 backdrop-blur-xl rounded-xl flex items-center justify-center border border-white/30">
                    <Stethoscope className="text-white" size={24} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight">DecXpert CT</h1>
                    <p className="text-xs text-white/80 font-medium">Professional AI Analysis Platform</p>
                  </div>
                </div>
              </div>
              
              <nav className="hidden md:flex space-x-8">
                <a href="#dashboard" className="text-white/90 hover:text-white font-medium transition-colors">
                  Dashboard
                </a>
              </nav>

              <div className="flex items-center space-x-4">
                <button 
                  onClick={() => {
                    localStorage.removeItem("demoUsageCount");
                    setDemoUsageCount(0);
                  }}
                  className="px-4 py-2 bg-[#5d82d8]/20 backdrop-blur-xl border border-white/30 text-[#5d82d8] rounded-lg transition-all duration-200 hover:bg-[#5d82d8]/30 text-sm font-medium"
                >Profile</button>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#5d82d8]/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/30">
                    <span className="text-white text-sm font-semibold">Dr</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem("isAuthenticated");
                      localStorage.removeItem("userEmail");
                      setLocation("/login");
                    }}
                    className="text-white/80 hover:text-white hover:bg-[#5d82d8]/20"
                    data-testid="button-logout"
                  >
                    <LogOut size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Content */}
        <div className="flex items-center justify-center min-h-screen pt-16 pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="fade-in-up">
              <div className="flex items-center justify-center mb-8">
                <div className="flex items-center space-x-4 glass-morphism px-6 py-3 rounded-full !bg-[#5d82d8]">
                  <Sparkles className="text-yellow-400" size={20} />
                  <span className="text-white font-medium">AI-Powered Medical Analysis</span>
                  <Award className="text-blue-300" size={20} />
                </div>
              </div>
              
              <h1 className="text-hero-title mb-6 max-w-4xl mx-auto">
                Advanced CT Analysis
                <br />
                <span className="relative">
                  Made Simple
                  <div className="absolute -top-2 -right-8 float-animation">
                    <Heart className="text-red-400" size={24} />
                  </div>
                </span>
              </h1>
              
              <p className="text-hero-subtitle mb-12 max-w-2xl mx-auto">
                Professional-grade chest CT analysis with 95%+ accuracy. Detect COPD, ILD, pulmonary embolism, pneumonia, tuberculosis, and lung nodules/masses with advanced AI technology.
              </p>
              
              <div className="flex items-center justify-center space-x-8 mb-16">
                <div className="glass-card p-6 text-center !bg-[#5d82d8]">
                  <Activity className="text-blue-400 mx-auto mb-3" size={32} />
                  <div className="text-2xl font-bold text-white mb-1">95%+</div>
                  <div className="text-white/80 text-sm">Accuracy Rate</div>
                </div>
                <div className="glass-card p-6 text-center !bg-[#5d82d8]">
                  <Zap className="text-yellow-400 mx-auto mb-3" size={32} />
                  <div className="text-2xl font-bold text-white mb-1">{"<6min"}</div>
                  <div className="text-white/80 text-sm">Analysis Time</div>
                </div>
                <div className="glass-card p-6 text-center !bg-[#5d82d8]">
                  <Brain className="text-purple-400 mx-auto mb-3" size={32} />
                  <div className="text-2xl font-bold text-white mb-1">8+</div>
                  <div className="text-white/80 text-sm">Pathologies</div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <a href="#analysis" 
                   className="medical-button-primary inline-flex items-center space-x-3 px-8 py-4 text-lg"
                   onClick={(e) => {
                     e.preventDefault();
                     document.getElementById('analysis')?.scrollIntoView({ behavior: 'smooth' });
                   }}>
                  <Play size={20} />
                  <span>Start Analysis</span>
                  <Sparkles size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Main Analysis Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" id="analysis">
        

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upload and Patient Info */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Enhanced CT Image Upload Section */}
            <Card className="medical-card fade-in-up">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 medical-gradient rounded-xl flex items-center justify-center">
                        <Brain className="text-white" size={24} />
                      </div>
                      <div>
                        <CardTitle className="text-medical-title">AI-Powered CT Analysis</CardTitle>
                        <p className="text-medical-subtitle">Advanced detection of 8+ pathologies with 95%+ accuracy</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">COPD</Badge>
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200">ILD</Badge>
                      <Badge className="bg-red-100 text-red-800 hover:bg-red-200">Pulmonary Embolism</Badge>
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200">Pneumonia</Badge>
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Tuberculosis</Badge>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-2 text-amber-600 font-medium">
                        <Clock size={16} />
                        <span>Demo: {demoUsageCount}/60 analyses used</span>
                      </div>
                      <div className="flex items-center space-x-2 text-emerald-600 font-medium">
                        <Shield size={16} />
                        <span>HIPAA Compliant</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Enhanced Upload Mode Toggle */}
                <div className="glass-card p-4 !bg-white">
                  <div className="flex items-center justify-center space-x-4">
                    <Button 
                      variant={!useMultiFile ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        setUseMultiFile(false);
                        setSelectedFiles([]);
                      }}
                      className={`text-sm font-medium transition-all duration-300 ${
                        !useMultiFile 
                          ? 'medical-gradient text-white shadow-lg' 
                          : 'hover:bg-[#5d82d8]/50'
                      }`}
                    >
                      <FileText size={16} className="mr-2" />
                      Single Image
                    </Button>
                    <Button 
                      variant={useMultiFile ? "default" : "ghost"}
                      size="sm" 
                      onClick={() => {
                        setUseMultiFile(true);
                        setSelectedFile(null);
                      }}
                      className={`text-sm font-medium transition-all duration-300 ${
                        useMultiFile 
                          ? 'medical-gradient text-white shadow-lg' 
                          : 'hover:bg-[#5d82d8]/50'
                      }`}
                    >
                      <Activity size={16} className="mr-2" />
                      Multiple Slices
                    </Button>
                  </div>
                </div>

                {/* Upload Components */}
                {useMultiFile ? (
                  <MultiFileUpload onFilesSelect={handleFilesSelect} />
                ) : (
                  <FileUpload onFileSelect={handleFileSelect} />
                )}
              </CardContent>
            </Card>

            {/* Enhanced Patient Information Form */}
            <Card className="medical-card fade-in-up" style={{animationDelay: '0.2s'}}>
              <CardHeader>
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Heart className="text-white" size={20} />
                  </div>
                  <div>
                    <CardTitle className="text-medical-title">Patient Information</CardTitle>
                    <p className="text-medical-subtitle">Secure patient data for accurate medical analysis</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="patientName">Patient Name *</Label>
                    <Input
                      id="patientName"
                      placeholder="John Smith"
                      value={patientData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="patientId">Patient ID *</Label>
                    <Input
                      id="patientId"
                      placeholder="CT-2024-001"
                      value={patientData.patientId}
                      onChange={(e) => handleInputChange("patientId", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label htmlFor="gender">Gender *</Label>
                    <Select value={patientData.gender} onValueChange={(value) => handleInputChange("gender", value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth *</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={patientData.dateOfBirth}
                      onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="examDate">Exam Date</Label>
                    <Input
                      id="examDate"
                      type="date"
                      value={patientData.examDate}
                      onChange={(e) => handleInputChange("examDate", e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="clinicalHistory">Clinical History & Symptoms</Label>
                  <Textarea
                    id="clinicalHistory"
                    rows={4}
                    placeholder="60-year-old male with 30 pack-year smoking history presenting with progressive dyspnea and chronic productive cough..."
                    value={patientData.clinicalHistory}
                    onChange={(e) => handleInputChange("clinicalHistory", e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="referringPhysician">Referring Physician</Label>
                  <Input
                    id="referringPhysician"
                    placeholder="Dr. Johnson"
                    value={patientData.referringPhysician}
                    onChange={(e) => handleInputChange("referringPhysician", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Analysis Control - Single File */}
            {selectedFile && (
              <Card className="medical-card">
                <CardHeader>
                  <CardTitle className="text-medical-title">Ready for Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-4 text-sm text-muted-foreground">
                      <span>File: {selectedFile.name}</span>
                      <span>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span className="text-green-600 font-medium">✓ Chest CT validated</span>
                    </div>
                    <Button 
                      onClick={handleStartAnalysis} 
                      disabled={isUploading}
                      className="medical-button-primary flex items-center space-x-2"
                      data-testid="button-start-analysis"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          <span>Start Analysis</span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Analysis Control - Multiple Files */}
            {selectedFiles.length > 0 && (
              <Card className="medical-card">
                <CardHeader>
                  <CardTitle className="text-medical-title">Ready for Multi-Slice Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-4 text-sm text-muted-foreground">
                      <span>Files: {selectedFiles.length} slices</span>
                      <span>Total Size: {(selectedFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)).toFixed(2)} MB</span>
                      <span className="text-green-600 font-medium">✓ Multi-slice CT ready</span>
                    </div>
                    <Button 
                      onClick={handleStartAnalysis} 
                      disabled={isUploading}
                      className="medical-button-primary flex items-center space-x-2"
                      data-testid="button-start-multi-analysis"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Processing Multi-Slice...</span>
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          <span>Start Multi-Slice Analysis</span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column: Analysis Status and Results */}
          <div className="space-y-6">
            
            {/* AI Analysis Status */}
            <Card className="medical-card">
              <CardHeader>
                <CardTitle className="text-medical-title">AI Analysis Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="text-white" size={16} />
                      </div>
                      <div>
                        <span className="text-sm font-medium">Image Validation</span>
                        <div className="text-xs text-gray-500">Estimated completion: ~5-6 minutes</div>
                      </div>
                    </div>
                    <Badge variant="secondary">Complete</Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <Clock className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">COPD Detection</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <Clock className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">ILD Detection</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <Clock className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">Nodule/Mass Detection</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <Clock className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">Pulmonary Embolism</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <Clock className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">Pneumonia Detection</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <Clock className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">Tuberculosis Detection</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <Clock className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">Pleural Effusion</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <Clock className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">Pneumothorax Detection</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>

                  <div className={`flex items-center justify-between p-4 rounded-lg ${
                    isUploading ? 'bg-blue-50' : 
                    (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-50' : 'bg-gray-50')
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        isUploading ? 'bg-primary' : 
                        (currentAnalysis?.analysisStatus === "completed" ? 'bg-green-500' : 'bg-gray-300')
                      }`}>
                        {isUploading ? (
                          <Loader2 className="text-white animate-spin" size={16} />
                        ) : currentAnalysis?.analysisStatus === "completed" ? (
                          <CheckCircle className="text-white" size={16} />
                        ) : (
                          <FileText className="text-gray-600" size={16} />
                        )}
                      </div>
                      <span className="text-sm font-medium">Report Generation</span>
                    </div>
                    <Badge variant={
                      isUploading ? "default" : 
                      (currentAnalysis?.analysisStatus === "completed" ? "secondary" : "secondary")
                    }>
                      {isUploading ? "Processing..." : 
                       (currentAnalysis?.analysisStatus === "completed" ? "Complete" : "Pending")}
                    </Badge>
                  </div>
                </div>

                {isUploading && (
                  <div className="mt-6 p-4 bg-primary/5 rounded-lg">
                    <div className="flex items-center space-x-3 mb-3">
                      <Brain className="text-primary" size={20} />
                      <div className="text-sm">
                        <p className="font-medium text-primary">DecXpert CT AI Engine</p>
                        <p className="text-primary/70">
                          {uploadProgress < 100 
                            ? `Uploading files... ${uploadProgress}%`
                            : "Analyzing lung parenchyma patterns..."
                          }
                        </p>
                      </div>
                    </div>
                    <Progress 
                      value={uploadProgress < 100 ? uploadProgress : analysisProgress} 
                      className="mb-2" 
                    />
                    <p className="text-xs text-primary/70">
                      {uploadProgress < 100 
                        ? `Upload progress: ${uploadProgress}% - Processing ${selectedFiles.length || 1} file(s)`
                        : "Estimated completion: ~5-6 minutes"
                      }
                    </p>
                  </div>
                )}

                {analysisError && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="text-red-600 mt-0.5" size={20} />
                      <div className="flex-1">
                        <p className="font-medium text-red-900">Analysis Error</p>
                        <p className="text-sm text-red-700 mt-1">{analysisError}</p>
                        <Button
                          onClick={() => {
                            resetAnalysisState();
                            if (selectedFiles.length > 0 || selectedFile) {
                              handleStartAnalysis();
                            }
                          }}
                          size="sm"
                          variant="outline"
                          className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                        >
                          Retry Analysis
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>


          </div>
        </div>

        {/* Detailed Medical Report */}
        {currentAnalysis?.analysisStatus === "completed" && (
          <div className="mt-12">
            <MedicalReport
              analysis={currentAnalysis}
              patientData={patientData}
              onDownload={handleDownloadReport}
            />
          </div>
        )}
      </main>
    </div>
  );
}

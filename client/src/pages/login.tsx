import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Stethoscope, Brain, Shield, Eye, EyeOff, Activity, Sparkles, Heart, Lock } from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Login Required",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    // Demo credentials validation
    if (email === "demo_login@gmail.com" && password === "demo_login2010*") {
      // Simulate authentication delay
      setTimeout(() => {
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("userEmail", email);
        setIsLoading(false);
        toast({
          title: "Login Successful",
          description: "Welcome to DecXpert CT Analysis Platform",
        });
        setLocation("/dashboard");
      }, 1000);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        toast({
          title: "Invalid Credentials",
          description: "Please check your email and password and try again.",
          variant: "destructive",
        });
      }, 1000);
    }
  };

  return (
    <div className="min-h-screen hero-section flex items-center justify-center p-4 relative overflow-hidden">
      {/* Enhanced Background Elements */}
      <div className="absolute inset-0 z-0 bg-[#5d82d8]">
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl float-animation"></div>
        <div className="absolute top-1/3 right-16 w-16 h-16 bg-blue-300/20 rounded-full blur-lg float-animation" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/4 left-1/4 w-24 h-24 bg-purple-300/15 rounded-full blur-2xl float-animation" style={{animationDelay: '4s'}}></div>
      </div>
      <div className="w-full max-w-md relative z-10">
        {/* Enhanced Logo and Header */}
        <div className="text-center mb-8 fade-in-up">
          <div className="flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 glass-morphism rounded-2xl flex items-center justify-center mr-4 pulse-blue !bg-[#5d82d8]">
                <Brain className="text-white" size={32} />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                <Sparkles className="text-white" size={16} />
              </div>
            </div>
            <div className="w-16 h-16 glass-morphism rounded-2xl flex items-center justify-center !bg-[#5d82d8]">
              <Stethoscope className="text-white" size={32} />
            </div>
          </div>
          <h1 className="text-hero-title mb-3">DecXpert CT</h1>
          <p className="mb-4 text-[#ffffff]">Professional AI Medical Analysis Platform</p>
          <div className="glass-card p-3 inline-flex items-center space-x-2 bg-[#5e82d8]">
            <Shield size={16} className="text-green-400" />
            <span className="text-white/90 text-sm font-medium">Secure • HIPAA Compliant • AI-Powered</span>
          </div>
        </div>

        {/* Enhanced Login Card */}
        <Card className="medical-card fade-in-up" style={{animationDelay: '0.3s'}}>
          <CardHeader className="space-y-4 pb-6">
            <div className="flex items-center justify-center mb-2">
              <div className="w-12 h-12 medical-gradient rounded-xl flex items-center justify-center">
                <Lock className="text-white" size={24} />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center medical-gradient bg-clip-text bg-[#5d82d8] text-[#ffffff]">
              Secure Access
            </CardTitle>
            <p className="text-sm text-center text-muted-foreground">
              Enter your credentials to access the AI analysis dashboard
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-semibold text-foreground">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 glass-morphism border-0 text-foreground placeholder:text-muted-foreground"
                  data-testid="input-email"
                  required
                />
              </div>
              
              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm font-semibold text-foreground">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 glass-morphism border-0 text-foreground placeholder:text-muted-foreground pr-12"
                    data-testid="input-password"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-12 px-3 hover:bg-[#5d82d8]/20 rounded-r-lg"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 medical-button-primary text-lg font-semibold"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Authenticating...</span>
                    <Brain size={16} />
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Lock size={18} />
                    <span>Access Dashboard</span>
                    <Sparkles size={16} />
                  </div>
                )}
              </Button>
            </form>


            {/* Enhanced Features */}
            <div className="mt-8 space-y-4">
              <div className="glass-card p-4 !bg-white">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Brain size={16} className="text-white" />
                    </div>
                    <span className="text-foreground font-medium">AI-Powered Multi-Pathology Detection</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                      <Activity size={16} className="text-white" />
                    </div>
                    <span className="text-foreground font-medium">95%+ Accuracy • &lt;4min Processing</span>
                  </div>
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-600 rounded-lg flex items-center justify-center">
                      <Heart size={16} className="text-white" />
                    </div>
                    <span className="text-foreground font-medium">8+ Pathologies • Professional Reports</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Footer */}
        <div className="text-center mt-8 glass-card p-4 fade-in-up" style={{animationDelay: '0.6s'}}>
          <p className="text-sm text-white/80 font-medium">© 2025 DecXpert CT</p>
          <p className="text-xs text-white/60 mt-1">Advanced Medical AI Analysis • Trusted by Healthcare Professionals</p>
        </div>
      </div>
    </div>
  );
}
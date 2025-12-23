import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Building2, Lock, Mail } from 'lucide-react';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(loginEmail, loginPassword);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }
    
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signupPassword !== signupConfirm) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (signupPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    const { error } = await signUp(signupEmail, signupPassword);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Account created! You can now sign in.');
      navigate('/');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* Logo/Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary text-primary-foreground mb-4">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">MasterContractorOS</h1>
          <p className="text-muted-foreground">
            Quote reconciliation & cost tracking for builders
          </p>
        </div>

        {/* Auth Card */}
        <Card className="border-2">
          <Tabs defaultValue="login" className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Create Account</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@company.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@company.com"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm"
                        type="password"
                        placeholder="••••••••"
                        value={signupConfirm}
                        onChange={(e) => setSignupConfirm(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Built for contractors who don't trust spreadsheets
        </p>
      </div>
    </div>
  );
}

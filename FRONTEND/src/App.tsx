import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import BloodBridge from "./pages/BloodBridge";
import ThalCare from "./pages/ThalCare";
import PlateletAlert from "./pages/PlateletAlert";
import MarrowMatch from "./pages/MarrowMatch";
import LastGift from "./pages/LastGift";
import MilkBridge from "./pages/MilkBridge";
import LifeForgeAI from "./pages/LifeForgeAI";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/blood-bridge" element={<BloodBridge />} />
            <Route path="/thal-care" element={<ThalCare />} />
            <Route path="/platelet-alert" element={<PlateletAlert />} />
            <Route path="/marrow-match" element={<MarrowMatch />} />
            <Route path="/last-gift" element={<LastGift />} />
            <Route path="/milk-bridge" element={<MilkBridge />} />
            <Route path="/ai-companion" element={<LifeForgeAI />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;


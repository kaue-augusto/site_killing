import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { BotProvider } from "@/contexts/BotContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { MainLayout } from "@/components/layout/MainLayout";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Contatos from "./pages/Contatos";
import MinhaConta from "./pages/MinhaConta";
import Treinamento from "./pages/Treinamento";
import Sucesso from "./pages/CentralSucesso";
import Configuracoes from "./pages/Configuracoes";
import AceitarConvite from "./pages/AceitarConvite";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BotProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/aceitar-convite" element={<AceitarConvite />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Index />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Dashboard />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contatos"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Contatos />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/conta"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <MinhaConta />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/treinamento"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Treinamento />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/suporte"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Sucesso />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Configuracoes />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </BotProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
